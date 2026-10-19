import { state as S } from '../core/state.js';
import * as E from '../core/economy.js';
import * as EV from '../core/events.js';
import * as R from '../core/research.js';
import * as RC from '../core/raid.js';
import * as P from '../core/prestige.js';
import * as M from '../core/modifiers.js';
import * as eggs from '../core/eggs.js';
import { seededRand } from '../core/rng.js';
import cfg from '../config/economy.json';
import rcfg from '../config/raid.json';

// เครื่องมือพัฒนาเท่านั้น (ไม่ถูกรวมในไฟล์ build): จำลองการเล่นเต็มระบบแบบเร่งเวลา เพื่อตรวจบาลานซ์
// นโยบายผู้เล่นจำลอง: คลิกตามโปรไฟล์ ซื้อของตามอัตราส่วนคุ้มค่า รักษาพลังป้องกันให้พอกับคลื่นถัดไป ใช้สกิล เก็บผลเบอร์รี่ทอง วิจัยตามลำดับ
export function fullSim({
  minutes = 90,
  profile = { clicksActive: 3, clicksIdle: 0.3, activeSec: 180 },
  seed = 1,
  prestigeAtMin = null,
  goldenCatch = 0.8,
  report = 10,
  keepMeta = false,
  defenseFactor = 1, // 1 = ซื้อนักรบให้พอดีกับคลื่นถัดไป, 0.5 = ลงทุนป้องกันแค่ครึ่งเดียว (ดูผลของการประมาท)
} = {}) {
  const rand = seededRand(seed);
  if (!keepMeta) {
    S.prestige = { jelly: 0, count: 0 };
    S.research = { done: {}, active: null };
    S.upgrades.lab = 0;
    S.upgrades.queenSkills = 0;
  }
  S.food = 0;
  S.totalFood = 0;
  S.wasted = 0;
  S.workers = 0;
  S.warriors = 0;
  S.clicks = 0;
  for (const k of Object.keys(S.upgrades)) if (k !== 'lab' && k !== 'queenSkills') S.upgrades[k] = 0;
  S.eggs = cfg.eggs.startEggs;
  S.eggProgress = 0;
  S.totalHatched = 0;
  for (const k of Object.keys(S.ants)) S.ants[k] = 0;
  for (const k of Object.keys(S.firstHatch)) S.firstHatch[k] = null;
  for (const k of Object.keys(S.pity)) S.pity[k] = 0;
  S.raid = { wave: 0, won: 0, lost: 0, nextIn: rcfg.firstDelaySec };
  S.missions = { claimed: {} };
  S.stats = { golden: 0, skills: 0 };
  RC.raid.active = null;
  M.resetTransient();
  EV.init(rand);

  const log = [];
  let raidLoss = 0;
  let raidsSeen = 0;
  let warriorSpend = 0;
  let researchSpend = 0;
  let storageSpend = 0;
  let goldenGot = 0;
  let prestiged = false;
  const firstTimes = {};
  const mark = (k, t) => {
    if (firstTimes[k] === undefined) firstTimes[k] = +(t / 60).toFixed(1);
  };
  const ids = ['worker', 'clickPower', 'antSpeed', 'fungusRoom'];
  const cost = (id) => (id === 'worker' ? E.workerCost() : E.upgradeCost(id));
  const canBuy = (id) => (id === 'worker' ? true : !E.isMaxed(id));
  const apply = (id, d) => {
    if (id === 'worker') S.workers += d;
    else S.upgrades[id] += d;
  };
  const researchOrder = ['eco1', 'brd1', 'def1', 'eco2', 'brd2', 'def2', 'eco3', 'brd3', 'def3'];
  const lossByWave = [];

  for (let t = 1; t <= minutes * 60; t++) {
    const cr = t <= profile.activeSec ? profile.clicksActive : profile.clicksIdle;
    E.creditFood(cr * E.clickPower());
    S.clicks += cr;
    E.earnPassive(1);
    E.tick(1);
    EV.update(1, rand);
    if (EV.golden.active && rand() < goldenCatch * 0.5) {
      EV.collectGolden(rand);
      goldenGot++;
    }
    for (const ev of RC.update(1, rand)) {
      if (ev.type === 'steal') raidLoss += ev.amount;
      if (ev.type === 'start') raidsSeen++;
      if (ev.type === 'win') mark('firstWin', t);
      if (ev.type === 'lose') lossByWave.push(ev.wave);
    }
    R.update(1);
    while (S.eggs >= 1) eggs.hatchOne(rand);
    if (E.upgradeLevel('queenSkills') > 0) {
      if (EV.skillReady('eggBurst')) EV.useSkill('eggBurst');
      if (EV.skillReady('frenzy') && E.foodPerSec() > 20) EV.useSkill('frenzy');
      if (RC.raid.active && RC.raid.active.phase === 'fight' && EV.skillReady('rally')) EV.useSkill('rally');
    }

    for (let g = 0; g < 250; g++) {
      const inc = E.foodPerSec();
      const cap = E.foodCapacity();
      const w = S.raid.wave + 1;
      const needPow = (RC.totalHp(w) / (rcfg.dpsPerPower * 18)) * defenseFactor;
      if ((RC.raid.active || S.raid.nextIn < 100) && E.defensePower() < needPow && E.warriorCost() <= S.food && E.warriorCost() <= cap) {
        warriorSpend += E.warriorCost();
        E.buyWarrior();
        continue;
      }
      if (S.warriors >= 6 && !E.isMaxed('barracks') && E.upgradeCost('barracks') <= Math.min(cap, S.food) && E.upgradeCost('barracks') <= 250 * Math.max(inc, 1)) {
        E.buyUpgrade('barracks');
        mark('barracks' + E.upgradeLevel('barracks'), t);
        continue;
      }
      const sc = E.upgradeCost('storage');
      let best = null;
      const base = inc + cr * E.clickPower();
      for (const id of ids) {
        if (!canBuy(id)) continue;
        const c = cost(id);
        apply(id, 1);
        const d = E.foodPerSec() + cr * E.clickPower() - base;
        apply(id, -1);
        const ratio = d / c;
        if (!best || ratio > best.ratio) best = { id, c, ratio };
      }
      const needStorage = !E.isMaxed('storage') && ((best && best.c > cap * 0.98) || S.food >= cap * 0.9);
      if (needStorage && S.food >= sc && sc <= cap) {
        storageSpend += sc;
        E.buyUpgrade('storage');
        mark('storage' + E.upgradeLevel('storage'), t);
        continue;
      }
      let did = false;
      for (const [id, k] of [['luck', 150], ['eggSpeed', 150], ['lab', 200], ['queenSkills', 300]]) {
        if (!E.isMaxed(id) && E.upgradeCost(id) <= Math.min(cap, S.food) && E.upgradeCost(id) <= k * Math.max(inc, 1)) {
          E.buyUpgrade(id);
          mark(id + E.upgradeLevel(id), t);
          did = true;
          break;
        }
      }
      if (did) continue;
      if (R.labUnlocked() && !S.research.active) {
        const nxt = researchOrder.find((id) => R.nodeStatus(id) === 'available');
        if (nxt) {
          const n = R.nodes().find((x) => x.id === nxt);
          if (n.cost <= Math.min(cap, S.food) && n.cost <= 400 * Math.max(inc, 1)) {
            researchSpend += n.cost;
            R.start(nxt);
            mark('res_' + nxt, t);
            continue;
          }
        }
      }
      if (best && best.ratio > 0 && best.c <= cap && S.food >= best.c) {
        S.food -= best.c;
        apply(best.id, 1);
        continue;
      }
      break;
    }
    if (prestigeAtMin && !prestiged && t >= prestigeAtMin * 60 && P.canPrestige()) {
      prestiged = true;
      P.perform();
      mark('prestige', t);
    }
    if (t % (report * 60) === 0) {
      log.push(
        `${t / 60}m: ${S.workers}w ${S.warriors}war pow ${E.defensePower().toFixed(0)} inc ${E.foodPerSec().toFixed(0)}/s cap ${E.foodCapacity()} rooms ${S.upgrades.storage} ` +
          `wave ${S.raid.wave} W${S.raid.won}/L${S.raid.lost} res ${R.doneCount()} luck ${S.upgrades.luck} hatched ${S.totalHatched} total ${Math.round(S.totalFood)} ` +
          `jellyGain ${P.jellyGain()} wasted ${((S.wasted / (S.totalFood + S.wasted + 1)) * 100).toFixed(0)}%`,
      );
    }
  }
  return {
    log,
    firstTimes,
    raidsSeen,
    lostWaves: lossByWave,
    raidLossPctOfTotal: +((raidLoss / Math.max(S.totalFood, 1)) * 100).toFixed(2),
    spendShare: {
      warriors: +((warriorSpend / Math.max(S.totalFood, 1)) * 100).toFixed(1) + '%',
      research: +((researchSpend / Math.max(S.totalFood, 1)) * 100).toFixed(1) + '%',
      storage: +((storageSpend / Math.max(S.totalFood, 1)) * 100).toFixed(1) + '%',
    },
    goldenGot,
    finalTotal: Math.round(S.totalFood),
  };
}
