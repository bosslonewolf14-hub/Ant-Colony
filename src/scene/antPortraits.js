import * as THREE from 'three';
import { createAntGeometry } from './antModel.js';

const W = 220;
const H = 150;

// วาดภาพประกอบของมดแต่ละชนิดจากโมเดล 3D เดียวกับในฉาก เป็นรูปครั้งเดียวตอนเริ่มเกม (ใช้เป็นภาพการ์ดสมุดสะสม)
// ใช้ renderer แยกชั่วคราวแล้วทิ้งทันที ไม่กระทบฉากหลัก
// คืน { [id]: dataURL, unknown: dataURL } โดย unknown เป็นภาพเงาดำสำหรับชนิดที่ยังไม่เคยพบ
export function renderAntPortraits(types) {
  const out = {};
  const canvas = document.createElement('canvas');
  canvas.width = W * 2; // วาดละเอียดเป็น 2 เท่าให้คมบนจอความละเอียดสูง
  canvas.height = H * 2;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return out; // สร้างบริบท WebGL ไม่ได้ → การ์ดจะไม่มีรูป แต่ข้อมูลยังแสดงครบ
  }
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9c7a55, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.position.set(-3, 5, 6);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 50);
  camera.position.set(0.3, 0.55, 4.6);
  camera.lookAt(-0.05, 0.02, 0);

  const geometry = createAntGeometry();
  const body = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75 }));
  body.rotation.y = -0.55; // มองเฉียง 3/4 ให้เห็นรูปร่างมากกว่าด้านข้างตรง ๆ
  scene.add(body);

  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 5), new THREE.MeshStandardMaterial({ color: 0xffd23f, flatShading: true }));
  crown.position.set(0.42, 0.36, 0);
  body.add(crown);

  const maxScale = Math.max(...types.map((t) => t.scale));
  const snap = () => {
    renderer.render(scene, camera);
    return canvas.toDataURL('image/png');
  };

  for (const t of types) {
    body.material.color.set(t.color);
    body.scale.setScalar((t.scale / maxScale) * 1.0 + 0.12); // ขนาดสัมพัทธ์ระหว่างชนิด ตัวใหญ่สุดเต็มกรอบ
    crown.visible = t.id === 'legendary';
    out[t.id] = snap();
  }

  // เงาดำสำหรับชนิดที่ยังไม่พบ
  body.material.color.set(0x1d120a);
  body.material.emissive.set(0x1d120a);
  body.scale.setScalar(0.9);
  crown.visible = false;
  out.unknown = snap();

  body.material.dispose();
  crown.material.dispose();
  crown.geometry.dispose();
  geometry.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
