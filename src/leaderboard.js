// A board everyone shares, kept in a Firebase Realtime Database and talked to
// over plain REST. No SDK and no API key, so the game still ships with no
// dependencies and no external scripts.
//
// Every call fails quietly: the game is installable and plays offline, so a
// missing board must never stop anyone playing.
const BOARD = 'https://roo-gun-default-rtdb.asia-southeast1.firebasedatabase.app';
const TIMEOUT = 5000;
export const KEEP = 8;

// AbortSignal.timeout is recent; without it the fetch just has no deadline.
function deadline() {
  try {
    return AbortSignal.timeout(TIMEOUT);
  } catch {
    return undefined;
  }
}

async function call(path, options = {}) {
  const res = await fetch(`${BOARD}${path}`, { signal: deadline(), ...options });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return res.json();
}

// Tidies whatever the game hands over into something safe to publish:
// someone else's screen is going to show this.
export function clean({ name, score, wave }) {
  const tidy = String(name ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, 12);
  return {
    name: tidy || 'ANON',
    score: Math.max(0, Math.round(Number(score)) || 0),
    wave: Math.max(1, Math.round(Number(wave)) || 1),
    at: Date.now(),
  };
}

function usable(row) {
  return Boolean(row) && typeof row.name === 'string'
    && Number.isFinite(row.score) && Number.isFinite(row.wave);
}

// Best score first. Anything malformed is dropped rather than drawn.
export function rank(raw, limit = KEEP) {
  const rows = Object.values(raw ?? {}).filter(usable);
  rows.sort((a, b) => b.score - a.score || b.wave - a.wave);
  return rows.slice(0, limit);
}

export async function fetchTop(limit = KEEP, api = call) {
  try {
    return rank(await api('/scores.json'), limit);
  } catch {
    return [];
  }
}

// Append-only: every run is its own entry, so two people finishing at once
// can't overwrite each other.
export async function submit(entry, api = call) {
  try {
    await api('/scores.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean(entry)),
    });
    return true;
  } catch {
    return false;
  }
}
