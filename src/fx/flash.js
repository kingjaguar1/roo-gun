// Full-screen flashes (white for big kills) and a red edge vignette (data stolen).
export class Flash {
  constructor() {
    this.alpha = 0;
    this.color = '#fff';
    this.decay = 4;
    this.vignette = 0;
    this.vignetteColor = '255, 46, 99';
  }

  trigger(color = '#fff', alpha = 0.6, decay = 4) {
    if (alpha >= this.alpha) {
      this.color = color;
      this.decay = decay;
    }
    this.alpha = Math.max(this.alpha, alpha);
  }

  danger(amount = 1) {
    this.vignette = Math.max(this.vignette, amount);
  }

  update(dt) {
    this.alpha = Math.max(0, this.alpha - dt * this.decay);
    this.vignette = Math.max(0, this.vignette - dt * 1.4);
  }

  reset() {
    this.alpha = 0;
    this.vignette = 0;
  }

  draw(ctx, view) {
    if (this.vignette > 0) {
      const r = Math.hypot(view.w, view.h) / 2;
      const g = ctx.createRadialGradient(view.w / 2, view.h / 2, r * 0.35, view.w / 2, view.h / 2, r);
      g.addColorStop(0, `rgba(${this.vignetteColor}, 0)`);
      g.addColorStop(1, `rgba(${this.vignetteColor}, ${Math.min(0.85, this.vignette)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (this.alpha > 0) {
      ctx.globalAlpha = Math.min(1, this.alpha);
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.globalAlpha = 1;
    }
  }
}
