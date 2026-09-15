// Every tuning number in the game lives here.
// Sizes, distances and speeds are in reference pixels (a ~400px-wide phone)
// and are multiplied by view.scale at runtime.
export const CONFIG = {
  reference: { w: 400, h: 760, minScale: 0.8, maxScale: 1.6 },

  data: { start: 100 },

  core: {
    radius: 36,
    margin: 14,
    alarmDistance: 260,   // enemies closer than this make the core panic
    reachFraction: 0.35,  // how much of an enemy must overlap the core to steal
  },

  input: { hitPadding: 16 }, // forgiving tap radius for thumbs

  combo: { window: 1.8, maxMultiplier: 10 },

  fx: { shakeMax: 20, shakeDecay: 1.7, maxParticles: 700 },

  boss: {
    revealDeathChance: 0.1, // rolled once per Boss Ruben appearance: his stare kills you
    stareDelay: 1.3,        // seconds after the reveal before the stare starts charging
    chargeTime: 1.2,        // frown, evil grin and glowing eyes before the lasers fire
  },

  // Short levels you can link to with ?level=<name>. Clearing finalWave wins.
  levels: {
    proto: { name: 'PROTO LEVEL', goal: 'SURVIVE 3 WAVES AND BEAT BOSS {NAME}', startWave: 6, finalWave: 8 },
  },

  waves: {
    breakTime: 2.0,        // pause between waves
    bannerTime: 1.8,       // "WAVE 3" banner before spawning starts
    baseCount: 2,
    countPerWave: 1.35,
    maxCount: 40,
    startInterval: 1.7,    // seconds between spawns on wave 1
    intervalDecay: 0.9,
    minInterval: 0.32,
    speedPerWave: 0.06,
    maxSpeedMul: 2.1,
    maxAlive: 18,
    burstFromWave: 6,      // later waves sometimes spawn several at once
    burstChance: 0.25,
    unlocks: { fast: 3, big: 5, sneaky: 7 },
    bossFirstWave: 8,
    bossEvery: 4,
    bossHpPerAppearance: 0.35,
  },
};
