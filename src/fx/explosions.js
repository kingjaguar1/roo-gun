import { comicText, starPath } from '../ui/draw.js';
import { easeOutBack, easeOutCubic } from '../math.js';

const WORDS = {
  small: ['POW!', 'BAM!', 'ZAP!', 'BOOM!', 'WHAM!', 'BONK!', 'YEET!', 'DENIED!'],
  big: ['KA-BOOM!', 'KABLAM!', 'KRAKA-THOOM!', 'SPLATOOM!'],
  mega: ['KA-BLOOOOM!!', 'OBLITERATED!', 'MEGA BOOM!!', 'NOT TODAY!!'],
};
const FIRE = ['#fff7ae', '#ffd23f', '#ff8c1a', '#ff2e63'];
const LAYERS = [
  { color: '#0b0620', k: 1.12 },
  { color: '#ff2e63', k: 1 },
  { color: '#ff8c1a', k: 0.78 },
  { color: '#ffd23f', k: 0.56 },
];

function pickWord(power, rng) {
  const list = power >= 4 ? WORDS.mega : power >= 2 ? WORDS.big : WORDS.small;
  return list[Math.floor(rng() * list.length)];
}

// Comic-book explosions. power: 1 normal, ~1.4 sneaky, 2 big, 4 boss.
export class Explosions {
  constructor(particles) {
    this.particles = particles;
    this.bursts = [];
    this.rings = [];
  }

  spawn(x, y, power, { scale = 1, sprite = null, rng = Math.random, word = true } = {}) {
    const root = Math.sqrt(power);
    const size = 46 * scale * Math.pow(power, 0.75);
    const points = 9 + Math.round(power * 2);
    this.bursts.push({
      x, y, size, age: 0, life: 0.42 + 0.14 * power,
      rotation: rng() * Math.PI, points,
      jitter: Array.from({ length: points * 2 }, () => 0.72 + rng() * 0.56),
      word: word ? pickWord(power, rng) : null,
      wordRotation: (rng() - 0.5) * 0.5,
    });
    this.rings.push({ x, y, age: 0, life: 0.32 + 0.1 * power, radius: size * 2.6, width: 12 * scale * root });

    const p = this.particles;
    const fire = Math.min(70, Math.round(14 * power));
    for (let i = 0; i < fire; i++) {
      const a = rng() * Math.PI * 2;
      const speed = (110 + rng() * 380) * scale * root;
      p.emit({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        size: (6 + rng() * 10) * scale * root, color: FIRE[Math.floor(rng() * FIRE.length)],
        life: 0.35 + rng() * 0.45, drag: 3.5,
      });
    }
    const sparks = Math.min(40, Math.round(10 * power));
    for (let i = 0; i < sparks; i++) {
      const a = rng() * Math.PI * 2;
      const speed = (300 + rng() * 650) * scale;
      p.emit({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, shape: 'spark',
        size: 3.5 * scale, color: rng() < 0.5 ? '#fff' : '#ffd23f',
        life: 0.25 + rng() * 0.3, drag: 2.5, additive: true, shrink: false,
      });
    }
    const smoke = Math.min(20, Math.round(5 * power));
    for (let i = 0; i < smoke; i++) {
      const a = rng() * Math.PI * 2;
      const speed = (30 + rng() * 110) * scale * root;
      p.emit({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40 * scale,
        size: (12 + rng() * 14) * scale * root, grow: 36 * scale, color: 'rgba(35, 16, 60, 0.5)',
        life: 0.7 + rng() * 0.5, drag: 2, shrink: false,
      });
    }
    // His face, shattered into spinning pieces.
    if (sprite) {
      const pieces = power >= 4 ? 18 : power >= 2 ? 10 : 6;
      const cell = sprite.width / 3;
      for (let i = 0; i < pieces; i++) {
        const a = rng() * Math.PI * 2;
        const speed = (220 + rng() * 420) * scale * Math.min(2, root);
        p.emit({
          x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 200 * scale,
          shape: 'chunk', image: sprite,
          sx: Math.floor(rng() * 3) * cell, sy: Math.floor(rng() * 3) * cell, sw: cell, sh: cell,
          size: (14 + rng() * 12) * scale * Math.min(2, root), gravity: 1100 * scale,
          spin: (rng() - 0.5) * 22, life: 0.8 + rng() * 0.5, shrink: false,
        });
      }
    }
    // Rescued data bits.
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2;
      const speed = (90 + rng() * 220) * scale;
      p.emit({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, shape: 'text',
        text: rng() < 0.5 ? '0' : '1', color: '#39ff88', size: 16 * scale,
        life: 0.6 + rng() * 0.3, drag: 1.5, shrink: false,
      });
    }
  }

  update(dt) {
    for (const b of this.bursts) b.age += dt;
    for (const r of this.rings) r.age += dt;
    this.bursts = this.bursts.filter((b) => b.age < b.life);
    this.rings = this.rings.filter((r) => r.age < r.life);
  }

  clear() {
    this.bursts = [];
    this.rings = [];
  }

  draw(ctx) {
    for (const r of this.rings) {
      const t = r.age / r.life;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, r.width * (1 - t));
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * easeOutCubic(t), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const b of this.bursts) {
      const t = b.age / b.life;
      const grow = easeOutBack(Math.min(1, b.age / 0.14));
      ctx.globalAlpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      const spin = b.rotation + t * 0.3;
      for (const layer of LAYERS) {
        const outer = b.size * layer.k * grow;
        starPath(ctx, b.x, b.y, b.points, outer, outer * 0.55, spin, b.jitter);
        ctx.fillStyle = layer.color;
        ctx.fill();
      }
      if (t < 0.25) {
        starPath(ctx, b.x, b.y, b.points, b.size * 0.34 * grow, b.size * 0.18 * grow, spin, b.jitter);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
      if (b.word) {
        comicText(ctx, b.word, b.x, b.y, b.size * 0.62 * grow, {
          fill: '#fff', rotation: b.wordRotation, maxWidth: b.size * 3.2,
        });
      }
    }
    ctx.globalAlpha = 1;
  }
}
