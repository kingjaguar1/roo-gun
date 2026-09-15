import { VARIANTS } from './variants.js';
import { Enemy } from './enemy.js';

// Where a new HIM appears: just off the left, bottom or top-left edges,
// as far as practical from the Data Core in the top-right.
export function spawnPoint(view, size, rng, variant = null) {
  if (variant?.boss) return { x: view.w * 0.42, y: -size / 2 };
  const pad = size / 2 + 8;
  const edge = rng();
  if (edge < 0.42) return { x: -pad, y: view.h * (0.2 + rng() * 0.8) };
  if (edge < 0.88) return { x: view.w * rng() * 0.85, y: view.h + pad };
  return { x: view.w * rng() * 0.45, y: -pad };
}

export class Spawner {
  constructor({ hims, rng = Math.random }) {
    this.hims = hims;
    this.rng = rng;
  }

  create(key, { view, speedMul = 1, hpMul = 1 }) {
    const variant = VARIANTS[key];
    if (!variant) throw new Error(`Unknown HIM variant: ${key}`);
    const size = variant.size * view.scale;
    const { x, y } = spawnPoint(view, size, this.rng, variant);
    return new Enemy({
      variant, x, y,
      sprite: this.hims.random(this.rng),
      revealSprite: variant.boss ? this.hims.bossPhoto?.(this.rng) ?? null : null,
      scale: view.scale,
      speedMul,
      hpMul,
      rng: this.rng,
    });
  }
}
