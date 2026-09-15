import { circle } from './draw.js';

// A loud comic-book backdrop: magenta glow behind the Data Core, purple
// everywhere else, halftone dots, and slow sunburst rays.
const OVERSCAN = 40; // extra margin so screen shake never shows an edge
let cache = null;

export function drawBackground(ctx, view, time, core) {
  const key = `${view.w}x${view.h}@${view.dpr}:${Math.round(core.x)},${Math.round(core.y)}`;
  if (!cache || cache.key !== key) cache = { key, canvas: render(view, core) };
  ctx.drawImage(cache.canvas, -OVERSCAN, -OVERSCAN, view.w + OVERSCAN * 2, view.h + OVERSCAN * 2);

  // Sunburst rays radiating from the Data Core.
  const rays = 14;
  const len = Math.hypot(view.w, view.h) * 1.2;
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.rotate(time * 0.05);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const spread = Math.PI / rays / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - spread) * len, Math.sin(a - spread) * len);
    ctx.lineTo(Math.cos(a + spread) * len, Math.sin(a + spread) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function render(view, core) {
  const w = view.w + OVERSCAN * 2;
  const h = view.h + OVERSCAN * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * view.dpr);
  canvas.height = Math.round(h * view.dpr);
  const g = canvas.getContext('2d');
  g.scale(view.dpr, view.dpr);

  const cx = (core?.x ?? view.w * 0.8) + OVERSCAN;
  const cy = (core?.y ?? view.h * 0.1) + OVERSCAN;
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h));
  glow.addColorStop(0, '#ff3d9a');
  glow.addColorStop(0.22, '#8f2bd1');
  glow.addColorStop(0.6, '#3a1685');
  glow.addColorStop(1, '#150838');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  // Halftone dots that get bigger away from the core.
  const step = 18 * view.scale;
  const maxDist = Math.hypot(w, h);
  g.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let y = 0; y < h + step; y += step) {
    for (let x = (Math.round(y / step) % 2) * step * 0.5; x < w + step; x += step) {
      const d = Math.hypot(x - cx, y - cy) / maxDist;
      circle(g, x, y, step * 0.08 + d * step * 0.28);
      g.fill();
    }
  }
  return canvas;
}
