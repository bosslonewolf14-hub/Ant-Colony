import * as THREE from 'three';
import {
  WORLD,
  SOIL_BANDS,
  SHAFT,
  TUNNEL,
  CHAMBER,
  FLOOR,
  FLOOR_Y,
  FOOD_POS,
  FOOD_RADIUS,
  QUEEN_POS,
  CAVITY_RECTS,
  FUNGUS,
  FUNGUS_TUNNEL,
  FUNGUS_FLOOR,
} from './layout.js';
import { createAntGeometry, ANT_FOOT_OFFSET } from './antModel.js';
import { mat, box, hexRoom, cavityRect } from './buildHelpers.js';
import { createRooms } from './rooms.js';

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tree(x, z, scale, parent) {
  const g = new THREE.Group();
  box(0.35, 1.2, 0.35, 0x8b5a2b, 0, 0.6, 0, g);
  const leaf = [0x2fbf71, 0x27a862, 0x1f9355];
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3 - i * 0.28, 1.3, 6), mat(leaf[i]));
    cone.position.y = 1.5 + i * 0.85;
    g.add(cone);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  parent.add(g);
}

function flower(x, z, color, parent) {
  const g = new THREE.Group();
  box(0.05, 0.4, 0.05, 0x2e9e45, 0, 0.2, 0, g);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(color));
  head.position.y = 0.46;
  g.add(head);
  g.position.set(x, 0, z);
  parent.add(g);
}

function cloud(x, y, z, s, parent) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, emissive: 0xbfe6ff, emissiveIntensity: 0.35 });
  [
    [0, 0, 0, 1.3],
    [1.3, -0.2, 0.1, 1],
    [-1.3, -0.25, 0, 0.95],
    [0.5, 0.45, 0, 0.85],
  ].forEach(([px, py, pz, r]) => {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
    b.position.set(px, py, pz);
    g.add(b);
  });
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  parent.add(g);
  return g;
}

export function createWorld() {
  const scene = new THREE.Scene();
  const rand = mulberry32(7);

  // ---------- แสง ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9c7a55, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
  sun.position.set(-7, 12, 14);
  scene.add(sun);
  const chamberLight = new THREE.PointLight(0xffb866, 18, 11, 2);
  chamberLight.position.set(CHAMBER.x, CHAMBER.y + 0.5, 3);
  scene.add(chamberLight);

  const diorama = new THREE.Group();
  scene.add(diorama);

  // ---------- ชั้นดิน (หน้าตัดอยู่ที่ z = 0) ----------
  const W = WORLD.halfWidth * 2;
  for (const b of SOIL_BANDS) {
    const h = b.y0 - b.y1;
    box(W, h, WORLD.depth, b.color, 0, (b.y0 + b.y1) / 2, -WORLD.depth / 2, diorama);
  }

  // กรวด/หินฝังหน้าดินให้ไม่โล่ง
  const stoneColors = [0xb98a5b, 0x6b4a30, 0xa07a52, 0x4d3220, 0xc7a073];
  for (let i = 0, placed = 0; placed < 130 && i < 1200; i++) {
    const x = (rand() * 2 - 1) * (WORLD.halfWidth - 0.4);
    const y = -0.6 - rand() * (-WORLD.bottomY - 1);
    if (CAVITY_RECTS.some((r) => x > r.x0 - 0.5 && x < r.x1 + 0.5 && y > r.y0 - 0.5 && y < r.y1 + 0.5)) continue;
    const s = 0.1 + rand() * 0.22;
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat(stoneColors[Math.floor(rand() * stoneColors.length)]));
    stone.position.set(x, y, 0.02);
    stone.scale.z = 0.5;
    stone.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    diorama.add(stone);
    placed++;
  }

  // ---------- สนามหญ้าด้านบน (มีช่องให้อุโมงค์ทะลุขึ้นมา) ----------
  const lawnZ0 = -WORLD.depth;
  const lawnDepth = WORLD.lawnFront - lawnZ0;
  const lawnCz = (WORLD.lawnFront + lawnZ0) / 2;
  const lawnPieces = [
    { x0: -WORLD.halfWidth, x1: SHAFT.x0 },
    { x0: SHAFT.x1, x1: WORLD.halfWidth },
  ];
  const clickables = [];
  for (const p of lawnPieces) {
    const w = p.x1 - p.x0;
    const cx = (p.x0 + p.x1) / 2;
    box(w, 0.4, lawnDepth, 0x6e4425, cx, -0.6, lawnCz, diorama); // ขอบดินใต้หญ้า
    const grass = box(w, 0.4, lawnDepth, 0x58d04a, cx, -0.2, lawnCz, diorama);
    clickables.push(grass);
  }

  tree(-6.6, -1.3, 1.1, diorama);
  tree(-4.2, -1.7, 0.8, diorama);
  tree(7.1, -1.4, 1.0, diorama);
  const flowers = [
    [-7.8, 0.6, 0xff6fa5],
    [-2.6, 0.9, 0xffe14d],
    [-1.6, 0.3, 0xffffff],
    [2.1, -0.6, 0xff6fa5],
    [6.2, 0.7, 0xffe14d],
    [8.1, 0.2, 0xffffff],
  ];
  flowers.forEach(([x, z, c]) => flower(x, z, c, diorama));

  // ---------- โพรงรัง ----------
  const zRim = 0.03;
  cavityRect(SHAFT, 0.06, zRim, 0xc79a63, 0.12, diorama);
  cavityRect(TUNNEL, 0.06, zRim, 0xc79a63, 0.12, diorama);
  hexRoom(CHAMBER.x, CHAMBER.y, CHAMBER.r + 0.14, 0.06, zRim, 0xc79a63, diorama);

  const zIn = 0.06;
  cavityRect(SHAFT, 0.06, zIn, 0x3a2315, 0, diorama);
  cavityRect(TUNNEL, 0.06, zIn, 0x3a2315, 0, diorama);
  hexRoom(CHAMBER.x, CHAMBER.y, CHAMBER.r, 0.06, zIn, 0x3a2315, diorama);
  hexRoom(CHAMBER.x, CHAMBER.y, CHAMBER.r * 0.8, 0.06, zIn + 0.02, 0x4a2e1b, diorama);

  // พื้นห้อง/อุโมงค์ ยื่นออกมาด้านหน้าให้มดเดินบนได้
  const floorW = FLOOR.x1 - FLOOR.x0;
  const floorH = FLOOR.y1 - FLOOR.y0;
  box(floorW, floorH, FLOOR.zFront - FLOOR.zBack, 0xc99a5b, (FLOOR.x0 + FLOOR.x1) / 2, (FLOOR.y0 + FLOOR.y1) / 2, (FLOOR.zFront + FLOOR.zBack) / 2, diorama);

  // ---------- ราชินี ----------
  const antGeo = createAntGeometry();
  const queen = new THREE.Group();
  const queenBody = new THREE.Mesh(
    antGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, color: 0xffa21f }),
  );
  queenBody.scale.setScalar(QUEEN_POS.scale);
  queen.add(queenBody);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 5), mat(0xffd23f));
  crown.position.set(0.42, 0.36, 0);
  queenBody.add(crown);
  queen.position.set(QUEEN_POS.x, FLOOR_Y + ANT_FOOT_OFFSET * QUEEN_POS.scale, QUEEN_POS.z);
  diorama.add(queen);

  // ไข่ข้างราชินี: มีช่องวางได้ 8 ใบ แสดงตามจำนวนไข่จริง (ใบที่เกินช่องไม่ต้องวาดเพิ่ม)
  const eggs = [];
  [
    [4.55, 0.2],
    [4.45, 0.78],
    [4.68, 0.5],
    [4.25, -0.12],
    [3.7, -0.15],
    [3.15, -0.15],
    [2.6, -0.12],
    [4.15, 1.0],
  ].forEach(([x, z], i) => {
    const egg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat(0xfff3d6));
    egg.position.set(x, FLOOR_Y + 0.22, z);
    egg.userData.phase = i * 1.7;
    egg.userData.grow = 0; // 0 = ซ่อน, 1 = แสดงเต็ม (ค่อย ๆ โตเข้าหาเป้าหมาย)
    egg.scale.setScalar(0.001);
    diorama.add(egg);
    eggs.push(egg);
  });
  let eggTarget = 0;

  // ---------- ผลเบอร์รี่ (เป้าหมายคลิก) ----------
  const berry = new THREE.Group();
  const berryBody = new THREE.Mesh(new THREE.IcosahedronGeometry(FOOD_RADIUS, 1), mat(0xff3b5c));
  berryBody.scale.set(1, 0.92, 1);
  berry.add(berryBody);
  const seedMat = mat(0xffe27a);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 * 2.3;
    const yy = ((i % 7) / 7) * 1.1 - 0.45;
    const rr = Math.sqrt(Math.max(1 - (yy / 0.92) ** 2, 0.05)) * FOOD_RADIUS;
    const seed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.05), seedMat);
    seed.position.set(Math.cos(a) * rr * 0.98, yy * FOOD_RADIUS * 0.92, Math.sin(a) * rr * 0.98);
    seed.lookAt(seed.position.clone().multiplyScalar(2));
    berry.add(seed);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 4), mat(0x2fbf55));
    leaf.position.set(Math.cos(a) * 0.3, FOOD_RADIUS * 0.85, Math.sin(a) * 0.3);
    leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    berry.add(leaf);
  }
  berry.position.set(FOOD_POS.x, FOOD_RADIUS * 0.9, FOOD_POS.z);
  diorama.add(berry);

  // พื้นที่แตะที่ใหญ่กว่าตัวผล (นิ้วแตะมือถือได้ง่ายขึ้น) มองไม่เห็นแต่ถูก raycast
  const hit = new THREE.Mesh(new THREE.SphereGeometry(FOOD_RADIUS * 1.7, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.copy(berry.position);
  hit.userData.isBerry = true;
  diorama.add(hit);
  clickables.push(hit);

  // ---------- ห้องฟาร์มเชื้อรา (ซ่อนไว้จนกว่าจะซื้อ) ----------
  // จัดตำแหน่งลูกทั้งหมดสัมพัทธ์กับศูนย์กลางห้อง เพื่อให้สเกลเข้า/ออกจากจุดกึ่งกลางได้
  const fungus = new THREE.Group();
  fungus.position.set(FUNGUS.x, FUNGUS.y, 0);
  fungus.visible = false;
  diorama.add(fungus);
  const rel = (r) => ({ x0: r.x0 - FUNGUS.x, x1: r.x1 - FUNGUS.x, y0: r.y0 - FUNGUS.y, y1: r.y1 - FUNGUS.y });
  cavityRect(rel(FUNGUS_TUNNEL), 0.06, zRim, 0xc79a63, 0.12, fungus);
  hexRoom(0, 0, FUNGUS.r + 0.14, 0.06, zRim, 0xc79a63, fungus);
  cavityRect(rel(FUNGUS_TUNNEL), 0.06, zIn, 0x3a2315, 0, fungus);
  hexRoom(0, 0, FUNGUS.r, 0.06, zIn, 0x3a2315, fungus);
  hexRoom(0, 0, FUNGUS.r * 0.8, 0.06, zIn + 0.02, 0x2f2a3d, fungus);

  const ff = rel(FUNGUS_FLOOR);
  box(
    ff.x1 - ff.x0,
    ff.y1 - ff.y0,
    FUNGUS_FLOOR.zFront - FUNGUS_FLOOR.zBack,
    0xc99a5b,
    (ff.x0 + ff.x1) / 2,
    (ff.y0 + ff.y1) / 2,
    (FUNGUS_FLOOR.zFront + FUNGUS_FLOOR.zBack) / 2,
    fungus,
  );

  const mushrooms = [];
  const floorTop = ff.y1;
  [
    [-0.55, 0.35, 1.5, 0xff8fb1],
    [0.1, 0.55, 1.1, 0xa78bff],
    [0.65, 0.2, 0.8, 0xffd166],
    [-1.15, 0.7, 0.85, 0x7be0c3],
    [0.95, 0.65, 0.6, 0xff8fb1],
    [-0.2, 0.15, 0.7, 0xffd166],
  ].forEach(([x, z, s, capColor], i) => {
    const m = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.5, 6), mat(0xfff1dc));
    stem.position.y = 0.25;
    m.add(stem);
    const capMat = new THREE.MeshStandardMaterial({ color: capColor, flatShading: true, roughness: 0.7, emissive: capColor, emissiveIntensity: 0.3 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.position.y = 0.46;
    cap.scale.y = 0.8;
    m.add(cap);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i;
      const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), mat(0xffffff));
      dot.position.set(Math.cos(a) * 0.17, 0.46 + Math.sin(a * 0.7 + 1) * 0.04 + 0.12, Math.sin(a) * 0.17);
      m.add(dot);
    }
    m.position.set(x, floorTop, z);
    m.scale.setScalar(s);
    m.userData.phase = i * 1.3;
    fungus.add(m);
    mushrooms.push(m);
  });

  const fungusLight = new THREE.PointLight(0x7bffc8, 0, 8, 2);
  // อยู่นอกกลุ่มที่ซ่อนไว้ เพื่อให้จำนวนแสงในฉากคงที่ (ไม่ต้องคอมไพล์ shader ใหม่ตอนปลดล็อก)
  fungusLight.position.set(FUNGUS.x, FUNGUS.y + 0.2, 2.5);
  scene.add(fungusLight);

  const fungusState = { on: false, t: 1 };
  const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

  // ห้องบ่มไข่ / ค่ายนักรบ / ห้องคลังอาหาร (ซ่อนไว้จนกว่าจะซื้ออัปเกรด) ดู rooms.js
  const rooms = createRooms(diorama);

  // ---------- เอฟเฟกต์ตอนฟักไข่: วงแหวนขยาย + แสงในห้องวาบ ----------
  const ringGeo = new THREE.RingGeometry(0.25, 0.36, 40);
  const pulses = [];
  const baseLightColor = new THREE.Color(0xffb866);
  const flash = { k: 0, boost: 0, color: new THREE.Color() };
  const HATCH_POS = { x: QUEEN_POS.x + 0.9, y: FLOOR_Y + 1.0, z: 1.2 };

  // ---------- เมฆ ----------
  const clouds = [
    cloud(-12, 6.5, -9, 1.0, scene),
    cloud(4, 8, -12, 1.3, scene),
    cloud(14, 5.5, -8, 0.8, scene),
    cloud(-3, 9.5, -14, 1.1, scene),
  ];

  let pop = 0;

  return {
    scene,
    rooms,
    clickables,
    berry,
    queen,
    popBerry() {
      pop = 1;
    },
    // วงแหวนสีขยายออกจากจุดฟัก + แสงในห้องราชินีวาบสีเดียวกัน ยิ่งระดับสูงยิ่งใหญ่/นานและมีหลายวง
    hatchPulse(hex, tier) {
      const rings = tier >= 4 ? 3 : tier >= 3 ? 2 : 1;
      for (let i = 0; i < rings; i++) {
        const m = new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
        );
        m.position.set(HATCH_POS.x, HATCH_POS.y, HATCH_POS.z);
        diorama.add(m);
        pulses.push({ mesh: m, t: -i * 0.14, dur: 0.55 + tier * 0.12, grow: 3 + tier * 1.6 });
      }
      flash.k = 1;
      flash.boost = 14 + tier * 22;
      flash.color.set(hex);
    },
    // จำนวนไข่ที่โชว์ในห้องราชินี (สูงสุด 8 ใบ)
    setEggCount(n) {
      eggTarget = Math.min(Math.floor(n), eggs.length);
    },
    // เปิด/ปิดห้องฟาร์มเชื้อรา: animate = true จะค่อย ๆ โผล่ออกมา (ใช้ตอนเพิ่งซื้อ)
    setFungusRoom(on, animate) {
      fungusState.on = on;
      fungusState.t = on && animate ? 0 : 1;
      fungus.visible = on;
      if (on && !animate) {
        fungus.scale.setScalar(1);
        fungusLight.intensity = 14;
      }
    },
    update(dt, time, cloudMul = 1) {
      rooms.update(dt, time);
      if (fungusState.on) {
        if (fungusState.t < 1) {
          fungusState.t = Math.min(1, fungusState.t + dt / 0.7);
          fungus.scale.setScalar(Math.max(easeOutBack(fungusState.t), 0.001));
          fungusLight.intensity = 14 * fungusState.t;
        }
        mushrooms.forEach((m) => {
          const s = m.userData.phase;
          m.scale.y = m.scale.x * (1 + Math.sin(time * 1.6 + s) * 0.04);
        });
      }

      // ผลเบอร์รี่โยกเบา ๆ + บีบตอนโดนคลิก
      pop *= Math.exp(-11 * dt);
      const bob = Math.sin(time * 2.2) * 0.04;
      berry.position.y = FOOD_RADIUS * 0.9 + bob;
      berry.rotation.y = Math.sin(time * 0.9) * 0.25;
      berry.scale.set(1 + pop * 0.2, 1 - pop * 0.25, 1 + pop * 0.2);

      // ราชินีหายใจ
      const breathe = 1 + Math.sin(time * 1.8) * 0.025;
      queen.scale.set(1, breathe, 1);
      eggs.forEach((e, i) => {
        const goal = i < eggTarget ? 1 : 0;
        e.userData.grow += (goal - e.userData.grow) * (1 - Math.exp(-9 * dt));
        const g = Math.max(e.userData.grow, 0.001);
        const s = 1 + Math.sin(time * 2 + e.userData.phase) * 0.04;
        e.scale.set(0.85 * s * g, 1.1 * g / s, 0.85 * s * g);
        e.visible = e.userData.grow > 0.01 || goal === 1;
      });

      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += dt;
        const k = Math.min(Math.max(p.t, 0) / p.dur, 1);
        p.mesh.visible = p.t >= 0;
        p.mesh.scale.setScalar(0.4 + (1 - (1 - k) ** 3) * p.grow);
        p.mesh.material.opacity = 0.9 * (1 - k);
        if (k >= 1) {
          diorama.remove(p.mesh);
          p.mesh.material.dispose();
          pulses.splice(i, 1);
        }
      }
      if (flash.k > 0) {
        flash.k = Math.max(0, flash.k - dt / 0.6);
        chamberLight.intensity = 18 + flash.boost * flash.k;
        chamberLight.color.copy(baseLightColor).lerp(flash.color, flash.k);
      }

      clouds.forEach((c, i) => {
        c.position.x += dt * (0.25 + i * 0.07) * cloudMul;
        if (c.position.x > 24) c.position.x = -24;
      });
    },
  };
}
