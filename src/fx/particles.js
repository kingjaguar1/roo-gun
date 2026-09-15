import { CONFIG } from '../config.js';
import { circle, font } from '../ui/draw.js';

// Shapes: circle, square, spark (streak along velocity), text, ring,
// chunk (a spinning piece of a sprite, e.g. his face).
export class Particles {
  constructor(max = CONFIG.fx.maxParticles) {
    this.max = max;
    this.list = [];
  }

  emit(p) {
    if (this.list.length >= this.max) this.list.splice(0, this.list.length - this.max + 1);
    this.list.push({
      x: 0, y: 0, vx: 0, vy: 0, size: 4, grow: 0, color: '#fff', life: 0.6, age: 0,
      gravity: 0, drag: 0, rotation: 0, spin: 0, shape: 'circle',
      fade: true, shrink: true, additive: false, ...p,
    });
  }

  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
      p.size = Math.max(0, p.size + p.grow * dt);
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  clear() {
    this.list = [];
  }

  draw(ctx) {
    for (const p of this.list) {
      const t = p.age / p.life;
      const size = p.shrink ? p.size * (1 - t) : p.size;
      if (size <= 0.2) continue;
      ctx.globalAlpha = p.fade ? 1 - t * t : 1;
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';

      switch (p.shape) {
        case 'spark': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
          ctx.stroke();
          break;
        }
        case 'square': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
          break;
        }
        case 'ring': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, (p.lineWidth ?? 3) * (1 - t));
          circle(ctx, p.x, p.y, size);
          ctx.stroke();
          break;
        }
        case 'text': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.font = font(size);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, 0, 0);
          ctx.restore();
          break;
        }
        case 'chunk': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = '#0b0620';
          ctx.fillRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4);
          ctx.drawImage(p.image, p.sx, p.sy, p.sw, p.sh, -size / 2, -size / 2, size, size);
          ctx.restore();
          break;
        }
        default: {
          ctx.fillStyle = p.color;
          circle(ctx, p.x, p.y, size);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
