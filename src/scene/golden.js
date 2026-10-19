import * as THREE from 'three';

// ผลเบอร์รี่ทอง: โผล่สุ่มบนสนามหญ้า ลอยเด้ง ส่องประกาย คลิกเพื่อรับโบนัส (เหตุผลและรางวัลอยู่ใน core/events.js)
// goldenState = events.golden.active = { x, left } หรือ null: ฉากแค่ซิงก์ภาพให้ตรงกับสถานะนี้

export function createGolden(scene, clickables, effects) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffa800, emissiveIntensity: 0.9, flatShading: true, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), goldMat);
  body.scale.set(1, 0.92, 1);
  group.add(body);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 4), new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffc233, emissiveIntensity: 0.6, flatShading: true }));
    leaf.position.set(Math.cos(a) * 0.22, 0.5, Math.sin(a) * 0.22);
    leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    group.add(leaf);
  }
  // วงแสงรอบผล (หมุน/พัลส์) ให้เห็นเด่นบนพื้นหญ้า
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.05, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  );
  halo.position.z = -0.1;
  group.add(halo);

  // พื้นที่แตะที่ใหญ่กว่าตัวผล (นิ้วแตะง่าย) มองไม่เห็นแต่ถูก raycast
  const hit = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData.isGolden = true;
  hit.position.y = 0.6;
  group.add(hit);

  let shown = false;
  let appear = 0;
  let sparkle = 0;
  let baseX = 0;

  function show(x) {
    shown = true;
    appear = 0;
    baseX = x;
    group.visible = true;
    group.position.set(x, 0.85, 0.7);
    group.scale.setScalar(0.001);
    if (!clickables.includes(hit)) clickables.push(hit);
  }

  function hide(collected) {
    if (!shown) return;
    if (collected) effects.burst(group.position.x, group.position.y + 0.3, 1.0, '#ffd23f', 34);
    shown = false;
    group.visible = false;
    const i = clickables.indexOf(hit);
    if (i >= 0) clickables.splice(i, 1);
  }

  return {
    // เรียกทุกเฟรมด้วยสถานะผลเบอร์รี่ทอง (หรือ null)
    update(dt, time, goldenState) {
      if (goldenState && !shown) show(goldenState.x);
      if (!goldenState && shown) hide(false);
      if (!shown) return;
      appear = Math.min(1, appear + dt / 0.35);
      // ใกล้หมดเวลา (เหลือ < 3 วิ) กะพริบเตือน
      const urgent = goldenState && goldenState.left < 3;
      const blink = urgent ? (Math.sin(time * 16) > 0 ? 1 : 0.55) : 1;
      const grow = (1 - (1 - appear) ** 3) * blink;
      group.scale.setScalar(Math.max(grow, 0.001));
      group.position.y = 0.85 + Math.abs(Math.sin(time * 3)) * 0.35;
      body.rotation.y += dt * 1.8;
      halo.rotation.z += dt * 1.2;
      halo.material.opacity = 0.4 + Math.sin(time * 5) * 0.2;
      sparkle -= dt;
      if (sparkle <= 0) {
        sparkle = 0.35;
        effects.burst(baseX + (Math.random() - 0.5) * 0.8, 1.1, 1.0, '#fff2a8', 2);
      }
    },
    // ใช้ตอนผู้เล่นคลิกโดน: เอฟเฟกต์ประกายแล้วซ่อน
    collect() {
      hide(true);
    },
  };
}
