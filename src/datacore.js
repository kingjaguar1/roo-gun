import { CONFIG } from './config.js';

// The thing HE wants. Holds the DATA percentage and how alarmed it is.
export class DataCore {
  constructor() {
    this.data = CONFIG.data.start;
    this.x = 0;
    this.y = 0;
    this.radius = CONFIG.core.radius;
    this.alarm = 0;   // 0 calm .. 1 panicking (someone is very close)
    this.damage = 0;  // 1 right after data is stolen, decays to 0
    this.time = 0;
  }

  layout(view) {
    const s = view.scale;
    this.radius = CONFIG.core.radius * s;
    const halfWidth = Math.max(this.radius * 1.4, 52 * s);
    this.x = view.w - view.safe.right - CONFIG.core.margin * s - halfWidth;
    this.y = view.safe.top + CONFIG.core.margin * s + this.radius * 1.4;
  }

  get empty() { return this.data <= 0; }

  isReachedBy(enemy) {
    const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
    return d < this.radius + enemy.radius * CONFIG.core.reachFraction;
  }

  // Returns how much was actually stolen.
  steal(amount) {
    const before = this.data;
    this.data = Math.max(0, this.data - amount);
    this.damage = 1;
    return before - this.data;
  }

  update(dt, enemies, scale = 1) {
    this.time += dt;
    this.damage = Math.max(0, this.damage - dt * 1.8);
    const range = CONFIG.core.alarmDistance * scale;
    let target = 0;
    for (const e of enemies) {
      if (e.dead || e.escaping) continue;
      const gap = Math.hypot(e.x - this.x, e.y - this.y) - e.radius - this.radius;
      target = Math.max(target, 1 - Math.max(0, gap) / range);
    }
    this.alarm += (target - this.alarm) * Math.min(1, dt * 4);
  }
}
