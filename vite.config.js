import { defineConfig } from 'vite';

// base: './' ทำให้ไฟล์ใน dist/ เปิดได้จากโฟลเดอร์ย่อยของเว็บเซิร์ฟเวอร์ใดก็ได้ (XAMPP, GitHub Pages, Netlify, ฯลฯ)
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800, // three.js อย่างเดียวก็ ~500 kB (gzip ~140 kB) ยอมรับได้สำหรับเกมนี้
  },
});
