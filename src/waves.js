import { CONFIG } from './config.js';
import { bossPersona } from './enemies/variants.js';

// Wave N's line-up is a pure function of N (plus randomness), so the
// difficulty curve is easy to test and tune from config.js.

export function isBossWave(n) {
  const { bossFirstWave, bossEvery } = CONFIG.waves;
  return n >= bossFirstWave && (n - bossFirstWave) % bossEvery === 0;
}

// Which variant makes its debut on wave n, if any.
export function introducedVariant(n) {
  if (n === CONFIG.waves.bossFirstWave) return 'boss';
  const entry = Object.entries(CONFIG.waves.unlocks).find(([, wave]) => wave === n);
  return entry ? entry[0] : null;
}

// Extra speed for the opening waves, tapering to nothing by the wave after
// them, so wave 3 runs straight into wave 4 with no dip.
export function earlyBoost(n) {
  const b = CONFIG.waves.earlyBoost;
  if (!b || n > b.waves) return 0;
  return b.speed * (1 - (n - 1) / b.waves);
}

// 1 on a normal wave; below 1 for the waves just after a boss, easing back
// up to full by the end of the breather.
export function reliefFactor(n) {
  const W = CONFIG.waves;
  if (!W.relief || n <= W.bossFirstWave) return 1;
  const since = (n - W.bossFirstWave) % W.bossEvery;
  if (since === 0 || since > W.relief.waves) return 1;
  return W.relief.from + (1 - W.relief.from) * ((since - 1) / W.relief.waves);
}

export function variantWeights(n) {
  const u = CONFIG.waves.unlocks;
  return {
    normal: Math.max(0.35, 1 - (n - 1) * 0.05),
    fast: n >= u.fast ? Math.min(0.6, 0.25 + (n - u.fast) * 0.07) : 0,
    big: n >= u.big ? Math.min(0.35, 0.14 + (n - u.big) * 0.04) : 0,
    sneaky: n >= u.sneaky ? Math.min(0.4, 0.18 + (n - u.sneaky) * 0.05) : 0,
  };
}

function pickWeighted(weights, rng) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function buildWave(n, rng = Math.random, { lastPersona = null } = {}) {
  const W = CONFIG.waves;
  const boss = isBossWave(n);
  const intro = introducedVariant(n);
  const relief = reliefFactor(n);
  let count = Math.min(W.maxCount, Math.round(W.baseCount + (n - 1) * W.countPerWave));
  if (boss) count = Math.round(count * 0.6);
  if (relief < 1) count = Math.max(3, Math.round(count * relief));

  const weights = variantWeights(n);
  const rest = [];
  const introCount = intro && intro !== 'boss' ? 2 : 0;
  while (rest.length < count - introCount) rest.push(pickWeighted(weights, rng));
  // The new variant shows up first so the player meets it right after the banner.
  const keys = introCount ? [intro, ...rest.slice(0, 2), intro, ...rest.slice(2)] : rest;

  const interval = Math.max(W.minInterval, W.startInterval * Math.pow(W.intervalDecay, n - 1));
  const spawns = [];
  let at = 0;
  if (boss) {
    spawns.push({ variant: 'boss', at: 0 });
    at = 4;
  }
  for (const key of keys) {
    spawns.push({ variant: key, at });
    const burst = n >= W.burstFromWave && rng() < W.burstChance;
    at += burst ? interval * 0.12 : interval * (0.7 + rng() * 0.6);
  }

  const bossAppearance = boss ? 1 + (n - W.bossFirstWave) / W.bossEvery : 0;
  const persona = boss ? (CONFIG.boss.forcePersona ?? bossPersona(bossAppearance, rng, lastPersona)) : null;
  return {
    number: n,
    boss,
    persona,
    bossAppearance,
    intro,
    spawns,
    // Speed eases off too, but far less than the head count.
    speedMul: Math.min(W.maxSpeedMul, W.startSpeedMul + (n - 1) * W.speedPerWave + earlyBoost(n))
      * (1 - (1 - relief) * (W.relief?.speedShare ?? 0)),
    bossHpMul: boss ? 1 + (bossAppearance - 1) * W.bossHpPerAppearance : 1,
  };
}

// Runs waves over time: banner -> spawning -> (all cleared) -> break -> next.
export class WaveManager {
  constructor({ rng = Math.random, startWave = 1 } = {}) {
    this.rng = rng;
    this.number = startWave - 1;
    this.wave = null;
    this.state = 'idle';
    this.timer = 0;
    this.clock = 0;
    this.queue = [];
    this.lastPersona = null;
  }

  next() {
    this.number++;
    this.wave = buildWave(this.number, this.rng, { lastPersona: this.lastPersona });
    if (this.wave.persona) this.lastPersona = this.wave.persona;
    this.queue = this.wave.spawns.slice();
    this.state = 'banner';
    this.timer = CONFIG.waves.bannerTime;
    this.clock = 0;
    return this.wave;
  }

  get bannerProgress() {
    return this.state === 'banner' ? 1 - this.timer / CONFIG.waves.bannerTime : 1;
  }

  // alive: enemies still attacking. spawn(variantKey, wave) adds one.
  // Returns 'cleared' or 'started' when those happen this frame.
  update(dt, alive, spawn) {
    const W = CONFIG.waves;
    if (this.state === 'banner') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'spawning';
    } else if (this.state === 'spawning') {
      this.clock += dt;
      while (this.queue.length && this.queue[0].at <= this.clock && alive < W.maxAlive) {
        spawn(this.queue.shift().variant, this.wave);
        alive++;
      }
      // Too crowded: hold the clock so queued spawns don't all dump at once later.
      if (this.queue.length && alive >= W.maxAlive) this.clock = Math.min(this.clock, this.queue[0].at);
      if (!this.queue.length && alive === 0) {
        this.state = 'break';
        this.timer = W.breakTime;
        return 'cleared';
      }
    } else if (this.state === 'break') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.next();
        return 'started';
      }
    }
    return null;
  }
}
