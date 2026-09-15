import { CONFIG } from './config.js';

// Score and combos. Kills in quick succession build the combo; the
// multiplier is the combo count, capped.
export class Scoring {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.kills = 0;
    this.bestCombo = 0;
  }

  get multiplier() {
    return Math.max(1, Math.min(CONFIG.combo.maxMultiplier, this.combo));
  }

  get comboFraction() {
    return this.combo > 0 ? Math.max(0, this.comboTimer / CONFIG.combo.window) : 0;
  }

  // Any landed hit keeps a combo alive, so chipping at a Big HIM counts.
  registerHit() {
    if (this.combo > 0) this.comboTimer = CONFIG.combo.window;
  }

  registerKill(baseScore) {
    this.combo++;
    this.comboTimer = CONFIG.combo.window;
    this.kills++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const multiplier = this.multiplier;
    const points = baseScore * multiplier;
    this.score += points;
    return { points, combo: this.combo, multiplier };
  }

  add(points) {
    this.score += points;
  }

  // Returns the size of the combo that was lost.
  breakCombo() {
    const lost = this.combo;
    this.combo = 0;
    this.comboTimer = 0;
    return lost;
  }

  // Returns the size of a combo that just expired, else 0.
  update(dt) {
    if (this.combo === 0) return 0;
    this.comboTimer -= dt;
    return this.comboTimer <= 0 ? this.breakCombo() : 0;
  }
}
