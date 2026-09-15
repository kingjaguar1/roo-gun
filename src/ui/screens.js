import { circle, comicText, emoji, roundRect } from './draw.js';
import { drawBackground } from './background.js';
import { drawCoreBody } from './datacore-view.js';
import { Button } from './button.js';
import { Particles } from '../fx/particles.js';
import { Explosions } from '../fx/explosions.js';
import { Shake } from '../fx/shake.js';
import { clamp, easeOutBack } from '../math.js';

const ORBITERS = 7;

// Title screen: a Data Core in the middle with several of him circling it.
// Tapping one of them blows him up, because why not.
export class MenuScreen {
  constructor({ view, hims }) {
    this.view = view;
    this.hims = hims;
    this.core = { x: 0, y: 0, radius: 0, time: 0, alarm: 0.3, damage: 0 };
    this.particles = new Particles(300);
    this.explosions = new Explosions(this.particles);
    this.shake = new Shake();
    this.playButton = new Button('PLAY', { fill: '#ff2e63', size: 46 });
    this.enter();
  }

  enter() {
    this.time = 0;
    this.orbiters = Array.from({ length: ORBITERS }, (_, i) => this.makeOrbiter(i));
    this.particles.clear();
    this.explosions.clear();
  }

  makeOrbiter(i) {
    return {
      angle: (i / ORBITERS) * Math.PI * 2 + Math.random() * 0.4,
      dist: 0.6 + Math.random() * 0.4,
      speed: 0.3 + Math.random() * 0.35,
      size: 0.75 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      sprite: this.hims.random(),
      alive: true,
      respawn: 0,
    };
  }

  layout() {
    const { w, h, scale: s } = this.view;
    this.core.radius = 42 * s;
    this.core.x = w / 2;
    this.core.y = h * 0.57;
    this.playButton.layout(w / 2, h * 0.8, Math.min(w * 0.7, 280 * s), 78 * s);
  }

  orbiterPosition(o) {
    const s = this.view.scale;
    const rx = Math.min(this.view.w * 0.4, 170 * s) * o.dist;
    const ry = 88 * s * o.dist;
    return {
      x: this.core.x + Math.cos(o.angle) * rx,
      y: this.core.y + Math.sin(o.angle) * ry + Math.sin(this.time * 2.4 + o.phase) * 7 * s,
      r: 27 * s * o.size * (0.85 + 0.15 * Math.sin(o.angle)), // smaller when "behind"
    };
  }

  update(dt) {
    this.time += dt;
    this.layout();
    this.core.time += dt;
    this.core.alarm = 0.08 + 0.08 * Math.sin(this.time * 1.3);
    this.core.damage = Math.max(0, this.core.damage - dt * 2);
    for (const o of this.orbiters) {
      o.angle += o.speed * dt;
      if (!o.alive) {
        o.respawn -= dt;
        if (o.respawn <= 0) Object.assign(o, this.makeOrbiter(0), { angle: o.angle });
      }
    }
    this.particles.update(dt);
    this.explosions.update(dt);
    this.shake.update(dt, this.view.scale);
    this.playButton.update(dt);
  }

  press(x, y) {
    if (this.playButton.contains(x, y)) {
      this.playButton.press();
      return 'play';
    }
    for (const o of this.orbiters) {
      if (!o.alive) continue;
      const p = this.orbiterPosition(o);
      if (Math.hypot(x - p.x, y - p.y) <= p.r + 12 * this.view.scale) {
        this.explosions.spawn(p.x, p.y, 1, { scale: this.view.scale, sprite: o.sprite });
        this.shake.add(0.35);
        this.core.damage = 0.6;
        o.alive = false;
        o.respawn = 1.5;
        return 'boom';
      }
    }
    return null;
  }

  drawOrbiter(ctx, o) {
    const p = this.orbiterPosition(o);
    const s = this.view.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(this.time * 3 + o.phase) * 0.2);
    circle(ctx, 0, 0, p.r + 4 * s);
    ctx.fillStyle = '#0b0620';
    ctx.fill();
    circle(ctx, 0, 0, p.r + 1.5 * s);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.drawImage(o.sprite, -p.r, -p.r, p.r * 2, p.r * 2);
    ctx.restore();
  }

  draw(ctx, records, level = null) {
    const view = this.view;
    const { w, h, scale: s, safe } = view;
    const behind = this.orbiters.filter((o) => o.alive && Math.sin(o.angle) < 0);
    const front = this.orbiters.filter((o) => o.alive && Math.sin(o.angle) >= 0);

    ctx.save();
    this.shake.apply(ctx, view);
    drawBackground(ctx, view, this.time, this.core);
    for (const o of behind) this.drawOrbiter(ctx, o);
    drawCoreBody(ctx, this.core, view);
    for (const o of front) this.drawOrbiter(ctx, o);
    this.particles.draw(ctx);
    this.explosions.draw(ctx);
    ctx.restore();

    const titleY = safe.top + h * 0.16;
    const intro = easeOutBack(clamp(this.time / 0.6, 0, 1));
    const bob = Math.sin(this.time * 2) * 4 * s;
    comicText(ctx, 'ROO GUN', w / 2, titleY + bob, 104 * s * Math.max(0.01, intro), {
      fill: '#ffd23f', rotation: -0.07, strokeWidth: 15 * s, maxWidth: w * 0.9,
    });

    // Ribbon.
    const ribbonW = Math.min(w * 0.92, 350 * s);
    const ribbonH = 46 * s;
    const ribbonY = titleY + 76 * s;
    const ribbonIn = easeOutBack(clamp((this.time - 0.25) / 0.5, 0, 1));
    ctx.save();
    ctx.translate(w / 2, ribbonY);
    ctx.rotate(-0.04);
    ctx.scale(Math.max(0.01, ribbonIn), 1);
    const notch = 14 * s;
    ctx.beginPath();
    ctx.moveTo(-ribbonW / 2 - notch, -ribbonH / 2);
    ctx.lineTo(ribbonW / 2 + notch, -ribbonH / 2);
    ctx.lineTo(ribbonW / 2, 0);
    ctx.lineTo(ribbonW / 2 + notch, ribbonH / 2);
    ctx.lineTo(-ribbonW / 2 - notch, ribbonH / 2);
    ctx.lineTo(-ribbonW / 2, 0);
    ctx.closePath();
    ctx.fillStyle = '#ff2e63';
    ctx.fill();
    ctx.lineWidth = 4.5 * s;
    ctx.strokeStyle = '#0b0620';
    ctx.stroke();
    comicText(ctx, 'THE DATA DEFENDERS', 0, 2 * s, 30 * s, { strokeWidth: 6 * s, maxWidth: ribbonW * 0.86 });
    ctx.restore();

    comicText(ctx, 'PROTECT THE DATA. STOP HIM.', w / 2, ribbonY + 48 * s, 19 * s, {
      fill: '#fff', strokeWidth: 5 * s, maxWidth: w * 0.9,
    });

    this.playButton.draw(ctx, s, this.time, { pulse: true, appear: easeOutBack(clamp((this.time - 0.4) / 0.4, 0, 1)) });

    let below = this.playButton.y + this.playButton.h + 32 * s;
    if (level) {
      const goal = level.goal.replaceAll('{NAME}', this.hims.name.toUpperCase());
      comicText(ctx, `${level.name}: ${goal}`, w / 2, below, 17 * s, { fill: '#39ff88', strokeWidth: 5 * s, maxWidth: w * 0.9 });
      below += 28 * s;
    }
    if (records.highScore > 0) {
      comicText(ctx, `BEST ${records.highScore.toLocaleString('en-US')}  ·  WAVE ${records.bestWave}`, w / 2, below, 18 * s, {
        fill: '#3fd0ff', strokeWidth: 5 * s, maxWidth: w * 0.8,
      });
    }
    comicText(ctx, `STARRING ${this.hims.name.toUpperCase()} AS EVERY SINGLE ENEMY`, w / 2, h - safe.bottom - 20 * s, 13 * s, {
      fill: 'rgba(255, 255, 255, 0.85)', strokeWidth: 4 * s, shadow: false, maxWidth: w * 0.62,
    });
  }
}

const QUIPS = [
  "HE'S ALREADY SELLING IT.",
  'HE SAYS THANKS.',
  'YOUR PASSWORDS ARE NOW HIS PASSWORDS.',
  "HE'S READING YOUR NOTES APP.",
  "HE'S LIKING YOUR PHOTOS FROM 2014.",
  'THERE WERE JUST TOO MANY OF HIM.',
  'HE HAS CHANGED YOUR NETFLIX PROFILE PICTURE.',
];

const WIN_QUIPS = [
  "HE'LL BE BACK.",
  'HE IS FILING A COMPLAINT.',
  'YOUR DATA IS SAFE. FOR NOW.',
  'HE WANTS A REMATCH.',
];

// Comedic results screen drawn over the frozen game: failure, or a level won.
export class GameOverScreen {
  constructor({ view, hims }) {
    this.view = view;
    this.hims = hims;
    this.retryButton = new Button('TRY AGAIN', { fill: '#ff2e63', size: 36 });
    this.menuButton = new Button('MENU', { fill: '#7b2ff7', size: 24 });
    this.time = 0;
    this.stats = null;
  }

  enter(stats, { newHighScore }) {
    this.stats = stats;
    this.newHighScore = newHighScore;
    this.time = 0;
    this.won = Boolean(stats.won);
    const stared = stats.cause === 'stare';
    // By now the player has met the real him (boss or stare), so show the photo.
    this.sprite = ((stared || this.won) && this.hims.bossPhoto()) || this.hims.random();
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    this.quip = this.won ? pick(WIN_QUIPS)
      : stared ? 'YOU LOOKED DIRECTLY AT HIM. NOBODY SURVIVES THAT.'
        : pick(QUIPS);
    this.retryButton.label = this.won ? 'PLAY AGAIN' : 'TRY AGAIN';
  }

  update(dt) {
    this.time += dt;
    this.retryButton.update(dt);
    this.menuButton.update(dt);
  }

  press(x, y) {
    if (this.time < 0.9) return null; // don't let a frantic tap skip the joke
    if (this.retryButton.contains(x, y)) {
      this.retryButton.press();
      return 'retry';
    }
    if (this.menuButton.contains(x, y)) {
      this.menuButton.press();
      return 'menu';
    }
    return null;
  }

  draw(ctx) {
    const { w, h, scale: s, safe } = this.view;
    const t = this.time;
    const appear = (delay) => Math.max(0.01, easeOutBack(clamp((t - delay) / 0.35, 0, 1)));
    const name = this.hims.name.toUpperCase();

    ctx.fillStyle = this.won
      ? `rgba(4, 22, 34, ${0.8 * clamp(t / 0.4, 0, 1)})`
      : `rgba(24, 4, 30, ${0.8 * clamp(t / 0.4, 0, 1)})`;
    ctx.fillRect(0, 0, w, h);

    const top = safe.top;
    const usable = h - safe.top - safe.bottom;
    const at = (f) => top + usable * f;

    comicText(ctx, this.won ? 'DATA DEFENDED!' : 'DATA HAS BEEN STOLEN', w / 2, at(0.08), 32 * s * appear(0.05), {
      fill: this.won ? '#39ff88' : '#ff2e63', rotation: -0.03, maxWidth: w * 0.9,
    });

    // Him, smug, with your data.
    const r = 64 * s * appear(0.2);
    const cx = w / 2;
    const cy = at(0.24) + Math.sin(t * 3) * 6 * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.won ? 0.45 + Math.sin(t * 4) * 0.08 : Math.sin(t * 2.2) * 0.18); // defeated = dizzy tilt
    circle(ctx, 0, 0, r + 6 * s);
    ctx.fillStyle = '#0b0620';
    ctx.fill();
    circle(ctx, 0, 0, r + 2.5 * s);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.drawImage(this.sprite, -r, -r, r * 2, r * 2);
    ctx.restore();
    if (this.won) emoji(ctx, '💫', cx, cy - r * 1.1, r * 0.6, t * 2);
    else emoji(ctx, '💾', cx + r * 1.05, cy + r * 0.45, r * 0.75, Math.sin(t * 6) * 0.25);
    if (t > 0.5) {
      const laugh = this.won ? ['NO', 'NOO', 'NOOO!'] : ['HA', 'HA', 'HA!'];
      laugh.forEach((word, i) => {
        const lx = cx - r * 1.35 + i * r * 0.2;
        const ly = cy - r * 0.9 + i * r * 0.55 + Math.sin(t * 10 + i) * 3 * s;
        comicText(ctx, word, lx, ly, 18 * s, { fill: '#fff', strokeWidth: 4 * s, rotation: -0.3 });
      });
    }

    comicText(ctx, this.won ? `YOU STOPPED ${name}.` : `${name} GOT THE DATA.`, w / 2, at(0.41), 44 * s * appear(0.4), {
      fill: this.won ? '#39ff88' : '#ffd23f', rotation: -0.05, strokeWidth: 8 * s, maxWidth: w * 0.92,
    });
    if (t > 0.6) {
      comicText(ctx, this.quip, w / 2, at(0.475), 16 * s, { fill: '#fff', strokeWidth: 4 * s, maxWidth: w * 0.88 });
    }

    // Stats.
    const panelW = Math.min(w * 0.86, 340 * s);
    const rowH = 31 * s;
    const panelH = rowH * 4 + 20 * s;
    const px = w / 2 - panelW / 2;
    const py = at(0.52);
    const panelIn = appear(0.55);
    ctx.save();
    ctx.translate(w / 2, py + panelH / 2);
    ctx.scale(panelIn, panelIn);
    ctx.translate(-w / 2, -(py + panelH / 2));
    roundRect(ctx, px, py, panelW, panelH, 16 * s);
    ctx.fillStyle = 'rgba(11, 6, 32, 0.85)';
    ctx.fill();
    ctx.lineWidth = 3.5 * s;
    ctx.strokeStyle = '#ffd23f';
    ctx.stroke();
    const rows = [
      ['FINAL SCORE', this.stats.score.toLocaleString('en-US')],
      ['HIGHEST WAVE', String(this.stats.wave)],
      [`${name}S DEFEATED`, String(this.stats.kills)],
      ['BEST COMBO', `x${this.stats.bestCombo}`],
    ];
    rows.forEach(([label, value], i) => {
      const y = py + 10 * s + rowH * (i + 0.5);
      comicText(ctx, label, px + 16 * s, y, 18 * s, { align: 'left', fill: '#3fd0ff', strokeWidth: 0.001, shadow: false, maxWidth: panelW * 0.58 });
      comicText(ctx, value, px + panelW - 16 * s, y, (i === 0 ? 26 : 22) * s, { align: 'right', fill: '#fff', strokeWidth: 4 * s, shadow: false });
    });
    ctx.restore();

    if (this.newHighScore && t > 0.9 && Math.sin(t * 9) > -0.4) {
      comicText(ctx, 'NEW HIGH SCORE!', w / 2 + panelW * 0.2, py - 6 * s, 22 * s, {
        fill: '#39ff88', rotation: 0.08, strokeWidth: 5 * s, maxWidth: panelW * 0.6,
      });
    }

    const retryY = py + panelH + 52 * s;
    this.retryButton.layout(w / 2, retryY, Math.min(w * 0.72, 290 * s), 68 * s);
    this.menuButton.layout(w / 2, retryY + 70 * s, Math.min(w * 0.4, 160 * s), 48 * s);
    this.retryButton.draw(ctx, s, t, { pulse: t > 1, appear: appear(0.8) });
    this.menuButton.draw(ctx, s, t, { appear: appear(0.9) });
  }
}
