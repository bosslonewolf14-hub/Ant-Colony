import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import raidCfg from '../config/raid.json';
import economyCfg from '../config/economy.json';
import { RAID, ANT_LIFT } from './layout.js';
import { createAntGeometry, ANT_FOOT_OFFSET } from './antModel.js';
import { raid } from '../core/raid.js';

// ภาพของการบุก: ศัตรูเดินมาจากขอบซ้ายสนามหญ้าเข้าคิวหน้าปากทางลง และนักรบที่ประจำการอยู่ตรงนั้น
// สถานะจริงอยู่ใน core/raid.js (raid.active) ที่นี่แค่อ่านแล้ววาด

const GROUND_Y = ANT_LIFT - 0.135; // พื้นหญ้า y = 0 (ค่านี้ = 0)

function part(geometry, { pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], color = [1, 1, 1] }) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.deleteAttribute('uv');
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale),
  );
  g.applyMatrix4(m);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = color[0];
    c[i * 3 + 1] = color[1];
    c[i * 3 + 2] = color[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

const hex = (h) => {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b];
};
const dim = (rgb, k) => rgb.map((v) => v * k);

// โมเดลศัตรู 4 ชนิด (หันหน้าไปทาง +x) สีฝังเป็น vertex color ตาม raid.json
function buildEnemyGeometry(type) {
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 5);
  const base = hex(raidCfg.enemies[type].color);
  const parts = [];

  if (type === 'termite') {
    parts.push(part(ball, { pos: [-0.38, 0.02, 0], scale: [0.42, 0.3, 0.3], color: base }));
    parts.push(part(ball, { pos: [0.05, 0.03, 0], scale: [0.25, 0.2, 0.2], color: dim(base, 0.9) }));
    parts.push(part(ball, { pos: [0.4, 0.05, 0], scale: [0.21, 0.19, 0.19], color: hex('#b07a3a') }));
    for (const z of [0.07, -0.07]) parts.push(part(box, { pos: [0.6, -0.04, z], scale: [0.2, 0.04, 0.04], color: hex('#5a3a1a') }));
    parts.push(part(ball, { pos: [0.5, 0.12, 0.1], scale: [0.04, 0.04, 0.04], color: [0.05, 0.05, 0.05] }));
    parts.push(part(ball, { pos: [0.5, 0.12, -0.1], scale: [0.04, 0.04, 0.04], color: [0.05, 0.05, 0.05] }));
    for (const x of [-0.1, 0.05, 0.2]) for (const z of [0.15, -0.15]) parts.push(part(box, { pos: [x, -0.14, z], scale: [0.04, 0.26, 0.04], color: dim(base, 0.6) }));
  } else if (type === 'beetle') {
    parts.push(part(ball, { pos: [0, 0.14, 0], scale: [0.58, 0.4, 0.44], color: base }));
    parts.push(part(box, { pos: [0, 0.5, 0], scale: [0.9, 0.03, 0.03], color: dim(base, 0.4) }));
    parts.push(part(ball, { pos: [0.55, 0.06, 0], scale: [0.22, 0.17, 0.2], color: [0.12, 0.12, 0.16] }));
    parts.push(part(cone, { pos: [0.78, 0.2, 0], scale: [0.08, 0.3, 0.08], rot: [0, 0, -1.2], color: [0.2, 0.2, 0.25] }));
    for (const x of [-0.25, 0, 0.25]) for (const z of [0.3, -0.3]) parts.push(part(box, { pos: [x, -0.12, z], scale: [0.05, 0.3, 0.05], color: [0.1, 0.1, 0.14] }));
  } else if (type === 'spider') {
    parts.push(part(ball, { pos: [-0.2, 0.2, 0], scale: [0.4, 0.34, 0.34], color: base }));
    parts.push(part(ball, { pos: [0.25, 0.18, 0], scale: [0.23, 0.2, 0.2], color: dim(base, 0.75) }));
    for (const z of [0.1, -0.1]) parts.push(part(ball, { pos: [0.4, 0.26, z], scale: [0.05, 0.05, 0.05], color: [1, 0.2, 0.2] }));
    parts.push(part(ball, { pos: [-0.25, 0.28, 0], scale: [0.14, 0.1, 0.14], color: [0.85, 0.2, 0.2] })); // ลายบนหลัง
    // ขา 8 ข้อพับ: ท่อนบนชี้ออกด้านข้างและขึ้น ท่อนล่างลงพื้น
    for (const side of [1, -1]) {
      for (let k = 0; k < 4; k++) {
        const x = 0.35 - k * 0.2;
        parts.push(part(box, { pos: [x, 0.3, side * 0.32], scale: [0.04, 0.04, 0.4], rot: [side * 0.4, 0, 0], color: dim(base, 0.7) }));
        parts.push(part(box, { pos: [x, 0.13, side * 0.55], scale: [0.04, 0.34, 0.04], rot: [side * 0.2, 0, 0], color: dim(base, 0.6) }));
      }
    }
  } else {
    // ตะขาบ: ลำตัว 7 ปล้อง + ขาคู่ + หัวใหญ่ + หนวด
    for (let k = 0; k < 7; k++) {
      const x = -1.2 + k * 0.4;
      const c = k % 2 ? dim(base, 0.85) : base;
      parts.push(part(ball, { pos: [x, 0.17, 0], scale: [0.26, 0.22, 0.26], color: c }));
      for (const z of [0.22, -0.22]) parts.push(part(box, { pos: [x, 0.03, z], scale: [0.04, 0.26, 0.04], color: [0.25, 0.1, 0.08] }));
    }
    parts.push(part(ball, { pos: [1.65, 0.19, 0], scale: [0.34, 0.26, 0.3], color: [0.5, 0.12, 0.1] }));
    for (const z of [0.12, -0.12]) {
      parts.push(part(box, { pos: [1.95, 0.3, z], scale: [0.4, 0.035, 0.035], rot: [0, 0, 0.5], color: [0.2, 0.08, 0.06] }));
      parts.push(part(ball, { pos: [1.85, 0.3, z * 1.5], scale: [0.05, 0.05, 0.05], color: [1, 0.9, 0.2] }));
    }
  }
  const geo = mergeGeometries(parts, false);
  geo.computeVertexNormals();
  return geo;
}

const SCALE = { termite: 0.55, beetle: 0.62, spider: 0.62, centipede: 0.55 };
const HEIGHT = { termite: 0.35, beetle: 0.55, spider: 0.6, centipede: 0.45 }; // ความสูงโดยประมาณ (หน่วยโมเดล) ใช้วางแถบเลือด
const LIFT = { termite: 0.14, beetle: 0.14, spider: 0.13, centipede: 0.02 }; // ยกตัวให้ปลายขาแตะพื้น (หน่วยโมเดล)
const LANES = [0.25, 0.6, 0.95];

export function createRaidScene(scene, effects) {
  const geos = Object.fromEntries(Object.keys(raidCfg.enemies).map((t) => [t, buildEnemyGeometry(t)]));
  const enemyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
  const barBg = new THREE.MeshBasicMaterial({ color: 0x2a1a10, depthWrite: false });
  const barFg = new THREE.MeshBasicMaterial({ color: 0x59d65a, depthWrite: false });
  const barGeo = new THREE.PlaneGeometry(1, 1);

  const group = new THREE.Group();
  scene.add(group);

  let visuals = []; // ตามลำดับเดียวกับ raid.active.enemies
  let builtFor = null; // ตัวอ้างอิงการบุกที่ภาพกำลังแสดงอยู่

  function clearVisuals() {
    for (const v of visuals) group.remove(v.root);
    visuals = [];
    builtFor = null;
  }

  function buildVisuals(a) {
    clearVisuals();
    builtFor = a;
    a.enemies.forEach((e, i) => {
      const root = new THREE.Group();
      const mesh = new THREE.Mesh(geos[e.type], enemyMat);
      mesh.scale.setScalar(SCALE[e.type]);
      mesh.position.y = LIFT[e.type] * SCALE[e.type];
      root.add(mesh);
      const bar = new THREE.Group();
      const bg = new THREE.Mesh(barGeo, barBg);
      bg.scale.set(0.56, 0.08, 1);
      const fg = new THREE.Mesh(barGeo, barFg.clone());
      fg.position.z = 0.01;
      bar.add(bg, fg);
      bar.position.set(0, HEIGHT[e.type] * SCALE[e.type] * 2 + 0.25, 0.05);
      root.add(bar);
      root.position.set(RAID.spawnX - i * 0.15, GROUND_Y, LANES[i % LANES.length]);
      root.scale.setScalar(1);
      group.add(root);
      visuals.push({ root, mesh, bar, fg, x: root.position.x, deathT: 0, dead: false, hitPulse: 0, phase: i * 0.7 });
    });
  }

  // ---------- นักรบประจำการ ----------
  const warriorMesh = new THREE.InstancedMesh(
    createAntGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 }),
    economyCfg.warriors.maxVisible,
  );
  warriorMesh.count = 0;
  warriorMesh.frustumCulled = false;
  scene.add(warriorMesh);
  const color = new THREE.Color();
  const dummy = new THREE.Object3D();
  const WARRIOR_SCALE = 0.55;
  let lastWarriors = -1;
  let sparkTimer = 0;

  return {
    // time = วินาทีของนาฬิกาเกม, warriors = จำนวนนักรบที่มีจริง
    update(dt, time, warriors, events = []) {
      const a = raid.active;
      if (!a) {
        if (builtFor) clearVisuals();
      } else if (builtFor !== a) {
        buildVisuals(a);
      }

      // ----- ศัตรู -----
      if (a && builtFor === a) {
        // ตำแหน่งในคิวนับจากตัวที่ยังมีชีวิต (ตัวหน้าตายแล้วคิวขยับขึ้น)
        let rank = 0;
        let frontAlive = -1;
        a.enemies.forEach((e, i) => {
          const v = visuals[i];
          if (!v) return;
          if (e.alive) {
            if (frontAlive < 0) frontAlive = i;
            const myRank = rank;
            const col = Math.floor(rank / LANES.length);
            const lane = rank % LANES.length;
            const queueX = RAID.enemyFrontX - col * 0.66 - lane * 0.2;
            rank++;
            let goalX = queueX;
            if (a.phase === 'approach') {
              // เดินเข้ามาทีละตัวตามลำดับ ใช้เวลาเดินทั้งหมด approachSec
              const k = Math.min(1, Math.max(0, (a.t - i * 0.04) / (raidCfg.approachSec * 0.9)));
              goalX = RAID.spawnX - i * 0.15 + (queueX - (RAID.spawnX - i * 0.15)) * (1 - (1 - k) ** 2);
              v.x = goalX;
            } else if (a.phase === 'retreat') {
              goalX = RAID.spawnX - 3 - i * 0.2;
              v.x += (goalX - v.x) * (1 - Math.exp(-2.5 * dt));
            } else {
              v.x += (goalX - v.x) * (1 - Math.exp(-6 * dt));
            }
            v.root.visible = v.x > -9.3; // ตัวที่ยังอยู่นอกขอบสนามหญ้าไม่วาด (ไม่ให้ลอยกลางอากาศ)
            const walking = a.phase === 'approach' || a.phase === 'retreat' || Math.abs(goalX - v.x) > 0.05;
            const bob = walking ? Math.abs(Math.sin(time * 14 + v.phase)) * 0.04 : Math.sin(time * 9 + v.phase) * 0.012;
            v.hitPulse = Math.max(0, v.hitPulse - dt * 6);
            const s = 1 + v.hitPulse * 0.25;
            v.root.position.set(v.x, GROUND_Y + bob, LANES[lane]);
            v.root.scale.set(s, 1 - v.hitPulse * 0.12, s);
            if (a.phase === 'retreat') v.root.rotation.y = Math.PI; // ถอยกลับ: หันหลังกลับไปทางซ้าย
            v.fg.scale.set(0.52 * Math.max(e.hp / e.maxHp, 0.001), 0.055, 1);
            v.fg.position.x = -0.26 * (1 - e.hp / e.maxHp);
            v.fg.material.color.setHSL(0.33 * (e.hp / e.maxHp), 0.7, 0.5);
            v.bar.visible = a.phase === 'fight' && myRank < 3; // แถบเลือดเฉพาะ 3 ตัวหน้าสุดที่กำลังถูกตี ไม่ให้รก
          } else if (!v.dead) {
            v.dead = true;
            v.deathT = 0;
            effects.burst(v.root.position.x, 0.4, v.root.position.z + 0.2, raidCfg.enemies[e.type].color, e.type === 'centipede' ? 24 : 8);
          }
          if (v.dead) {
            v.deathT += dt;
            const k = Math.min(1, v.deathT / 0.35);
            v.root.scale.setScalar(Math.max(1 - k, 0.001));
            v.bar.visible = false;
            v.root.visible = k < 1;
          }
        });

        // ประกายตอนนักรบกับศัตรูปะทะกัน (ที่ตัวหน้าสุด)
        const hit = events.find((ev) => ev.type === 'hit');
        if (a.phase === 'fight' && hit && frontAlive >= 0) {
          visuals[frontAlive].hitPulse = 1;
          sparkTimer -= dt;
          if (sparkTimer <= 0) {
            sparkTimer = 0.28;
            const p = visuals[frontAlive].root.position;
            effects.burst(p.x + 0.4, 0.45, p.z + 0.3, '#ffe27a', 3);
          }
        }
      }

      // ----- นักรบ -----
      const shown = Math.min(warriors, economyCfg.warriors.maxVisible);
      if (shown !== lastWarriors) {
        lastWarriors = shown;
        for (let i = 0; i < shown; i++) {
          warriorMesh.setColorAt(i, color.set('#9b1c1c').offsetHSL((i % 3) * 0.004, 0, (i % 2) * 0.04));
        }
        if (warriorMesh.instanceColor) warriorMesh.instanceColor.needsUpdate = true;
        warriorMesh.count = shown;
      }
      const fighting = a && a.phase === 'fight';
      for (let i = 0; i < shown; i++) {
        const col = Math.floor(i / 2);
        const lane = i % 2;
        const homeX = RAID.guardBackX - col * RAID.guardSpacing;
        // ตอนสู้: พุ่งไปข้างหน้า-กลับเป็นจังหวะ (สลับเฟสตามตัว)
        const lunge = fighting ? (Math.sin(time * 9 + i * 1.3) * 0.5 + 0.5) * 0.22 : 0;
        const bob = fighting ? 0 : Math.sin(time * 2 + i) * 0.01;
        dummy.position.set(homeX - lunge, GROUND_Y + ANT_FOOT_OFFSET * WARRIOR_SCALE + bob, 0.3 + lane * 0.4);
        dummy.rotation.set(0, Math.PI, fighting ? Math.sin(time * 9 + i * 1.3) * 0.12 : 0); // หันซ้ายเข้าหาศัตรู
        dummy.scale.setScalar(WARRIOR_SCALE);
        dummy.updateMatrix();
        warriorMesh.setMatrixAt(i, dummy.matrix);
      }
      warriorMesh.instanceMatrix.needsUpdate = true;
    },
    // ตำแหน่งหน้าปากทางลง (ใช้วางตัวเลข/แบนเนอร์)
    gateX: RAID.guardBackX,
  };
}
