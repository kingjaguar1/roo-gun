import { CONFIG } from './config.js';
import { Events } from './events.js';
import { Timers } from './timers.js';
import { pick } from './rng.js';
import { Spawner } from './enemies/spawner.js';
import { drawEnemy } from './enemies/render.js';
import { drawDeathStare } from './fx/deathstare.js';
import { VARIANTS, variantLabel } from './enemies/variants.js';
import { findTarget } from './hit.js';
import { DataCore } from './datacore.js';
import { RooGun } from './roogun.js';
import { Scoring } from './scoring.js';
import { WaveManager } from './waves.js';
import { Particles } from './fx/particles.js';
import { Explosions } from './fx/explosions.js';
import { Shake } from './fx/shake.js';
import { Flash } from './fx/flash.js';
import { Popups } from './fx/popups.js';
import { StageShow } from './fx/stageshow.js';
import { drawBackground } from './ui/background.js';
import { drawCoreBody, drawCoreGauge } from './ui/datacore-view.js';
import { Hud } from './ui/hud.js';
import { drawWaveBanner } from './ui/banner.js';

const TAUNTS = ['YOINK!', 'MINE NOW!', 'HEHEHE', 'THANKS!', 'GOT IT!', 'SEE YA!', 'EASY!'];
const COMBO_CALLOUTS = { 5: 'NICE!', 10: 'UNSTOPPABLE!', 15: 'DATA HERO!', 20: 'ROO GOD!', 30: 'HE FEARS YOU' };

// One play session. Emits: waveStart, waveCleared, bossIncoming, shot, hit,
// kill, stolen, comboLost, bossReveal, stareCharge, rubenStare, bossDown, dataGone,
// gameOver, victory.
export class Game {
  constructor({ view, hims, events = new Events(), rng = Math.random, startWave = 1, finalWave = 0 }) {
    this.view = view;
    this.hims = hims;
    this.events = events;
    this.rng = rng;

    this.core = new DataCore();
    this.core.layout(view);
    this.gun = new RooGun();
    this.spawner = new Spawner({ hims, rng });
    this.scoring = new Scoring();
    this.waves = new WaveManager({ rng, startWave });
    this.timers = new Timers();
    this.enemies = [];
    this.world = { core: this.core, view, rng };

    this.particles = new Particles();
    this.explosions = new Explosions(this.particles);
    this.shake = new Shake();
    this.flash = new Flash();
    this.popups = new Popups();
    this.stage = new StageShow();
    this.hud = new Hud();

    this.time = 0;
    this.hitStop = 0;
    this.slowMo = 0;
    this.slowMoScale = 1;
    this.over = false;
    this.deathCause = 'stolen';
    this.finalWave = finalWave; // 0 = endless
    this.won = false;
  }

  start() {
    this.events.emit('waveStart', this.waves.next());
  }

  get stats() {
    return {
      score: this.scoring.score,
      wave: Math.max(1, this.waves.number),
      kills: this.scoring.kills,
      bestCombo: this.scoring.bestCombo,
      cause: this.deathCause,
      won: this.won,
    };
  }

  addEnemy(key, opts = {}) {
    const enemy = this.spawner.create(key, { view: this.view, ...opts });
    enemy.init(this.world);
    this.enemies.push(enemy);
    return enemy;
  }

  // ---- Player actions -------------------------------------------------

  shoot(x, y) {
    if (this.over) return;
    const s = this.view.scale;
    const target = findTarget(this.enemies, x, y, CONFIG.input.hitPadding * s);
    this.gun.fire(x, y, this.view, Boolean(target));
    this.shake.add(0.05);
    this.events.emit('shot', { x, y, hit: Boolean(target) });

    if (!target) {
      this.particles.emit({ x, y, shape: 'ring', size: 22 * s, grow: 60 * s, color: 'rgba(255,255,255,0.5)', life: 0.25, shrink: false, lineWidth: 3 * s });
      return;
    }

    this.sparks(x, y, 8);
    this.scoring.registerHit();
    if (target.hit(1)) {
      this.kill(target);
    } else {
      this.shake.add(0.1);
      this.events.emit('hit', { enemy: target });
    }
  }

  // ---- Outcomes -------------------------------------------------------

  kill(e) {
    e.dead = true;
    const s = this.view.scale;
    const power = e.variant.explosion;
    this.explosions.spawn(e.x, e.y, power, { scale: s, sprite: e.sprite, rng: this.rng });
    this.shake.add(Math.min(0.85, 0.24 + 0.13 * power));
    this.hitStop = Math.max(this.hitStop, 0.022 * power);
    if (power >= 2) this.flash.trigger('#fff', 0.18 * power, 5);

    const { points, combo, multiplier } = this.scoring.registerKill(e.variant.score);
    const big = power >= 2 ? 1.35 : 1;
    this.popups.add(`+${points.toLocaleString('en-US')}`, e.x, e.y - e.radius * 0.7, {
      size: (26 + Math.min(multiplier, 10) * 1.6) * s * big, fill: '#ffd23f', vy: -95 * s,
    });
    if (combo >= 2) {
      this.popups.add(`COMBO x${multiplier}`, e.x, e.y + e.radius * 0.5, {
        size: 19 * s, fill: '#ff8c1a', vy: -55 * s, delay: 0.05, life: 0.8,
      });
    }
    if (COMBO_CALLOUTS[combo]) {
      this.popups.add(COMBO_CALLOUTS[combo], this.view.w / 2, this.view.h * 0.45, {
        size: 46 * s, fill: '#3fd0ff', vy: -30 * s, life: 1.2, rotation: -0.08,
      });
    }

    this.events.emit('kill', { enemy: e, points, combo, power });
    if (e.variant.boss) {
      if (e.persona?.stageShow) this.stage.stop();
      this.bossDown(e);
    }
  }

  // Boss Ruben arrives as a cartoon, then the mask comes off: a real photo.
  revealBoss(e) {
    if (e.revealed) return;
    const s = this.view.scale;
    e.revealed = true;
    e.sprite = e.revealSprite;
    e.hitFlash = 1;
    e.squash = 1;
    this.flash.trigger('#fff', 1, 2.2);
    this.shake.add(0.9);
    this.hitStop = Math.max(this.hitStop, 0.2);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const speed = (380 + this.rng() * 320) * s;
      this.particles.emit({
        x: e.x + Math.cos(a) * e.radius, y: e.y + Math.sin(a) * e.radius,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, shape: 'spark',
        size: 4 * s, color: i % 2 ? '#ff2e63' : '#ffd23f', life: 0.5, drag: 2, shrink: false, additive: true,
      });
    }
    const name = this.hims.name.toUpperCase();
    const y = Math.min(this.view.h * 0.75, e.y + e.radius + 40 * s);
    this.popups.add('WAIT...', this.view.w / 2, y, { size: 26 * s, life: 2.1, vy: 0, rotation: -0.05 });
    this.popups.add(`IT'S THE REAL ${name}!`, this.view.w / 2, y + 38 * s, {
      size: 38 * s, fill: '#ff2e63', life: 2.1, vy: 0, delay: 0.4, rotation: -0.05,
    });
    const persona = e.persona;
    if (persona?.stageShow) {
      // His face owns the screen, then collapses into the spotlight.
      this.stage.start(e.revealSprite?.source ?? e.revealSprite ?? e.sprite, this.bossTarget(e));
      this.popups.clear();
    }
    if (persona?.taunt) {
      this.popups.add(persona.taunt, this.view.w / 2, y + 76 * s, {
        size: 28 * s, fill: persona.ring, life: 2.0, vy: 0, delay: 0.9, rotation: 0.04,
      });
    }
    this.events.emit('bossReveal', { enemy: e });

    // Rolled once per Boss Ruben appearance, never per shot.
    if (this.rng() < CONFIG.boss.revealDeathChance) {
      this.timers.after(CONFIG.boss.stareDelay, () => {
        if (!e.dead && !this.over) this.startStare(e);
      });
    }
  }

  bossTarget(e) {
    return { x: e.x, y: e.y, r: e.radius };
  }

  // Unlucky roll: he stops, frowns, grins, and his eyes start glowing.
  startStare(e) {
    const s = this.view.scale;
    e.stare = { phase: 'charging', t: 0 };
    e.state.timer = Infinity; // hold still and stare
    this.popups.clear();
    this.shake.add(0.4);
    this.flash.danger(0.8);
    this.popups.add('👁 DEATH STARE 👁', this.view.w / 2, Math.min(this.view.h * 0.75, e.y + e.radius + 72 * s), {
      size: 36 * s, fill: '#ff2e63', life: CONFIG.boss.chargeTime + 0.2, vy: 0, rotation: -0.04,
    });
    this.events.emit('stareCharge', { enemy: e });
  }

  updateStare(e, dt) {
    const stare = e.stare;
    if (stare.phase === 'charging' && this.over) {
      e.stare = null; // the data was already gone before he finished charging
      return;
    }
    stare.t += dt;
    this.shake.add(stare.phase === 'charging' ? dt * 0.6 : 0);
    if (stare.phase === 'charging' && stare.t >= CONFIG.boss.chargeTime) {
      stare.phase = 'firing';
      stare.t = 0;
      const s = this.view.scale;
      const gun = this.gun.origin(this.view);
      this.explosions.spawn(gun.x, gun.y - 30 * s, 2.5, { scale: s, rng: this.rng });
      this.gun.destroyed = true;
      this.rubenStare(e);
    }
  }

  // Unlucky: you looked directly at the real Ruben. All data, gone, instantly.
  rubenStare(e) {
    const s = this.view.scale;
    const name = this.hims.name.toUpperCase();
    this.deathCause = 'stare';
    this.popups.clear();
    this.flash.trigger('#ff2e63', 0.45, 2);
    this.shake.add(1);
    this.popups.add('YOU LOOKED DIRECTLY AT HIM', this.view.w / 2, this.view.h * 0.62, {
      size: 30 * s, fill: '#fff', life: 2.2, vy: 0, rotation: 0.04,
    });
    this.popups.add(`${name}'S STARE: -${Math.ceil(this.core.data)}%`, this.view.w / 2, this.view.h * 0.62 + 40 * s, {
      size: 34 * s, fill: '#ff2e63', life: 2.2, vy: 0, delay: 0.25, rotation: 0.04,
    });
    this.core.steal(this.core.data);
    this.scoring.breakCombo();
    this.events.emit('rubenStare', { enemy: e });
    this.startGameOver();
  }

  bossDown(e) {
    const s = this.view.scale;
    const { x, y, radius } = e;
    this.flash.trigger('#fff', 0.95, 1.6);
    this.shake.add(1);
    this.hitStop = 0.18;
    this.slowMo = 1.1;
    this.slowMoScale = 0.35;
    for (let i = 0; i < 7; i++) {
      this.timers.after(0.12 + i * 0.14, () => {
        const a = this.rng() * Math.PI * 2;
        const d = this.rng() * radius * 1.3;
        this.explosions.spawn(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.6, { scale: s, sprite: e.sprite, rng: this.rng, word: i % 3 === 2 });
        this.shake.add(0.35);
        this.events.emit('kill', { enemy: e, points: 0, combo: 0, power: 1.6, echo: true });
      });
    }
    this.timers.after(0.3, () => {
      this.popups.add(`${variantLabel(e.variant, this.hims.name)} DEFEATED!`, this.view.w / 2, this.view.h * 0.42, {
        size: 40 * s, fill: '#ffd23f', life: 2, vy: -15 * s, rotation: -0.05,
      });
    });
    this.events.emit('bossDown', { enemy: e });
  }

  steal(e) {
    const s = this.view.scale;
    const stolen = this.core.steal(e.variant.steal);
    e.escape();

    this.shake.add(0.55);
    this.flash.danger(1);
    this.flash.trigger('#ff2e63', 0.22, 3);
    this.popups.add(`⚠ DATA STOLEN -${stolen}% ⚠`, this.view.w / 2, this.view.h * 0.3, {
      size: 32 * s, fill: '#ff2e63', life: 1.4, vy: -18 * s, rotation: 0,
    });
    this.popups.add(pick(this.rng, TAUNTS), e.x, e.y - e.radius, { size: 22 * s, life: 0.9 });

    // Data pouring out of the core after him.
    for (let i = 0; i < 18; i++) {
      const spread = (this.rng() - 0.5) * 260 * s;
      this.particles.emit({
        x: this.core.x, y: this.core.y, shape: 'text', text: this.rng() < 0.5 ? '0' : '1',
        vx: e.escapeVX * (0.3 + this.rng() * 0.5) + spread, vy: e.escapeVY * (0.3 + this.rng() * 0.5) - spread,
        color: this.rng() < 0.5 ? '#39ff88' : '#ff2e63', size: (14 + this.rng() * 8) * s,
        life: 0.7 + this.rng() * 0.4, drag: 1.2, shrink: false,
      });
    }

    const lost = this.scoring.breakCombo();
    if (lost >= 3) this.comboLost(lost);
    this.events.emit('stolen', { enemy: e, amount: stolen, data: this.core.data });
    if (this.core.empty) this.startGameOver();
  }

  comboLost(lost) {
    const s = this.view.scale;
    this.popups.add(`COMBO x${Math.min(lost, CONFIG.combo.maxMultiplier)} LOST`, this.view.safe.left + 80 * s, this.view.safe.top + 120 * s, {
      size: 18 * s, fill: '#aaa', life: 0.9, vy: 30 * s,
    });
    this.events.emit('comboLost', { lost });
  }

  startGameOver() {
    if (this.over) return;
    this.over = true;
    const s = this.view.scale;
    this.slowMo = 2;
    this.slowMoScale = 0.4;
    this.flash.danger(1);
    this.explosions.spawn(this.core.x, this.core.y, 3, { scale: s, rng: this.rng, word: false });
    // Everyone runs off with the data, except a staring boss, who stays to gloat.
    for (const e of this.enemies) if (!e.dead && !e.escaping && !e.stare) e.escape();
    this.popups.add('DATA HAS BEEN STOLEN', this.view.w / 2, this.view.h * 0.45, {
      size: 38 * s, fill: '#ff2e63', life: 2, vy: 0, rotation: -0.04,
    });
    this.events.emit('dataGone', this.stats);
    this.timers.after(1.8, () => this.events.emit('gameOver', this.stats));
  }

  sparks(x, y, count) {
    const s = this.view.scale;
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const speed = (200 + this.rng() * 400) * s;
      this.particles.emit({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, shape: 'spark',
        size: 3 * s, color: '#fff', life: 0.18 + this.rng() * 0.15, drag: 4, shrink: false, additive: true,
      });
    }
  }

  // ---- Frame ----------------------------------------------------------

  updateWaves(dt) {
    const alive = this.enemies.filter((e) => !e.dead && !e.escaping).length;
    const result = this.waves.update(dt, alive, (key, wave) => {
      const boss = VARIANTS[key].boss;
      this.addEnemy(key, {
        speedMul: wave.speedMul,
        hpMul: boss ? wave.bossHpMul : 1,
        persona: boss ? wave.persona : null,
      });
      if (boss) {
        this.shake.add(0.7);
        this.flash.trigger('#ff2e63', 0.3, 2);
        this.events.emit('bossIncoming', { wave });
        if (wave.persona) this.events.emit('bossPersona', wave.persona);
      }
    });
    if (result === 'cleared') this.waveCleared();
    if (result === 'started') this.events.emit('waveStart', this.waves.wave);
  }

  waveCleared() {
    const s = this.view.scale;
    const n = this.waves.number;
    const bonus = 100 * n;
    this.scoring.add(bonus);
    this.popups.add(`WAVE ${n} CLEARED!`, this.view.w / 2, this.view.h * 0.4, {
      size: 40 * s, fill: '#39ff88', life: 1.5, vy: -20 * s, rotation: -0.05,
    });
    this.popups.add(`+${bonus.toLocaleString('en-US')} BONUS`, this.view.w / 2, this.view.h * 0.4 + 44 * s, {
      size: 24 * s, fill: '#ffd23f', life: 1.5, vy: -20 * s, delay: 0.2, rotation: -0.05,
    });
    this.events.emit('waveCleared', { wave: n, bonus });
    if (this.finalWave && n >= this.finalWave) this.win();
  }

  win() {
    if (this.over) return;
    this.over = true;
    this.won = true;
    const s = this.view.scale;
    // Any stragglers are blown away in the celebration.
    for (const e of this.enemies) {
      if (e.dead || e.escaping) continue;
      e.dead = true;
      this.explosions.spawn(e.x, e.y, 1, { scale: s, sprite: e.sprite, rng: this.rng, word: false });
    }
    this.flash.trigger('#fff', 0.6, 2);
    this.popups.clear();
    this.popups.add('DATA DEFENDED!', this.view.w / 2, this.view.h * 0.45, {
      size: 46 * s, fill: '#39ff88', life: 2.2, vy: -10 * s, rotation: -0.05,
    });
    for (let i = 0; i < 7; i++) {
      this.timers.after(i * 0.22, () => {
        const x = this.view.w * (0.15 + this.rng() * 0.7);
        const y = this.view.h * (0.15 + this.rng() * 0.5);
        this.explosions.spawn(x, y, 1.5, { scale: s, rng: this.rng });
        this.events.emit('kill', { power: 1.5, combo: 0, points: 0, echo: true });
      });
    }
    this.timers.after(2.2, () => this.events.emit('victory', this.stats));
  }

  update(dt) {
    const s = this.view.scale;
    this.time += dt;
    this.core.layout(this.view);

    // Hit-stop freezes gameplay for a few frames on impact; slow-mo for big moments.
    let gameDt = dt;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      gameDt = 0;
    } else if (this.slowMo > 0) {
      this.slowMo -= dt;
      gameDt = dt * this.slowMoScale;
    }

    this.timers.update(dt);
    if (!this.over) this.updateWaves(gameDt);

    for (const e of this.enemies) {
      e.update(gameDt, this.world);
      if (e.revealSprite && !e.revealed && e.state.phase === 'taunting') this.revealBoss(e);
      if (e.stare) this.updateStare(e, dt);
      if (e.landed) {
        e.landed = false;
        this.shake.add(0.25);
        this.events.emit('parkourLand', { enemy: e });
        for (let i = 0; i < 10; i++) {
          const a = Math.PI + (i / 10) * Math.PI;
          this.particles.emit({
            x: e.x, y: e.y + e.radius * 0.9, vx: Math.cos(a) * 180 * s, vy: Math.sin(a) * 120 * s,
            size: 5 * s, color: '#d9c9ff', life: 0.45, drag: 3,
          });
        }
      }
      if (this.stage.active && e.persona?.stageShow && !e.dead) this.stage.update(gameDt, this.bossTarget(e));
      if (!this.over && !e.dead && !e.escaping && this.core.isReachedBy(e)) this.steal(e);
    }
    this.enemies = this.enemies.filter((e) => !e.dead && !(e.escaping && e.isOffscreen(this.view)));

    this.core.update(gameDt, this.enemies, s);
    if (this.core.alarm > 0.6) this.flash.danger((this.core.alarm - 0.6) * 0.9);
    if (!this.over) {
      const lost = this.scoring.update(gameDt);
      if (lost >= 3) this.comboLost(lost);
    }

    this.particles.update(gameDt);
    this.explosions.update(gameDt);
    this.gun.update(dt);
    this.shake.update(dt, s);
    this.flash.update(dt);
    this.popups.update(dt);
    this.hud.update(dt, this.scoring);
  }

  draw(ctx) {
    const view = this.view;
    ctx.save();
    this.shake.apply(ctx, view);
    drawBackground(ctx, view, this.time, this.core);
    this.stage.drawLights(ctx, view, this.time);
    drawCoreBody(ctx, this.core, view);
    for (const e of this.enemies) drawEnemy(ctx, e, this.hims.name);
    for (const e of this.enemies) if (e.stare) drawDeathStare(ctx, e, this.gun.origin(view), view);
    this.stage.drawFace(ctx, view);
    this.particles.draw(ctx);
    this.explosions.draw(ctx);
    this.gun.drawBolts(ctx, view);
    this.gun.drawGun(ctx, view);
    ctx.restore();

    drawCoreGauge(ctx, this.core, view);
    this.hud.draw(ctx, view, { scoring: this.scoring, wave: Math.max(1, this.waves.number) });
    this.popups.draw(ctx, view);
    drawWaveBanner(ctx, view, this.waves, this.hims.name, this.time);
    this.flash.draw(ctx, view);
  }

  debugStats() {
    return { ...this.stats, waveState: this.waves.state, combo: this.scoring.combo, data: this.core.data, over: this.over, particles: this.particles.list.length };
  }
}
