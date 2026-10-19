import { state } from './state.js';
import researchCfg from '../config/research.json';
import eventsCfg from '../config/events.json';
import prestigeCfg from '../config/prestige.json';

// ตัวคูณ/โบนัสทั้งหมดจากแหล่งที่ไม่ใช่อัปเกรดปกติ: บัฟชั่วคราว สภาพอากาศ งานวิจัย และ Royal Jelly
// แยกไฟล์ไว้เพื่อให้ economy.js เรียกใช้ได้โดยไม่เกิดการอ้างอิงวนกับ events/research (ที่ต้องเรียก economy กลับ)

// ----- สถานะชั่วคราว (ไม่บันทึกเซฟ: เปิดเกมใหม่เริ่มสะอาด) -----
export const buffs = { frenzy: 0, clickFrenzy: 0, rally: 0 }; // วินาทีที่เหลือ
export const buffMult = { frenzy: 3, clickFrenzy: 10, rally: 3 }; // ตัวคูณของบัฟแต่ละชนิด (ตั้งค่าตอนเริ่มบัฟ)
export const weather = { type: null, left: 0, nextIn: 0 };

const NODES = new Map(researchCfg.nodes.map((n) => [n.id, n]));

// ผลรวมของงานวิจัยที่เสร็จแล้วชนิด kind (เช่น food รวมแบบบวก)
function researchSum(kind) {
  let s = 0;
  for (const id of Object.keys(state.research.done)) {
    const n = NODES.get(id);
    if (n && n.effect.kind === kind) s += n.effect.value;
  }
  return s;
}

// ผลคูณของงานวิจัยชนิด kind (เช่น eggInterval ×0.85)
function researchProd(kind) {
  let p = 1;
  for (const id of Object.keys(state.research.done)) {
    const n = NODES.get(id);
    if (n && n.effect.kind === kind) p *= n.effect.value;
  }
  return p;
}

const W = () => (weather.type ? eventsCfg.weather.types[weather.type] : null);

// Royal Jelly: รายได้ + คลังมดสะสมเพดานสูงขึ้นถาวร
export function jellyIncomeBonus() {
  return state.prestige.jelly * prestigeCfg.jellyIncomeBonus;
}

export function jellyCapBonus() {
  return 1 + state.prestige.jelly * prestigeCfg.jellyCapBonus;
}

// ตัวคูณรายได้อาหารของมดทุกตัว (ไม่รวมอัปเกรดความเร็ว/ห้องเชื้อรา ซึ่งอยู่ใน economy)
export function incomeMultiplier() {
  const w = W();
  return (1 + jellyIncomeBonus()) * (1 + researchSum('food')) * (buffs.frenzy > 0 ? buffMult.frenzy : 1) * (w?.income ?? 1);
}

export function clickMultiplier() {
  return (1 + jellyIncomeBonus()) * (buffs.clickFrenzy > 0 ? buffMult.clickFrenzy : 1);
}

// อัตราการวางไข่ (คูณ) = ฝน × (1 / ตัวคูณช่วงเวลาไข่จากงานวิจัย)
export function eggRateMultiplier() {
  return (W()?.eggRate ?? 1) / researchProd('eggInterval');
}

export function luckBonus() {
  return researchSum('luck');
}

// ลดลิมิต Pity ของระดับ key (เช่น rare: 30 → 24)
export function pityReduction(key) {
  return key === 'rare' ? researchSum('pityRare') : 0;
}

export function defenseMultiplier() {
  return (buffs.rally > 0 ? buffMult.rally : 1) * (1 + researchSum('warrior'));
}

export function raidLossMultiplier() {
  return researchProd('raidLoss');
}

// ลมแรง: เวลานับถอยหลังของศัตรูเดินเร็วขึ้น / ผลเบอร์รี่ทองมาถี่ขึ้น
export function raidTimerRate() {
  return W()?.raidRate ?? 1;
}

export function goldenRate() {
  return W()?.goldenRate ?? 1;
}

export function cooldownMultiplier() {
  return researchProd('cooldown');
}

export function activeWeather() {
  return weather.type ? { type: weather.type, left: weather.left, ...eventsCfg.weather.types[weather.type] } : null;
}

export function resetTransient() {
  buffs.frenzy = buffs.clickFrenzy = buffs.rally = 0;
  weather.type = null;
  weather.left = 0;
}
