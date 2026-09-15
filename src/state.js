// Which screen is showing, plus high-score records kept on this device.
export const SCREEN = { MENU: 'menu', PLAYING: 'playing', GAME_OVER: 'gameOver' };

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
