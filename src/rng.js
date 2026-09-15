// Seedable random numbers so tests (and debug runs) are repeatable.
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function mulberry32() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng, min, max) => min + rng() * (max - min);
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
