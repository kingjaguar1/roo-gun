// The five versions of HIM. They are all the same person: a variant only
// changes numbers, movement behaviour and decoration, never the photo pool.
export const VARIANTS = {
  normal: {
    key: 'normal', prefix: '', size: 74, speed: 66, hp: 1, score: 50, steal: 10,
    behaviour: 'drift', explosion: 1, ring: '#ffd23f',
  },
  fast: {
    key: 'fast', prefix: 'FAST', size: 60, speed: 150, hp: 1, score: 80, steal: 8,
    behaviour: 'zigzag', explosion: 1, ring: '#3fd0ff', trail: true,
    intro: 'HE HAS DISCOVERED ENERGY DRINKS',
  },
  big: {
    key: 'big', prefix: 'BIG', size: 132, speed: 40, hp: 6, score: 300, steal: 20,
    behaviour: 'drift', explosion: 2, ring: '#ff7a1a',
    intro: "HE'S BEEN BULKING",
  },
  sneaky: {
    key: 'sneaky', prefix: 'SNEAKY', size: 70, speed: 70, hp: 2, score: 200, steal: 12,
    behaviour: 'blink', explosion: 1.4, ring: '#b36bff',
    intro: 'NOW YOU SEE HIM...',
  },
  boss: {
    key: 'boss', prefix: 'BOSS', size: 230, speed: 20, hp: 60, score: 2500, steal: 40,
    behaviour: 'boss', explosion: 4, ring: '#ff2e63', boss: true,
    intro: "IT'S HIM. BUT ENORMOUS.",
  },
};

// Boss Ruben is not one character. Every appearance is a different side of
// him: same photo, different personality, movement and noise. Data only -
// the drawing lives in render.js and fx/stageshow.js.
export const BOSS_PERSONAS = {
  // The original: he turns up, unmasks, and that is the whole trick.
  classic: {
    key: 'classic', label: 'BOSS', ring: '#ff2e63',
    intro: "IT'S HIM. BUT ENORMOUS.",
  },

  // A performer. House lights down, his face fills the screen, then he
  // shrinks into the spotlight and plays to the crowd.
  showman: {
    key: 'showman', label: 'SUPERSTAR', ring: '#ffd23f',
    intro: 'ONE NIGHT ONLY. NO REFUNDS.',
    taunt: 'THANK YOU! GOODNIGHT!',
    stageShow: true, speedMul: 1.12, hpMul: 1.1, sound: 'crowdRoar',
  },

  // Gone full villain: darker, angrier, tougher, and he laughs at you.
  evil: {
    key: 'evil', label: 'EVIL', ring: '#8b0f3a',
    intro: 'HE HAS GONE FULL VILLAIN',
    taunt: 'YOUR DATA IS MINE',
    angryEyes: true, speedMul: 1.1, hpMul: 1.3, sound: 'evilLaugh',
  },

  // He has grown legs. He is doing parkour. Nobody asked for this.
  silly: {
    key: 'silly', label: 'SILLY', ring: '#3fd0ff',
    intro: 'HE HAS LEGS NOW. THIS IS WORSE.',
    taunt: 'PARKOUR!',
    legs: true, behaviour: 'parkour', speedMul: 1.45, hpMul: 0.8, sound: 'boing',
  },
};

// Which Ruben turns up for appearance n. The first two are fixed so the
// reveal lands before the spectacle; after that it's pot luck.
export function bossPersona(appearance, rng = Math.random) {
  if (appearance <= 1) return 'classic';
  if (appearance === 2) return 'showman';
  const pool = ['showman', 'evil', 'silly'];
  return pool[Math.floor(rng() * pool.length)];
}

// The boss variant wearing one persona: same HIM, different everything else.
export function withPersona(variant, key) {
  const persona = BOSS_PERSONAS[key];
  if (!variant.boss || !persona) return variant;
  return {
    ...variant,
    prefix: persona.label,
    ring: persona.ring,
    intro: persona.intro,
    behaviour: persona.behaviour ?? variant.behaviour,
    persona,
  };
}

export function variantLabel(variant, name) {
  const him = name.toUpperCase();
  return variant.prefix ? `${variant.prefix} ${him}` : him;
}
