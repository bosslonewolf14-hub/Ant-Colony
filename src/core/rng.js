import antCfg from '../config/ants.json';
import { pityReduction } from './modifiers.js';

const TYPES = antCfg.types;

// น้ำหนักของแต่ละระดับ = weight × Luck^tier  (Luck = 1 → ตรงตามตารางใน ants.json)
// ระดับสูงได้รับผลจาก Luck มากกว่าระดับต่ำ ส่วน Common (tier 0) คงเดิมเสมอ
function weightsFor(luck, minTier) {
  return TYPES.map((t) => (t.tier >= minTier ? t.weight * Math.pow(luck, t.tier) : 0));
}

// โอกาสของแต่ละระดับ (รวมเป็น 1) เมื่อบังคับให้ได้ระดับ minTier ขึ้นไป
export function odds(luck = 1, minTier = 0) {
  const w = weightsFor(luck, minTier);
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

// ระดับขั้นต่ำที่ต้องได้ตาม Pity: ตรวจจากกฎที่สูงสุดก่อน
// ถ้านับไข่ที่ไม่ได้ถึง limit-1 ใบแล้ว ใบถัดไปคือใบที่ limit จึงบังคับ
export function pityFloor(pity) {
  for (const rule of antCfg.pity) {
    if ((pity[rule.key] || 0) >= pityLimit(rule) - 1) return rule.tier;
  }
  return 0;
}

// ลิมิต Pity จริงของกฎ (หักด้วยงานวิจัยแล้ว) ใช้ทั้งตอนสุ่มและตอนโชว์ใน UI
export function pityLimit(rule) {
  return Math.max(2, rule.limit - pityReduction(rule.key));
}

export function advancePity(pity, tierIndex) {
  for (const rule of antCfg.pity) {
    pity[rule.key] = tierIndex >= rule.tier ? 0 : (pity[rule.key] || 0) + 1;
  }
}

// สุ่ม 1 ครั้ง คืน index ของชนิด (ไม่แก้ pity ที่ส่งเข้ามา)
export function rollTier(luck, pity, rand = Math.random, usePity = true) {
  const minTier = usePity ? pityFloor(pity) : 0;
  const p = odds(luck, minTier);
  let r = rand();
  for (let i = 0; i < p.length; i++) {
    r -= p[i];
    if (r < 0) return i;
  }
  return p.length - 1; // กันค่าคลาดเคลื่อนทศนิยม
}

// ตัวเลื่อนเลขสุ่มแบบกำหนดเมล็ด (ใช้ทดสอบให้ผลซ้ำได้)
export function seededRand(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// จำลองการฟัก n ใบโดยไม่แตะสถานะเกม ใช้ตรวจสัดส่วนและช่วงดวงแย่สุด
export function simulate(n, { luck = 1, usePity = true, rand = Math.random } = {}) {
  const counts = TYPES.map(() => 0);
  const pity = {};
  const drought = {};
  const maxDrought = {};
  for (const rule of antCfg.pity) {
    pity[rule.key] = 0;
    drought[rule.key] = 0;
    maxDrought[rule.key] = 0;
  }
  for (let i = 0; i < n; i++) {
    const idx = rollTier(luck, pity, rand, usePity);
    counts[idx]++;
    advancePity(pity, idx);
    for (const rule of antCfg.pity) {
      drought[rule.key] = idx >= rule.tier ? 0 : drought[rule.key] + 1;
      maxDrought[rule.key] = Math.max(maxDrought[rule.key], drought[rule.key]);
    }
  }
  return { n, counts, rates: counts.map((c) => c / n), maxDrought };
}
