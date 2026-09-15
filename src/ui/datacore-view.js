import { circle, comicText, polygonPath, roundRect } from './draw.js';
import { lerp } from '../math.js';

// The glowing, increasingly nervous Data Core in the top-right.
export function drawCoreBody(ctx, core, view) {
  const s = view.scale;
  const r = core.radius;
  const t = core.time;
  const alarm = core.alarm;
  const danger = Math.max(alarm, core.damage);
  const hue = lerp(188, 0, Math.min(1, danger * 1.2));
  const jitter = (alarm * alarm * 3 + core.damage * 9) * s;
  const pulse = 1 + Math.sin(t * (3 + alarm * 14)) * (0.035 + alarm * 0.06) + core.damage * 0.15;

  ctx.save();
  ctx.translate(core.x + (Math.random() * 2 - 1) * jitter, core.y + (Math.random() * 2 - 1) * jitter);

  const glowR = r * (2.2 + alarm * 0.7 + core.damage) * pulse;
  const glow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, glowR);
  glow.addColorStop(0, `hsla(${hue}, 100%, 62%, 0.75)`);
  glow.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
  ctx.fillStyle = glow;
  circle(ctx, 0, 0, glowR);
  ctx.fill();

  // Spinning dashed orbit ring. Spins faster when he's close.
  ctx.save();
  ctx.rotate(t * (0.9 + alarm * 6));
  ctx.setLineDash([9 * s, 6 * s]);
  ctx.lineWidth = 3.5 * s;
  ctx.strokeStyle = `hsla(${hue}, 100%, 75%, 0.95)`;
  circle(ctx, 0, 0, r * 1.32 * pulse);
  ctx.stroke();
  ctx.restore();

  // Hexagonal vault.
  polygonPath(ctx, 0, 0, 6, r * pulse, Math.PI / 6);
  const body = ctx.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, `hsl(${hue}, 80%, 38%)`);
  body.addColorStop(1, `hsl(${hue}, 90%, 14%)`);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 5 * s;
  ctx.strokeStyle = '#0b0620';
  ctx.stroke();
  polygonPath(ctx, 0, 0, 6, r * 0.8 * pulse, Math.PI / 6);
  ctx.lineWidth = 2.5 * s;
  ctx.strokeStyle = `hsla(${hue}, 100%, 75%, 0.9)`;
  ctx.stroke();

  drawDatabaseIcon(ctx, r * 0.42, hue);

  if (alarm > 0.55 || core.damage > 0.2) {
    const blink = Math.sin(t * 22) > 0;
    if (blink) comicText(ctx, '!', r * 0.95, -r * 0.95, r * 0.9, { fill: '#ffd23f', rotation: 0.2 });
  }
  ctx.restore();
}

function drawDatabaseIcon(ctx, size, hue) {
  const w = size;
  const h = size * 0.32;
  ctx.lineWidth = size * 0.12;
  ctx.strokeStyle = '#0b0620';
  for (let i = 2; i >= 0; i--) {
    const y = (i - 1) * size * 0.55;
    ctx.beginPath();
    ctx.ellipse(0, y + h * 0.4, w, h, 0, 0, Math.PI);
    ctx.lineTo(-w, y - h * 0.4);
    ctx.ellipse(0, y - h * 0.4, w, h, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fillStyle = `hsl(${hue}, 100%, ${88 - i * 6}%)`;
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.55 - h * 0.4, w, h, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.stroke();
}

// "DATA CORE" label, a 10-block bar and the big percentage.
export function drawCoreGauge(ctx, core, view) {
  const s = view.scale;
  const t = core.time;
  const data = Math.ceil(core.data);
  const top = core.y + core.radius * 1.45;
  const hurt = core.damage;
  const shakeX = hurt * (Math.random() * 2 - 1) * 6 * s;

  comicText(ctx, 'DATA CORE', core.x + shakeX, top + 7 * s, 14 * s, { fill: '#fff', strokeWidth: 4 * s });

  const blocks = 10;
  const bw = 8 * s;
  const gap = 2 * s;
  const total = blocks * bw + (blocks - 1) * gap;
  const bx = core.x - total / 2 + shakeX;
  const by = top + 17 * s;
  const bh = 13 * s;
  roundRect(ctx, bx - 4 * s, by - 4 * s, total + 8 * s, bh + 8 * s, 5 * s);
  ctx.fillStyle = '#0b0620';
  ctx.fill();

  const filled = Math.ceil(data / 10);
  const low = data <= 30;
  const color = data > 60 ? '#39ff88' : data > 30 ? '#ffd23f' : '#ff2e63';
  for (let i = 0; i < blocks; i++) {
    ctx.fillStyle = i < filled
      ? (low && Math.sin(t * 12) > 0 ? '#fff' : color)
      : 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(bx + i * (bw + gap), by, bw, bh);
  }

  const size = (24 + hurt * 10) * s;
  comicText(ctx, `${data}%`, core.x + shakeX, by + bh + 19 * s, size, {
    fill: hurt > 0.3 ? '#ff2e63' : color,
    strokeWidth: 5 * s,
  });

  if (core.alarm > 0.7 && data > 0 && Math.sin(t * 16) > -0.3) {
    comicText(ctx, "HE'S CLOSE!", core.x, by + bh + 44 * s, 15 * s, {
      fill: '#ffd23f', strokeWidth: 4 * s, rotation: Math.sin(t * 30) * 0.06,
    });
  }
}
