import * as THREE from 'three';
import { mat, box, buildRoom, cavityRect, easeOutBack } from './buildHelpers.js';
import {
  HATCHERY,
  HATCHERY_TUNNEL,
  HATCHERY_FLOOR,
  BARRACKS,
  BARRACKS_TUNNEL,
  BARRACKS_FLOOR,
  STORAGE_ROOMS,
  DEEP_SEGMENTS,
  LAB,
  LAB_TUNNEL,
  LAB_FLOOR,
} from './layout.js';

// ห้องที่ปลดล็อกด้วยการอัปเกรด: ห้องบ่มไข่, ค่ายนักรบ, ห้องคลังอาหาร (สูงสุด 8) พร้อมทางลงลึก
// แต่ละห้องเป็นกลุ่มที่จุดหมุนอยู่กลางห้อง เปิดห้องแล้วจะ "ขุด" โผล่ออกมาจากกลางห้อง (สเกลเข้า)
const REVEAL_SEC = 0.7;

// ผู้ช่วย: ห้องที่ซ่อนอยู่แล้วค่อย ๆ โผล่ ใช้กับทุกห้อง
function revealable(group) {
  group.visible = false;
  return { group, on: false, t: 1, extra: null };
}

function setReveal(r, on, animate) {
  r.on = on;
  r.t = on && animate ? 0 : 1;
  r.group.visible = on;
  if (on && !animate) r.group.scale.setScalar(1);
  if (on && animate) r.group.scale.setScalar(0.001);
}

function stepReveal(r, dt) {
  if (!r.on || r.t >= 1) return;
  r.t = Math.min(1, r.t + dt / REVEAL_SEC);
  r.group.scale.setScalar(Math.max(easeOutBack(r.t), 0.001));
}

// ---------- ห้องบ่มไข่ ----------
function buildHatchery() {
  const room = buildRoom({ ...HATCHERY, tunnel: HATCHERY_TUNNEL, floor: HATCHERY_FLOOR, inner: 0x5a3a22 });
  const floorTop = HATCHERY_FLOOR.y1 - HATCHERY.y;
  const units = [];
  [-0.62, -0.2, 0.22, 0.64].forEach((x, i) => {
    const u = new THREE.Group();
    u.position.set(x, floorTop, 0.45);
    const padMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a1c, emissiveIntensity: 0.6, flatShading: true });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.08, 8), padMat);
    pad.position.y = 0.04;
    u.add(pad);
    const eggMat = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffd9a0, emissiveIntensity: 0.5, flatShading: true });
    const egg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), eggMat);
    egg.scale.y = 1.25;
    egg.position.y = 0.22;
    u.add(egg);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.32, flatShading: true, depthWrite: false }),
    );
    dome.position.y = 0.06;
    u.add(dome);
    u.userData = { egg, padMat, eggMat, phase: i * 1.4 };
    room.add(u);
    units.push(u);
  });
  // โคลเวอร์บนผนัง (สัญลักษณ์ Luck)
  const clover = new THREE.Group();
  const leafMat = mat(0x39c66b, { emissive: 0x1e8a45, emissiveIntensity: 0.5 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), leafMat);
    leaf.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0);
    leaf.scale.z = 0.4;
    clover.add(leaf);
  }
  clover.position.set(0, 0.45, 0.14);
  room.add(clover);
  return { room, units, clover };
}

// ---------- ค่ายนักรบ ----------
function buildBarracks() {
  const room = buildRoom({ ...BARRACKS, tunnel: BARRACKS_TUNNEL, floor: BARRACKS_FLOOR, inner: 0x4a2b24 });
  const floorTop = BARRACKS_FLOOR.y1 - BARRACKS.y;
  const tiers = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  tiers.forEach((t) => room.add(t));

  const shield = (x, y, color) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 8), mat(color));
    s.rotation.x = Math.PI / 2;
    s.position.set(x, y, 0.16);
    const boss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(0xffd23f));
    boss.position.set(x, y, 0.22);
    return [s, boss];
  };

  // ระดับ 1: ชั้นวางหอก + โล่
  const rackY = floorTop + 0.75;
  box(0.07, 0.95, 0.07, 0x7a4a24, -0.85, floorTop + 0.48, 0.3, tiers[0]);
  box(0.07, 0.95, 0.07, 0x7a4a24, -0.2, floorTop + 0.48, 0.3, tiers[0]);
  box(0.75, 0.07, 0.07, 0x7a4a24, -0.52, rackY, 0.3, tiers[0]);
  [-0.75, -0.6, -0.45, -0.3].forEach((x, i) => {
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 5), mat(0xb08a5a));
    spear.position.set(x, rackY + 0.15, 0.34);
    spear.rotation.z = (i - 1.5) * 0.06;
    tiers[0].add(spear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 4), mat(0xd8dde6));
    tip.position.set(x - (i - 1.5) * 0.03, rackY + 0.72, 0.34);
    tip.rotation.z = (i - 1.5) * 0.06;
    tiers[0].add(tip);
  });
  shield(0.35, floorTop + 0.7, 0xb3262e).forEach((m) => tiers[0].add(m));

  // ระดับ 2: ธงและโล่เพิ่ม
  box(0.05, 1.5, 0.05, 0x7a4a24, 0.85, floorTop + 0.75, 0.3, tiers[1]);
  box(0.45, 0.32, 0.03, 0xd62f50, 1.05, floorTop + 1.35, 0.3, tiers[1]);
  shield(0.75, floorTop + 0.38, 0x3b6fd6).forEach((m) => tiers[1].add(m));

  // ระดับ 3: หุ่นซ้อมและถ้วยรางวัล
  box(0.1, 0.55, 0.1, 0x8b5a2b, 0.05, floorTop + 0.3, 0.55, tiers[2]);
  box(0.45, 0.07, 0.07, 0x8b5a2b, 0.05, floorTop + 0.45, 0.55, tiers[2]);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(0xe0c49a));
  head.position.set(0.05, floorTop + 0.7, 0.55);
  tiers[2].add(head);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.16, 6), mat(0xffd23f, { emissive: 0xb88a00, emissiveIntensity: 0.5 }));
  cup.position.set(-0.95, floorTop + 0.9, 0.2);
  tiers[2].add(cup);
  return { room, tiers };
}

// ---------- ห้องวิจัย ----------
function buildLab() {
  const room = buildRoom({ ...LAB, tunnel: LAB_TUNNEL, floor: LAB_FLOOR, inner: 0x2f3a4a });
  const floorTop = LAB_FLOOR.y1 - LAB.y;
  // โต๊ะทดลอง
  box(1.3, 0.07, 0.5, 0x8b5a2b, 0.1, floorTop + 0.42, 0.45, room);
  box(0.07, 0.4, 0.4, 0x7a4a24, -0.45, floorTop + 0.2, 0.45, room);
  box(0.07, 0.4, 0.4, 0x7a4a24, 0.65, floorTop + 0.2, 0.45, room);
  // กล้องจุลทรรศน์
  box(0.22, 0.05, 0.2, 0x4a4a52, -0.32, floorTop + 0.48, 0.5, room);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 6), mat(0x7b7b86));
  pillar.position.set(-0.32, floorTop + 0.66, 0.5);
  pillar.rotation.z = -0.25;
  room.add(pillar);
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 6), mat(0x2a2a30));
  eye.position.set(-0.4, floorTop + 0.86, 0.5);
  eye.rotation.z = -0.25;
  room.add(eye);
  // ขวดทดลอง 3 ใบ (ของเหลวเรืองแสง) + ฟองที่ลอยขึ้นตอนกำลังวิจัย
  const liquids = [];
  const bubbles = [];
  [
    [0.12, 0x6cf0a8],
    [0.38, 0xc58bff],
    [0.62, 0x6cd8ff],
  ].forEach(([x, c], i) => {
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.11, 0.3, 7),
      new THREE.MeshStandardMaterial({ color: 0xbfeeff, transparent: true, opacity: 0.3, flatShading: true, depthWrite: false }),
    );
    glass.position.set(x, floorTop + 0.61, 0.5);
    room.add(glass);
    const liquidMat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, flatShading: true });
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.18, 7), liquidMat);
    liquid.position.set(x, floorTop + 0.56, 0.5);
    room.add(liquid);
    liquids.push(liquidMat);
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0), mat(0xffffff, { emissive: c, emissiveIntensity: 0.8 }));
      b.position.set(x, floorTop + 0.55, 0.5);
      b.userData = { baseX: x, baseY: floorTop + 0.5, phase: i * 2 + k * 0.9 };
      b.visible = false;
      room.add(b);
      bubbles.push(b);
    }
  });
  // กระดานดำ + แผนภูมิต้นไม้ (สัญลักษณ์ต้นไม้งานวิจัย)
  box(1.1, 0.7, 0.04, 0x24352c, 0.1, 0.45, 0.1, room);
  box(1.16, 0.76, 0.03, 0x7a4a24, 0.1, 0.45, 0.07, room);
  const chalk = 0xf2f2e6;
  box(0.04, 0.34, 0.01, chalk, -0.1, 0.4, 0.13, room);
  box(0.4, 0.03, 0.01, chalk, 0.1, 0.56, 0.13, room);
  box(0.03, 0.18, 0.01, chalk, -0.28, 0.46, 0.13, room);
  box(0.03, 0.18, 0.01, chalk, 0.48, 0.46, 0.13, room);
  // ไฟสถานะ: เขียว = ว่าง, ส้มกะพริบ = กำลังวิจัย
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x6cf0a8, emissive: 0x6cf0a8, emissiveIntensity: 0.8, flatShading: true });
  const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), lampMat);
  lamp.position.set(0.85, 0.7, 0.2);
  room.add(lamp);
  return { room, liquids, bubbles, lampMat };
}

// ---------- ห้องคลังอาหาร ----------
const PILE = [
  // [x, ชั้น, z] กองผลเบอร์รี่ 12 ลูก เรียงจากฐานขึ้นไป
  [-0.7, 0, 0.55], [-0.35, 0, 0.55], [0, 0, 0.55], [0.35, 0, 0.55], [0.7, 0, 0.55],
  [-0.52, 1, 0.55], [-0.17, 1, 0.55], [0.17, 1, 0.55], [0.52, 1, 0.55],
  [-0.35, 2, 0.55], [0.0, 2, 0.55], [0.35, 2, 0.55],
];

function buildStorage(spec) {
  const room = buildRoom({ x: spec.x, y: spec.y, r: spec.r, tunnel: spec.tunnel, floor: spec.floor, inner: 0x4d3a1f });
  const floorTop = spec.floor.y1 - spec.y;
  // ลังไม้ 2 ใบ + ชั้นวางตรงผนัง
  const side = spec.right ? 1 : -1;
  box(0.5, 0.4, 0.4, 0x9b6a35, -side * 0.95, floorTop + 0.2, 0.3, room);
  box(0.52, 0.06, 0.42, 0xc99a5b, -side * 0.95, floorTop + 0.43, 0.3, room);
  box(0.4, 0.3, 0.35, 0x8a5a2b, -side * 0.45, floorTop + 0.15, 0.2, room);
  box(1.5, 0.07, 0.25, 0x7a4a24, 0, floorTop + 1.3, 0.12, room);
  box(0.07, 0.6, 0.2, 0x7a4a24, -0.7, floorTop + 1.0, 0.12, room);
  box(0.07, 0.6, 0.2, 0x7a4a24, 0.7, floorTop + 1.0, 0.12, room);
  const berries = PILE.map(([x, row, z], i) => {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), mat(i % 3 === 0 ? 0xff5c7a : 0xff3b5c));
    b.position.set(x * 0.9, floorTop + 0.17 + row * 0.27, z);
    b.userData = { grow: 0, index: i };
    b.scale.setScalar(0.001);
    b.visible = false;
    room.add(b);
    return b;
  });
  return { room, berries };
}

export function createRooms(parent) {
  // ----- ห้องบ่มไข่ -----
  const hatchery = buildHatchery();
  const hatcheryR = revealable(hatchery.room);
  parent.add(hatchery.room);
  let hatcheryLevel = 0;

  // ----- ค่ายนักรบ -----
  const barracks = buildBarracks();
  const barracksR = revealable(barracks.room);
  parent.add(barracks.room);
  let barracksLevel = 0;

  // ----- ห้องวิจัย -----
  const lab = buildLab();
  const labR = revealable(lab.room);
  parent.add(lab.room);
  let labOn = false;
  let labActive = false;

  // ----- ทางลงลึก (ทีละช่วง) -----
  const deep = DEEP_SEGMENTS.map((seg) => {
    const g = new THREE.Group();
    cavityRect(seg, 0.06, 0.03, 0xc79a63, 0.12, g);
    cavityRect(seg, 0.06, 0.06, 0x3a2315, 0, g);
    g.visible = false;
    parent.add(g);
    return g;
  });

  // ----- ห้องคลังอาหาร 8 ห้อง -----
  const storage = STORAGE_ROOMS.map((spec) => {
    const s = buildStorage(spec);
    const r = revealable(s.room);
    parent.add(s.room);
    return { spec, r, berries: s.berries };
  });
  let storageCount = 0;
  let fill = 0;
  // ทางลงลึกช่วงแรกโผล่เมื่อมีห้องคลังหรือห้องวิจัย ช่วงต่อไปโผล่ตามชั้นของห้องคลัง
  function applyDeep() {
    deep.forEach((g, k) => (g.visible = storageCount >= 2 * k + 1 || (k === 0 && labOn)));
  }

  const api = {
    // ระดับ Luck → ห้องบ่มไข่ (ปลดล็อกที่ระดับ 1) จำนวนตู้ฟักและความสว่างเพิ่มตามระดับ
    setHatchery(level, animate) {
      const was = hatcheryLevel;
      hatcheryLevel = level;
      if ((level > 0) !== (was > 0)) setReveal(hatcheryR, level > 0, animate);
      const count = [0, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4][Math.min(level, 10)];
      hatchery.units.forEach((u, i) => (u.visible = i < count));
    },
    // ระดับค่ายนักรบ 1–3: เพิ่มของตกแต่งทีละระดับ
    setBarracks(level, animate) {
      const was = barracksLevel;
      barracksLevel = level;
      if ((level > 0) !== (was > 0)) setReveal(barracksR, level > 0, animate);
      barracks.tiers.forEach((t, i) => (t.visible = i < level));
    },
    // จำนวนห้องคลังที่สร้างแล้ว (0–8): ห้องใหม่โผล่ทีละห้อง ทางลงโผล่เมื่อเริ่มชั้นใหม่
    setStorage(count, animate) {
      const prev = storageCount;
      storageCount = count;
      storage.forEach((s, i) => {
        const on = i < count;
        if (on !== s.r.on) setReveal(s.r, on, animate && i >= prev);
      });
      applyDeep();
    },
    // ห้องวิจัย (ระดับ ≥ 1 = มี) ต้องมีทางลงช่วงแรกด้วย active = กำลังวิจัยอยู่ (ขวดเรืองแสงมีฟอง ไฟสถานะกะพริบ)
    setLab(level, animate) {
      const on = level > 0;
      if (on !== labOn) setReveal(labR, on, animate);
      labOn = on;
      applyDeep();
    },
    setLabActive(active) {
      labActive = active;
    },
    // สัดส่วนอาหารที่เก็บอยู่ (0–1) ทำให้กองผลเบอร์รี่ในทุกห้องคลังสูงขึ้น
    setStorageFill(f) {
      fill = Math.min(1, Math.max(0, f));
    },
    // ตำแหน่งกลางห้อง สำหรับเลื่อนกล้องไปดู
    center(kind, n = 1) {
      if (kind === 'hatchery') return { x: HATCHERY.x, y: HATCHERY.y };
      if (kind === 'barracks') return { x: BARRACKS.x, y: BARRACKS.y };
      if (kind === 'lab') return { x: LAB.x, y: LAB.y };
      const s = STORAGE_ROOMS[Math.min(Math.max(n, 1), STORAGE_ROOMS.length) - 1];
      return { x: s.x, y: s.y };
    },
    update(dt, time) {
      stepReveal(hatcheryR, dt);
      stepReveal(barracksR, dt);
      stepReveal(labR, dt);
      for (const s of storage) stepReveal(s.r, dt);

      if (labR.on) {
        const pulse = Math.sin(time * (labActive ? 7 : 1.5)) * 0.5 + 0.5;
        lab.liquids.forEach((m) => (m.emissiveIntensity = 0.45 + pulse * (labActive ? 0.7 : 0.15)));
        lab.lampMat.color.set(labActive ? 0xffa23a : 0x6cf0a8);
        lab.lampMat.emissive.set(labActive ? 0xff8a1c : 0x35c97a);
        lab.lampMat.emissiveIntensity = labActive ? 0.4 + pulse * 0.9 : 0.8;
        for (const b of lab.bubbles) {
          b.visible = labActive;
          if (!labActive) continue;
          const t = (time * 0.6 + b.userData.phase) % 1;
          b.position.set(b.userData.baseX + Math.sin(time * 5 + b.userData.phase) * 0.03, b.userData.baseY + t * 0.22, 0.5);
          b.scale.setScalar(1 - t * 0.6);
        }
      }

      if (hatcheryR.on) {
        const glow = 0.5 + hatcheryLevel * 0.08;
        hatchery.units.forEach((u) => {
          if (!u.visible) return;
          const p = Math.sin(time * 2.2 + u.userData.phase) * 0.5 + 0.5;
          u.userData.eggMat.emissiveIntensity = glow + p * 0.35;
          u.userData.padMat.emissiveIntensity = 0.5 + p * 0.3;
          u.userData.egg.scale.set(1, 1.25 + p * 0.06, 1);
        });
        hatchery.clover.rotation.z = Math.sin(time * 0.8) * 0.15;
      }

      // กองผลเบอร์รี่: ลูกที่ n โผล่เมื่อ fill × จำนวนลูก > n
      for (const s of storage) {
        if (!s.r.on) continue;
        for (const b of s.berries) {
          const goal = fill * s.berries.length > b.userData.index ? 1 : 0;
          const g = b.userData.grow;
          if (g === goal) continue;
          b.userData.grow = Math.abs(goal - g) < 0.01 ? goal : g + (goal - g) * (1 - Math.exp(-8 * dt));
          b.scale.setScalar(Math.max(b.userData.grow, 0.001));
          b.visible = b.userData.grow > 0.01;
        }
      }
    },
  };
  return api;
}
