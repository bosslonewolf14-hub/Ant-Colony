import * as THREE from 'three';
import cfg from '../config/economy.json';
import antCfg from '../config/ants.json';
import { ANT_PATH, CARRY_FROM } from './layout.js';
import { createAntGeometry, ANT_FOOT_OFFSET } from './antModel.js';

const MAX = cfg.workers.maxVisible;
const WORKER_SCALE = 0.5;
const SPEED = 3.0; // หน่วยโลกต่อวินาที (รอบเดินประมาณ 9 วินาที)
const BITE_TIME = 0.4;

// ชนิดของมดในฉาก: เรียงจากหายากสุดไปน้อยสุด แล้วมดงานที่ซื้อเป็นลำดับท้าย
// เมื่อมดเกินจำนวนที่วาดได้ (MAX) ชนิดหายากจะได้ที่ก่อนเสมอ
const WORKER_COLORS = ['#8a3410', '#9c4218', '#7a2c0c', '#a5521f'];
const KINDS = [
  ...[...antCfg.types].reverse().map((t) => ({ id: t.id, tier: t.tier, color: t.color, scale: t.scale })),
  { id: 'worker', tier: -1, color: null, scale: WORKER_SCALE },
];

// มดที่เดินในฉาก: จำนวนที่ "วาด" แยกจากจำนวนที่ "มีจริง" ในเกม (วาดไม่เกิน MAX ตัว)
// onDeliver(amount, kind) ถูกเรียกทุกครั้งที่มดตัวหนึ่งเดินถึงห้องราชินีพร้อมอาหาร
// amount = อัตราเก็บอาหารของมดตัวนั้น (ตาม Rank) × เวลาที่ใช้ในรอบนั้น แล้วเกมจะเพิ่มอาหารตามนี้ตอนมดส่ง
export function createAnts(scene, { onDeliver = () => {} } = {}) {
  const antMesh = new THREE.InstancedMesh(
    createAntGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }),
    MAX,
  );
  antMesh.count = 0;
  antMesh.frustumCulled = false;
  scene.add(antMesh);

  const loadMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.2, 0),
    new THREE.MeshStandardMaterial({ color: 0xff3b5c, flatShading: true, roughness: 0.7 }),
    MAX,
  );
  loadMesh.count = 0;
  loadMesh.frustumCulled = false;
  scene.add(loadMesh);

  // เส้นทาง: ความยาวแต่ละช่วง + ความยาวสะสม
  const pts = ANT_PATH.map(([x, y]) => new THREE.Vector2(x, y));
  const segLen = [];
  const cum = [0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    segLen.push(a.distanceTo(b));
    cum.push(cum[i] + segLen[i]);
  }
  const total = cum[pts.length];
  const carryS = cum[CARRY_FROM];

  const ants = [];
  const color = new THREE.Color();
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'ZYX';
  const leafLocal = new THREE.Matrix4();
  const loadMatrix = new THREE.Matrix4();
  const drawn = new Map(); // จำนวนที่วาดจริงของแต่ละชนิดในเฟรมนี้
  let now = 0; // เวลาปัจจุบัน (วินาที) ของเฟรมที่กำลังคำนวณ ใช้บันทึกว่ามดแต่ละตัวส่งอาหารรอบล่าสุดเมื่อไร
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  function paint(i, kind) {
    const hex = kind.color ?? WORKER_COLORS[i % WORKER_COLORS.length];
    antMesh.setColorAt(i, color.set(hex).offsetHSL(0, 0, (Math.random() - 0.5) * 0.05));
    antMesh.instanceColor.needsUpdate = true;
  }

  // ตัวที่ซื้อ/ฟักทีละตัวจะเดินออกมาจากห้องราชินี ส่วนที่เกิดพร้อมกันหลายตัวกระจายตามเส้นทางไม่ให้กระจุก
  function spawn(kind, spread) {
    const i = ants.length;
    const speed = SPEED * (0.85 + Math.random() * 0.35);
    const s = spread ? Math.random() * total : 0;
    ants.push({
      kind,
      s,
      speed,
      // ตัวที่เกิดกลางทางถือว่าเดินมาแล้วบางส่วนของรอบ ไม่ให้ส่งรอบแรกได้เกินจริง
      lastDeliver: now - s / speed,
      z: 0.15 + Math.random() * 0.65,
      phase: Math.random() * 6.28,
      pause: 0,
      hx: 1,
      hy: 0,
    });
    paint(i, kind);
  }

  // ปรับรายการมดที่วาดให้ตรงกับจำนวนจริง: เปลี่ยนชนิดตัวที่เกินแทนการลบ/สร้างใหม่ (จำนวนมักเพิ่มอย่างเดียว)
  function reconcile(counts) {
    let remaining = MAX;
    const want = new Map();
    for (const k of KINDS) {
      const n = Math.min(counts[k.id] || 0, remaining);
      want.set(k, n);
      remaining -= n;
    }
    const have = new Map(KINDS.map((k) => [k, 0]));
    for (const a of ants) have.set(a.kind, have.get(a.kind) + 1);

    const spare = [];
    ants.forEach((a, i) => {
      if (have.get(a.kind) > want.get(a.kind)) {
        have.set(a.kind, have.get(a.kind) - 1);
        spare.push(i);
      }
    });
    let deficit = 0;
    for (const k of KINDS) deficit += Math.max(0, want.get(k) - have.get(k));
    for (const k of KINDS) {
      for (let n = have.get(k); n < want.get(k); n++) {
        if (spare.length) {
          const i = spare.pop();
          ants[i].kind = k;
          ants[i].lastDeliver = now;
          paint(i, k);
        } else if (ants.length < MAX) {
          spawn(k, deficit > 1);
        }
      }
    }
    antMesh.count = ants.length;
    loadMesh.count = ants.length;
  }

  return {
    // ตั้งเวลาส่งอาหารรอบล่าสุดของทุกตัวเป็นตอนนี้ (เรียกหลังแท็บถูกพักแล้วกลับมา รายได้ช่วงนั้นคิดแยกใน save.applyOffline แล้ว)
    syncTime(time) {
      now = time;
      for (const a of ants) a.lastDeliver = time;
    },
    // counts: { worker, common, uncommon, ... } จำนวนที่มีจริงของแต่ละชนิด
    // rates: { worker, common, ... } อัตราเก็บอาหารต่อวินาทีของมด 1 ตัวของแต่ละชนิด (รวมตัวคูณและการลดทอนแล้ว)
    update(dt, time, counts, speedMul = 1, rates = {}) {
      now = time;
      reconcile(counts);

      // จำนวนจริงมากกว่าที่วาดได้ → ตัวที่วาดต้องแทนมดหลายตัว มูลค่าต่อรอบจึงคูณขึ้นตามสัดส่วนของชนิดนั้น
      drawn.clear();
      for (const a of ants) drawn.set(a.kind, (drawn.get(a.kind) || 0) + 1);
      const lap = total / (SPEED * speedMul);
      const maxLap = lap * 2; // กันค่าพุ่งตอนเฟรมสะดุด (แท็บถูกพักคิดแยกใน save.applyOffline)

      for (let i = 0; i < ants.length; i++) {
        const a = ants[i];
        const represent = (counts[a.kind.id] || 0) / (drawn.get(a.kind) || 1);
        const rate = rates[a.kind.id] || 0;

        if (a.pause > 0) {
          a.pause -= dt;
        } else {
          const prev = a.s;
          a.s += a.speed * speedMul * dt;
          if (prev < carryS && a.s >= carryS) {
            a.s = carryS;
            a.pause = BITE_TIME;
          }
          if (a.s >= total) {
            a.s -= total;
            // ถึงห้องราชินีแล้ว: ส่งอาหาร มดที่ Rank สูงกว่ามีอัตราเก็บสูงกว่า จึงส่งได้ครั้งละมากกว่า
            const trip = Math.min(Math.max(time - a.lastDeliver, 0), maxLap);
            const amount = rate * trip * represent;
            a.lastDeliver = time;
            if (amount > 0) onDeliver(amount, a.kind);
          }
        }

        let seg = 0;
        while (seg < pts.length - 1 && a.s >= cum[seg + 1]) seg++;
        const p0 = pts[seg];
        const p1 = pts[(seg + 1) % pts.length];
        const t = segLen[seg] > 0 ? (a.s - cum[seg]) / segLen[seg] : 0;
        const x = p0.x + (p1.x - p0.x) * t;
        let y = p0.y + (p1.y - p0.y) * t;
        const dx = (p1.x - p0.x) / segLen[seg];
        const dy = (p1.y - p0.y) / segLen[seg];

        // หันหน้าค่อย ๆ เปลี่ยนทิศ (ตอนเลี้ยวมุมจะไม่หักฉับ)
        const k = 1 - Math.exp(-14 * dt);
        a.hx += (dx - a.hx) * k;
        a.hy += (dy - a.hy) * k;
        const hl = Math.hypot(a.hx, a.hy) || 1;
        const hx = a.hx / hl;
        const hy = a.hy / hl;

        const scale = a.kind.scale;
        const moving = a.pause <= 0;
        // ตัวใหญ่ขึ้นต้องยกตัวขึ้นให้ปลายขายังแตะพื้น
        y += ANT_FOOT_OFFSET * (scale - WORKER_SCALE);
        y += moving ? Math.abs(Math.sin(time * 16 + a.phase)) * 0.025 : Math.sin(time * 40 + a.phase) * 0.012;

        // ถ้าหันซ้าย ให้พลิกซ้าย-ขวาของโมเดล แล้วหมุนรอบ z เพื่อไม่ให้มดคว่ำ
        if (hx >= 0) {
          dummy.rotation.set(0, 0, Math.atan2(hy, hx));
        } else {
          dummy.rotation.set(0, Math.PI, Math.atan2(-hy, -hx));
        }
        dummy.position.set(x, y, a.z);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        antMesh.setMatrixAt(i, dummy.matrix);

        if (a.s > carryS) {
          // ก้อนอาหารที่แบกโตตามมูลค่าที่ตัวนี้จะส่ง (ล็อกสเกล) มด Rank สูง/รังที่รวยแล้วจึงแบกก้อนใหญ่กว่า
          const perTrip = rate * lap * represent;
          const loadScale = Math.min(2.2, Math.max(0.8, 0.6 + 0.22 * Math.log10(1 + perTrip)));
          leafLocal.makeScale(loadScale, loadScale, loadScale).setPosition(0.62, 0.36, 0);
          loadMatrix.multiplyMatrices(dummy.matrix, leafLocal);
          loadMesh.setMatrixAt(i, loadMatrix);
        } else {
          loadMesh.setMatrixAt(i, hidden);
        }
      }
      antMesh.instanceMatrix.needsUpdate = true;
      loadMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
