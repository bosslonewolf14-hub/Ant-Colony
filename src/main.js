import './style.css';
import * as THREE from 'three';
import { createWorld } from './scene/world.js';
import { createAnts } from './scene/ants.js';
import { createEffects } from './scene/effects.js';
import { createCameraRig } from './scene/cameraRig.js';
import { createHud } from './ui/hud.js';
import { state } from './core/state.js';
import * as economy from './core/economy.js';
import * as save from './core/save.js';
import * as eggs from './core/eggs.js';
import * as raidCore from './core/raid.js';
import * as missions from './core/missions.js';
import * as events from './core/events.js';
import * as research from './core/research.js';
import * as prestige from './core/prestige.js';
import * as mods from './core/modifiers.js';
import * as audio from './audio.js';
import { renderAntPortraits } from './scene/antPortraits.js';
import { createRaidScene } from './scene/raid.js';
import { createGolden } from './scene/golden.js';
import { createWeather } from './scene/weather.js';
import cfg from './config/economy.json';
import antCfg from './config/ants.json';
import raidCfg from './config/raid.json';
import { FUNGUS, QUEEN_POS, FLOOR_Y, ANT_PATH, RAID } from './scene/layout.js';
import { formatNum } from './util/format.js';

// โหลดเซฟก่อนสร้างฉาก เพื่อให้ห้อง/จำนวนมดเริ่มต้นตรงกับที่บันทึกไว้
const loaded = save.load();

const app = document.getElementById('app');
const canvas = document.getElementById('scene');
const shop = document.getElementById('shop');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const rig = createCameraRig(camera);

const portraits = renderAntPortraits(antCfg.types);
const world = createWorld();
// อาหารเข้าคลังตอนมดเดินถึงห้องราชินี (ไม่ได้เข้าต่อเนื่องแล้ว) แต่ละตัวส่งได้ตามอัตราของ Rank ตัวเอง
// ตัวเลขลอยรวมหลายตัวทุก 0.6 วินาทีไม่ให้รก: มดทั่วไปรวมเป็นตัวเลขเดียว ส่วนมด Rare ขึ้นไปแยกลอยตามสี Rank
const RANK_FLOAT_TIER = 2;
const DELIVER_WINDOW = 0.6;
let deliverTimer = 0;
let deliverAcc = 0;
let wastedAcc = 0; // อาหารที่มดส่งมาแต่คลังเต็ม (ล้น)
let stolenAcc = 0; // อาหารที่ถูกศัตรูขโมยในช่วงนี้
const rankAcc = new Map(); // tier → { amount, color }
const ants = createAnts(world.scene, {
  onDeliver: (amount, kind) => {
    const accepted = economy.creditFood(amount); // ไม่เกินความจุคลัง
    wastedAcc += amount - accepted;
    if (kind.tier >= RANK_FLOAT_TIER) {
      const e = rankAcc.get(kind.tier) || { amount: 0, color: kind.color };
      e.amount += accepted;
      rankAcc.set(kind.tier, e);
    } else {
      deliverAcc += accepted;
    }
  },
});
const effects = createEffects(world.scene);
const raidScene = createRaidScene(world.scene, effects);
const goldenScene = createGolden(world.scene, world.clickables, effects);
const weatherScene = createWeather(world.scene);
events.init(); // ตั้งเวลาผลเบอร์รี่ทอง/สภาพอากาศรอบแรก (สถานะชั่วคราว ไม่อยู่ในเซฟ)

// ห้องที่ปลดล็อกด้วยอัปเกรด: ซิงก์ภาพให้ตรงกับระดับอัปเกรดปัจจุบัน (animate = ขุดโผล่ทีละห้อง)
function syncRooms(animate) {
  world.rooms.setHatchery(economy.upgradeLevel('luck'), animate);
  world.rooms.setBarracks(economy.upgradeLevel('barracks'), animate);
  world.rooms.setStorage(economy.upgradeLevel('storage'), animate);
  world.rooms.setLab(economy.upgradeLevel('lab'), animate);
}

// พากล้องไปดูห้องที่เพิ่งสร้างสักครู่ แล้วพากลับที่เดิม (ถ้าระหว่างนั้นผู้เล่นไม่ได้เลื่อนเอง)
function showNewRoom(kind, n) {
  const c = world.rooms.center(kind, n);
  effects.burst(c.x, c.y, 0.9, 0xc99a63, 30);
  if (!reduceMotion.matches) rig.focusTemporarily(c.y, 3200);
}

function buy(id) {
  const levelBefore = economy.upgradeLevel(id);
  let ok;
  if (id === 'worker') ok = economy.buyWorker();
  else if (id === 'warrior') ok = economy.buyWarrior();
  else ok = economy.buyUpgrade(id);
  if (!ok) return;
  if (id === 'fungusRoom') {
    world.setFungusRoom(true, true);
    effects.burst(FUNGUS.x, FUNGUS.y, 0.8, 0xc99a63, 28);
    audio.play('unlock');
  } else if (id === 'luck' || id === 'barracks' || id === 'storage' || id === 'lab') {
    syncRooms(true);
    // ห้องบ่มไข่/ค่ายนักรบ/ห้องวิจัย โผล่ตอนซื้อระดับแรก ส่วนห้องคลังโผล่ทุกครั้งที่ขยาย
    if (levelBefore === 0 && id === 'luck') showNewRoom('hatchery');
    if (levelBefore === 0 && id === 'barracks') showNewRoom('barracks');
    if (id === 'lab') showNewRoom('lab');
    if (id === 'storage') showNewRoom('storage', economy.upgradeLevel('storage'));
    audio.play(id === 'storage' || levelBefore === 0 ? 'unlock' : 'buy');
  } else if (id === 'queenSkills') {
    const s = events.skillList()[economy.upgradeLevel('queenSkills') - 1];
    hud.notify(`👑 ปลดล็อกสกิลราชินี: ${s.icon} ${s.name}`, '#ffc21a');
    audio.play('unlock');
  } else {
    audio.play('buy');
  }
  hud.flashSaved(save.save());
}

// ผลเบอร์รี่ทอง: แจ้งรางวัลที่สุ่มได้
function announceGolden(r) {
  let text;
  if (r.id === 'bonus') text = `✨ ผลเบอร์รี่ทอง! +${formatNum(r.food)} อาหาร`;
  else if (r.id === 'frenzy') text = `✨ ผลเบอร์รี่ทอง! รายได้ ×${r.mult} นาน ${r.seconds} วินาที`;
  else if (r.id === 'clickFrenzy') text = `✨ ผลเบอร์รี่ทอง! พลังคลิก ×${r.mult} นาน ${r.seconds} วินาที`;
  else text = `✨ ผลเบอร์รี่ทอง! ไข่ +${r.eggs} ใบ`;
  hud.notify(text, '#ffc21a');
  audio.play('claim');
  hud.flashSaved(save.save());
}

// ---------- สกิลราชินี / วิจัย / ก่อตั้งอาณานิคมใหม่ ----------
function useSkill(id) {
  const s = events.useSkill(id);
  if (!s) return;
  if (id === 'eggBurst') effects.burst(QUEEN_POS.x + 0.9, FLOOR_Y + 1.1, 1.0, '#fff3d6', 30);
  else effects.burst(QUEEN_POS.x, FLOOR_Y + 1.2, 1.0, id === 'rally' ? '#e03a3a' : '#ffc21a', 26);
  world.hatchPulse(id === 'rally' ? '#e03a3a' : '#ffc21a', 2);
  hud.notify(`${s.icon} ใช้สกิล ${s.name}!`, '#ffc21a');
  audio.play('claim');
  hud.flashSaved(save.save());
}

function startResearch(id) {
  if (!research.start(id)) return;
  const n = research.nodes().find((x) => x.id === id);
  hud.notify(`🔬 เริ่มวิจัย: ${n.name}`, '#3b82f6');
  audio.play('buy');
  hud.flashSaved(save.save());
}

// หลังก่อตั้งอาณานิคมใหม่: บันทึกแล้วโหลดหน้าใหม่ ให้ฉากทั้งหมดเริ่มตามสถานะที่รีเซ็ตแล้ว (แจ้งผลหลังโหลดผ่าน sessionStorage)
function doPrestige() {
  const gain = prestige.perform();
  if (!gain) return;
  save.save();
  try {
    sessionStorage.setItem('ant-prestige-gain', String(gain));
  } catch {
    // ไม่มี sessionStorage ก็แค่ไม่โชว์ข้อความหลังโหลด
  }
  window.location.reload();
}

// ---------- ภารกิจ ----------
function claimMission(id) {
  const res = missions.claim(id);
  if (!res) return;
  const r = res.reward;
  const parts = [];
  if (r.foodGained) parts.push(`🍓 ${formatNum(r.foodGained)}`);
  if (r.eggs) parts.push(`🥚 ${r.eggs}`);
  if (r.warriors) parts.push(`🛡️ ${r.warriors}`);
  if (r.guaranteeRare) parts.push('✨ ไข่ใบถัดไปได้ Rare+');
  hud.notify(`🎯 ภารกิจสำเร็จ! ${parts.join(' · ')}`, '#ffc21a');
  audio.play('claim');
  hud.flashSaved(save.save());
}

// ---------- เสียงและการสั่น/แสงวาบ ----------
// เบราว์เซอร์ให้เล่นเสียงได้หลังผู้เล่นโต้ตอบครั้งแรก
for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, audio.unlock, { passive: true });

const muteBtn = document.getElementById('mute-btn');
function syncMute() {
  const on = audio.isEnabled();
  muteBtn.textContent = on ? '🔊' : '🔇';
  muteBtn.setAttribute('aria-pressed', String(!on));
  muteBtn.title = on ? 'ปิดเสียง' : 'เปิดเสียง';
}
muteBtn.addEventListener('click', () => {
  audio.setEnabled(!audio.isEnabled());
  syncMute();
  audio.unlock();
  audio.play('click'); // ตอนเพิ่งเปิดเสียงให้ได้ยินเป็นการยืนยัน (ตอนปิดจะไม่ดัง)
});
syncMute();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ผลการฟักไข่: สรุปผลใน UI + ประกายสีตามระดับที่ดีที่สุดที่ได้ (ยิ่งหายากยิ่งเยอะ)
// ยิ่งระดับสูง: ประกายเยอะขึ้น วงแหวน/แสงในห้องใหญ่ขึ้น Rare+ เริ่มสั่นจอ Epic+ แสงวาบเต็มจอ เสียงยาวและมีชั้นมากขึ้น
// ฟักหลายใบพร้อมกัน (ฟักทั้งหมด) แสดงเอฟเฟกต์ครั้งเดียวตามใบที่ดีที่สุด
const BURST_COUNT = [8, 12, 18, 28, 44];
const SHAKE = [null, null, [0.05, 0.35], [0.12, 0.5], [0.22, 0.9]]; // [แอมพลิจูด (หน่วยโลก), วินาที]
const FLASH_PEAK = [0, 0, 0, 0.3, 0.65];
function afterHatch(results) {
  if (!results.length) return;
  hud.showHatch(results);
  const best = results.reduce((a, b) => (b.type.tier > a.type.tier ? b : a));
  const tier = best.type.tier;
  const color = best.type.color;
  effects.burst(QUEEN_POS.x + 0.9, FLOOR_Y + 1.1, 1.0, color, BURST_COUNT[tier]);
  world.hatchPulse(color, tier);
  if (!reduceMotion.matches) {
    if (SHAKE[tier]) rig.shake(...SHAKE[tier]);
    if (FLASH_PEAK[tier]) hud.flash(color, FLASH_PEAK[tier]);
  }
  audio.hatch(tier);
  hud.flashSaved(save.save());
}

const hud = createHud({
  onBuy: buy,
  onReset: () => {
    save.reset();
    window.location.reload();
  },
  onHatchOne: () => afterHatch([eggs.hatchOne()].filter(Boolean)),
  onHatchAll: () => afterHatch(eggs.hatchAll()),
  onClaim: claimMission,
  onSkill: useSkill,
  onResearch: startResearch,
  onPrestige: doPrestige,
  onLayout: () => resize(),
  portraits,
});
world.setFungusRoom(economy.upgradeLevel('fungusRoom') > 0, false);
syncRooms(false);

// หลังก่อตั้งอาณานิคมใหม่ (โหลดหน้าใหม่) แจ้งผลสั้น ๆ
try {
  const g = sessionStorage.getItem('ant-prestige-gain');
  if (g) {
    sessionStorage.removeItem('ant-prestige-gain');
    hud.notify(`👑 ก่อตั้งอาณานิคมใหม่แล้ว! ได้ Royal Jelly +${g}`, '#d968b0');
  }
} catch {
  // ไม่มี sessionStorage ก็ข้าม
}

// ---------- บันทึกอัตโนมัติ + รายได้ตอนไม่ได้เล่น ----------
function offlineWelcome(sinceMs) {
  const result = save.applyOffline(sinceMs);
  save.save(); // บันทึกทันที กันรับรายได้ซ้ำถ้ารีเฟรชก่อนถึงรอบบันทึกถัดไป
  if (result.show) hud.showWelcomeBack(result, cfg.offline);
}

if (loaded) {
  if (state.clicks > 0 || state.workers > 0) hud.hideHint();
  offlineWelcome(loaded.savedAt);
}

// ช่วงที่แท็บถูกซ่อน เบราว์เซอร์หยุดวาดเฟรม → บันทึกตอนซ่อน แล้วคิดรายได้ย้อนหลังตอนกลับมา
// (ตอนซ่อนห้ามบันทึกทับ ไม่งั้นเวลาที่ผ่านไปจะหายไป)
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    save.save();
  } else if (hiddenAt) {
    const since = hiddenAt;
    hiddenAt = 0;
    last = performance.now();
    offlineWelcome(since);
    ants.syncTime(last / 1000); // รายได้ช่วงที่แท็บถูกพักคิดไปแล้ว ไม่ให้มดส่งซ้ำตามเวลาที่ผ่านไป
  }
});
window.addEventListener('pagehide', () => {
  if (!document.hidden) save.save();
});
setInterval(() => {
  if (!document.hidden) hud.flashSaved(save.save());
}, cfg.save.intervalSec * 1000);

// ตัวเลขลอยตรงจุดที่มดส่งอาหาร (ปากห้องราชินี) ถ้าจุดนั้นอยู่นอกจอ (เลื่อนกล้องไปที่อื่น) จะลอยจากตัวนับอาหารแทน
const deliverPoint = new THREE.Vector3(ANT_PATH[0][0], ANT_PATH[0][1] + 0.9, 0.6);
function showDelivery(amount, color, slot = 0) {
  const rect = canvas.getBoundingClientRect();
  const p = deliverPoint.clone().project(camera);
  let x = ((p.x + 1) / 2) * rect.width;
  let y = ((1 - p.y) / 2) * rect.height;
  if (x < 24 || x > rect.width - 24 || y < 24 || y > rect.height - 24) {
    const r = document.getElementById('food-value').getBoundingClientRect();
    x = r.left - rect.left + r.width / 2;
    y = r.bottom - rect.top + 8;
  }
  // หลายลำดับ Rank ในรอบเดียวกันเลื่อนตำแหน่งเล็กน้อยไม่ให้ซ้อนกัน
  x += (slot % 3) * 34 - 34;
  y -= slot * 18;
  const text = '+' + formatNum(amount, amount < 10 ? 1 : 0);
  if (color) hud.floater(text, x, y, 'delivered rank', color);
  else hud.floater(text, x, y, 'delivered');
}

function flushDeliveries() {
  let any = false;
  if (deliverAcc > 0) {
    showDelivery(deliverAcc);
    any = true;
  }
  let slot = 1;
  for (const tier of [...rankAcc.keys()].sort((a, b) => a - b)) {
    const e = rankAcc.get(tier);
    showDelivery(e.amount, e.color, slot++);
    any = true;
  }
  if (any) hud.bumpFood();
  deliverAcc = 0;
  rankAcc.clear();

  // อาหารถูกขโมยตอนศัตรูบุก: ตัวเลขแดงลอยที่หน้าปากทางลง
  if (stolenAcc >= 1) {
    const p = gatePoint.clone().project(camera);
    const rect = canvas.getBoundingClientRect();
    hud.floater('-' + formatNum(stolenAcc), ((p.x + 1) / 2) * rect.width, ((1 - p.y) / 2) * rect.height, 'stolen');
  }
  stolenAcc = 0;
  // คลังเต็ม: อาหารที่มดส่งมาล้นเสียไป แจ้งใต้ตัวนับอาหาร
  if (wastedAcc >= 1) {
    const r = document.getElementById('food-value').getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    hud.floater('📦 ล้น -' + formatNum(wastedAcc), r.left - rect.left + r.width / 2, r.bottom - rect.top + 22, 'stolen');
  }
  wastedAcc = 0;
}

// จุดหน้าปากทางลงบนสนามหญ้า (ตำแหน่งตัวเลขตอนถูกขโมย)
const gatePoint = new THREE.Vector3(RAID.guardBackX - 1.6, 1.0, 0.7);

// ย้ายผลเบอร์รี่ทองไปที่ที่ผู้เล่นเห็นและแตะได้ (จอแนวตั้งเห็นไม่ครบสนามหญ้า และการ์ดอาหาร/แผงร้านค้า/ปุ่มสกิลอาจบังอยู่)
function placeGoldenInView() {
  const g = events.golden.active;
  if (!g) return;
  const rect = canvas.getBoundingClientRect();
  const blockers = ['hud', 'shop', 'skills', 'raid-banner']
    .map((id) => document.getElementById(id))
    .filter((el) => el && !el.classList.contains('hidden'))
    .map((el) => el.getBoundingClientRect());
  const p = new THREE.Vector3();
  const candidates = [g.x];
  for (let i = 0; i < 40; i++) candidates.push(-9 + Math.random() * 18);
  for (const x of candidates) {
    if (Math.abs(x) < 1.4 || Math.abs(x - 4.2) < 1.6) continue; // เลี่ยงช่องทางลงและผลเบอร์รี่หลัก
    p.set(x, 1.0, 0.7).project(camera);
    const sx = rect.left + ((p.x + 1) / 2) * rect.width;
    const sy = rect.top + ((1 - p.y) / 2) * rect.height;
    const inside = sx > rect.left + 40 && sx < rect.right - 40 && sy > rect.top + 40 && sy < rect.bottom - 40;
    const blocked = blockers.some((b) => sx > b.left - 36 && sx < b.right + 36 && sy > b.top - 36 && sy < b.bottom + 36);
    if (inside && !blocked) {
      g.x = x;
      return;
    }
  }
}

// ---------- เหตุการณ์สุ่ม / งานวิจัยเสร็จ ----------
function handleWorldEvents(list) {
  for (const ev of list) {
    if (ev.type === 'golden-spawn') {
      placeGoldenInView();
      hud.notify('✨ ผลเบอร์รี่ทองโผล่ที่สนามหญ้า! รีบแตะ', '#ffc21a');
      audio.play('unlock');
    } else if (ev.type === 'weather-start') {
      const w = mods.activeWeather();
      hud.notify(`${w.icon} ${w.name}: ${w.effect}`, '#4a7bd8');
    }
  }
}

function handleResearchDone(ev) {
  const n = research.nodes().find((x) => x.id === ev.id);
  hud.notify(`🔬 วิจัยสำเร็จ: ${n.name}`, '#3b82f6');
  audio.play('claim');
  const c = world.rooms.center('lab');
  effects.burst(c.x, c.y, 0.9, '#7bc9ff', 26);
  hud.flashSaved(save.save());
}

// ---------- เหตุการณ์การบุก ----------
function handleRaidEvents(events) {
  for (const ev of events) {
    if (ev.type === 'start') {
      hud.notify(`⚠️ ศัตรูบุก! คลื่นที่ ${ev.wave}`, '#e03a3a');
      audio.play('alarm');
      if (!reduceMotion.matches) rig.shake(0.05, 0.4);
      rig.focusY(-0.6); // พากล้องกลับมาที่ผิวดินให้เห็นการต่อสู้ (ถ้าผู้เล่นกำลังดูห้องลึก ๆ อยู่)
      rig.focusX(-3.5); // จอแนวตั้งเห็นไม่ครบกว้าง → เลื่อนไปทางซ้ายที่ศัตรูเข้ามา (จอกว้างจะไม่ขยับ)
    } else if (ev.type === 'steal') {
      stolenAcc += ev.amount;
    } else if (ev.type === 'win') {
      hud.notify(`🏆 ป้องกันสำเร็จ! +${formatNum(ev.reward.food)} อาหาร +${ev.reward.eggs} ไข่`, '#3fae49');
      audio.play('victory');
      effects.burst(RAID.guardBackX - 1.2, 1.0, 0.8, '#ffd23f', 36);
      hud.flashSaved(save.save());
    } else if (ev.type === 'lose') {
      hud.notify(`💨 สู้ไม่ทัน ถูกขโมย -${formatNum(ev.loss)} อาหาร`, '#7a4a24');
      audio.play('defeat');
      hud.flashSaved(save.save());
    } else if (ev.type === 'kill') {
      audio.play('click');
    } else if (ev.type === 'end') {
      rig.focusX(0);
    }
  }
}

// อัตราเก็บอาหารต่อวินาทีของมด 1 ตัวแต่ละชนิด (ใช้ในฉากคำนวณมูลค่าอาหารที่มดส่งแต่ละรอบ)
const rates = {};
function currentRates() {
  const eff = economy.storedAntsEfficiency();
  rates.worker = economy.perAntRate('worker', eff);
  for (const t of antCfg.types) rates[t.id] = economy.perAntRate(t.id, eff);
  return rates;
}

// ---------- ขนาดหน้าจอ ----------
function resize() {
  const w = app.clientWidth;
  const h = app.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  // แผงร้านค้าอยู่ด้านขวา → ขยับฉากไปทางซ้ายให้อยู่กลางพื้นที่ที่ไม่ถูกบัง
  const rect = shop.getBoundingClientRect();
  const sideDocked = rect.left > w * 0.5;
  rig.resize(w, h, sideDocked ? w - rect.left : 0, sideDocked ? 0 : h - rect.top);
  // ปุ่มลอย (สกิลราชินี) วางเหนือแผงร้านค้าเมื่อแผงอยู่ด้านล่าง (จอแนวตั้ง) ไม่งั้นวางมุมซ้ายล่าง
  app.style.setProperty('--sheet-h', (sideDocked ? 0 : Math.max(0, h - rect.top)) + 'px');
}
new ResizeObserver(resize).observe(app);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- การคลิก/ลาก ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmp = new THREE.Vector3();

function tapAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(world.clickables, false)[0];
  if (!hit) return;

  // ผลเบอร์รี่ทอง: ได้โบนัสสุ่มแทนการเก็บอาหารปกติ
  if (hit.object.userData.isGolden) {
    const r = events.collectGolden();
    goldenScene.collect();
    if (r) announceGolden(r);
    return;
  }

  const gain = economy.clickFood();
  audio.play('click');
  if (hit.object.userData.isBerry) world.popBerry();
  hud.hideHint();
  hud.floater('+' + formatNum(gain), clientX - rect.left, clientY - rect.top - 8);
  effects.burst(hit.point.x, hit.point.y + 0.1, hit.point.z + 0.2, hit.object.userData.isBerry ? 0xff5c7a : 0x7be05a, 9);
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (drag) return;
  canvas.setPointerCapture(e.pointerId);
  drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true;
  if (drag.moved) rig.panByPixels(e.clientY - drag.y, e.clientX - drag.x);
  drag.y = e.clientY;
  drag.x = e.clientX;
});
function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && !cancelled) tapAt(e.clientX, e.clientY);
  drag = null;
}
canvas.addEventListener('pointerup', (e) => endDrag(e, false));
canvas.addEventListener('pointercancel', (e) => endDrag(e, true));
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    rig.panByWheel(e.deltaY);
  },
  { passive: false },
);

// ---------- เต็มจอ (เล่นได้ทั้งแนวตั้งและแนวนอน ไม่ล็อกทิศทางหน้าจอ) ----------
document.getElementById('fs-btn').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // อุปกรณ์/เบราว์เซอร์ไม่รองรับเต็มจอ (เช่น iPhone) → เล่นในหน้าเว็บตามปกติ
  }
});

// ---------- เกมลูป ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const time = now / 1000;

  economy.tick(dt); // ราชินีวางไข่ (อาหารเข้าตอนมดส่ง ผ่าน onDeliver)
  const raidEvents = raidCore.update(dt);
  if (raidEvents.length) handleRaidEvents(raidEvents);
  raidScene.update(dt, time, state.warriors, raidEvents);
  world.rooms.setStorageFill(economy.foodFillFraction());

  // เหตุการณ์สุ่ม (ผลเบอร์รี่ทอง/สภาพอากาศ) + งานวิจัยที่กำลังทำอยู่
  const worldEvents = events.update(dt);
  if (worldEvents.length) handleWorldEvents(worldEvents);
  for (const ev of research.update(dt)) handleResearchDone(ev);
  goldenScene.update(dt, time, events.golden.active);
  weatherScene.update(dt, time, mods.weather.type);
  world.rooms.setLabActive(!!state.research.active);

  world.update(dt, time, weatherScene.cloudSpeed.value);
  world.setEggCount(state.eggs);
  ants.update(dt, time, { ...state.ants, worker: state.workers }, economy.antVisualSpeed(), currentRates());

  deliverTimer += dt;
  if (deliverTimer >= DELIVER_WINDOW) {
    deliverTimer = 0;
    flushDeliveries();
  }
  effects.update(dt);
  rig.update(dt);

  tmp.copy(world.berry.position);
  tmp.y += 1.2;
  tmp.project(camera);
  const rect = canvas.getBoundingClientRect();
  hud.placeHint(((tmp.x + 1) / 2) * rect.width, ((1 - tmp.y) / 2) * rect.height);

  hud.update();
  renderer.render(world.scene, camera);
}
requestAnimationFrame(frame);

// เครื่องมือจำลองบาลานซ์ (เฉพาะโหมดพัฒนา ไม่อยู่ในไฟล์ build)
if (import.meta.env.DEV) import('./dev/fullSim.js').then((m) => (window.__fullSim = m.fullSim));

if (import.meta.env.DEV) window.__ant = { state, camera, world, economy, save, eggs, audio, rig, portraits, renderer, ants, effects, hud, cfg, antCfg, raidCore, raidScene, missions, raidCfg, events, research, prestige, mods, goldenScene, weatherScene };
