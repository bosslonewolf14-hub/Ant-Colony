const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

// formatDuration(8130) -> "2 ชม. 15 นาที"
export function formatDuration(totalSec) {
  const sec = Math.floor(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (h) parts.push(`${h} ชม.`);
  if (m) parts.push(`${m} นาที`);
  if (!h && s) parts.push(`${s} วินาที`);
  return parts.join(' ') || '0 วินาที';
}

// formatNum(1234) -> "1.23K", formatNum(12.34, 1) -> "12.3"
export function formatNum(n, decimals = 0) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 1000) return n.toFixed(decimals);
  const tier = Math.min(Math.floor(Math.log10(n) / 3), SUFFIXES.length - 1);
  const v = n / 1000 ** tier;
  return v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + SUFFIXES[tier];
}
