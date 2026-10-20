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

  // Superstar Ruben's entrance: his face takes the screen, then collapses
  // into the spotlight. Seconds.
  stage: {
    takeover: 0.9,        // how long his face owns the whole screen
    collapse: 0.85,       // the shrink down into the boss circle
    beams: 5,
    strobeRate: 11,       // radians/sec; higher is a faster strobe
    beamColors: ['#ff2e63', '#3fd0ff', '#ffd23f', '#b36bff', '#39ff88'],
  },

  boss: {
    forcePersona: null,     // ?boss=evil pins every boss to one persona
    revealDeathChance: 0.1, // rolled once per Boss Ruben appearance: his stare kills you
    stareDelay: 1.3,        // seconds after the reveal before the stare starts charging
    chargeTime: 1.2,        // frown, evil grin and glowing eyes before the lasers fire
  },

  // Short levels you can link to with ?level=<name>. Clearing finalWave wins.
  levels: {
    proto: { name: 'PROTO LEVEL', goal: 'SURVIVE 3 WAVES AND BEAT BOSS {NAME}', startWave: 6, finalWave: 8 },
  },

  waves: {
    breakTime: 1.0,        // pause between waves
    bannerTime: 1.1,       // "WAVE 3" banner before spawning starts
    baseCount: 4,
    countPerWave: 1.6,
    maxCount: 40,
    startInterval: 0.95,   // seconds between spawns on wave 1
    intervalDecay: 0.92,
    minInterval: 0.32,
    startSpeedMul: 1.25,   // wave 1 is already brisk, not a warm-up
    speedPerWave: 0.07,
    maxSpeedMul: 2.1,
    maxAlive: 18,
    burstFromWave: 6,      // later waves sometimes spawn several at once
    burstChance: 0.25,
    unlocks: { fast: 2, big: 4, sneaky: 6 },
    bossFirstWave: 8,
    bossEvery: 4,
    // Beating a boss earns a breather: the next few waves are lighter and
    // build back up, so waves 9-11 aren't harder than the boss you just beat.
    relief: { waves: 3, from: 0.6, speedShare: 0.4 },
    bossHpPerAppearance: 0.35,
  },
};
