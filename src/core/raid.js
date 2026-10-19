import raidCfg from '../config/raid.json';
import { state } from './state.js';
import * as economy from './economy.js';
import { raidTimerRate, raidLossMultiplier } from './modifiers.js';

// ระบบศัตรูบุกรัง (ตรรกะล้วน ไม่แตะกราฟิก): ศัตรูเดินมาที่ปากทางลง นักรบสู้ ถ้าชนะได้รางวัล ถ้าสู้ไม่ทันถูกขโมยอาหารบางส่วน
// ภาพศัตรู/นักรบอ่านสถานะจาก raid.active (ดู scene/raid.js) ส่วน UI ฟัง events ที่ update() คืนมา

export const raid = { active: null };

export const ENEMY_ORDER = ['termite', 'beetle', 'spider', 'centipede'];

// องค์ประกอบของคลื่นที่ wave (เริ่มที่ 1): จำนวนศัตรูแต่ละชนิด (มีเพดานไม่ให้ล้นจอ ยิ่งสูงยิ่งเพิ่มเลือดแทน)
export function waveComposition(wave) {
  return {
    termite: Math.min(10, 2 + Math.floor(wave * 0.9)),
    beetle: wave >= 3 ? Math.min(8, Math.floor((wave - 1) * 0.7)) : 0,
    spider: wave >= 6 ? Math.min(6, Math.floor((wave - 4) * 0.5)) : 0,
    centipede: wave % 5 === 0 ? Math.min(4, wave / 5) : 0,
  };
}

// เลือดศัตรูทุกชนิด = ฐาน × hpBaseMul แล้วหลังคลื่นที่ hpGrowthAfterWave คูณเพิ่มเป็นเท่าตัวต่อคลื่น (hpGrowthRate)
// เพราะจำนวนศัตรูถึงเพดานแล้ว ความยากต้องมาจากเลือดที่โตเร็วเท่ากับเศรษฐกิจของผู้เล่น
export function hpScale(wave) {
  return raidCfg.hpBaseMul * Math.pow(raidCfg.hpGrowthRate, Math.max(0, wave - raidCfg.hpGrowthAfterWave));
}

export function buildEnemies(wave) {
  const comp = waveComposition(wave);
  const scale = hpScale(wave);
  const list = [];
  // ตัวใหญ่ยืนหน้าสุด (คิวสู้): ตะขาบ → แมงมุม → ด้วง → ปลวก
  for (const type of [...ENEMY_ORDER].reverse()) {
    for (let i = 0; i < comp[type]; i++) {
      const base = raidCfg.enemies[type];
      const hp = base.hp * scale;
      list.push({ type, hp, maxHp: hp, atk: base.atk, alive: true });
    }
  }
  return list;
}

export function totalHp(wave) {
  return buildEnemies(wave).reduce((a, e) => a + e.maxHp, 0);
}

const randomInterval = (rand) => raidCfg.intervalSec[0] + rand() * (raidCfg.intervalSec[1] - raidCfg.intervalSec[0]);

// เริ่มการบุกคลื่นที่ state.raid.wave + 1 (คลื่นเดิมซ้ำจนกว่าจะชนะ ไม่ให้เกมยากขึ้นเรื่อย ๆ จากการแพ้)
export function startRaid() {
  const wave = state.raid.wave + 1;
  const enemies = buildEnemies(wave);
  raid.active = {
    wave,
    phase: 'approach', // approach → fight → (victory | retreat) → จบ
    t: 0,
    fightT: 0,
    enemies,
    maxHp: enemies.reduce((a, e) => a + e.maxHp, 0),
    startFood: state.food,
    loss: 0,
    outcome: null,
    reward: null,
  };
  return raid.active;
}

export function aliveCount(a = raid.active) {
  return a ? a.enemies.filter((e) => e.alive).length : 0;
}

export function remainingHp(a = raid.active) {
  return a ? a.enemies.reduce((s, e) => s + (e.alive ? e.hp : 0), 0) : 0;
}

// เดินเวลา: นับถอยหลังคลื่นถัดไป / ดำเนินการสู้ คืนรายการเหตุการณ์ที่เกิดในเฟรมนี้
export function update(dt, rand = Math.random) {
  const events = [];
  const a = raid.active;

  if (!a) {
    state.raid.nextIn -= dt * raidTimerRate(); // ลมแรงทำให้ศัตรูมาเร็วขึ้น
    if (state.raid.nextIn <= 0) {
      startRaid();
      events.push({ type: 'start', wave: raid.active.wave });
    }
    return events;
  }

  a.t += dt;

  if (a.phase === 'approach') {
    if (a.t >= raidCfg.approachSec) {
      a.phase = 'fight';
      a.t = 0;
      events.push({ type: 'phase', phase: 'fight' });
    }
    return events;
  }

  if (a.phase === 'fight') {
    a.fightT += dt;

    // นักรบโจมตีศัตรูตามลำดับคิว (ตัวหน้าสุดก่อน)
    let dmg = economy.defensePower() * raidCfg.dpsPerPower * dt;
    if (dmg > 0) events.push({ type: 'hit', damage: dmg });
    for (let i = 0; i < a.enemies.length && dmg > 0; i++) {
      const e = a.enemies[i];
      if (!e.alive) continue;
      const d = Math.min(e.hp, dmg);
      e.hp -= d;
      dmg -= d;
      if (e.hp <= 1e-9) {
        e.alive = false;
        e.hp = 0;
        events.push({ type: 'kill', index: i, enemy: e.type });
      }
    }

    // ศัตรูที่ยังเหลือขโมยอาหาร (สัดส่วนของอาหารตอนเริ่มบุก) แต่รวมไม่เกิน maxLossFrac
    const atk = a.enemies.reduce((s, e) => s + (e.alive ? e.atk : 0), 0);
    if (atk > 0 && a.startFood > 0) {
      const cap = a.startFood * raidCfg.maxLossFrac - a.loss;
      const want = a.startFood * raidCfg.stealFracPerAtkPerSec * atk * dt * raidLossMultiplier();
      const lost = economy.loseFood(Math.min(want, Math.max(cap, 0)));
      if (lost > 0) {
        a.loss += lost;
        events.push({ type: 'steal', amount: lost });
      }
    }

    if (aliveCount(a) === 0) {
      a.phase = 'victory';
      a.t = 0;
      a.outcome = 'won';
      const food = Math.max(raidCfg.rewardMinFood, economy.foodPerSec() * raidCfg.rewardIncomeSec);
      const eggs = raidCfg.eggsPerWin[0] + Math.floor(rand() * (raidCfg.eggsPerWin[1] - raidCfg.eggsPerWin[0] + 1));
      const gained = economy.creditFood(food);
      state.eggs += eggs;
      a.reward = { food: gained, eggs };
      state.raid.wave = a.wave;
      state.raid.won += 1;
      state.raid.nextIn = randomInterval(rand);
      events.push({ type: 'win', wave: a.wave, reward: a.reward, loss: a.loss });
    } else if (a.fightT >= raidCfg.fightTimeoutSec) {
      // สู้ไม่ทัน: ศัตรูคว้าของติดมือถอยไป รวมแล้วเสียอย่างน้อย defeatLootFrac ของอาหารตอนเริ่มบุก (แพ้แล้วต้องเจ็บกว่าชนะ)
      const floor = Math.min(a.startFood * raidCfg.defeatLootFrac, a.startFood * raidCfg.maxLossFrac) * raidLossMultiplier();
      if (a.loss < floor) {
        const extra = economy.loseFood(floor - a.loss);
        a.loss += extra;
        if (extra > 0) events.push({ type: 'steal', amount: extra });
      }
      a.phase = 'retreat';
      a.t = 0;
      a.outcome = 'lost';
      state.raid.lost += 1;
      state.raid.nextIn = randomInterval(rand);
      events.push({ type: 'lose', wave: a.wave, loss: a.loss });
    }
    return events;
  }

  // victory / retreat: ให้ภาพเล่นฉากจบสั้น ๆ แล้วปิดการบุก
  if (a.t >= 2.5) {
    raid.active = null;
    events.push({ type: 'end' });
  }
  return events;
}

// ยกเลิกการบุกที่กำลังเกิด (ใช้ตอนโหลดเกม/รีเซ็ต) และตั้งเวลารอบถัดไป
export function cancel(delay = raidCfg.retryDelaySec) {
  raid.active = null;
  state.raid.nextIn = Math.max(state.raid.nextIn, delay);
}
