import { circle, comicText, roundRect, starPath } from './ui/draw.js';

// The Roo Gun: a chunky cartoon blaster at the bottom of the screen that
// swings toward every tap and fires a crackling energy bolt.
export class RooGun {
  constructor() {
    this.bolts = [];
    this.recoil = 0;
    this.muzzle = 0;
    this.angle = -Math.PI / 2;
    this.destroyed = false; // blown up by Ruben's death stare
  }

  origin(view) {
    return { x: view.w / 2, y: view.h - view.safe.bottom - 34 * view.scale };
  }

  fire(x, y, view, hit) {
    const o = this.origin(view);
    let angle = Math.atan2(y - o.y, x - o.x);
    if (angle > 0) angle = angle < Math.PI / 2 ? -0.08 : -Math.PI + 0.08; // never point down
    this.angle = angle;
    this.recoil = 1;
    this.muzzle = 1;
    const len = 80 * view.scale;
    this.bolts.push({
      x0: o.x + Math.cos(angle) * len,
      y0: o.y + Math.sin(angle) * len,
      x1: x, y1: y, age: 0, life: hit ? 0.18 : 0.13, hit,
    });
  }

  update(dt) {
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.muzzle = Math.max(0, this.muzzle - dt * 10);
    for (const b of this.bolts) b.age += dt;
    this.bolts = this.bolts.filter((b) => b.age < b.life);
  }

  drawBolts(ctx, view) {
    const s = view.scale;
    for (const b of this.bolts) {
      const t = b.age / b.life;
      const dx = b.x1 - b.x0;
      const dy = b.y1 - b.y0;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      const segments = 9;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const k = i / segments;
        const off = (Math.random() - 0.5) * 22 * s * Math.sin(Math.PI * k);
        const x = b.x0 + dx * k + px * off;
        const y = b.y0 + dy * k + py * off;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = b.hit ? '#ffd23f' : '#3fd0ff';
      ctx.lineWidth = 11 * s;
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4 * s;
      ctx.stroke();

      // Impact ring where the tap landed.
      circle(ctx, b.x1, b.y1, (10 + 36 * t) * s);
      ctx.lineWidth = (8 * (1 - t) + 1) * s;
      ctx.strokeStyle = b.hit ? '#fff' : 'rgba(255,255,255,0.6)';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawGun(ctx, view) {
    if (this.destroyed) return;
    const s = view.scale;
    const o = this.origin(view);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(this.angle + Math.PI / 2);
    ctx.translate(0, this.recoil * 12 * s);
    ctx.lineWidth = 3.5 * s;
    ctx.strokeStyle = '#0b0620';
    ctx.lineJoin = 'round';

    // Kangaroo ears, obviously.
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 22 * s, -20 * s, 7 * s, 17 * s, side * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#c8793a';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(side * 22 * s, -19 * s, 3 * s, 10 * s, side * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#f4b6c2';
      ctx.fill();
    }

    roundRect(ctx, -10 * s, -68 * s, 20 * s, 56 * s, 6 * s);
    ctx.fillStyle = '#ff8c1a';
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, -16 * s, -80 * s, 32 * s, 14 * s, 5 * s);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, -30 * s, -16 * s, 60 * s, 38 * s, 13 * s);
    ctx.fillStyle = '#7b2ff7';
    ctx.fill();
    ctx.stroke();
    comicText(ctx, 'ROO', 0, 3 * s, 17 * s, { shadow: false, strokeWidth: 4 * s });

    if (this.muzzle > 0) {
      const m = this.muzzle;
      starPath(ctx, 0, -84 * s, 8, 34 * s * m, 13 * s * m, m * 2);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      starPath(ctx, 0, -84 * s, 8, 18 * s * m, 7 * s * m, m * 2 + 0.3);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.restore();
  }
}
