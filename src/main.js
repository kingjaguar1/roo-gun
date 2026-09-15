import { createView } from './view.js';
import { attachInput } from './input.js';
import { loadHimLibrary } from './assets.js';
import { loadFonts } from './ui/draw.js';
import { Events } from './events.js';
import { GameAudio, connectAudio } from './audio.js';
import { SCREEN, loadRecords, saveRecords, updateRecords } from './state.js';
import { MenuScreen, GameOverScreen } from './ui/screens.js';
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

const menu = new MenuScreen({ view, hims });
const gameOver = new GameOverScreen({ view, hims });
const muteButton = new MuteButton();
let records = loadRecords();
let screen = SCREEN.MENU;
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

function showResults(stats, sound) {
  const result = updateRecords(records, stats);
  records = result.records;
  saveRecords(records);
  gameOver.enter(stats, { newHighScore: result.newHighScore });
  screen = SCREEN.GAME_OVER;
  audio.play(sound);
}

events.on('gameOver', (stats) => showResults(stats, 'gameOver'));
events.on('victory', (stats) => showResults(stats, 'victory'));

attachInput(canvas, {
  onGesture: () => audio.unlock(),
  onPress(x, y) {
    audio.unlock();
    if (muteButton.contains(x, y)) {
      audio.toggleMute();
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
  if (screen === SCREEN.MENU) {
    menu.update(dt);
  } else {
    game.update(dt);
    if (screen === SCREEN.GAME_OVER) gameOver.update(dt);
  }
}

function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  if (screen === SCREEN.MENU) {
    menu.draw(ctx, records, level);
  } else {
    game.draw(ctx);
    if (screen === SCREEN.GAME_OVER) gameOver.draw(ctx);
  }
  muteButton.draw(ctx, view, audio.muted);
}

// Debug runs (?sim, ?bot, ?wave) skip the menu.
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
