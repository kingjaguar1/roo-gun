import { variantLabel } from './variants.js';
import { circle, comicText, emoji, font, roundRect } from '../ui/draw.js';

const DEFAULT_EYES = [[0.38, 0.42], [0.62, 0.42]];
const DEFAULT_MOUTH = [0.5, 0.68];

// The tilt drawEnemy applies, so overlays can stay on his face.
export function enemyRotation(e) {
  const wobble = Math.sin(e.age * 3 + e.phase) * 0.14;
  const spin = e.escaping ? e.escapeAge * 9 : 0;
  return wobble + spin;
}

// Eye and mouth positions as fractions of a sprite; photos can set them in the manifest.
export function faceFeatures(sprite) {
  return { eyes: sprite?.eyes ?? DEFAULT_EYES, mouth: sprite?.mouth ?? DEFAULT_MOUTH };
}

// World position of a point given as a fraction of the enemy's sprite.
export function facePoint(e, [fx, fy]) {
  const a = enemyRotation(e);
  const lx = (fx - 0.5) * 2 * e.radius;
  const ly = (fy - 0.5) * 2 * e.radius;
  return { x: e.x + lx * Math.cos(a) - ly * Math.sin(a), y: e.y + lx * Math.sin(a) + ly * Math.cos(a) };
}

export function drawEnemy(ctx, e, name) {
  if (e.alpha <= 0.01) return;
  const v = e.variant;
  const r = e.radius;
  const s = e.scale;

  ctx.save();
  ctx.globalAlpha = e.alpha;
  if (v.trail && !e.escaping) drawSpeedTrail(ctx, e);

  ctx.translate(e.x, e.y);
  ctx.rotate(enemyRotation(e));
  // Tougher versions wobble and flash less, so rapid hits don't smear them.
  const toughness = Math.sqrt(e.variant.explosion);
  const squash = e.squash / toughness;
  ctx.scale(1 + squash * 0.28, 1 - squash * 0.22);

  if (v.boss) {
    const pulse = 1.55 + Math.sin(e.age * 5) * 0.08;
    const aura = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * pulse);
    aura.addColorStop(0, 'rgba(255, 46, 99, 0.7)');
    aura.addColorStop(1, 'rgba(255, 46, 99, 0)');
    ctx.fillStyle = aura;
    circle(ctx, 0, 0, r * pulse);
    ctx.fill();
  }

  circle(ctx, 0, 0, r + 5 * s);
  ctx.fillStyle = '#0b0620';
  ctx.fill();
  circle(ctx, 0, 0, r + 2 * s);
  ctx.fillStyle = v.ring;
  ctx.fill();
  if (e.sprite) ctx.drawImage(e.sprite, -r, -r, r * 2, r * 2);

  if (e.hitFlash > 0) {
    ctx.globalAlpha = e.alpha * e.hitFlash * (0.75 / toughness);
    circle(ctx, 0, 0, r);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = e.alpha;
  if (e.escaping) {
    emoji(ctx, '💾', e.x + r * 0.8, e.y + r * 0.2, Math.max(22 * s, r * 0.7), Math.sin(e.age * 20) * 0.3);
  } else {
    if (v.boss) emoji(ctx, '👑', e.x, e.y - r - 34 * s, r * 0.5, Math.sin(e.age * 3) * 0.15);
    if (e.health.max > 1) drawHealthBar(ctx, e);
    if (v.prefix) drawNameTag(ctx, e, variantLabel(v, name));
  }
  ctx.restore();
}

function drawSpeedTrail(ctx, e) {
  const r = e.radius;
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = e.alpha * (0.22 / i);
    circle(ctx, e.x - e.dirX * r * 0.55 * i, e.y - e.dirY * r * 0.55 * i, r * (1 - i * 0.08));
    ctx.fillStyle = e.variant.ring;
    ctx.fill();
  }
  ctx.globalAlpha = e.alpha * 0.8;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3 * e.scale;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const ox = -e.dirY * i * r * 0.6;
    const oy = e.dirX * i * r * 0.6;
    const start = r * 1.1 + ((e.age * 400 + i * 30) % 30) * e.scale;
    ctx.beginPath();
    ctx.moveTo(e.x + ox - e.dirX * start, e.y + oy - e.dirY * start);
    ctx.lineTo(e.x + ox - e.dirX * (start + r * 0.9), e.y + oy - e.dirY * (start + r * 0.9));
    ctx.stroke();
  }
  ctx.globalAlpha = e.alpha;
}

function drawHealthBar(ctx, e) {
  const s = e.scale;
  const w = Math.max(44 * s, e.radius * 1.4);
  const h = (e.variant.boss ? 10 : 7) * s;
  const x = e.x - w / 2;
  const y = e.y - e.radius - 16 * s;
  roundRect(ctx, x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s, h);
  ctx.fillStyle = '#0b0620';
  ctx.fill();
  const f = e.health.fraction;
  roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2);
  ctx.fillStyle = f > 0.5 ? '#39ff88' : f > 0.25 ? '#ffd23f' : '#ff2e63';
  ctx.fill();
}

function drawNameTag(ctx, e, label) {
  const s = e.scale;
  const size = (e.variant.boss ? 18 : 12) * s;
  ctx.font = font(size);
  const w = ctx.measureText(label).width + 14 * s;
  const h = size + 6 * s;
  const x = e.x - w / 2;
  const y = e.y + e.radius + 6 * s;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = e.variant.ring;
  ctx.fill();
  ctx.lineWidth = 2.5 * s;
  ctx.strokeStyle = '#0b0620';
  ctx.stroke();
  comicText(ctx, label, e.x, y + h / 2 + 1 * s, size, { shadow: false, strokeWidth: 0.001, fill: '#0b0620' });
}
