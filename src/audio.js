// เสียงสังเคราะห์ด้วย Web Audio (ไม่ต้องมีไฟล์เสียง) ทุกเสียงสั้นและเบา เล่นเฉพาะหลังผู้เล่นเคยแตะ/กดหน้าเว็บแล้ว
// เพราะเบราว์เซอร์ไม่อนุญาตให้เล่นเสียงก่อนมีการโต้ตอบ

const PREF_KEY = 'ant-colony-prefs';

function loadPrefs() {
  try {
    return JSON.parse(window.localStorage.getItem(PREF_KEY)) || {};
  } catch {
    return {};
  }
}

function savePrefs(p) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // จำค่าไม่ได้ก็ใช้ต่อได้ในรอบนี้
  }
}

let enabled = loadPrefs().sound !== false;
let ctx = null;
let master = null;
let noiseBuf = null;

// ตัวนับไว้ตรวจว่ามีการสั่งเล่นเสียงจริง (ใช้ตอนทดสอบ)
export const stats = { played: 0, last: '' };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); // กันเสียงซ้อนกันแล้วแตก
  master = ctx.createGain();
  master.gain.value = 0.45;
  master.connect(comp);
  comp.connect(ctx.destination);
  return ctx;
}

// เรียกจากเหตุการณ์ของผู้เล่น (pointerdown/keydown) เพื่อปลดล็อกเสียง
export function unlock() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function isEnabled() {
  return enabled;
}

export function setEnabled(on) {
  enabled = on;
  savePrefs({ ...loadPrefs(), sound: on });
}

function tone({ freq, to, type = 'sine', start = 0, dur = 0.2, gain = 0.3, attack = 0.006 }) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// เสียงลมวูบ (noise ผ่านฟิลเตอร์) ไล่ความถี่ขึ้น
function whoosh({ start = 0, dur = 0.5, gain = 0.2, from = 300, to = 3000 }) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const N = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5 };

// เสียงฟักไข่แยกตามระดับ (0 = Common … 4 = Legendary): ยิ่งหายากยิ่งยาว ยิ่งมีชั้นเสียงมากขึ้น
const HATCH = [
  () => tone({ freq: 380, to: 760, dur: 0.14, gain: 0.32 }),
  () => {
    tone({ freq: N.E5, type: 'triangle', dur: 0.16, gain: 0.26 });
    tone({ freq: N.G5, type: 'triangle', start: 0.09, dur: 0.2, gain: 0.26 });
  },
  () => {
    [N.C5, N.E5, N.G5].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.08, dur: 0.22, gain: 0.26 }));
    tone({ freq: 1568, start: 0.2, dur: 0.35, gain: 0.08 });
  },
  () => {
    tone({ freq: 90, to: 45, dur: 0.5, gain: 0.45 });
    whoosh({ dur: 0.45, gain: 0.12 });
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone({ freq: f, type: 'triangle', start: 0.12 + i * 0.08, dur: 0.3, gain: 0.26 }));
    tone({ freq: 2093, start: 0.4, dur: 0.4, gain: 0.07 });
  },
  () => {
    tone({ freq: 80, to: 32, dur: 0.9, gain: 0.55 });
    whoosh({ dur: 0.8, gain: 0.16, from: 200, to: 4500 });
    [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => {
      tone({ freq: f, type: 'triangle', start: 0.2 + i * 0.08, dur: 1.1, gain: 0.2 });
      tone({ freq: f * 2, type: 'sine', start: 0.2 + i * 0.08, dur: 0.9, gain: 0.05 });
    });
    for (let i = 0; i < 8; i++) tone({ freq: 2000 + Math.random() * 1800, start: 0.5 + i * 0.09, dur: 0.12, gain: 0.05 });
  },
];

const SFX = {
  click: () => tone({ freq: 520, to: 800, dur: 0.07, gain: 0.1 }),
  buy: () => {
    tone({ freq: 660, type: 'triangle', dur: 0.1, gain: 0.18 });
    tone({ freq: 990, type: 'triangle', start: 0.07, dur: 0.14, gain: 0.18 });
  },
  // เตือนศัตรูบุก: สองโน้ตแหลมสลับ (ไซเรนสั้น ๆ)
  alarm: () => {
    [0, 0.22, 0.44].forEach((s, i) => tone({ freq: i % 2 ? 520 : 760, type: 'square', start: s, dur: 0.2, gain: 0.14 }));
  },
  victory: () => {
    tone({ freq: 90, to: 50, dur: 0.4, gain: 0.35 });
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone({ freq: f, type: 'triangle', start: 0.05 + i * 0.1, dur: 0.32, gain: 0.24 }));
  },
  defeat: () => {
    [N.G5, N.E5, N.C5].forEach((f, i) => tone({ freq: f * 0.5, type: 'sawtooth', start: i * 0.18, dur: 0.3, gain: 0.14 }));
  },
  claim: () => {
    [N.E5, N.G5, N.C6].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.07, dur: 0.2, gain: 0.2 }));
    tone({ freq: 2093, start: 0.22, dur: 0.25, gain: 0.07 });
  },
  unlock: () => {
    tone({ freq: 110, to: 55, dur: 0.35, gain: 0.35 });
    [N.G5, N.C6, N.E6].forEach((f, i) => tone({ freq: f, type: 'triangle', start: 0.1 + i * 0.09, dur: 0.25, gain: 0.2 }));
  },
};

function run(name, fn) {
  if (!enabled || document.hidden || !ensure() || ctx.state !== 'running') return;
  stats.played += 1;
  stats.last = name;
  fn();
}

export function play(name) {
  if (SFX[name]) run(name, SFX[name]);
}

export function hatch(tier) {
  const fn = HATCH[Math.min(Math.max(tier, 0), HATCH.length - 1)];
  run('hatch' + tier, fn);
}
