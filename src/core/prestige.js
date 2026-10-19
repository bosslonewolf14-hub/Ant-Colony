import prestigeCfg from '../config/prestige.json';
import economyCfg from '../config/economy.json';
import raidCfg from '../config/raid.json';
import { state } from './state.js';

// ก่อตั้งอาณานิคมใหม่ (Prestige): รีเซ็ตความคืบหน้ารอบนี้ แลก Royal Jelly ที่ให้โบนัสถาวร
// Royal Jelly ที่ได้ = ⌊(อาหารสะสมรอบนี้ ÷ divisor)^exponent⌋ เมื่ออาหารสะสมถึง minFood

export function runFood() {
  return state.totalFood;
}

export function jellyGain(food = runFood()) {
  if (food < prestigeCfg.minFood) return 0;
  return Math.floor(Math.pow(food / prestigeCfg.divisor, prestigeCfg.exponent));
}

export function canPrestige() {
  return jellyGain() >= 1;
}

// ก่อตั้งใหม่: คืนจำนวน Royal Jelly ที่ได้ (0 = ทำไม่ได้)
// สิ่งที่คงอยู่: Royal Jelly, งานวิจัย, ห้องวิจัย/สกิลราชินี, สมุดสะสม (ชนิดมดที่เคยพบ), ภารกิจที่รับแล้ว, สถิติ
// สิ่งที่รีเซ็ต: อาหาร มดงาน/นักรบ อัปเกรดอื่น ๆ ไข่ มดสะสม Pity คลื่นศัตรู
export function perform() {
  const gain = jellyGain();
  if (gain < 1) return 0;
  const keep = new Set(prestigeCfg.keepUpgrades);

  state.prestige.jelly += gain;
  state.prestige.count += 1;

  state.food = 0;
  state.totalFood = 0;
  state.workers = 0;
  state.warriors = 0;
  state.clicks = 0;
  for (const id of Object.keys(state.upgrades)) if (!keep.has(id)) state.upgrades[id] = 0;
  state.eggs = economyCfg.eggs.startEggs;
  state.eggProgress = 0;
  state.totalHatched = 0;
  for (const id of Object.keys(state.ants)) state.ants[id] = 0;
  for (const key of Object.keys(state.pity)) state.pity[key] = 0;
  state.raid.wave = 0;
  state.raid.nextIn = raidCfg.firstDelaySec;
  // งานวิจัยที่กำลังทำอยู่ทำต่อได้ (ค่าใช้จ่ายจ่ายไปแล้ว) ไม่ต้องเริ่มใหม่
  return gain;
}
