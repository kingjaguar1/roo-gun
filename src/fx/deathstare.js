import { CONFIG } from '../config.js';
import { circle, starPath } from '../ui/draw.js';
import { enemyRotation, faceFeatures, facePoint } from '../enemies/render.js';

// Boss Ruben's death stare. While it charges: a frown, an evil toothy grin,
// a red tint and glowing eyes over his photo. Then laser beams from his eyes
// to the Roo Gun. Driven by enemy.stare = { phase: 'charging' | 'firing', t }.
export function drawDeathStare(ctx, e, target, view) {
  const stare = e.stare;
  if (!stare) return;
  const charging = stare.phase === 'charging';
  const power = charging ? Math.min(1, stare.t / CONFIG.boss.chargeTime) : 1;
  const appear = charging ? Math.min(1, stare.t / 0.3) : 1;
  const { eyes, mouth } = faceFeatures(e.sprite);
  const r = e.radius;
  const toLocal = ([fx, fy]) => [(fx - 0.5) * 2 * r, (fy - 0.5) * 2 * r];
  const [left, right] = eyes.map(toLocal).sort((a, b) => a[0] - b[0]);
  const gap = Math.max(12 * view.scale, Math.hypot(right[0] - left[0], right[1] - left[1]));

  drawEvilFace(ctx, e, { left, right, mouth: toLocal(mouth), gap, appear, t: stare.t, charging });
  drawEyeGlow(ctx, e, eyes, gap, power, stare.t);
  if (!charging) drawBeams(ctx, e, eyes, target, gap, stare.t, view);
}

function drawEvilFace(ctx, e, { left, right, mouth, gap, appear, t, charging }) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(enemyRotation(e));

  // Everything goes a little red.
  circle(ctx, 0, 0, e.radius);
  ctx.fillStyle = `rgba(150, 0, 30, ${0.32 * appear * e.alpha})`;
  ctx.fill();

  ctx.globalAlpha = e.alpha * appear;

  // The frown: thick angry eyebrows slanting down toward his nose, dropping into place.
  const drop = (1 - appear) * gap * 0.25;
  ctx.strokeStyle = '#0b0620';
  ctx.lineCap = 'round';
  ctx.lineWidth = gap * 0.17;
  for (const [eye, outward] of [[left, -1], [right, 1]]) {
    ctx.beginPath();
    ctx.moveTo(eye[0] + outward * gap * 0.32, eye[1] - gap * 0.42 - drop);
    ctx.lineTo(eye[0] - outward * gap * 0.22, eye[1] - gap * 0.2 - drop);
    ctx.stroke();
  }

  // The evil grin: a wide toothy crescent over his mouth.
  const [mx, my] = mouth;
  const half = gap * 0.75 * (0.4 + 0.6 * appear);
  const cornerY = my - half * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(mx - half, cornerY);
  ctx.quadraticCurveTo(mx, my + half * 0.95, mx + half, cornerY);
  ctx.quadraticCurveTo(mx, my + half * 0.2, mx - half, cornerY);
  ctx.closePath();
  ctx.fillStyle = '#2a0008';
  ctx.fill();
  ctx.lineWidth = gap * 0.07;
  ctx.stroke();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(mx - half, cornerY);
  ctx.quadraticCurveTo(mx, my + half * 0.2, mx + half, cornerY);
  ctx.lineTo(mx + half, cornerY + half * 0.16);
  ctx.quadraticCurveTo(mx, my + half * 0.52, mx - half, cornerY + half * 0.16);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#2a0008';
  ctx.lineWidth = gap * 0.03;
  for (let i = -3; i <= 3; i++) {
    const x = mx + (i / 4) * half;
    ctx.beginPath();
    ctx.moveTo(x, my - half * 0.4);
    ctx.lineTo(x, my + half * 0.35);
    ctx.stroke();
  }
  ctx.restore();

  // A cartoon "ting" glint on the grin.
  const glintT = Math.min(1, Math.max(0, (t - 0.25) / 0.35));
  const glint = charging ? Math.sin(glintT * Math.PI) : 0;
  if (glint > 0.01) {
    starPath(ctx, mx + half * 0.55, my - half * 0.05, 4, gap * 0.45 * glint, gap * 0.1 * glint, t * 3);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.restore();
}

function drawEyeGlow(ctx, e, eyes, gap, power, t) {
  const flicker = 1 + Math.sin(t * 45) * 0.12;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const eye of eyes) {
    const p = facePoint(e, eye);
    const r = gap * (0.18 + 0.55 * power) * flicker;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.25, 'rgba(255, 60, 60, 0.95)');
    g.addColorStop(1, 'rgba(255, 0, 40, 0)');
    ctx.fillStyle = g;
    circle(ctx, p.x, p.y, r);
    ctx.fill();
  }
  ctx.restore();
}

function drawBeams(ctx, e, eyes, target, gap, t, view) {
  const life = 0.9;
  if (t > life) return;
  const fade = t > 0.6 ? 1 - (t - 0.6) / 0.3 : 1;
  const grow = Math.min(1, t / 0.08);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = fade;
  eyes.forEach((eye, i) => {
    const p = facePoint(e, eye);
    const tx = target.x + (i === 0 ? -8 : 8) * view.scale;
    const dx = (tx - p.x) * grow;
    const dy = (target.y - p.y) * grow;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const points = [];
    for (let k = 0; k <= 10; k++) {
      const f = k / 10;
      const off = k === 0 || k === 10 ? 0 : (Math.random() - 0.5) * gap * 0.25;
      points.push([p.x + dx * f + nx * off, p.y + dy * f + ny * off]);
    }
    const width = gap * 0.42;
    for (const [color, w] of [['rgba(255, 0, 40, 0.5)', width * 2.2], ['#ff2e63', width], ['#ffd23f', width * 0.5], ['#fff', width * 0.22]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      points.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  });
  if (grow >= 1) {
    const flare = gap * 1.6 * (1 + Math.sin(t * 50) * 0.15);
    const g = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, flare);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.3, 'rgba(255, 210, 63, 0.9)');
    g.addColorStop(1, 'rgba(255, 46, 99, 0)');
    ctx.fillStyle = g;
    circle(ctx, target.x, target.y, flare);
    ctx.fill();
  }
  ctx.restore();
}
