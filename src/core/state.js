import cfg from '../config/economy.json';
import antCfg from '../config/ants.json';
import raidCfg from '../config/raid.json';

// สถานะเกมทั้งหมดอยู่ที่นี่ที่เดียว (ภาพ/UI อ่านจากตรงนี้ ไม่เก็บสถานะเอง)
export const state = {
  food: 0,
  totalFood: 0,
  wasted: 0, // อาหารที่ล้นคลังแล้วเสียไป (สถิติ)
  workers: 0,
  warriors: 0, // มดนักรบ: ไม่เก็บอาหาร มีไว้ป้องกันรังตอนถูกบุก
  clicks: 0,
  // ระดับของอัปเกรดแต่ละชนิด (0 = ยังไม่ซื้อ)
  upgrades: {
    clickPower: 0,
    antSpeed: 0,
    eggSpeed: 0,
    luck: 0, // ระดับ ≥ 1 = มีห้องบ่มไข่
    storage: 0, // จำนวนห้องคลังอาหารที่สร้างแล้ว (เพิ่มความจุคลัง)
    barracks: 0, // ระดับค่ายนักรบ (เพิ่มพลังนักรบ)
    lab: 0, // 1 = มีห้องวิจัย (เปิดแท็บวิจัย) อยู่ถาวรแม้ก่อตั้งอาณานิคมใหม่
    queenSkills: 0, // ระดับสกิลราชินีที่ปลดล็อก (1–3) อยู่ถาวรแม้ก่อตั้งอาณานิคมใหม่
    fungusRoom: 0,
  },
  // Royal Jelly จากการก่อตั้งอาณานิคมใหม่: ให้โบนัสถาวร (ไม่รีเซ็ต)
  prestige: { jelly: 0, count: 0 },
  // วิจัย: หัวข้อที่เสร็จแล้ว { [id]: true } และหัวข้อที่กำลังวิจัย { id, left } (ทีละหัวข้อ) ไม่รีเซ็ตตอนก่อตั้งใหม่
  research: { done: {}, active: null },
  // สถิติสะสม (ใช้กับภารกิจ)
  stats: { golden: 0, skills: 0 },
  // ไข่ที่ราชินีวางไว้ (ยังไม่ฟัก) และวินาทีที่สะสมไปแล้วสำหรับใบถัดไป
  eggs: cfg.eggs.startEggs,
  eggProgress: 0,
  totalHatched: 0,
  // มดสะสมจากการฟักไข่ แยกตามชนิด
  ants: Object.fromEntries(antCfg.types.map((t) => [t.id, 0])),
  // ไข่ใบที่เท่าไหร่ (นับจากทั้งหมดที่เคยฟัก) ที่ได้มดชนิดนั้นเป็นครั้งแรก; null = ยังไม่เคยได้, 0 = เคยได้แต่ไม่ทราบลำดับ (เซฟเก่า)
  firstHatch: Object.fromEntries(antCfg.types.map((t) => [t.id, null])),
  // ตัวนับ Pity: จำนวนไข่ติดกันที่ยังไม่ได้ระดับนั้นหรือสูงกว่า
  pity: Object.fromEntries(antCfg.pity.map((p) => [p.key, 0])),
  // การบุกของศัตรู: คลื่นที่ผ่านมาแล้ว ชนะ/แพ้ และเวลาที่เหลือก่อนคลื่นถัดไป (การบุกที่กำลังเกิดอยู่ไม่ถูกบันทึก)
  raid: { wave: 0, won: 0, lost: 0, nextIn: raidCfg.firstDelaySec },
  // ภารกิจที่รับรางวัลไปแล้ว { [id]: true }
  missions: { claimed: {} },
};
