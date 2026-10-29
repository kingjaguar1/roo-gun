import { createView } from './view.js';
import { attachInput } from './input.js';
import { loadHimLibrary } from './assets.js';
import { loadFonts } from './ui/draw.js';
import { Events } from './events.js';
import { GameAudio, connectAudio } from './audio.js';
import { SCREEN, loadRecords, saveRecords, updateRecords, isUnlocked, rememberUnlocked, loadName, saveName } from './state.js';
import { fetchTop, submit } from './leaderboard.js';
import { MenuScreen, CodeScreen, GameOverScreen } from './ui/screens.js';
import { MuteButton } from './ui/button.js';
import { setupDebug } from './debug.js';
import { Game } from './game.js';
import { CONFIG } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = createView(canvas);

const [hims] = await Promise.all([loadHimLibrary('assets/him/manifest.json'), loadFonts()]);

const events = new Events();
const audio = new GameAudio();
connectAudio(events, audio);
audio.listenForTaps();

const menu = new MenuScreen({ view, hims });
const codeScreen = new CodeScreen({ view, hims });
const gameOver = new GameOverScreen({ view, hims });
const muteButton = new MuteButton();
let records = loadRecords();
// Nobody gets past the door without the code, but a device only types it once.
let screen = isUnlocked(CONFIG.access.code) ? SCREEN.MENU : SCREEN.LOCKED;
refreshBoard();
let game = null;

const debug = setupDebug({ view, getGame: () => game });
// ?level=proto plays a short level with a win condition instead of endless waves.
const level = CONFIG.levels[debug.params.get('level')] ?? null;
const startWave = Number(debug.params.get('wave')) || level?.startWave || 1;
const finalWave = level?.finalWave ?? 0;

function startGame() {
  game = new Game({ view, hims, events, startWave, finalWave });
  game.start();
  screen = SCREEN.PLAYING;
}

// Asked once, then remembered. A plain prompt is not pretty, but it is the
// native keyboard on a phone and it works everywhere.
function playerName() {
  let name = loadName();
  if (name) return name;
  let typed = null;
  try {
    typed = window.prompt('Name for the leaderboard?', '');
  } catch { /* blocked: play on without a board entry */ }
  name = String(typed ?? '').trim().slice(0, 12);
  if (name) saveName(name);
  return name;
}

function refreshBoard() {
  fetchTop().then((rows) => menu.setBoard(rows));
}

function showResults(stats, sound) {
  const result = updateRecords(records, stats);
  records = result.records;
  saveRecords(records);
  gameOver.enter(stats, { newHighScore: result.newHighScore });
  screen = SCREEN.GAME_OVER;
  audio.play(sound);
  // Nothing to brag about on a zero, and nothing to ask a name for.
  if (stats.score > 0) {
    const name = playerName();
    if (name) submit({ name, score: stats.score, wave: stats.wave }).then(refreshBoard);
  }
}

events.on('gameOver', (stats) => showResults(stats, 'gameOver'));
events.on('victory', (stats) => showResults(stats, 'victory'));

attachInput(canvas, {
  onPress(x, y) {
    audio.unlock();
    if (muteButton.contains(x, y)) {
      audio.toggleMute();
      return;
    }
    if (screen === SCREEN.LOCKED) {
      const action = codeScreen.press(x, y);
      if (action === 'key') audio.play('click');
      if (action === 'wrong') audio.play('comboLost');
      if (action === 'open') {
        rememberUnlocked(CONFIG.access.code);
        audio.play('waveCleared');
      }
      return;
    }
    if (screen === SCREEN.MENU) {
      const action = menu.press(x, y);
      if (action === 'play') {
        audio.play('click');
        startGame();
      } else if (action === 'boom') {
        audio.play('kill', { power: 1 });
      }
    } else if (screen === SCREEN.PLAYING) {
      game.shoot(x, y);
    } else if (screen === SCREEN.GAME_OVER) {
      const action = gameOver.press(x, y);
      if (action) audio.play('click');
      if (action === 'retry') startGame();
      if (action === 'menu') {
        menu.enter();
        screen = SCREEN.MENU;
      }
    }
  },
});

function update(dt) {
  if (screen === SCREEN.LOCKED) {
    codeScreen.update(dt);
    if (codeScreen.done) {
      menu.enter();
      screen = SCREEN.MENU;
    }
    return;
  }
  if (screen === SCREEN.MENU) {
    menu.update(dt);
  } else {
    game.update(dt);
    if (screen === SCREEN.GAME_OVER) gameOver.update(dt);
  }
}

function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  if (screen === SCREEN.LOCKED) {
    codeScreen.draw(ctx);
    return;
  }
  if (screen === SCREEN.MENU) {
    menu.draw(ctx, records, level);
  } else {
    game.draw(ctx);
    if (screen === SCREEN.GAME_OVER) gameOver.draw(ctx);
  }
  muteButton.draw(ctx, view, audio.muted);
}

// Debug runs (?sim, ?bot, ?wave) skip the door and the menu.
if (debug.enabled || debug.params.has('wave')) screen = SCREEN.MENU;
if (debug.params.get('code') === 'show') screen = SCREEN.LOCKED;
if (debug.enabled || debug.params.has('wave')) startGame();
if (debug.params.get('screen') === 'menu') screen = SCREEN.MENU;
if (debug.simulateSeconds) {
  debug.simulate(debug.simulateSeconds, update);
  render();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  render();
  debug.tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
