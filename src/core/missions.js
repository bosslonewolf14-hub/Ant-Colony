import missionCfg from '../config/missions.json';
import antCfg from '../config/ants.json';
import { state } from './state.js';
import * as economy from './economy.js';
import { doneCount as researchDone } from './research.js';

// ภารกิจ: รายการเรียงตามความยากใน missions.json แสดงทีละไม่เกิน slots ภารกิจที่ยังไม่รับรางวัล
// เมื่อทำสำเร็จต้องกด "รับรางวัล" เอง (ได้ความรู้สึกว่าได้รางวัลจริง และรางวัลคิดตามรายได้ ณ ตอนรับ)

// ตัวชี้วัดที่ภารกิจอ้างอิง: อ่านจากสถานะเกมโดยตรง ไม่มีตัวนับแยก (จึงไม่คลาดเคลื่อนกับของจริง)
const METRICS = {
  clicks: () => state.clicks,
  workers: () => state.workers,
  warriors: () => state.warriors,
  hatched: () => state.totalHatched,
  totalFood: () => state.totalFood,
  discovered: () => Object.values(state.firstHatch).filter((v) => v != null).length,
  rareUp: () => antCfg.types.reduce((s, t) => s + (t.tier >= 2 ? state.ants[t.id] || 0 : 0), 0),
  storage: () => economy.upgradeLevel('storage'),
  fungus: () => economy.upgradeLevel('fungusRoom'),
  luck: () => economy.upgradeLevel('luck'),
  barracks: () => economy.upgradeLevel('barracks'),
  raidsWon: () => state.raid.won,
  golden: () => state.stats.golden,
  skills: () => state.stats.skills,
  research: () => researchDone(),
  lab: () => economy.upgradeLevel('lab'),
  prestige: () => state.prestige.count,
  jelly: () => state.prestige.jelly,
};

const BY_ID = new Map(missionCfg.missions.map((m) => [m.id, m]));

export function metricValue(metric) {
  return METRICS[metric] ? METRICS[metric]() : 0;
}

export function isClaimed(id) {
  return !!state.missions.claimed[id];
}

function describe(def) {
  const value = Math.min(metricValue(def.metric), def.target);
  return { def, value, target: def.target, done: metricValue(def.metric) >= def.target };
}

// ภารกิจที่แสดงอยู่ (ยังไม่รับรางวัล) ไม่เกิน slots รายการแรกตามลำดับ
export function activeMissions() {
  const out = [];
  for (const def of missionCfg.missions) {
    if (isClaimed(def.id)) continue;
    out.push(describe(def));
    if (out.length >= missionCfg.slots) break;
  }
  return out;
}

export function claimableCount() {
  return activeMissions().filter((m) => m.done).length;
}

export function totalMissions() {
  return missionCfg.missions.length;
}

export function claimedCount() {
  return missionCfg.missions.filter((m) => isClaimed(m.id)).length;
}

// คำนวณรางวัลจริง ณ ตอนนี้ (อาหารคิดจากรายได้ปัจจุบัน: เอาค่าที่มากกว่าระหว่างค่าคงที่กับรายได้ × วินาที)
export function rewardAmounts(reward) {
  const out = {};
  if (reward.food) out.food = Math.max(reward.food.fixed, Math.round(economy.foodPerSec() * reward.food.seconds));
  if (reward.eggs) out.eggs = reward.eggs;
  if (reward.warriors) out.warriors = reward.warriors;
  if (reward.guaranteeRare) out.guaranteeRare = true;
  return out;
}

// รับรางวัลภารกิจ: คืนรางวัลที่ได้จริง หรือ null ถ้ายังไม่สำเร็จ/รับไปแล้ว
export function claim(id) {
  const def = BY_ID.get(id);
  if (!def || isClaimed(id) || metricValue(def.metric) < def.target) return null;
  const r = rewardAmounts(def.reward);
  if (r.food) r.foodGained = economy.creditFood(r.food); // ถ้าคลังเต็มจะได้เท่าที่ใส่ได้
  if (r.eggs) state.eggs += r.eggs; // ไข่จากรางวัลไม่ติดเพดานของราชินี
  if (r.warriors) state.warriors += r.warriors;
  if (r.guaranteeRare) {
    const rule = antCfg.pity.find((p) => p.key === 'rare');
    if (rule) state.pity.rare = Math.max(state.pity.rare, rule.limit - 1); // ไข่ใบถัดไปได้ Rare ขึ้นไปแน่นอน
  }
  state.missions.claimed[id] = true;
  return { def, reward: r };
}
