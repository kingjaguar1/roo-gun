// Which screen is showing, plus high-score records kept on this device.
export const SCREEN = { LOCKED: 'locked', MENU: 'menu', PLAYING: 'playing', GAME_OVER: 'gameOver' };

const ACCESS_KEY = 'roogun.access';

// A device only types the code once.
export function isUnlocked(code, storage = globalThis.localStorage) {
  try {
    return storage.getItem(ACCESS_KEY) === code;
  } catch {
    return false; // private browsing: they'll type it each time
  }
}

export function rememberUnlocked(code, storage = globalThis.localStorage) {
  try {
    storage.setItem(ACCESS_KEY, code);
  } catch { /* nothing to do: it just won't be remembered */ }
}

const RECORDS_KEY = 'roogun.records';
const EMPTY_RECORDS = { highScore: 0, bestWave: 0 };

export function loadRecords(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(RECORDS_KEY));
    return { ...EMPTY_RECORDS, ...saved };
  } catch {
    return { ...EMPTY_RECORDS };
  }
}

export function saveRecords(records, storage = globalThis.localStorage) {
  try {
    storage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Private browsing or storage full: records just won't persist.
  }
}

export function updateRecords(records, stats) {
  const newHighScore = stats.score > records.highScore;
  return {
    records: {
      highScore: Math.max(records.highScore, stats.score),
      bestWave: Math.max(records.bestWave, stats.wave),
    },
    newHighScore,
  };
}
