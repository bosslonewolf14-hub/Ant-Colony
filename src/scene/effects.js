import * as THREE from 'three';

const MAX = 64;

// พาร์ติเคิลก้อนเล็ก ๆ ตอนคลิก ใช้ InstancedMesh ตัวเดียวทั้งหมด
export function createEffects(scene) {
  const geo = new THREE.IcosahedronGeometry(0.1, 0);
  const material = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.7 });
  const mesh = new THREE.InstancedMesh(geo, material, MAX);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const pool = Array.from({ length: MAX }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
  let cursor = 0;

  for (let i = 0; i < MAX; i++) {
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.set(0xffffff));
  }

  return {
    burst(x, y, z, hex, count = 10) {
      for (let n = 0; n < count; n++) {
        const p = pool[cursor];
        const i = cursor;
        cursor = (cursor + 1) % MAX;
        const a = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = Math.cos(a) * speed;
        p.vy = 3 + Math.random() * 3;
        p.vz = Math.sin(a) * speed * 0.5;
        p.max = p.life = 0.5 + Math.random() * 0.4;
        mesh.setColorAt(i, color.set(hex).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15));
      }
      mesh.instanceColor.needsUpdate = true;
    },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = pool[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        p.vy -= 14 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const k = Math.max(p.life / p.max, 0);
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(k);
        dummy.rotation.set(p.life * 8, p.life * 6, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
