import { comicText, roundRect } from './draw.js';

const COMBO_COLORS = ['#ffffff', '#ffd23f', '#ff8c1a', '#ff2e63', '#b36bff', '#3fd0ff'];

// SCORE / WAVE / COMBO in the top-left. DATA lives with the Data Core.
export class Hud {
  constructor() {
    this.displayScore = 0;
    this.comboPop = 0;
    this.scorePop = 0;
    this.lastCombo = 0;
    this.lastScore = 0;
  }

  reset() {
    this.displayScore = 0;
    this.lastCombo = 0;
    this.lastScore = 0;
  }

  update(dt, scoring) {
    const diff = scoring.score - this.displayScore;
    this.displayScore = Math.abs(diff) < 1 ? scoring.score : this.displayScore + diff * Math.min(1, dt * 12);
    if (scoring.combo > this.lastCombo) this.comboPop = 1;
    if (scoring.score > this.lastScore) this.scorePop = 1;
    this.lastCombo = scoring.combo;
    this.lastScore = scoring.score;
    this.comboPop = Math.max(0, this.comboPop - dt * 5);
    this.scorePop = Math.max(0, this.scorePop - dt * 6);
  }

  draw(ctx, view, { scoring, wave }) {
    const s = view.scale;
    const x = view.safe.left + 14 * s;
    let y = view.safe.top + 12 * s;
    const maxWidth = view.w * 0.55;

    comicText(ctx, 'SCORE', x, y, 14 * s, { align: 'left', baseline: 'top', fill: '#ffd23f', strokeWidth: 4 * s });
    y += 16 * s;
    const score = Math.round(this.displayScore).toLocaleString('en-US');
    comicText(ctx, score, x, y, (34 + this.scorePop * 6) * s, {
      align: 'left', baseline: 'top', strokeWidth: 6 * s, maxWidth,
    });
    y += 42 * s;
    comicText(ctx, `WAVE ${wave}`, x, y, 20 * s, { align: 'left', baseline: 'top', fill: '#3fd0ff', strokeWidth: 5 * s });
    y += 28 * s;

    if (scoring.combo >= 2) {
      const m = scoring.multiplier;
      const color = COMBO_COLORS[Math.min(COMBO_COLORS.length - 1, Math.floor(m / 2))];
      const size = (24 + this.comboPop * 16 + Math.min(m, 10)) * s;
      const wiggle = Math.sin(performance.now() / 60) * 0.04 * Math.min(1, m / 5);
      comicText(ctx, `COMBO x${m}`, x, y + size / 2, size, {
        align: 'left', fill: color, strokeWidth: 6 * s, rotation: -0.06 + wiggle, maxWidth,
      });
      const barY = y + size + 6 * s;
      const barW = 110 * s;
      roundRect(ctx, x, barY, barW, 7 * s, 4 * s);
      ctx.fillStyle = '#0b0620';
      ctx.fill();
      roundRect(ctx, x + 1.5 * s, barY + 1.5 * s, Math.max(0, (barW - 3 * s) * scoring.comboFraction), 4 * s, 2 * s);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}
