import { comicText, font } from '../ui/draw.js';
import { easeOutBack } from '../math.js';

// Floating comic text: "+250", "COMBO x5", "DATA STOLEN -10%".
export class Popups {
  constructor() {
    this.list = [];
  }

  add(text, x, y, opts = {}) {
    this.list.push({
      text, x, y, age: 0, life: 0.9, size: 24, fill: '#fff', stroke: '#0b0620',
      vy: -70, rotation: (Math.random() - 0.5) * 0.25, delay: 0, ...opts,
    });
  }

  update(dt) {
    for (const p of this.list) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      p.y += p.vy * dt;
      p.vy *= Math.exp(-2.5 * dt);
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  clear() {
    this.list = [];
  }

  draw(ctx, view) {
    for (const p of this.list) {
      if (p.delay > 0) continue;
      const t = p.age / p.life;
      const pop = p.age < 0.16 ? Math.max(0.01, easeOutBack(p.age / 0.16)) : 1;
      const size = p.size * pop;
      ctx.font = font(size);
      const half = Math.min(ctx.measureText(p.text).width, view.w - 16) / 2;
      const x = Math.max(half + 8, Math.min(view.w - half - 8, p.x));
      ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      comicText(ctx, p.text, x, p.y, size, {
        fill: p.fill, stroke: p.stroke, rotation: p.rotation, maxWidth: view.w - 16,
      });
    }
    ctx.globalAlpha = 1;
  }
}
