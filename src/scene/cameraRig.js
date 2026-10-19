import * as THREE from 'three';

const FOV = 40;
const MIN_VISIBLE_HEIGHT = 12; // หน่วยโลกที่ต้องเห็นในแนวตั้งอย่างน้อย
const MIN_VISIBLE_WIDTH = 19; // จอแนวนอน: เห็นทั้งรังกว้าง 18 + เผื่อห้องที่ขยายทางซ้าย
const PORTRAIT_VISIBLE_WIDTH = 13; // จอแนวตั้ง: เห็นแค่ช่วงกลางของรัง ให้มดตัวใหญ่พอ แล้วลากซ้าย-ขวาเพื่อดูส่วนอื่น
const PORTRAIT_ASPECT = 0.9; // กว้าง/สูง ต่ำกว่านี้ถือเป็นจอแนวตั้ง
const WORLD_HALF_WIDTH = 9.5; // ขอบซ้าย-ขวาของฉากที่เลื่อนไปดูได้

// กล้องมองตรงเข้าหน้าตัดรัง เลื่อนขึ้นลงได้ด้วยการลาก/ล้อเมาส์ (จอแนวตั้งลากซ้าย-ขวาได้ด้วย)
export function createCameraRig(camera) {
  camera.fov = FOV;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  const bounds = { top: 9, bottom: -29.5 };
  let visibleHeight = MIN_VISIBLE_HEIGHT;
  let visibleWidth = MIN_VISIBLE_WIDTH;
  let distance = 20;
  let viewportH = 1;
  let xOffset = 0;
  let yOffset = 0;
  let insetBottomUnits = 0; // ส่วนล่างของจอที่แผงร้านค้าบังอยู่ (หน่วยโลก)
  let insetSideUnits = 0; // ส่วนขวาของจอที่แผงร้านค้าบังอยู่
  let y = -2.6;
  let targetY = -2.6;
  let x = 0;
  let targetX = 0;
  let userPanAt = 0; // เวลาที่ผู้เล่นลาก/เลื่อนกล้องเองครั้งล่าสุด

  // y/x = จุดกลางของ "พื้นที่ที่มองเห็นจริง" (ไม่นับส่วนที่แผงบัง) ไม่ให้เลื่อนออกนอกฉาก
  function clampY(v) {
    const half = (visibleHeight - insetBottomUnits) / 2;
    const lo = bounds.bottom + half;
    const hi = bounds.top - half;
    if (lo > hi) return (lo + hi) / 2;
    return Math.min(hi, Math.max(lo, v));
  }

  function clampX(v) {
    const half = (visibleWidth - insetSideUnits) / 2;
    const lim = WORLD_HALF_WIDTH - half;
    return lim <= 0 ? 0 : Math.min(lim, Math.max(-lim, v));
  }

  // สั่นกล้อง: แอมพลิจูดลดลงเป็นเส้นตรงจนหมดเวลา (หน่วยโลก)
  let shakeAmp = 0;
  let shakeLeft = 0;
  let shakeTotal = 1;
  let sx = 0;
  let sy = 0;

  function apply() {
    const cy = y + yOffset + sy;
    const cx = x + xOffset + sx;
    camera.position.set(cx, cy, distance);
    camera.lookAt(cx, cy, 0);
  }

  return {
    // insetPx = พื้นที่ด้านขวา / insetBottomPx = ด้านล่างที่ถูกแผงร้านค้าบัง
    // ขยับฉากให้อยู่กลางพื้นที่ที่มองเห็นจริง
    resize(width, height, insetPx = 0, insetBottomPx = 0) {
      const aspect = width / height;
      viewportH = height;
      const wantWidth = aspect < PORTRAIT_ASPECT ? PORTRAIT_VISIBLE_WIDTH : MIN_VISIBLE_WIDTH;
      visibleHeight = Math.max(MIN_VISIBLE_HEIGHT, wantWidth / aspect);
      visibleWidth = visibleHeight * aspect;
      distance = visibleHeight / (2 * tanHalf);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      const upp = visibleHeight / height; // หน่วยโลกต่อพิกเซล
      insetSideUnits = insetPx * upp;
      insetBottomUnits = insetBottomPx * upp;
      xOffset = insetSideUnits / 2;
      yOffset = -insetBottomUnits / 2;
      targetY = clampY(targetY);
      y = clampY(y);
      targetX = clampX(targetX);
      x = clampX(x);
      apply();
    },
    panByPixels(dyPx, dxPx = 0) {
      userPanAt = performance.now();
      const upp = visibleHeight / viewportH;
      targetY = clampY(targetY + dyPx * upp);
      targetX = clampX(targetX - dxPx * upp); // ลากไปทางขวา = ภาพเลื่อนไปขวา = กล้องไปซ้าย
    },
    // เลื่อนกล้องไปที่ความลึก y (ค่อย ๆ เลื่อน) ใช้พาผู้เล่นไปดูห้องที่เพิ่งสร้าง
    focusY(worldY) {
      targetY = clampY(worldY);
    },
    // ไปดูที่ y สักครู่ (holdMs) แล้วกลับที่เดิม ถ้าระหว่างนั้นผู้เล่นลาก/เลื่อนเองจะไม่ดึงกลับ
    focusTemporarily(worldY, holdMs) {
      const back = targetY;
      const startedAt = performance.now();
      targetY = clampY(worldY);
      setTimeout(() => {
        if (userPanAt < startedAt) targetY = back;
      }, holdMs);
    },
    getY() {
      return y;
    },
    panByWheel(deltaY) {
      userPanAt = performance.now();
      targetY = clampY(targetY - deltaY * 0.012);
    },
    shake(amplitude, seconds) {
      if (amplitude * seconds < shakeAmp * shakeLeft) return; // ไม่ให้แรงสั่นเล็กทับแรงสั่นใหญ่ที่กำลังทำงาน
      shakeAmp = amplitude;
      shakeLeft = shakeTotal = seconds;
    },
    // เลื่อนกล้องไปที่ตำแหน่งแนวนอน (ใช้พาไปดูศัตรูที่เข้ามาจากซ้ายบนจอแนวตั้ง)
    focusX(worldX) {
      targetX = clampX(worldX);
    },
    update(dt) {
      y += (targetY - y) * (1 - Math.exp(-10 * dt));
      x += (targetX - x) * (1 - Math.exp(-10 * dt));
      if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - dt);
        const k = (shakeLeft / shakeTotal) * shakeAmp;
        sx = (Math.random() * 2 - 1) * k;
        sy = (Math.random() * 2 - 1) * k;
      } else {
        sx = sy = 0;
      }
      apply();
    },
    setBounds(top, bottom) {
      bounds.top = top;
      bounds.bottom = bottom;
      targetY = clampY(targetY);
    },
  };
}
