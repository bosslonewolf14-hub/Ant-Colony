// ตำแหน่งและขนาดของทุกอย่างในฉาก (หน่วยโลก) แยกไว้ที่เดียวเพื่อให้ world/ants ใช้ตรงกัน
// แกน: x ขวา, y ขึ้น, z เข้าหากล้อง  ผิวดินอยู่ที่ y = 0 หน้าตัดรังอยู่ที่ z = 0

export const WORLD = {
  halfWidth: 9,
  surfaceY: 0,
  bottomY: -30,
  depth: 2.5,
  lawnFront: 1.2,
};

export const SOIL_BANDS = [
  { y0: 0, y1: -3.2, color: 0x9a6232 },
  { y0: -3.2, y1: -7, color: 0x85502a },
  { y0: -7, y1: -11, color: 0x6f4122 },
  { y0: -11, y1: -16, color: 0x5a331b },
  { y0: -16, y1: -21, color: 0x4f2d18 },
  { y0: -21, y1: -26, color: 0x442715 },
  { y0: -26, y1: -30, color: 0x3a2012 },
];

export const FLOOR_Y = -7.9; // ผิวบนของพื้นห้อง/อุโมงค์
export const ANT_LIFT = 0.135; // ระยะจากพื้นถึงจุดกึ่งกลางตัวมด (= ANT_FOOT_OFFSET 0.27 × สเกลมด 0.5)

export const SHAFT = { x0: -0.45, x1: 0.45, y0: -8.45, y1: 0 };
export const TUNNEL = { x0: -0.45, x1: 2.2, y0: -8.45, y1: -6.3 };
export const CHAMBER = { x: 3.2, y: -6.2, r: 2.6 };
export const FLOOR = { x0: -0.45, x1: 4.8, y0: -8.45, y1: FLOOR_Y, zBack: -0.2, zFront: 1.0 };

// ห้องฟาร์มเชื้อรา (ซ่อนไว้จนกว่าจะซื้ออัปเกรด) อยู่ซ้ายของอุโมงค์หลัก
export const FUNGUS = { x: -4.1, y: -3.7, r: 2.0 };
export const FUNGUS_TUNNEL = { x0: -3.0, x1: -0.3, y0: -5.43, y1: -3.7 };
export const FUNGUS_FLOOR = { x0: -5.1, x1: -0.45, y0: -5.43, y1: -5.2, zBack: -0.2, zFront: 0.9 };

// ห้องบ่มไข่ (ปลดล็อกด้วยอัปเกรด Luck) อยู่ขวาบน ใต้สนามหญ้า เหนือห้องราชินี
export const HATCHERY = { x: 3.6, y: -2.55, r: 1.45 };
export const HATCHERY_TUNNEL = { x0: 0.3, x1: 2.6, y0: -3.81, y1: -2.55 };
export const HATCHERY_FLOOR = { x0: 0.45, x1: 4.7, y0: -3.81, y1: -3.58, zBack: -0.2, zFront: 0.9 };

// ค่ายนักรบ (ปลดล็อกด้วยอัปเกรดค่ายนักรบ) อยู่ซ้ายกลาง ฝั่งตรงข้ามห้องราชินี
export const BARRACKS = { x: -4.2, y: -8.5, r: 1.9 };
export const BARRACKS_TUNNEL = { x0: -3.1, x1: -0.3, y0: -10.145, y1: -8.5 };
export const BARRACKS_FLOOR = { x0: -5.6, x1: -0.45, y0: -10.145, y1: -9.9, zBack: -0.2, zFront: 0.9 };

// ห้องวิจัย (ปลดล็อกด้วยอัปเกรดห้องวิจัย) อยู่ขวากลาง ใต้ห้องราชินี เหนือห้องคลังห้องแรก เชื่อมกับทางลงลึก
export const LAB = { x: 4.4, y: -10.2, r: 1.3 };
const LAB_BOTTOM = LAB.y - LAB.r * 0.866;
export const LAB_TUNNEL = { x0: -0.3, x1: LAB.x - LAB.r + 0.5, y0: LAB_BOTTOM, y1: LAB.y };
export const LAB_FLOOR = { x0: 0.45, x1: LAB.x + 0.85, y0: LAB_BOTTOM, y1: LAB_BOTTOM + 0.22, zBack: -0.2, zFront: 0.9 };

// ทางลงลึกสู่ห้องคลังอาหาร: โผล่ทีละช่วงตามจำนวนห้องคลังที่สร้าง (ช่วงละ 2 ห้อง ซ้าย-ขวา)
export const DEEP_SHAFT = { x0: -0.45, x1: 0.45 };
const STORAGE_R = 1.75;
const STORAGE_FIRST_Y = -13.2;
const STORAGE_LEVEL_GAP = 4;
export const STORAGE_MAX = 8;

// ห้องคลังอาหารห้องที่ n (เริ่มที่ 1): คี่ = ขวา, คู่ = ซ้าย ห้องละ 2 ต่อชั้น
export const STORAGE_ROOMS = Array.from({ length: STORAGE_MAX }, (_, i) => {
  const n = i + 1;
  const right = n % 2 === 1;
  const level = Math.ceil(n / 2);
  const x = right ? 4.3 : -4.3;
  const y = STORAGE_FIRST_Y - (level - 1) * STORAGE_LEVEL_GAP;
  const bottom = y - STORAGE_R * 0.866;
  const tunnel = right ? { x0: -0.3, x1: x - STORAGE_R + 0.55, y0: bottom, y1: y } : { x0: x + STORAGE_R - 0.55, x1: 0.3, y0: bottom, y1: y };
  const floor = right
    ? { x0: 0.45, x1: x + 1.05, y0: bottom, y1: bottom + 0.25, zBack: -0.2, zFront: 0.9 }
    : { x0: x - 1.05, x1: -0.45, y0: bottom, y1: bottom + 0.25, zBack: -0.2, zFront: 0.9 };
  return { n, level, x, y, r: STORAGE_R, bottom, tunnel, floor, right };
});

// ช่วงของทางลง: ช่วงที่ k ลงถึงก้นห้องชั้นที่ k
export const DEEP_SEGMENTS = (() => {
  const segs = [];
  let top = SHAFT.y0;
  for (let k = 1; k <= STORAGE_MAX / 2; k++) {
    const bottom = STORAGE_FIRST_Y - (k - 1) * STORAGE_LEVEL_GAP - STORAGE_R * 0.866 - 0.01;
    segs.push({ x0: DEEP_SHAFT.x0, x1: DEEP_SHAFT.x1, y1: top, y0: bottom });
    top = bottom;
  }
  return segs;
})();

export const FOOD_POS = { x: 4.2, y: 0, z: 0.45 };
export const FOOD_RADIUS = 0.75;
export const QUEEN_POS = { x: 3.4, z: 0.5, scale: 1.5 };

// จุดต่อสู้บนสนามหญ้า: ศัตรูเดินมาจากขอบซ้ายสุดแล้วหยุดหน้าปากทางลง นักรบยืนขวางอยู่ระหว่างศัตรูกับทางลง
export const RAID = { spawnX: -9.4, enemyFrontX: -2.8, guardBackX: -0.7, guardSpacing: 0.27 };

const walkY = FLOOR_Y + ANT_LIFT;
const topY = WORLD.surfaceY + ANT_LIFT;

// เส้นทางวนของมดงาน (ปิดวงเองจากจุดสุดท้ายกลับจุดแรก)
// ถือของเมื่อผ่านจุดที่ CARRY_FROM (ถึงอาหารแล้ว) จนถึงห้องราชินี
export const ANT_PATH = [
  [1.9, walkY], // ส่งอาหารให้ราชินี
  [0, walkY],
  [0, topY],
  [FOOD_POS.x - FOOD_RADIUS - 0.15, topY], // จุดกัดอาหาร
  [0, topY],
  [0, walkY],
];
export const CARRY_FROM = 3;

const hexRect = (room, pad = 0.3) => ({
  x0: room.x - room.r - pad,
  x1: room.x + room.r + pad,
  y0: room.y - room.r * 0.87 - pad,
  y1: room.y + room.r * 0.87 + pad,
});

// สี่เหลี่ยมโพรงทั้งหมด ใช้กันไม่ให้กรวดไปวางทับโพรง
export const CAVITY_RECTS = [
  SHAFT,
  TUNNEL,
  { x0: FUNGUS.x - FUNGUS.r - 0.3, x1: FUNGUS_TUNNEL.x1, y0: FUNGUS_TUNNEL.y0 - 0.3, y1: FUNGUS.y + FUNGUS.r * 0.87 + 0.3 },
  hexRect(CHAMBER),
  { x0: HATCHERY_TUNNEL.x0, x1: HATCHERY.x + HATCHERY.r + 0.3, y0: HATCHERY_TUNNEL.y0 - 0.3, y1: HATCHERY.y + HATCHERY.r * 0.87 + 0.3 },
  { x0: BARRACKS.x - BARRACKS.r - 0.3, x1: BARRACKS_TUNNEL.x1, y0: BARRACKS_TUNNEL.y0 - 0.3, y1: BARRACKS.y + BARRACKS.r * 0.87 + 0.3 },
  { x0: DEEP_SHAFT.x0, x1: DEEP_SHAFT.x1, y0: DEEP_SEGMENTS[DEEP_SEGMENTS.length - 1].y0, y1: SHAFT.y0 },
  ...STORAGE_ROOMS.map((s) => hexRect(s)),
  { x0: LAB_TUNNEL.x0, x1: LAB.x + LAB.r + 0.3, y0: LAB_TUNNEL.y0 - 0.3, y1: LAB.y + LAB.r * 0.87 + 0.3 },
];
