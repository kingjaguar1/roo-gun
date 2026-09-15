// Finds which HIM a tap landed on. When taps overlap several, the one whose
// centre is closest (relative to its size) wins.
export function findTarget(enemies, x, y, padding = 0) {
  let best = null;
  let bestScore = Infinity;
  for (const e of enemies) {
    if (e.dead || e.escaping || !e.hittable) continue;
    const reach = e.radius + padding;
    const d = Math.hypot(x - e.x, y - e.y);
    if (d > reach) continue;
    const score = d / reach;
    if (score < bestScore) { best = e; bestScore = score; }
  }
  return best;
}
