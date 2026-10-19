import cfg from '../config/economy.json';
import antCfg from '../config/ants.json';
import raidCfg from '../config/raid.json';
import { state } from './state.js';
import * as mods from './modifiers.js';

const U = cfg.upgrades;

// ---------- มดงาน ----------
// ราคาตัวที่ n+1 = baseCost × costGrowth^n
export function workerCost(owned = state.workers) {
  return Math.ceil(cfg.workers.baseCost * Math.pow(cfg.workers.costGrowth, owned));
}

export function canBuyWorker() {
  return state.food >= workerCost();
}

export function buyWorker() {
  const cost = workerCost();
  if (state.food < cost) return false;
  state.food -= cost;
  state.workers += 1;
  return true;
}

// ---------- คลังอาหาร ----------
// ความจุคลัง = baseCap × capGrowth^จำนวนห้องคลังที่สร้างแล้ว (ห้องแรกคือคลังพื้นฐานในห้องราชินี)
// อาหารที่เข้ามาตอนคลังเต็มจะล้นและเสียไป จึงต้องขยายห้องคลังเพื่อเก็บได้มากขึ้น
export function foodCapacity(rooms = state.upgrades.storage || 0) {
  return Math.round(cfg.storage.baseCap * Math.pow(cfg.storage.capGrowth, rooms));
}

export function foodFillFraction() {
  return Math.min(1, state.food / foodCapacity());
}

// ราคาของที่แพงกว่าความจุคลัง จะซื้อไม่ได้ไม่ว่าจะรอนานแค่ไหน ต้องขยายคลังก่อน
export function exceedsCapacity(cost) {
  return cost > foodCapacity();
}

// ---------- มดนักรบ ----------
export function warriorCost(owned = state.warriors) {
  return Math.ceil(cfg.warriors.baseCost * Math.pow(cfg.warriors.costGrowth, owned));
}

export function canBuyWarrior() {
  return state.food >= warriorCost();
}

export function buyWarrior() {
  const cost = warriorCost();
  if (state.food < cost) return false;
  state.food -= cost;
  state.warriors += 1;
  return true;
}

// ---------- อัปเกรด ----------
// ราคาเลเวลถัดไป = baseCost × growth^เลเวลปัจจุบัน (ปัดขึ้น)
export function upgradeLevel(id) {
  return state.upgrades[id] || 0;
}

export function upgradeMax(id) {
  return U[id].max ?? Infinity;
}

export function isMaxed(id) {
  return upgradeLevel(id) >= upgradeMax(id);
}

export function upgradeCost(id) {
  return Math.ceil(U[id].baseCost * Math.pow(U[id].growth, upgradeLevel(id)));
}

export function canBuyUpgrade(id) {
  return !isMaxed(id) && state.food >= upgradeCost(id);
}

export function buyUpgrade(id) {
  if (!canBuyUpgrade(id)) return false;
  state.food -= upgradeCost(id);
  state.upgrades[id] = upgradeLevel(id) + 1;
  return true;
}

// ---------- ค่าที่คำนวณจากอัปเกรด ----------
export function clickPower(level = upgradeLevel('clickPower')) {
  return (cfg.click.basePower + level * U.clickPower.perLevel) * mods.clickMultiplier();
}

// ตัวคูณรายได้จากความเร็วมด: 1 + เลเวล × perLevel
export function speedMultiplier(level = upgradeLevel('antSpeed')) {
  return 1 + level * U.antSpeed.perLevel;
}

export function fungusMultiplier() {
  return upgradeLevel('fungusRoom') > 0 ? U.fungusRoom.multiplier : 1;
}

// ความเร็วเดินของมดในฉาก (ภาพเท่านั้น) โตช้ากว่ารายได้เล็กน้อยเพื่อไม่ให้มดวิ่งเร็วจนดูตลก
export function antVisualSpeed() {
  return 1 + upgradeLevel('antSpeed') * U.antSpeed.visualPerLevel;
}

// ---------- อัตราเก็บอาหาร ----------
// ทุกตัวที่เดินส่งอาหารเก็บได้ "อัตราต่อวินาที" ของตัวเอง ยิ่ง Rank สูงยิ่งเก็บได้มาก (ดู foodPerSec ใน ants.json)
// อาหารเข้าตอนมดเดินถึงห้องราชินี = อัตราของมดตัวนั้น × เวลาที่ใช้ในรอบนั้น (ดู scene/ants.js)
// จึงเป็นอัตราเฉลี่ยเท่ากับที่แสดงในเกมเสมอ ไม่ว่ามดจะเดินเร็วหรือช้า
function globalMultiplier() {
  return speedMultiplier() * fungusMultiplier() * mods.incomeMultiplier();
}

// อัตราดิบของมดสะสมทั้งหมด (ยังไม่ลดทอน ไม่คูณตัวคูณ) = Σ จำนวน × foodPerSec
export function storedAntsRaw(ants = state.ants) {
  let raw = 0;
  for (const t of antCfg.types) raw += (ants[t.id] || 0) * t.foodPerSec;
  return raw;
}

// มดสะสมมาจากไข่ที่ได้ฟรีตามเวลา จึงใช้การลดทอนแบบนุ่ม: ผลรวมจริง = cap × (1 − e^(−raw/cap))
// ช่วงแรกได้เต็มค่า แล้วเข้าใกล้ cap (collectCap ใน ants.json) โดยไม่เกิน กันไข่ฟรีกลบการซื้อมดงานด้วยอาหาร
export function storedAntsEffective(raw = storedAntsRaw()) {
  const cap = antCfg.collectCap * mods.jellyCapBonus(); // Royal Jelly ขยายเพดานของมดสะสมด้วย
  return cap * (1 - Math.exp(-raw / cap));
}

// สัดส่วนที่มดสะสมแต่ละตัวได้จริง (1 = ไม่ถูกลดทอน)
export function storedAntsEfficiency(raw = storedAntsRaw()) {
  return raw > 0 ? storedAntsEffective(raw) / raw : 1;
}

// อัตราเก็บอาหารต่อวินาทีของมด 1 ตัว (รวมตัวคูณและการลดทอนแล้ว): kindId = 'worker' หรือ id ของชนิดมดสะสม
export function perAntRate(kindId, efficiency = storedAntsEfficiency()) {
  if (kindId === 'worker') return cfg.workers.foodPerSec * globalMultiplier();
  const t = antCfg.types.find((x) => x.id === kindId);
  return t ? t.foodPerSec * globalMultiplier() * efficiency : 0;
}

// อัตราของมดงาน 1 ตัว (ซื้อด้วยอาหาร)
export function workerYield() {
  return perAntRate('worker');
}

// รายได้ต่อวินาทีของมดสะสมทั้งหมด (หลังลดทอนและตัวคูณ)
export function storedAntsIncome() {
  return storedAntsEffective() * globalMultiplier();
}

// รายได้ต่อวินาทีของทั้งรัง = มดงาน + มดสะสมทุก Rank
export function foodPerSec() {
  return state.workers * workerYield() + storedAntsIncome();
}

// ---------- พลังป้องกัน ----------
// ตัวคูณพลังนักรบจากค่ายนักรบ = 1 + ระดับ × perLevel
export function barracksMultiplier(level = upgradeLevel('barracks')) {
  return 1 + level * U.barracks.perLevel;
}

// พลังป้องกันรวม = นักรบ × พลังต่อตัว × ตัวคูณค่าย + พลังจากมดสะสม Rank สูง (Rare ขึ้นไปช่วยสู้ด้วย)
export function defensePower() {
  const p = state.warriors * cfg.warriors.power * barracksMultiplier() + storedDefense();
  return p * mods.defenseMultiplier(); // สกิลระดมพล + งานวิจัยเกราะหนา
}

// พลังป้องกันจากมดสะสม Rank สูง: ลดทอนแบบนุ่มเข้าหา storedDefenseCap (มดสะสมได้ฟรีตามเวลา ถ้าไม่จำกัดจะไม่ต้องซื้อนักรบเลย)
export function storedDefense() {
  let raw = 0;
  for (const [id, per] of Object.entries(raidCfg.defensePerStoredAnt)) raw += (state.ants[id] || 0) * per;
  const cap = raidCfg.storedDefenseCap;
  return cap * (1 - Math.exp(-raw / cap));
}

// ---------- ไข่ ----------
// วินาทีต่อไข่ 1 ใบ = intervalSec ÷ (1 + เลเวลเร่งวางไข่ × perLevel)
export function eggInterval(level = upgradeLevel('eggSpeed')) {
  return cfg.eggs.intervalSec / (1 + level * U.eggSpeed.perLevel) / mods.eggRateMultiplier();
}

// ตัวคูณ Luck = 1 + เลเวล × perLevel (ใช้คูณน้ำหนักของแต่ละระดับยกกำลังตามระดับ ดู rng.js)
export function luckMultiplier(level = upgradeLevel('luck')) {
  return 1 + level * U.luck.perLevel + mods.luckBonus();
}

// ราชินีวางไข่ตามเวลาที่ผ่านไป ไม่เกินเพดาน คืนจำนวนไข่ที่เพิ่มขึ้น
export function layEggs(seconds) {
  if (state.eggs >= cfg.eggs.cap) {
    state.eggProgress = 0;
    return 0;
  }
  const interval = eggInterval();
  const t = state.eggProgress + seconds;
  const n = Math.min(Math.floor(t / interval), cfg.eggs.cap - state.eggs);
  state.eggs += n;
  state.eggProgress = state.eggs >= cfg.eggs.cap ? 0 : t - n * interval;
  return n;
}

// ---------- การคลิก / เวลาเดิน ----------
export function clickFood() {
  const gain = clickPower();
  creditFood(gain);
  state.clicks += 1;
  return gain;
}

// เพิ่มอาหารเข้าคลัง (มดส่งถึงห้องราชินี / คลิก / รางวัล) ไม่เกินความจุ ส่วนที่ล้นนับเป็นอาหารที่เสียไป
// คืนจำนวนที่เข้าคลังจริง
export function creditFood(amount) {
  const room = Math.max(0, foodCapacity() - state.food);
  const accepted = Math.min(amount, room);
  state.food += accepted;
  state.totalFood += accepted;
  state.wasted += amount - accepted;
  return accepted;
}

// อาหารถูกขโมย/หายไป (ถูกบุก) คืนจำนวนที่หายจริง
export function loseFood(amount) {
  const lost = Math.min(Math.max(amount, 0), state.food);
  state.food -= lost;
  return lost;
}

// รายได้แบบต่อเนื่อง (ไม่ผ่านการเดินของมด) ใช้ในการจำลองบาลานซ์/ทดสอบ ในเกมจริงอาหารเข้าผ่าน creditFood ตอนมดส่ง
export function earnPassive(dt) {
  creditFood(foodPerSec() * dt);
}

// เดินเวลา: อาหารไม่ได้เข้าตรงนี้แล้ว (เข้าตอนมดส่ง) เหลือแค่ราชินีวางไข่
export function tick(dt) {
  layEggs(dt);
}
