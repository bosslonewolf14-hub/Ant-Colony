import * as THREE from 'three';

// ตัวช่วยสร้างฉาก low-poly ที่ใช้ร่วมกันระหว่าง world.js และ rooms.js

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = opts.emissive ? `${color}:${opts.emissive}:${opts.emissiveIntensity ?? 1}` : color;
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...opts }),
    );
  }
  return matCache.get(key);
}

export function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ห้องหกเหลี่ยม (แบนหน้า-หลัง) ด้านบน/ล่างเรียบ
export function hexRoom(cx, cy, r, depth, z, color, parent) {
  const g = new THREE.CylinderGeometry(r, r, depth, 6);
  g.rotateX(Math.PI / 2);
  g.rotateZ(Math.PI / 6);
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(cx, cy, z);
  parent.add(m);
  return m;
}

export function cavityRect(rect, depth, z, color, grow, parent) {
  const w = rect.x1 - rect.x0 + grow * 2;
  const h = rect.y1 - rect.y0 + grow * 2;
  return box(w, h, depth, color, (rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, z, parent);
}

export const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

// สร้างห้อง 1 ห้องเป็นกลุ่ม (จุดหมุนอยู่กลางห้อง ตำแหน่งลูกสัมพัทธ์กับกลางห้อง):
//   spec = { x, y, r, tunnel: {x0,x1,y0,y1} (พิกัดโลก), floor: {x0,x1,y0,y1,zBack,zFront} }
// ภายในกลุ่มมีกรอบสีอ่อน โพรงสีเข้ม อุโมงค์เชื่อมทางหลัก และพื้นยื่นออกมาด้านหน้า
export function buildRoom(spec) {
  const g = new THREE.Group();
  g.position.set(spec.x, spec.y, 0);
  const zRim = 0.03;
  const zIn = 0.06;
  const rel = (r) => ({ x0: r.x0 - spec.x, x1: r.x1 - spec.x, y0: r.y0 - spec.y, y1: r.y1 - spec.y });
  const t = rel(spec.tunnel);
  cavityRect(t, 0.06, zRim, 0xc79a63, 0.12, g);
  hexRoom(0, 0, spec.r + 0.14, 0.06, zRim, 0xc79a63, g);
  cavityRect(t, 0.06, zIn, 0x3a2315, 0, g);
  hexRoom(0, 0, spec.r, 0.06, zIn, 0x3a2315, g);
  hexRoom(0, 0, spec.r * 0.8, 0.06, zIn + 0.02, spec.inner ?? 0x4a2e1b, g);
  const f = rel(spec.floor);
  box(
    f.x1 - f.x0,
    f.y1 - f.y0,
    spec.floor.zFront - spec.floor.zBack,
    0xc99a5b,
    (f.x0 + f.x1) / 2,
    (f.y0 + f.y1) / 2,
    (spec.floor.zFront + spec.floor.zBack) / 2,
    g,
  );
  return g;
}
