import eventsCfg from '../config/events.json';
import { state } from './state.js';
import * as economy from './economy.js';
import { buffs, buffMult, weather, goldenRate, cooldownMultiplier } from './modifiers.js';

// เหตุการณ์สุ่มระหว่างเล่น: ผลเบอร์รี่ทอง / สภาพอากาศ / บัฟและสกิลราชินี (ตรรกะล้วน ภาพอยู่ใน scene/)
// สถานะทั้งหมดเป็นชั่วคราว ไม่ถูกบันทึกในเซฟ

export const golden = { active: null, nextIn: 0 }; // active = { x, left } ขณะที่มีผลเบอร์รี่ทองบนสนามหญ้า
export const cooldowns = { eggBurst: 0, rally: 0, frenzy: 0 }; // วินาทีที่เหลือก่อนใช้สกิลได้อีกครั้ง

const between = ([a, b], rand) => a + rand() * (b - a);

export function init(rand = Math.random) {
  golden.active = null;
  golden.nextIn = between(eventsCfg.golden.firstDelaySec, rand);
  weather.type = null;
  weather.left = 0;
  weather.nextIn = between(eventsCfg.weather.clearSec, rand);
  for (const k of Object.keys(cooldowns)) cooldowns[k] = 0;
}

function pickWeighted(items, weightOf, rand) {
  const total = items.reduce((s, it) => s + weightOf(it), 0);
  let r = rand() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

// ---------- ผลเบอร์รี่ทอง ----------
// ตำแหน่ง x บนสนามหญ้า: เลี่ยงช่องทางลง (±1.2) และเลี่ยงผลเบอร์รี่หลักที่ x ≈ 4.2
function goldenX(rand) {
  for (let i = 0; i < 20; i++) {
    const x = -8 + rand() * 16;
    if (Math.abs(x) > 1.4 && Math.abs(x - 4.2) > 1.6) return x;
  }
  return -5;
}

// คลิกผลเบอร์รี่ทอง: สุ่มรางวัลตามน้ำหนัก คืนรายละเอียดรางวัล (หรือ null ถ้าไม่มีผลทองอยู่)
export function collectGolden(rand = Math.random) {
  if (!golden.active) return null;
  golden.active = null;
  golden.nextIn = between(eventsCfg.golden.intervalSec, rand);
  state.stats.golden += 1;
  const r = pickWeighted(eventsCfg.golden.rewards, (x) => x.weight, rand);
  if (r.id === 'bonus') {
    const want = Math.max(r.minFood, economy.foodPerSec() * r.incomeSec);
    return { id: r.id, food: economy.creditFood(want), wanted: want };
  }
  if (r.id === 'frenzy') {
    buffs.frenzy = r.durationSec;
    buffMult.frenzy = r.mult;
    return { id: r.id, seconds: r.durationSec, mult: r.mult };
  }
  if (r.id === 'clickFrenzy') {
    buffs.clickFrenzy = r.durationSec;
    buffMult.clickFrenzy = r.mult;
    return { id: r.id, seconds: r.durationSec, mult: r.mult };
  }
  state.eggs += r.eggs; // ไข่จากผลทองไม่ติดเพดานของราชินี
  return { id: r.id, eggs: r.eggs };
}

// ---------- สกิลราชินี ----------
export function skillList() {
  return eventsCfg.skills;
}

export function skillUnlocked(index) {
  return economy.upgradeLevel('queenSkills') > index;
}

export function skillReady(id) {
  const i = eventsCfg.skills.findIndex((s) => s.id === id);
  return i >= 0 && skillUnlocked(i) && cooldowns[id] <= 0;
}

// ใช้สกิล: คืนข้อมูลสกิลถ้าใช้ได้ ไม่งั้น null
export function useSkill(id) {
  if (!skillReady(id)) return null;
  const s = eventsCfg.skills.find((x) => x.id === id);
  if (id === 'eggBurst') state.eggs += s.eggs;
  else if (id === 'rally') {
    buffs.rally = s.durationSec;
    buffMult.rally = s.mult;
  } else if (id === 'frenzy') {
    buffs.frenzy = s.durationSec;
    buffMult.frenzy = s.mult;
  }
  cooldowns[id] = s.cooldownSec * cooldownMultiplier();
  state.stats.skills += 1;
  return s;
}

// ---------- เดินเวลา ----------
// คืนรายการเหตุการณ์ของเฟรมนี้: golden-spawn / golden-expire / weather-start / weather-end
export function update(dt, rand = Math.random) {
  const events = [];

  for (const k of Object.keys(buffs)) if (buffs[k] > 0) buffs[k] = Math.max(0, buffs[k] - dt);
  for (const k of Object.keys(cooldowns)) if (cooldowns[k] > 0) cooldowns[k] = Math.max(0, cooldowns[k] - dt);

  // ผลเบอร์รี่ทอง
  if (golden.active) {
    golden.active.left -= dt;
    if (golden.active.left <= 0) {
      golden.active = null;
      golden.nextIn = between(eventsCfg.golden.intervalSec, rand);
      events.push({ type: 'golden-expire' });
    }
  } else {
    golden.nextIn -= dt * goldenRate();
    if (golden.nextIn <= 0) {
      golden.active = { x: goldenX(rand), left: eventsCfg.golden.lifeSec };
      events.push({ type: 'golden-spawn', x: golden.active.x });
    }
  }

  // สภาพอากาศ
  if (weather.type) {
    weather.left -= dt;
    if (weather.left <= 0) {
      const ended = weather.type;
      weather.type = null;
      weather.nextIn = between(eventsCfg.weather.clearSec, rand);
      events.push({ type: 'weather-end', weather: ended });
    }
  } else {
    weather.nextIn -= dt;
    if (weather.nextIn <= 0) {
      const ids = Object.keys(eventsCfg.weather.types);
      const type = pickWeighted(ids, (id) => eventsCfg.weather.weights[id] ?? 1, rand);
      weather.type = type;
      weather.left = eventsCfg.weather.types[type].durationSec;
      events.push({ type: 'weather-start', weather: type });
    }
  }
  return events;
}
