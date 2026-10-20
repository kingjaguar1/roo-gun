import { CONFIG } from './config.js';

// Developer aids, all off unless the URL asks for them:
//   ?debug          live stats in <pre id="debug"> (readable by headless browsers)
//   ?sim=20         fast-forward 20 seconds of gameplay before the first frame
//   ?bot=0.7        auto-tap HIMs with 70% accuracy (during sim and live play)
//   ?wave=8         start on a later wave
//   ?stare=1        force Boss Ruben's instant-death stare (chance 0-1)
//   ?boss=evil      force every boss to be one persona (classic|showman|evil|silly)
//   ?then=kill      after ?sim, force a kill, steal, gameover or win for a screenshot (?after=frames)
//   ?screen=menu    show the menu even when other debug flags start a game
export function setupDebug({ view, getGame }) {
  const params = new URLSearchParams(location.search);
  if (params.has('stare')) CONFIG.boss.revealDeathChance = Number(params.get('stare') || 1);
  if (params.has('boss')) CONFIG.boss.forcePersona = params.get('boss');
  const enabled = params.has('debug') || params.has('sim') || params.has('bot');
  const botAccuracy = params.has('bot') ? Number(params.get('bot') || 0.8) : 0;
  let botTimer = 0;

  let pre = null;
  if (enabled) {
    pre = document.createElement('pre');
    pre.id = 'debug';
    pre.style.cssText = 'position:fixed;left:0;bottom:0;margin:0;font:9px monospace;color:#fff;opacity:.7;pointer-events:none;white-space:pre-wrap;';
    document.body.appendChild(pre);
  }

  function bot(dt) {
    const game = getGame();
    if (!botAccuracy || !game?.enemies) return;
    botTimer -= dt;
    if (botTimer > 0) return;
    botTimer = 0.28;
    const targets = game.enemies.filter((e) => e.hittable && !e.dead && !e.escaping
      && e.x > 0 && e.x < view.w && e.y > 0 && e.y < view.h);
    if (!targets.length) return;
    targets.sort((a, b) => Math.hypot(a.x - game.core.x, a.y - game.core.y) - Math.hypot(b.x - game.core.x, b.y - game.core.y));
    const t = targets[0];
    const miss = Math.random() > botAccuracy ? t.radius * 3 : 0;
    game.shoot(t.x + miss, t.y + miss);
  }

  // Rolling frame rate, so performance can be checked on a real phone.
  let frames = 0;
  let frameClock = 0;
  let fps = 0;
  function trackFps(dt) {
    frames++;
    frameClock += dt;
    if (frameClock >= 0.5) {
      fps = Math.round(frames / frameClock);
      frames = 0;
      frameClock = 0;
    }
  }

  function write(extra = {}) {
    if (!pre) return;
    const game = getGame();
    pre.textContent = JSON.stringify({
      fps,
      view: { w: view.w, h: view.h, dpr: view.dpr, scale: +view.scale.toFixed(3) },
      core: game?.core && { x: Math.round(game.core.x), y: Math.round(game.core.y), data: game.core.data },
      enemies: game?.enemies?.length ?? 0,
      ...(game?.debugStats?.() ?? {}),
      ...extra,
    });
  }

  return {
    params,
    enabled,
    simulateSeconds: Number(params.get('sim') || 0),
    tick(dt) {
      trackFps(dt);
      bot(dt);
      write();
    },
    // Runs the game forward synchronously; used for headless screenshots and soak tests.
    simulate(seconds, update) {
      const step = 1 / 60;
      const started = performance.now();
      for (let t = 0; t < seconds; t += step) {
        bot(step);
        update(step);
      }
      // ?then=kill|steal forces a moment worth screenshotting.
      const game = getGame();
      const then = params.get('then');
      const onScreen = game?.enemies?.find((e) => !e.dead && !e.escaping && e.x > 40 && e.x < view.w - 40 && e.y > 40 && e.y < view.h - 40);
      if (then === 'kill' && onScreen) game.kill(onScreen);
      if (then === 'steal' && onScreen) game.steal(onScreen);
      if (then === 'win' && game) game.win();
      if (then === 'gameover' && game) { if (onScreen) { game.core.steal(game.core.data - onScreen.variant.steal); game.steal(onScreen); } else { game.core.steal(game.core.data); game.startGameOver(); } }
      if (then) for (let i = 0; i < Number(params.get('after') || 6); i++) update(step);
      write({ simulated: seconds, simMs: Math.round(performance.now() - started) });
    },
  };
}
