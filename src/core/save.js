import cfg from '../config/economy.json';
import { state } from './state.js';
import raidCfg from '../config/raid.json';
import { foodPerSec, upgradeMax, layEggs, creditFood, foodCapacity } from './economy.js';
import { advance as advanceResearch } from './research.js';
import researchCfg from '../config/research.json';

const RESEARCH_IDS = new Set(researchCfg.nodes.map((n) => n.id));

const KEY = cfg.save.key;
let disabled = false; // ใช้ตอนรีเซ็ต กันไม่ให้ pagehide เขียนเซฟเก่าทับ

const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null; // โหมดส่วนตัว/ปิดการเก็บข้อมูล: เล่นต่อได้ แต่บันทึกไม่ได้
  }
}

export function save() {
  if (disabled) return false;
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(
      KEY,
      JSON.stringify({
        v: cfg.save.version,
        savedAt: Date.now(),
        state: {
          food: state.food,
          totalFood: state.totalFood,
          wasted: state.wasted,
          workers: state.workers,
          warriors: state.warriors,
          clicks: state.clicks,
          raid: { ...state.raid },
          missions: { claimed: { ...state.missions.claimed } },
          prestige: { ...state.prestige },
          research: { done: { ...state.research.done }, active: state.research.active ? { ...state.research.active } : null },
          stats: { ...state.stats },
          upgrades: { ...state.upgrades },
          eggs: state.eggs,
          eggProgress: state.eggProgress,
          totalHatched: state.totalHatched,
          ants: { ...state.ants },
          firstHatch: { ...state.firstHatch },
          pity: { ...state.pity },
        },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

// อ่านเซฟกลับเข้า state: ค่าที่ไม่ถูกต้องจะถูกแก้เป็นค่าที่ปลอดภัย ไม่เชื่อข้อมูลในเซฟตรง ๆ
// คืนค่า { savedAt } ถ้าโหลดสำเร็จ, null ถ้าไม่มีเซฟหรือเซฟเสีย
export function load() {
  const ls = storage();
  if (!ls) return null;
  let data;
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return null;
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const s = data && data.v === cfg.save.version ? data.state : null;
  if (!s || typeof s !== 'object') return null;

  state.food = num(s.food);
  state.totalFood = Math.max(num(s.totalFood), state.food);
  state.wasted = num(s.wasted);
  state.workers = Math.floor(num(s.workers));
  state.warriors = Math.floor(num(s.warriors));
  state.clicks = Math.floor(num(s.clicks));
  const u = s.upgrades && typeof s.upgrades === 'object' ? s.upgrades : {};
  for (const id of Object.keys(state.upgrades)) {
    state.upgrades[id] = Math.min(Math.floor(num(u[id])), upgradeMax(id));
  }
  // เซฟที่อาหารเกินความจุคลัง (เช่นเซฟรุ่นก่อนมีระบบคลัง) ปรับให้เท่าความจุ ส่วนเกินนับเป็นอาหารที่เสียไป
  const cap = foodCapacity();
  if (state.food > cap) {
    state.wasted += state.food - cap;
    state.food = cap;
  }

  // การบุก/ภารกิจ: เซฟรุ่นเก่าไม่มีฟิลด์นี้ → ใช้ค่าเริ่มต้น การบุกที่กำลังเกิดตอนปิดหน้าเว็บไม่ถูกบันทึก
  const r = s.raid && typeof s.raid === 'object' ? s.raid : {};
  state.raid.wave = Math.floor(num(r.wave));
  state.raid.won = Math.floor(num(r.won));
  state.raid.lost = Math.floor(num(r.lost));
  // กันผู้เล่นโดนบุกทันทีตอนเปิดเกมกลับมา: อย่างน้อย retryDelaySec วินาที
  state.raid.nextIn = Math.max(num(r.nextIn, raidCfg.firstDelaySec), raidCfg.retryDelaySec);
  // Royal Jelly / งานวิจัย / สถิติ: เซฟรุ่นเก่าไม่มี → ค่าเริ่มต้น งานวิจัยรับเฉพาะ id ที่มีอยู่จริง
  const pr = s.prestige && typeof s.prestige === 'object' ? s.prestige : {};
  state.prestige.jelly = Math.floor(num(pr.jelly));
  state.prestige.count = Math.floor(num(pr.count));
  const rs = s.research && typeof s.research === 'object' ? s.research : {};
  state.research.done = {};
  const doneIn = rs.done && typeof rs.done === 'object' ? rs.done : {};
  for (const id of Object.keys(doneIn)) if (doneIn[id] === true && RESEARCH_IDS.has(id)) state.research.done[id] = true;
  const act = rs.active && typeof rs.active === 'object' ? rs.active : null;
  const node = act ? researchCfg.nodes.find((n) => n.id === act.id) : null;
  state.research.active = node && !state.research.done[node.id] ? { id: node.id, left: Math.min(num(act.left, node.timeSec), node.timeSec) } : null;
  const st = s.stats && typeof s.stats === 'object' ? s.stats : {};
  state.stats.golden = Math.floor(num(st.golden));
  state.stats.skills = Math.floor(num(st.skills));
  const claimed = s.missions && typeof s.missions.claimed === 'object' && s.missions.claimed ? s.missions.claimed : {};
  state.missions.claimed = {};
  for (const id of Object.keys(claimed)) if (claimed[id] === true) state.missions.claimed[id] = true;

  // ไข่/มดสะสม/Pity: เซฟรุ่นเก่าที่ยังไม่มีฟิลด์เหล่านี้จะได้ค่าเริ่มต้น (0) ไม่พัง
  state.eggs = Math.min(Math.floor(num(s.eggs)), cfg.eggs.cap);
  state.eggProgress = num(s.eggProgress);
  state.totalHatched = Math.floor(num(s.totalHatched));
  const ants = s.ants && typeof s.ants === 'object' ? s.ants : {};
  for (const id of Object.keys(state.ants)) state.ants[id] = Math.floor(num(ants[id]));
  // ลำดับที่พบครั้งแรก: ค่าที่ไม่ใช่ตัวเลข → null แต่ถ้ามีมดชนิดนั้นอยู่แล้ว (เซฟรุ่นก่อนหน้า) ถือว่าเคยพบ (0)
  const first = s.firstHatch && typeof s.firstHatch === 'object' ? s.firstHatch : {};
  for (const id of Object.keys(state.firstHatch)) {
    const v = first[id];
    const n = typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
    state.firstHatch[id] = n ?? (state.ants[id] > 0 ? 0 : null);
  }
  const pity = s.pity && typeof s.pity === 'object' ? s.pity : {};
  for (const key of Object.keys(state.pity)) state.pity[key] = Math.floor(num(pity[key]));
  return { savedAt: num(data.savedAt, Date.now()) };
}

// รายได้ช่วงที่ไม่ได้เปิดเกม = รายได้ต่อวินาที × วินาทีที่นับได้ (ไม่เกินเพดาน) × อัตรา offline
// เวลานับจาก sinceMs ถึงตอนนี้ ถ้านาฬิกาเครื่องย้อนหลัง (ค่าติดลบ) จะนับเป็น 0
export function applyOffline(sinceMs) {
  const maxSec = cfg.offline.maxHours * 3600;
  const elapsed = Math.max(0, (Date.now() - sinceMs) / 1000);
  const counted = Math.min(elapsed, maxSec);
  const earned = foodPerSec() * counted * cfg.offline.rate;
  const food = earned > 0 ? creditFood(earned) : 0; // ไม่เกินความจุคลัง ส่วนที่ล้นเสียไป
  // ราชินีวางไข่ต่อระหว่างไม่อยู่ ใช้อัตรา offline เท่ากัน และไม่เกินเพดานไข่
  const eggs = layEggs(counted * cfg.offline.rate);
  // งานวิจัยที่ค้างอยู่เดินต่อตามเวลาจริงที่ไม่อยู่ (เต็มอัตรา เพราะเป็นการรอ ไม่ใช่การหาอาหาร)
  const researchEvents = advanceResearch(counted);
  return {
    researchEvents,
    elapsed,
    counted,
    food,
    wasted: earned - food,
    eggs,
    capped: elapsed > maxSec,
    show: (earned > 0 || eggs > 0 || researchEvents.length > 0) && elapsed >= cfg.offline.minSecondsToShow,
  };
}

export function reset() {
  disabled = true;
  try {
    storage()?.removeItem(KEY);
  } catch {
    // ลบไม่ได้ก็ไม่เป็นไร จะโหลดหน้าใหม่ต่อ
  }
}
