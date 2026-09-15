import { CONFIG } from '../config.js';

// Trauma-based screen shake: add trauma on impacts, shake strength is trauma².
export class Shake {
  constructor() {
    this.trauma = 0;
    this.time = 0;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
  }

  add(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt, scale = 1) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * CONFIG.fx.shakeDecay);
    const power = this.trauma * this.trauma;
    const max = CONFIG.fx.shakeMax * scale * power;
    const t = this.time;
    this.x = max * (Math.sin(t * 71) * 0.6 + Math.sin(t * 43 + 1.7) * 0.4);
    this.y = max * (Math.sin(t * 67 + 0.5) * 0.6 + Math.sin(t * 37 + 2.9) * 0.4);
    this.angle = 0.035 * power * Math.sin(t * 29 + 4.1);
  }

  apply(ctx, view) {
    if (this.trauma <= 0) return;
    ctx.translate(view.w / 2 + this.x, view.h / 2 + this.y);
    ctx.rotate(this.angle);
    ctx.translate(-view.w / 2, -view.h / 2);
  }

  reset() {
    this.trauma = 0;
    this.x = this.y = this.angle = 0;
  }
}
