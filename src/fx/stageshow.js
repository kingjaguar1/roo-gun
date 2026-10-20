import { circle } from '../ui/draw.js';
import { CONFIG } from '../config.js';

// Superstar Ruben's entrance. The house lights drop, his face fills the whole
// screen, and then it collapses into the spotlight where the boss is standing.
// Pure drawing + a timer: the game only calls start(), update() and the draws.
export class StageShow {
  constructor() {
    this.active = false;
    this.t = 0;
    this.image = null;
    this.target = { x: 0, y: 0, r: 1 };
  }

  // image: the full photo (sprite.source) or the round sprite as a fallback.
  start(image, target) {
    this.active = true;
    this.t = 0;
    this.image = image ?? null;
    this.target = target;
    this.lights = true;
  }

  stop() {
    this.active = false;
    this.lights = false;
  }

  update(dt, target) {
    if (!this.active) return;
    this.t += dt;
    if (target) this.target = target;
    const { takeover, collapse } = CONFIG.stage;
    if (this.t > takeover + collapse) this.image = null; // the face has landed
  }

  // How far through the collapse we are, 0 while the face still fills the screen.
  get collapseProgress() {
    const { takeover, collapse } = CONFIG.stage;
    return Math.max(0, Math.min(1, (this.t - takeover) / collapse));
  }

  // Sweeping coloured beams from above, the way a stage rig looks from the floor.
  drawLights(ctx, view, time) {
    if (!this.lights) return;
    const { beams, beamColors } = CONFIG.stage;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < beams; i++) {
      const phase = time * 1.1 + (i / beams) * Math.PI * 2;
      const x = view.w * (0.5 + Math.sin(phase) * 0.48);
      const spread = view.w * 0.13;
      const g = ctx.createLinearGradient(view.w / 2, -view.h * 0.1, x, view.h);
      const color = beamColors[i % beamColors.length];
      g.addColorStop(0, `${color}cc`);
      g.addColorStop(1, `${color}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(view.w * 0.5 - 10, -view.h * 0.1);
      ctx.lineTo(x - spread, view.h);
      ctx.lineTo(x + spread, view.h);
      ctx.lineTo(view.w * 0.5 + 10, -view.h * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    // Strobe: a few hard white flashes a second, like a camera pit.
    const strobe = Math.sin(time * CONFIG.stage.strobeRate);
    if (strobe > 0.93) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255, 255, 255, ${(strobe - 0.93) * 2.2})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    ctx.restore();
  }

  // The face itself: full screen, then shrinking into the boss's circle.
  drawFace(ctx, view) {
    if (!this.active || !this.image) return;
    const k = this.collapseProgress;
    const eased = k * k * (3 - 2 * k); // smoothstep, so it settles rather than snaps
    const { x, y, r } = this.target;

    // Blackout behind the face while it still owns the screen.
    ctx.save();
    ctx.globalAlpha = 1 - eased;
    ctx.fillStyle = '#05020f';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();

    // Full-screen box -> the boss's circle.
    const fullR = Math.hypot(view.w, view.h) / 2;
    const cx = view.w / 2 + (x - view.w / 2) * eased;
    const cy = view.h / 2 + (y - view.h / 2) * eased;
    const rad = fullR + (r - fullR) * eased;

    ctx.save();
    circle(ctx, cx, cy, rad);
    ctx.clip();
    drawCover(ctx, this.image, cx - rad, cy - rad, rad * 2, rad * 2);
    ctx.restore();
  }
}

// Draw an image filling a box without squashing it (CSS object-fit: cover).
function drawCover(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
