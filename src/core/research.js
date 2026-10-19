import researchCfg from '../config/research.json';
import { state } from './state.js';
import * as economy from './economy.js';

// ห้องวิจัย: ต้นไม้งานวิจัย 3 สาย (หาอาหาร / เพาะพันธุ์ / ป้องกัน) แต่ละหัวข้อจ่ายอาหารแล้วรอเวลา ทำได้ทีละหัวข้อ
// งานวิจัยที่เสร็จแล้วถาวร ไม่รีเซ็ตตอนก่อตั้งอาณานิคมใหม่ ผลของแต่ละหัวข้ออ่านใน modifiers.js

const NODES = new Map(researchCfg.nodes.map((n) => [n.id, n]));

export function branches() {
  return researchCfg.branches;
}

export function nodes() {
  return researchCfg.nodes;
}

export function labUnlocked() {
  return economy.upgradeLevel('lab') > 0;
}

export function isDone(id) {
  return !!state.research.done[id];
}

export function doneCount() {
  return Object.keys(state.research.done).length;
}

export function totalCount() {
  return researchCfg.nodes.length;
}

// สถานะของหัวข้อ: done / active / available (เริ่มได้) / locked (ยังต้องวิจัยหัวข้อก่อนหน้า) / busy (มีหัวข้ออื่นกำลังทำอยู่)
export function nodeStatus(id) {
  const n = NODES.get(id);
  if (!n) return 'locked';
  if (isDone(id)) return 'done';
  if (state.research.active?.id === id) return 'active';
  if (n.requires && !isDone(n.requires)) return 'locked';
  return state.research.active ? 'busy' : 'available';
}

export function canStart(id) {
  const n = NODES.get(id);
  return !!n && labUnlocked() && nodeStatus(id) === 'available' && state.food >= n.cost;
}

export function start(id) {
  if (!canStart(id)) return false;
  const n = NODES.get(id);
  state.food -= n.cost;
  state.research.active = { id, left: n.timeSec };
  return true;
}

export function progress() {
  const a = state.research.active;
  if (!a) return null;
  const n = NODES.get(a.id);
  return { id: a.id, left: a.left, total: n.timeSec, fraction: 1 - a.left / n.timeSec };
}

// เดินเวลาวิจัย (วินาที) คืนรายการเหตุการณ์ { type: 'research-done', id } ใช้ได้ทั้งตอนเล่นและตอนคิดย้อนหลังหลังปิดเกม
export function advance(seconds) {
  const events = [];
  const a = state.research.active;
  if (!a) return events;
  a.left -= seconds;
  if (a.left <= 0) {
    state.research.done[a.id] = true;
    state.research.active = null;
    events.push({ type: 'research-done', id: a.id });
  }
  return events;
}

export const update = advance;
