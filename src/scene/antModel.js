import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// โมเดลมด low-poly ชิ้นเดียว หันหน้าไปทาง +x
// สีฝังเป็น vertex color (ความสว่างสัมพัทธ์) แล้วคูณกับสีของ material/instance อีกที
// ทำให้เปลี่ยนสีมดต่อตัวได้โดยไม่ต้องสร้างโมเดลใหม่ (ใช้ตอนทำความหายากของมดภายหลัง)
export const ANT_FOOT_OFFSET = 0.27; // ปลายขาต่ำกว่าจุดกึ่งกลางตัวเท่านี้ (ก่อนคูณสเกล)

function part(geometry, { pos = [0, 0, 0], scale = [1, 1, 1], rotZ = 0, shade = 1 }) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.deleteAttribute('uv');
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotZ),
    new THREE.Vector3(...scale),
  );
  g.applyMatrix4(m);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3).fill(shade);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export function createAntGeometry() {
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const parts = [
    part(ball, { pos: [-0.5, 0.02, 0], scale: [0.45, 0.34, 0.34], shade: 1.0 }), // ท้อง
    part(ball, { pos: [0, 0.03, 0], scale: [0.27, 0.21, 0.21], shade: 0.9 }), // อก
    part(ball, { pos: [0.42, 0.05, 0], scale: [0.24, 0.22, 0.22], shade: 0.85 }), // หัว
    part(ball, { pos: [0.54, 0.13, 0.13], scale: [0.06, 0.06, 0.06], shade: 0.05 }), // ตา
    part(ball, { pos: [0.54, 0.13, -0.13], scale: [0.06, 0.06, 0.06], shade: 0.05 }),
    part(box, { pos: [0.68, 0.27, 0.07], scale: [0.3, 0.035, 0.035], rotZ: 0.6, shade: 0.5 }), // หนวด
    part(box, { pos: [0.68, 0.27, -0.07], scale: [0.3, 0.035, 0.035], rotZ: 0.6, shade: 0.5 }),
  ];
  // ขา 3 คู่
  for (const x of [-0.12, 0.02, 0.16]) {
    for (const z of [0.17, -0.17]) {
      parts.push(part(box, { pos: [x, -0.1, z], scale: [0.04, 0.34, 0.04], rotZ: x * 0.6, shade: 0.55 }));
    }
  }
  const geo = mergeGeometries(parts, false);
  geo.computeVertexNormals();
  return geo;
}
