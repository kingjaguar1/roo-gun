import { Health } from './health.js';
import { BEHAVIOURS } from './behaviours.js';

let nextId = 1;

// One version of HIM on screen. Pure state; drawing lives in render.js.
export class Enemy {
  constructor({ variant, x, y, sprite = null, revealSprite = null, scale = 1, speedMul = 1, hpMul = 1, rng = Math.random }) {
    this.id = nextId++;
    this.variant = variant;
    this.sprite = sprite;
    this.revealSprite = revealSprite; // Boss Ruben's real photo, swapped in mid-entrance
    this.revealed = false;
    this.scale = scale;
    this.rng = rng;
    this.x = x;
    this.y = y;
    this.size = variant.size * scale;
    this.radius = this.size / 2;
    this.speed = variant.speed * scale * speedMul;
    this.health = new Health(Math.max(1, Math.round(variant.hp * hpMul)));
    this.behaviour = BEHAVIOURS[variant.behaviour] ?? BEHAVIOURS.drift;
    this.state = {};
    this.age = 0;
    this.phase = rng() * Math.PI * 2;
    this.dirX = 0;
    this.dirY = 0;
    this.alpha = 1;
    this.hittable = true;
    this.hitFlash = 0;
    this.squash = 0;
    this.dead = false;
    this.escaping = false;
  }

  init(world) {
    this.behaviour.init?.(this, world);
  }

  update(dt, world) {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.squash = Math.max(0, this.squash - dt * 5);
    if (this.escaping) {
      this.escapeAge += dt;
      this.x += this.escapeVX * dt;
      this.y += this.escapeVY * dt;
      return;
    }
    this.behaviour.update(this, dt, world);
  }

  // Returns true if this hit killed him.
  hit(damage = 1) {
    this.hitFlash = 1;
    this.squash = 1;
    return this.health.damage(damage);
  }

  // He got the data and is making a run for it.
  escape() {
    this.escaping = true;
    this.escapeAge = 0;
    this.hittable = false;
    this.alpha = 1;
    const speed = Math.max(this.speed * 4, 520 * this.scale);
    const len = Math.hypot(this.dirX, this.dirY - 0.6) || 1;
    this.escapeVX = (this.dirX / len) * speed;
    this.escapeVY = ((this.dirY - 0.6) / len) * speed;
  }

  isOffscreen(view) {
    const m = this.size;
    return this.x < -m || this.x > view.w + m || this.y < -m || this.y > view.h + m;
  }
}
