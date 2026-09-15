import { circle, comicText, emoji, roundRect } from './draw.js';

// A chunky comic button with a drop shadow and a squish when pressed.
export class Button {
  constructor(label, { fill = '#ff2e63', textColor = '#fff', size = 32 } = {}) {
    this.label = label;
    this.fill = fill;
    this.textColor = textColor;
    this.size = size;
    this.x = 0;
    this.y = 0;
    this.w = 0;
    this.h = 0;
    this.pressed = 0;
  }

  layout(cx, cy, w, h) {
    this.x = cx - w / 2;
    this.y = cy - h / 2;
    this.w = w;
    this.h = h;
  }

  contains(px, py, pad = 8) {
    return px >= this.x - pad && px <= this.x + this.w + pad && py >= this.y - pad && py <= this.y + this.h + pad;
  }

  press() {
    this.pressed = 1;
  }

  update(dt) {
    this.pressed = Math.max(0, this.pressed - dt * 6);
  }

  draw(ctx, s, time, { pulse = false, appear = 1 } = {}) {
    if (appear <= 0.01) return;
    const k = appear * (pulse ? 1 + Math.sin(time * 5) * 0.045 : 1) * (1 - this.pressed * 0.1);
    const { w, h } = this;
    const r = h * 0.3;
    ctx.save();
    ctx.translate(this.x + w / 2, this.y + h / 2);
    ctx.scale(k, k);
    ctx.rotate(-0.02);
    roundRect(ctx, -w / 2 + 6 * s, -h / 2 + 7 * s, w, h, r);
    ctx.fillStyle = '#0b0620';
    ctx.fill();
    roundRect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fillStyle = this.fill;
    ctx.fill();
    ctx.lineWidth = 4.5 * s;
    ctx.strokeStyle = '#0b0620';
    ctx.stroke();
    roundRect(ctx, -w / 2 + 10 * s, -h / 2 + 7 * s, w - 20 * s, h * 0.26, h * 0.13);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fill();
    comicText(ctx, this.label, 0, 2 * s, this.size * s, {
      fill: this.textColor, strokeWidth: this.size * s * 0.16, maxWidth: w * 0.85,
    });
    ctx.restore();
  }
}

// Small round speaker toggle in the bottom-left corner.
export class MuteButton {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.r = 0;
  }

  layout(view) {
    this.r = 20 * view.scale;
    this.x = view.safe.left + 14 * view.scale + this.r;
    this.y = view.h - view.safe.bottom - 14 * view.scale - this.r;
  }

  contains(px, py) {
    return Math.hypot(px - this.x, py - this.y) <= this.r + 10;
  }

  draw(ctx, view, muted) {
    this.layout(view);
    circle(ctx, this.x, this.y, this.r);
    ctx.fillStyle = 'rgba(11, 6, 32, 0.6)';
    ctx.fill();
    ctx.lineWidth = 2.5 * view.scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.stroke();
    emoji(ctx, muted ? '🔇' : '🔊', this.x, this.y + 1, this.r * 1.05);
  }
}
