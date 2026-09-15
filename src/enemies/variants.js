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

export function variantLabel(variant, name) {
  const him = name.toUpperCase();
  return variant.prefix ? `${variant.prefix} ${him}` : him;
}
