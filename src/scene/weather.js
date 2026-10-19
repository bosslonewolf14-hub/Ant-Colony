import * as THREE from 'three';

// ภาพสภาพอากาศ (ฝน/แดด/ลม) ค่อย ๆ จางเข้า-ออก ผลของเกมอยู่ใน core/modifiers.js + events.js
const DROPS = 160;
const LEAVES = 36;
const FIELD = { x0: -12, x1: 12, yTop: 9, yGround: 0.25, z0: -2.2, z1: 2.2 };

export function createWeather(scene) {
  // ----- ฝน: เส้นตกเฉียงเล็กน้อยเหนือสนามหญ้า (ตกถึงพื้นแล้ววนกลับขึ้นไป) -----
  const rainMat = new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.55, 0.025), rainMat, DROPS);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const drops = Array.from({ length: DROPS }, () => ({
    x: FIELD.x0 + Math.random() * (FIELD.x1 - FIELD.x0),
    y: FIELD.yGround + Math.random() * (FIELD.yTop - FIELD.yGround),
    z: FIELD.z0 + Math.random() * (FIELD.z1 - FIELD.z0),
    v: 13 + Math.random() * 5,
  }));

  // ----- แดด: ดวงอาทิตย์ low-poly พร้อมรังสีหมุน -----
  const sun = new THREE.Group();
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), sunMat);
  sun.add(core);
  const rayMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const ray = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.05), rayMat);
    ray.position.set(Math.cos(a) * 1.8, Math.sin(a) * 1.8, 0);
    ray.rotation.z = a - Math.PI / 2;
    sun.add(ray);
  }
  sun.position.set(6.5, 7.2, -9);
  sun.visible = false;
  scene.add(sun);

  // ----- ลม: ใบไม้ปลิวผ่านไปทางขวา -----
  const leafMat = new THREE.MeshBasicMaterial({ color: 0x57c95a, transparent: true, opacity: 0, depthWrite: false });
  const leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.1, 0.03), leafMat, LEAVES);
  leaves.frustumCulled = false;
  leaves.visible = false;
  scene.add(leaves);
  const leaf = Array.from({ length: LEAVES }, () => ({
    x: FIELD.x0 + Math.random() * (FIELD.x1 - FIELD.x0),
    y: 0.6 + Math.random() * 6,
    z: FIELD.z0 + Math.random() * (FIELD.z1 - FIELD.z0),
    v: 5 + Math.random() * 4,
    phase: Math.random() * 6.28,
  }));

  const dummy = new THREE.Object3D();
  const fade = { rain: 0, sun: 0, wind: 0 };
  const cloudSpeed = { value: 1 };

  return {
    // type = 'rain' | 'sun' | 'wind' | null
    update(dt, time, type) {
      for (const k of Object.keys(fade)) fade[k] += ((type === k ? 1 : 0) - fade[k]) * (1 - Math.exp(-2.2 * dt));
      cloudSpeed.value = 1 + fade.wind * 3;

      rain.visible = fade.rain > 0.02;
      if (rain.visible) {
        rainMat.opacity = 0.55 * fade.rain;
        for (let i = 0; i < DROPS; i++) {
          const d = drops[i];
          d.y -= d.v * dt;
          d.x -= d.v * 0.12 * dt;
          if (d.y < FIELD.yGround) {
            d.y = FIELD.yTop;
            d.x = FIELD.x0 + Math.random() * (FIELD.x1 - FIELD.x0);
          }
          dummy.position.set(d.x, d.y, d.z);
          dummy.rotation.set(0, 0, 0.12);
          dummy.updateMatrix();
          rain.setMatrixAt(i, dummy.matrix);
        }
        rain.instanceMatrix.needsUpdate = true;
      }

      sun.visible = fade.sun > 0.02;
      if (sun.visible) {
        sunMat.opacity = fade.sun;
        rayMat.opacity = 0.85 * fade.sun;
        sun.rotation.z += dt * 0.25;
        sun.scale.setScalar(0.9 + Math.sin(time * 1.6) * 0.04 + fade.sun * 0.1);
      }

      leaves.visible = fade.wind > 0.02;
      if (leaves.visible) {
        leafMat.opacity = 0.9 * fade.wind;
        for (let i = 0; i < LEAVES; i++) {
          const l = leaf[i];
          l.x += l.v * dt;
          if (l.x > FIELD.x1) l.x = FIELD.x0;
          dummy.position.set(l.x, l.y + Math.sin(time * 2.4 + l.phase) * 0.5, l.z);
          dummy.rotation.set(0, 0, time * 3 + l.phase);
          dummy.updateMatrix();
          leaves.setMatrixAt(i, dummy.matrix);
        }
        leaves.instanceMatrix.needsUpdate = true;
      }
    },
    // ตัวคูณความเร็วเมฆ (ลมแรง → เมฆเร็วขึ้น)
    cloudSpeed,
  };
}
