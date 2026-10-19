import { state } from '../core/state.js';
import {
  foodPerSec,
  workerCost,
  workerYield,
  canBuyWorker,
  upgradeLevel,
  upgradeMax,
  upgradeCost,
  canBuyUpgrade,
  isMaxed,
  clickPower,
  speedMultiplier,
  fungusMultiplier,
  eggInterval,
  luckMultiplier,
  perAntRate,
  storedAntsRaw,
  storedAntsIncome,
  storedAntsEfficiency,
  foodCapacity,
  exceedsCapacity,
  warriorCost,
  canBuyWarrior,
  defensePower,
  barracksMultiplier,
} from '../core/economy.js';
import { odds, pityLimit } from '../core/rng.js';
import { buffs, activeWeather, jellyIncomeBonus, cooldownMultiplier } from '../core/modifiers.js';
import { cooldowns, skillList, skillUnlocked } from '../core/events.js';
import * as research from '../core/research.js';
import * as prestige from '../core/prestige.js';
import prestigeCfg from '../config/prestige.json';
import { raid, remainingHp, aliveCount, totalHp, waveComposition, ENEMY_ORDER } from '../core/raid.js';
import { activeMissions, claimableCount, totalMissions, claimedCount, rewardAmounts } from '../core/missions.js';
import cfg from '../config/economy.json';
import antCfg from '../config/ants.json';
import raidCfg from '../config/raid.json';
import { formatNum, formatDuration } from '../util/format.js';

const $ = (id) => document.getElementById(id);
const x2 = (n) => n.toFixed(2);
const pct = (p) => {
  const v = p * 100;
  return v.toFixed(v >= 10 ? 1 : 2) + '%';
};
const TOP = antCfg.types.length - 1; // ระดับหายากสุด

// ตัวหนังสือบนสีพื้น: ขาวหรือเข้มตามความสว่างของสี
function inkOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 160 ? '#3a2314' : '#ffffff';
}

// รายการในร้านค้า: ข้อความทั้งหมดอยู่ที่นี่ ส่วนตัวเลข/สูตรอยู่ใน core + config
const ROWS = [
  {
    id: 'worker',
    icon: '🐜',
    name: 'มดงาน',
    level: () => '×' + formatNum(state.workers),
    desc: () => `หาอาหารเอง +${x2(workerYield())} / วินาที ต่อตัว`,
    cost: () => workerCost(),
    can: () => canBuyWorker(),
    maxed: () => false,
  },
  {
    id: 'warrior',
    icon: '🛡️',
    name: 'มดนักรบ',
    level: () => '×' + formatNum(state.warriors),
    desc: () => `ป้องกันรังจากศัตรู พลัง ${x2(cfg.warriors.power * barracksMultiplier())} ต่อตัว (ไม่เก็บอาหาร)`,
    cost: () => warriorCost(),
    can: () => canBuyWarrior(),
    maxed: () => false,
  },
  {
    id: 'storage',
    icon: '📦',
    name: 'ขยายคลังอาหาร',
    level: () => `${upgradeLevel('storage')}/${upgradeMax('storage')} ห้อง`,
    desc: () =>
      isMaxed('storage')
        ? `ความจุ ${formatNum(foodCapacity())} (สูงสุด)`
        : `ความจุ ${formatNum(foodCapacity())} → ${formatNum(foodCapacity(upgradeLevel('storage') + 1))}`,
    cost: () => upgradeCost('storage'),
    can: () => canBuyUpgrade('storage'),
    maxed: () => isMaxed('storage'),
  },
  {
    id: 'barracks',
    icon: '🏰',
    name: 'ค่ายนักรบ',
    level: () => `Lv.${upgradeLevel('barracks')}/${upgradeMax('barracks')}`,
    desc: () =>
      isMaxed('barracks')
        ? `พลังนักรบ ×${x2(barracksMultiplier())} (สูงสุด)`
        : `พลังนักรบ ×${x2(barracksMultiplier())} → ×${x2(barracksMultiplier(upgradeLevel('barracks') + 1))}`,
    cost: () => upgradeCost('barracks'),
    can: () => canBuyUpgrade('barracks'),
    maxed: () => isMaxed('barracks'),
  },
  {
    id: 'clickPower',
    icon: '👆',
    name: 'พลังคลิก',
    level: () => 'Lv.' + upgradeLevel('clickPower'),
    desc: () => `อาหารต่อคลิก ${clickPower()} → ${clickPower(upgradeLevel('clickPower') + 1)}`,
    cost: () => upgradeCost('clickPower'),
    can: () => canBuyUpgrade('clickPower'),
    maxed: () => isMaxed('clickPower'),
  },
  {
    id: 'antSpeed',
    icon: '⚡',
    name: 'ความเร็วมด',
    level: () => `Lv.${upgradeLevel('antSpeed')}/${upgradeMax('antSpeed')}`,
    desc: () =>
      isMaxed('antSpeed')
        ? `รายได้มดงาน ×${x2(speedMultiplier())} (สูงสุด)`
        : `รายได้มดงาน ×${x2(speedMultiplier())} → ×${x2(speedMultiplier(upgradeLevel('antSpeed') + 1))}`,
    cost: () => upgradeCost('antSpeed'),
    can: () => canBuyUpgrade('antSpeed'),
    maxed: () => isMaxed('antSpeed'),
  },
  {
    id: 'eggSpeed',
    icon: '🥚',
    name: 'ราชินีวางไข่เร็วขึ้น',
    level: () => `Lv.${upgradeLevel('eggSpeed')}/${upgradeMax('eggSpeed')}`,
    desc: () =>
      isMaxed('eggSpeed')
        ? `ไข่ทุก ${eggInterval().toFixed(1)} วินาที (สูงสุด)`
        : `ไข่ทุก ${eggInterval().toFixed(1)} → ${eggInterval(upgradeLevel('eggSpeed') + 1).toFixed(1)} วินาที`,
    cost: () => upgradeCost('eggSpeed'),
    can: () => canBuyUpgrade('eggSpeed'),
    maxed: () => isMaxed('eggSpeed'),
  },
  {
    id: 'luck',
    icon: '🍀',
    name: 'ห้องบ่มไข่ (Luck)',
    level: () => `Lv.${upgradeLevel('luck')}/${upgradeMax('luck')}`,
    // ระดับ 1 ปลดล็อกห้องบ่มไข่ในรัง ระดับถัดไปเพิ่มตู้ฟักและโอกาสได้มดหายาก
    desc: () => {
      const now = pct(odds(luckMultiplier())[TOP]);
      const name = antCfg.types[TOP].rarity;
      return isMaxed('luck')
        ? `โอกาส ${name} ${now} (สูงสุด)`
        : `โอกาส ${name} ${now} → ${pct(odds(luckMultiplier(upgradeLevel('luck') + 1))[TOP])}`;
    },
    cost: () => upgradeCost('luck'),
    can: () => canBuyUpgrade('luck'),
    maxed: () => isMaxed('luck'),
  },
  {
    id: 'lab',
    icon: '🔬',
    name: 'ห้องวิจัย',
    level: () => (isMaxed('lab') ? '✓' : ''),
    desc: () => (isMaxed('lab') ? 'เปิดแท็บ 🔬 วิจัยแล้ว (อยู่ถาวรแม้ก่อตั้งอาณานิคมใหม่)' : 'ปลดล็อกต้นไม้งานวิจัย 9 หัวข้อ (ถาวร)'),
    cost: () => upgradeCost('lab'),
    can: () => canBuyUpgrade('lab'),
    maxed: () => isMaxed('lab'),
  },
  {
    id: 'queenSkills',
    icon: '👑',
    name: 'สกิลราชินี',
    level: () => `Lv.${upgradeLevel('queenSkills')}/${upgradeMax('queenSkills')}`,
    desc: () => {
      const next = skillList()[upgradeLevel('queenSkills')];
      return next ? `ปลดล็อก: ${next.icon} ${next.name} — ${next.desc}` : 'ปลดล็อกสกิลครบแล้ว (ถาวร)';
    },
    cost: () => upgradeCost('queenSkills'),
    can: () => canBuyUpgrade('queenSkills'),
    maxed: () => isMaxed('queenSkills'),
  },
  {
    id: 'fungusRoom',
    icon: '🍄',
    name: 'ห้องฟาร์มเชื้อรา',
    level: () => (isMaxed('fungusRoom') ? '✓' : ''),
    desc: () =>
      isMaxed('fungusRoom')
        ? `เปิดใช้งานแล้ว: รายได้มดงาน ×${x2(fungusMultiplier())}`
        : `ขุดห้องใหม่ รายได้มดงาน ×${x2(cfg.upgrades.fungusRoom.multiplier)}`,
    cost: () => upgradeCost('fungusRoom'),
    can: () => canBuyUpgrade('fungusRoom'),
    maxed: () => isMaxed('fungusRoom'),
  },
];

// ผูก DOM กับสถานะเกม: อัปเดตข้อความเฉพาะตอนค่าเปลี่ยนจริง
export function createHud({
  onBuy,
  onReset,
  onHatchOne,
  onHatchAll,
  onClaim = () => {},
  onSkill = () => {},
  onResearch = () => {},
  onPrestige = () => {},
  onLayout = () => {},
  portraits = {},
}) {
  const els = {
    chips: $('chips'),
    skills: $('skills'),
    weatherTint: $('weather-tint'),
    tabResearch: $('tab-research'),
    paneResearch: $('pane-research'),
    researchProgress: $('research-progress'),
    researchBar: $('research-bar'),
    researchActive: $('research-active'),
    researchList: $('research-list'),
    prestigeCard: $('prestige-card'),
    welcomeResearch: $('welcome-research'),
    capValue: $('cap-value'),
    capFill: $('cap-fill'),
    fullTag: $('full-tag'),
    raidBanner: $('raid-banner'),
    raidText: $('raid-text'),
    raidHp: $('raid-hp'),
    raidPower: $('raid-power'),
    raidBuy: $('raid-buy'),
    threat: $('threat'),
    paneMissions: $('pane-missions'),
    missionBadge: $('mission-badge'),
    missionProgress: $('mission-progress'),
    missionBar: $('mission-bar'),
    missionList: $('mission-list'),
    welcomeWasted: $('welcome-wasted'),
    paneBook: $('pane-book'),
    bookBadge: $('book-badge'),
    bookProgress: $('book-progress'),
    bookBar: $('book-bar'),
    bookGrid: $('book-grid'),
    flash: $('flash'),
    food: $('food-value'),
    rate: $('rate-value'),
    hint: $('hint'),
    floaters: $('floaters'),
    list: $('shop-list'),
    saveStatus: $('save-status'),
    welcome: $('welcome'),
    welcomeText: $('welcome-text'),
    welcomeAmount: $('welcome-amount'),
    welcomeEggs: $('welcome-eggs'),
    welcomeNote: $('welcome-note'),
    welcomeOk: $('welcome-ok'),
    toast: $('toast'),
    paneShop: $('pane-shop'),
    paneEggs: $('pane-eggs'),
    badge: $('egg-badge'),
    eggCount: $('egg-count'),
    eggCap: $('egg-cap'),
    eggBar: $('egg-bar'),
    eggNext: $('egg-next'),
    hatchOne: $('hatch-one'),
    hatchAll: $('hatch-all'),
    hatchResult: $('hatch-result'),
    pity: $('pity-info'),
    antList: $('ant-list'),
    antTotal: $('ant-total'),
  };

  $('reset-btn').addEventListener('click', () => {
    if (window.confirm('รีเซ็ตเกมและลบความคืบหน้าทั้งหมด?\nการกระทำนี้ย้อนกลับไม่ได้')) onReset();
  });

  function closeWelcome() {
    els.welcome.classList.add('hidden');
  }
  els.welcomeOk.addEventListener('click', closeWelcome);
  window.addEventListener('keydown', (e) => {
    if (!els.welcome.classList.contains('hidden') && (e.key === 'Escape' || e.key === 'Enter')) closeWelcome();
  });

  let saveTimer = 0;
  let toastTimer = 0;
  const last = new Map();
  function setText(el, text) {
    if (last.get(el) !== text) {
      last.set(el, text);
      el.textContent = text;
    }
  }

  // ---------- แท็บ ----------
  let tab = 'shop';
  const tabButtons = [...document.querySelectorAll('.tab')];
  function setTab(name) {
    tab = name;
    for (const b of tabButtons) {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    }
    els.paneShop.hidden = name !== 'shop';
    els.paneEggs.hidden = name !== 'eggs';
    els.paneBook.hidden = name !== 'book';
    els.paneMissions.hidden = name !== 'missions';
    els.paneResearch.hidden = name !== 'research';
    // ออกจากสมุดแล้วถือว่าเห็นชนิดใหม่แล้ว (ป้าย "ใหม่!" บนการ์ดหายไป)
    if (name !== 'book') unseen.clear();
    for (const c of bookCards) c.badge.classList.toggle('hidden', !unseen.has(c.type.id));
    onLayout();
  }
  // ชนิดที่เพิ่งพบและผู้เล่นยังไม่ได้เปิดสมุดดู
  const unseen = new Set();
  tabButtons.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  // พับ/กางแผงร้านค้า (ใช้บนมือถือแนวตั้งให้เห็นฉากเต็มจอ) แตะแท็บใดก็กางกลับเอง
  const shopEl = $('shop');
  const toggleBtn = $('shop-toggle');
  function setCollapsed(on) {
    shopEl.classList.toggle('collapsed', on);
    toggleBtn.textContent = on ? '▴' : '▾';
    toggleBtn.setAttribute('aria-expanded', String(!on));
    onLayout();
  }
  toggleBtn.addEventListener('click', () => setCollapsed(!shopEl.classList.contains('collapsed')));
  tabButtons.forEach((b) =>
    b.addEventListener('click', () => {
      if (shopEl.classList.contains('collapsed')) setCollapsed(false);
    }),
  );

  // ---------- แท็บร้านค้า ----------
  const rows = ROWS.map((def) => {
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `
      <div class="shop-icon">${def.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${def.name} <span class="shop-level"></span></div>
        <div class="shop-desc"></div>
      </div>
      <button class="buy-btn" type="button"><span class="buy-cost"></span></button>`;
    const btn = row.querySelector('.buy-btn');
    btn.addEventListener('click', () => onBuy(def.id));
    els.list.appendChild(row);
    return {
      def,
      btn,
      level: row.querySelector('.shop-level'),
      desc: row.querySelector('.shop-desc'),
      cost: row.querySelector('.buy-cost'),
    };
  });

  // ---------- แท็บไข่ & มด ----------
  els.eggCap.textContent = cfg.eggs.cap;
  els.hatchOne.addEventListener('click', () => onHatchOne());
  els.hatchAll.addEventListener('click', () => onHatchAll());

  const antRows = antCfg.types.map((t, i) => {
    const row = document.createElement('div');
    row.className = 'ant-row';
    row.innerHTML = `
      <span class="ant-dot" style="background:${t.color}"></span>
      <div>
        <div class="ant-name">${t.name}</div>
        <div class="ant-rarity">${t.rarity} · <span class="ant-bonus"></span></div>
      </div>
      <div class="ant-odds"></div>
      <div class="ant-owned"></div>`;
    els.antList.appendChild(row);
    return {
      i,
      odds: row.querySelector('.ant-odds'),
      owned: row.querySelector('.ant-owned'),
      rate: row.querySelector('.ant-bonus'),
    };
  });

  // อัตราเก็บอาหารต่อตัวของมดชนิดนั้น (รวมตัวคูณ/การลดทอนแล้ว) เช่น "เก็บ 0.40/วินาที"
  const rateText = (id) => `เก็บ ${x2(perAntRate(id))}/วินาที`;
  const pityRules = [...antCfg.pity].sort((a, b) => a.tier - b.tier);

  // ---------- แท็บสมุดสะสม ----------
  const bookCards = antCfg.types.map((t) => {
    const card = document.createElement('div');
    card.className = 'book-card' + (t.id === 'legendary' ? ' legendary' : '');
    card.style.setProperty('--tier', t.color);
    card.style.setProperty('--tier-ink', inkOn(t.color));
    card.innerHTML = `
      <span class="book-new hidden">ใหม่!</span>
      <div class="book-art"><img alt="" draggable="false"></div>
      <div class="book-name"></div>
      <span class="book-chip">${t.rarity}</span>
      <div class="book-desc"></div>
      <div class="book-stats"></div>`;
    els.bookGrid.appendChild(card);
    return {
      type: t,
      card,
      badge: card.querySelector('.book-new'),
      img: card.querySelector('img'),
      name: card.querySelector('.book-name'),
      desc: card.querySelector('.book-desc'),
      stats: card.querySelector('.book-stats'),
    };
  });

  function updateBook() {
    const p = odds(luckMultiplier());
    let found = 0;
    bookCards.forEach((c, i) => {
      const t = c.type;
      const known = state.firstHatch[t.id] != null;
      if (known) found += 1;
      c.card.classList.toggle('locked', !known);
      const src = (known ? portraits[t.id] : portraits.unknown) || '';
      if (last.get(c.img) !== src) {
        last.set(c.img, src);
        if (src) c.img.src = src;
        else c.img.removeAttribute('src');
      }
      setText(c.name, known ? t.name : '???');
      setText(c.desc, known ? t.desc : 'ฟักไข่เพื่อค้นหามดชนิดนี้');
      const first = state.firstHatch[t.id];
      setText(
        c.stats,
        known
          ? `สะสม ×${formatNum(state.ants[t.id])} · ${rateText(t.id)}/ตัว` + (first > 0 ? ` · พบครั้งแรกจากไข่ใบที่ ${first}` : '')
          : `ยังไม่เคยพบ · โอกาส ${pct(p[i])} ต่อไข่`,
      );
      c.badge.classList.toggle('hidden', !unseen.has(t.id));
    });
    setText(els.bookProgress, `พบแล้ว ${found}/${bookCards.length}`);
    const w = (found / bookCards.length) * 100 + '%';
    if (els.bookBar.style.width !== w) els.bookBar.style.width = w;
  }

  let barShown = -1;
  function updateEggs() {
    const interval = eggInterval();
    const full = state.eggs >= cfg.eggs.cap;
    setText(els.eggCount, String(state.eggs));
    const barPct = full ? 100 : Math.round((state.eggProgress / interval) * 200) / 2;
    if (barPct !== barShown) {
      barShown = barPct;
      els.eggBar.style.width = barPct + '%';
    }
    setText(
      els.eggNext,
      full ? 'ไข่เต็มรัง — ฟักเลย ราชินีหยุดวางไข่แล้ว' : `ไข่ใบถัดไปใน ${Math.max(1, Math.ceil(interval - state.eggProgress))} วินาที`,
    );
    const has = state.eggs >= 1;
    els.hatchOne.classList.toggle('disabled', !has);
    els.hatchAll.classList.toggle('disabled', !has);
    setText(els.hatchAll, has ? `ฟักทั้งหมด (${state.eggs})` : 'ฟักทั้งหมด');

    setText(
      els.pity,
      'การันตี ' +
        pityRules.map((r) => `${antCfg.types[r.tier].rarity}+ ในอีก ${pityLimit(r) - state.pity[r.key]} ฟอง`).join(' · ') +
        ` · ฟักไปแล้ว ${formatNum(state.totalHatched)} ใบ`,
    );

    const p = odds(luckMultiplier());
    for (const r of antRows) {
      setText(r.odds, pct(p[r.i]));
      setText(r.owned, '×' + formatNum(state.ants[antCfg.types[r.i].id]));
      setText(r.rate, rateText(antCfg.types[r.i].id));
    }
    // รวมรายได้ของมดสะสมทุก Rank: ถ้าถูกลดทอน (สะสมมาก) บอกเปอร์เซ็นต์ที่ได้จริงเพื่อให้เข้าใจว่าทำไมเพิ่มช้าลง
    const eff = storedAntsEfficiency();
    setText(
      els.antTotal,
      `มดสะสมเก็บรวม ${x2(storedAntsIncome())}/วินาที` +
        (eff < 0.995 ? ` (ได้จริง ${Math.round(eff * 100)}% ของ ${x2(storedAntsRaw())} · เพดาน ${antCfg.collectCap})` : ''),
    );
  }

  function toast(text, bg) {
    els.toast.textContent = text;
    els.toast.style.background = bg;
    els.toast.style.color = inkOn(bg);
    els.toast.classList.add('hidden');
    void els.toast.offsetWidth; // เริ่มแอนิเมชันใหม่
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2700);
  }

  // ---------- ภารกิจ ----------
  let missionKey = '';
  let missionCards = [];
  function rewardText(reward) {
    const r = rewardAmounts(reward);
    const parts = [];
    if (r.food) parts.push(`🍓 ${formatNum(r.food)}`);
    if (r.eggs) parts.push(`🥚 ${r.eggs}`);
    if (r.warriors) parts.push(`🛡️ ${r.warriors}`);
    if (r.guaranteeRare) parts.push('✨ ไข่ใบถัดไปได้ Rare+');
    return 'รางวัล: ' + parts.join(' · ');
  }

  function updateMissions() {
    const list = activeMissions();
    const key = list.map((m) => m.def.id).join(',');
    if (key !== missionKey) {
      // รายการภารกิจเปลี่ยน (รับรางวัลแล้ว) → สร้างการ์ดใหม่
      missionKey = key;
      els.missionList.replaceChildren();
      missionCards = list.map((m) => {
        const card = document.createElement('div');
        card.className = 'mission-card';
        card.innerHTML = `
          <div>
            <div class="mission-title"></div>
            <div class="mission-reward"></div>
          </div>
          <button class="mission-claim" type="button">รับรางวัล</button>
          <div class="mission-progress"><div></div></div>
          <div class="mission-count"></div>`;
        card.querySelector('.mission-title').textContent = m.def.title;
        card.querySelector('.mission-claim').addEventListener('click', () => onClaim(m.def.id));
        els.missionList.appendChild(card);
        return {
          id: m.def.id,
          card,
          reward: card.querySelector('.mission-reward'),
          bar: card.querySelector('.mission-progress > div'),
          count: card.querySelector('.mission-count'),
          claim: card.querySelector('.mission-claim'),
          def: m.def,
        };
      });
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'mission-empty';
        empty.textContent = '🎉 ทำภารกิจครบทั้งหมดแล้ว! รอภารกิจใหม่ในการอัปเดตถัดไป';
        els.missionList.appendChild(empty);
      }
    }
    list.forEach((m, i) => {
      const c = missionCards[i];
      if (!c) return;
      c.card.classList.toggle('done', m.done);
      c.claim.disabled = !m.done;
      setText(c.count, `${formatNum(m.value)} / ${formatNum(m.target)}`);
      setText(c.reward, rewardText(m.def.reward));
      const w = (m.value / m.target) * 100 + '%';
      if (c.bar.style.width !== w) c.bar.style.width = w;
    });
    setText(els.missionProgress, `${claimedCount()}/${totalMissions()}`);
    const w = (claimedCount() / totalMissions()) * 100 + '%';
    if (els.missionBar.style.width !== w) els.missionBar.style.width = w;
  }

  // ---------- การบุก ----------
  els.raidBuy.addEventListener('click', () => onBuy('warrior'));
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const enemyList = (comp) =>
    ENEMY_ORDER.filter((t) => comp[t] > 0)
      .map((t) => `${raidCfg.enemies[t].name} ×${comp[t]}`)
      .join(' ');

  function updateRaid() {
    const a = raid.active;
    els.raidBanner.classList.toggle('hidden', !a);
    els.raidBanner.classList.toggle('win', !!a && a.phase === 'victory');
    if (!a) {
      // ไม่มีการบุก: แถบข้อมูลในแท็บร้านค้าบอกคลื่นถัดไปและพลังป้องกัน
      const wave = state.raid.wave + 1;
      setText(
        els.threat,
        `⚔️ ศัตรูคลื่นที่ ${wave} (${enemyList(waveComposition(wave))}) จะบุกใน ${mmss(Math.max(0, state.raid.nextIn))} ` +
          `· เลือดรวม ~${formatNum(totalHp(wave))} · พลังป้องกัน ${x2(defensePower())} (ชนะ ${state.raid.won} แพ้ ${state.raid.lost})`,
      );
      return;
    }
    const buyCost = warriorCost();
    const canBuy = canBuyWarrior();
    let title;
    let hp = 0;
    if (a.phase === 'approach') {
      title = `⚠️ ศัตรูบุก! คลื่นที่ ${a.wave}: ${enemyList(waveComposition(a.wave))} — ถึงในอีก ${Math.max(0, Math.ceil(raidCfg.approachSec - a.t))} วินาที`;
      hp = 100;
    } else if (a.phase === 'fight') {
      title = `⚔️ กำลังต่อสู้! ศัตรูเหลือ ${aliveCount(a)} ตัว · เหลือเวลา ${Math.max(0, Math.ceil(raidCfg.fightTimeoutSec - a.fightT))} วินาที`;
      hp = (remainingHp(a) / a.maxHp) * 100;
    } else if (a.phase === 'victory') {
      title = `🏆 ป้องกันสำเร็จ! +${formatNum(a.reward?.food ?? 0)} อาหาร +${a.reward?.eggs ?? 0} ไข่` + (a.loss > 0 ? ` (เสีย ${formatNum(a.loss)})` : '');
      hp = 0;
    } else {
      title = `💨 สู้ไม่ทัน ศัตรูถอยไปพร้อมขโมยอาหาร -${formatNum(a.loss)} (คลื่นนี้จะกลับมาอีก)`;
      hp = (remainingHp(a) / a.maxHp) * 100;
    }
    setText(els.raidText, title);
    els.raidHp.style.width = hp + '%';
    const active = a.phase === 'approach' || a.phase === 'fight';
    els.raidBuy.hidden = !active;
    els.raidPower.hidden = !active;
    if (active) {
      setText(els.raidPower, `พลังป้องกัน ${x2(defensePower())}`);
      setText(els.raidBuy, `+ นักรบ 🍓 ${formatNum(buyCost)}`);
      els.raidBuy.classList.toggle('disabled', !canBuy);
    }
  }

  // ---------- ชิปสถานะ (Royal Jelly / สภาพอากาศ / บัฟ) ----------
  let chipsKey = '';
  function updateChips() {
    const chips = [];
    if (state.prestige.jelly > 0) {
      chips.push({ cls: 'jelly', text: `👑 ${state.prestige.jelly} · รายได้ +${Math.round(jellyIncomeBonus() * 100)}%` });
    }
    const w = activeWeather();
    if (w) chips.push({ cls: 'weather', text: `${w.icon} ${w.name} ${Math.ceil(w.left)}s · ${w.effect}` });
    if (buffs.frenzy > 0) chips.push({ cls: 'buff', text: `🍯 รายได้ ×3 ${Math.ceil(buffs.frenzy)}s` });
    if (buffs.clickFrenzy > 0) chips.push({ cls: 'buff', text: `👆 คลิก ×10 ${Math.ceil(buffs.clickFrenzy)}s` });
    if (buffs.rally > 0) chips.push({ cls: 'buff', text: `📣 ป้องกัน ×3 ${Math.ceil(buffs.rally)}s` });
    const key = chips.map((c) => c.text).join('|');
    if (key === chipsKey) return;
    chipsKey = key;
    els.chips.replaceChildren(
      ...chips.map((c) => {
        const el = document.createElement('span');
        el.className = 'chip ' + c.cls;
        el.textContent = c.text;
        return el;
      }),
    );
  }

  // ---------- สกิลราชินี ----------
  const skillBtns = skillList().map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'skill locked';
    b.innerHTML = `<span class="icon"></span><span class="cd"></span><span class="cd-num"></span>`;
    b.querySelector('.icon').textContent = s.icon;
    b.title = `${s.name}: ${s.desc} (คูลดาวน์ ${s.cooldownSec} วินาที)`;
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', () => onSkill(s.id));
    els.skills.appendChild(b);
    return { s, i, b, cd: b.querySelector('.cd'), num: b.querySelector('.cd-num') };
  });
  const buffOf = { rally: () => buffs.rally, frenzy: () => buffs.frenzy, eggBurst: () => 0 };

  function updateSkills() {
    els.skills.classList.toggle('hidden', upgradeLevel('queenSkills') < 1);
    for (const k of skillBtns) {
      const unlocked = skillUnlocked(k.i);
      const cd = cooldowns[k.s.id] || 0;
      k.b.classList.toggle('locked', !unlocked);
      k.b.classList.toggle('ready', unlocked && cd <= 0);
      k.b.classList.toggle('active', buffOf[k.s.id]() > 0);
      const total = k.s.cooldownSec * cooldownMultiplier();
      k.cd.style.setProperty('--cd', (unlocked && cd > 0 ? (cd / total) * 360 : 0) + 'deg');
      setText(k.num, unlocked && cd > 0 ? String(Math.ceil(cd)) : unlocked ? '' : '🔒');
    }
  }

  // ---------- ห้องวิจัย ----------
  const nodeEls = new Map();
  for (const br of research.branches()) {
    const h = document.createElement('div');
    h.className = 'r-branch';
    h.textContent = `${br.icon} ${br.name}`;
    els.researchList.appendChild(h);
    for (const n of research.nodes().filter((x) => x.branch === br.id)) {
      const card = document.createElement('div');
      card.className = 'r-node';
      card.innerHTML = `
        <div>
          <div class="r-name"></div>
          <div class="r-desc"></div>
        </div>
        <button class="buy-btn" type="button"><span class="buy-cost"></span></button>
        <div class="r-bar"><div></div></div>`;
      card.querySelector('.r-name').textContent = n.name;
      card.querySelector('.r-desc').textContent = n.desc;
      const btn = card.querySelector('.buy-btn');
      btn.addEventListener('click', () => onResearch(n.id));
      els.researchList.appendChild(card);
      nodeEls.set(n.id, { n, card, btn, cost: card.querySelector('.buy-cost'), bar: card.querySelector('.r-bar'), fill: card.querySelector('.r-bar > div') });
    }
  }

  function updateResearch() {
    const done = research.doneCount();
    setText(els.researchProgress, `${done}/${research.totalCount()}`);
    const w = (done / research.totalCount()) * 100 + '%';
    if (els.researchBar.style.width !== w) els.researchBar.style.width = w;
    const p = research.progress();
    setText(els.researchActive, p ? `🔬 กำลังวิจัย: ${nodeEls.get(p.id).n.name} — เหลือ ${mmss(Math.ceil(p.left))}` : '');
    for (const e of nodeEls.values()) {
      const status = research.nodeStatus(e.n.id);
      e.card.className = 'r-node ' + status;
      const over = status === 'available' && exceedsCapacity(e.n.cost);
      const can = research.canStart(e.n.id);
      e.btn.classList.toggle('disabled', !can);
      e.btn.classList.toggle('maxed', status === 'done');
      let label;
      if (status === 'done') label = '✓ เสร็จแล้ว';
      else if (status === 'active') label = 'กำลังวิจัย…';
      else if (status === 'locked') label = '🔒 ต้องวิจัยข้อก่อน';
      else if (over) label = `📦 ต้องขยายคลัง (${formatNum(e.n.cost)})`;
      else label = `🍓 ${formatNum(e.n.cost)} · ${mmss(e.n.timeSec)}`;
      setText(e.cost, label);
      e.bar.style.display = status === 'active' ? 'block' : 'none';
      if (status === 'active' && p) {
        const fw = p.fraction * 100 + '%';
        if (e.fill.style.width !== fw) e.fill.style.width = fw;
      }
    }
  }

  // ---------- ก่อตั้งอาณานิคมใหม่ ----------
  els.prestigeCard.innerHTML = `
    <div class="p-title">👑 อาณานิคมใหม่</div>
    <div class="p-desc"></div>
    <button class="buy-btn" type="button"><span class="buy-cost"></span></button>`;
  const pDesc = els.prestigeCard.querySelector('.p-desc');
  const pBtn = els.prestigeCard.querySelector('.buy-btn');
  const pLabel = els.prestigeCard.querySelector('.buy-cost');
  pBtn.addEventListener('click', () => {
    if (!prestige.canPrestige()) return;
    const gain = prestige.jellyGain();
    const ok = window.confirm(
      `ก่อตั้งอาณานิคมใหม่?\n\nได้ Royal Jelly +${gain} (รายได้ถาวร +${Math.round(gain * prestigeCfg.jellyIncomeBonus * 100)}%)\n` +
        'รีเซ็ต: อาหาร มดงาน/นักรบ อัปเกรด ไข่ มดสะสม คลื่นศัตรู\n' +
        'คงไว้: Royal Jelly งานวิจัย ห้องวิจัย/สกิลราชินี สมุดสะสม ภารกิจที่รับแล้ว',
    );
    if (ok) onPrestige();
  });
  function updatePrestige() {
    const gain = prestige.jellyGain();
    const j = state.prestige.jelly;
    const base = `Royal Jelly ${j} (รายได้ถาวร +${Math.round(jellyIncomeBonus() * 100)}%) · ก่อตั้งแล้ว ${state.prestige.count} ครั้ง`;
    const hint = gain >= 1
      ? ` — ก่อตั้งตอนนี้ได้ +${gain} 👑`
      : ` — ต้องเก็บอาหารสะสมรอบนี้ถึง ${formatNum(prestigeCfg.minFood)} (ตอนนี้ ${formatNum(Math.floor(prestige.runFood()))})`;
    setText(pDesc, base + hint);
    setText(pLabel, gain >= 1 ? `👑 ก่อตั้งอาณานิคมใหม่ (+${gain})` : '👑 ยังก่อตั้งไม่ได้');
    pBtn.classList.toggle('disabled', gain < 1);
  }

  let hintOn = true;
  els.hint.classList.remove('hidden');

  return {
    update() {
      setText(els.food, formatNum(Math.floor(state.food)));
      setText(els.rate, formatNum(foodPerSec(), 1));
      // คลังอาหาร: ตัวเลขความจุ แถบความจุ (เหลือง ≥ 85% แดงเมื่อเต็ม) และป้าย "คลังเต็ม"
      const cap = foodCapacity();
      const fillPct = Math.min(100, (state.food / cap) * 100);
      setText(els.capValue, formatNum(cap));
      const fw = fillPct + '%';
      if (els.capFill.style.width !== fw) els.capFill.style.width = fw;
      const full = fillPct >= 99.5;
      els.capFill.classList.toggle('full', full);
      els.capFill.classList.toggle('near', !full && fillPct >= 85);
      els.fullTag.classList.toggle('hidden', !full);
      for (const r of rows) {
        const maxed = r.def.maxed();
        const cost = maxed ? 0 : r.def.cost();
        const over = !maxed && exceedsCapacity(cost); // ของแพงกว่าความจุคลัง: รอเท่าไรก็ซื้อไม่ได้ ต้องขยายคลังก่อน
        const can = !maxed && !over && r.def.can();
        setText(r.level, r.def.level());
        setText(r.desc, r.def.desc());
        setText(
          r.cost,
          maxed ? (r.def.id === 'fungusRoom' ? 'ปลดล็อกแล้ว' : r.def.id === 'lab' ? 'สร้างแล้ว' : 'สูงสุด') : over ? `📦 ต้องขยายคลัง (${formatNum(cost)})` : '🍓 ' + formatNum(cost),
        );
        r.cost.classList.toggle('need-storage', over);
        r.btn.classList.toggle('disabled', !can);
        r.btn.classList.toggle('maxed', maxed);
        r.btn.setAttribute('aria-disabled', String(!can));
      }
      updateRaid();
      updateChips();
      updateSkills();
      updatePrestige();
      const w = activeWeather();
      els.weatherTint.className = w ? w.type : '';
      // ห้องวิจัย: แท็บโผล่เมื่อสร้างห้องแล้ว (ถ้าอยู่บนแท็บวิจัยแล้วห้องหาย ให้กลับแท็บร้านค้า)
      const lab = research.labUnlocked();
      els.tabResearch.classList.toggle('hidden', !lab);
      if (!lab && tab === 'research') setTab('shop');
      if (tab === 'research') updateResearch();
      const claimable = claimableCount();
      els.missionBadge.classList.toggle('hidden', claimable === 0);
      setText(els.missionBadge, String(claimable));
      if (tab === 'missions') updateMissions();
      // ป้ายจำนวนไข่บนแท็บ (โชว์เมื่อไม่ได้เปิดแท็บไข่อยู่)
      const showBadge = tab !== 'eggs' && state.eggs > 0;
      els.badge.classList.toggle('hidden', !showBadge);
      setText(els.badge, String(state.eggs));
      els.bookBadge.classList.toggle('hidden', tab === 'book' || unseen.size === 0);
      if (tab === 'eggs') updateEggs();
      if (tab === 'book') updateBook();
    },
    // แสงวาบเต็มจอ (ใช้กับมดหายากตอนฟัก) peak = ความเข้มสูงสุด 0–1
    flash(hex, peak) {
      els.flash.style.setProperty('--flash', hex);
      els.flash.style.setProperty('--flash-peak', String(peak));
      els.flash.classList.remove('go');
      void els.flash.offsetWidth;
      els.flash.classList.add('go');
    },
    // สรุปผลฟัก: results = [{ type, isNew }, ...]
    showHatch(results) {
      if (!results.length) return;
      const byType = new Map();
      let best = results[0];
      let anyNew = false;
      for (const r of results) {
        byType.set(r.type, (byType.get(r.type) || 0) + 1);
        if (r.isNew) unseen.add(r.type.id);
        if (r.type.tier > best.type.tier) best = r;
        anyNew = anyNew || r.isNew;
      }
      els.hatchResult.replaceChildren();
      [...byType.entries()]
        .sort((a, b) => b[0].tier - a[0].tier)
        .forEach(([type, n]) => {
          const chip = document.createElement('span');
          chip.className = 'tier-chip';
          chip.style.background = type.color;
          chip.style.color = inkOn(type.color);
          chip.textContent = `${type.name} ×${n}`;
          els.hatchResult.appendChild(chip);
        });
      const bt = best.type;
      const text =
        results.length === 1
          ? `ฟักได้ ${bt.name} (${bt.rarity})${best.isNew ? ' ✨ใหม่!' : ''}`
          : `ฟัก ${results.length} ใบ — ดีที่สุด ${bt.name} (${bt.rarity})${anyNew ? ' ✨มีชนิดใหม่!' : ''}`;
      toast(text, bt.color);
    },
    // แจ้งผลบันทึกสั้น ๆ ในแผงร้านค้า
    flashSaved(ok) {
      els.saveStatus.textContent = ok ? 'บันทึกแล้ว ✓' : 'บันทึกไม่ได้ (เบราว์เซอร์ปิดการเก็บข้อมูล)';
      els.saveStatus.classList.add('show');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => els.saveStatus.classList.remove('show'), ok ? 1500 : 6000);
    },
    // หน้าต่างต้อนรับกลับ: แจ้งรายได้ที่ "ได้ไปแล้ว" (เพิ่มเข้า state ก่อนแสดง) ปุ่มแค่ปิดหน้าต่าง
    // แจ้งข้อความสั้น ๆ (toast) สีตามต้องการ ใช้กับผลการบุก/รางวัลภารกิจ
    notify(text, bg) {
      toast(text, bg);
    },
    showWelcomeBack({ counted, elapsed, food, wasted = 0, eggs, capped, researchEvents = [] }, { rate, maxHours }) {
      els.welcomeResearch.textContent = researchEvents.length
        ? '🔬 วิจัยสำเร็จระหว่างไม่อยู่: ' + researchEvents.map((e) => nodeEls.get(e.id)?.n.name ?? e.id).join(', ')
        : '';
      els.welcomeText.textContent = `ขณะที่คุณไม่อยู่ ${formatDuration(elapsed)} มดงานหาอาหารได้`;
      els.welcomeAmount.textContent = formatNum(Math.floor(food));
      els.welcomeWasted.textContent = wasted >= 1 ? `📦 คลังเต็ม อาหารล้นเสียไป ${formatNum(Math.floor(wasted))} — ขยายคลังเพื่อเก็บได้มากขึ้น` : '';
      els.welcomeEggs.textContent = eggs > 0 ? `🥚 ราชินีวางไข่เพิ่ม +${eggs} ใบ` : '';
      els.welcomeNote.textContent =
        `คิด ${Math.round(rate * 100)}% ของรายได้ปกติ นับได้สูงสุด ${maxHours} ชั่วโมง` +
        (capped ? ` (ครั้งนี้เต็มเพดาน นับ ${formatDuration(counted)})` : '');
      els.welcome.classList.remove('hidden');
      els.welcomeOk.focus();
    },
    // วางป้ายแนะนำ "แตะที่ผลเบอร์รี่" เหนือผลเบอร์รี่จนกว่าจะคลิกครั้งแรก
    placeHint(x, y) {
      if (!hintOn) return;
      els.hint.style.left = x + 'px';
      els.hint.style.top = Math.max(y, 56) + 'px';
    },
    hideHint() {
      if (!hintOn) return;
      hintOn = false;
      els.hint.classList.add('hidden');
    },
    // ตัวนับอาหารเด้งเล็กน้อยตอนมดส่งอาหาร
    bumpFood() {
      const el = els.food.parentElement;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    },
    // color (ถ้ามี) = สีตัวเลขลอย ใช้กับมด Rank สูงที่ส่งอาหารก้อนใหญ่
    floater(text, x, y, extraClass = '', color = '') {
      while (els.floaters.childElementCount > 24) els.floaters.firstElementChild.remove();
      const el = document.createElement('div');
      el.className = 'floater' + (extraClass ? ' ' + extraClass : '');
      if (color) el.style.setProperty('--fc', color);
      el.textContent = text;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.addEventListener('animationend', () => el.remove());
      els.floaters.appendChild(el);
    },
  };
}
