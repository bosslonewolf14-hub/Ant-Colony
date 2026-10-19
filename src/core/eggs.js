import antCfg from '../config/ants.json';
import { state } from './state.js';
import { luckMultiplier } from './economy.js';
import { rollTier, advancePity } from './rng.js';

// ฟักไข่ 1 ใบ: หักไข่ → สุ่มชนิด (Luck + Pity) → เพิ่มมดสะสม
// คืน null ถ้าไม่มีไข่ ไม่งั้นคืนผล { type, idx, isNew } (isNew = เพิ่งพบชนิดนี้เป็นครั้งแรก)
export function hatchOne(rand = Math.random) {
  if (state.eggs < 1) return null;
  state.eggs -= 1;
  const idx = rollTier(luckMultiplier(), state.pity, rand);
  advancePity(state.pity, idx);
  const type = antCfg.types[idx];
  state.ants[type.id] += 1;
  state.totalHatched += 1;
  const isNew = state.firstHatch[type.id] == null;
  if (isNew) state.firstHatch[type.id] = state.totalHatched;
  return { type, idx, isNew };
}

export function hatchAll(rand = Math.random) {
  const results = [];
  while (state.eggs >= 1) results.push(hatchOne(rand));
  return results;
}
