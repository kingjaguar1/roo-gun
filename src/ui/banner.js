import { comicText } from './draw.js';
import { CONFIG } from '../config.js';
import { VARIANTS, variantLabel } from '../enemies/variants.js';
import { easeOutBack } from '../math.js';

const QUIPS = [
  '{NAME} WANTS YOUR DATA',
  "HE'S BACK",
  'THERE ARE MORE OF HIM',
  'HOW MANY {NAME}S ARE THERE?',
  '{NAME} HAS NO CHILL',
  'HE BROUGHT FRIENDS. THEY ARE ALSO HIM.',
  'HE READ THE TERMS AND CONDITIONS',
  'HE KNOWS YOUR WI-FI PASSWORD',
  'PROTECT THE DATA',
  'HE HAS BEEN PRACTISING',
  'STOP HIM',
];

function subtitleFor(wave, name) {
  const stareChance = CONFIG.boss.revealDeathChance;
  if (wave.boss && stareChance > 0) return `DEATH STARE: 1 IN ${Math.round(1 / stareChance)} CHANCE IT KILLS YOU`;
  if (wave.intro) return VARIANTS[wave.intro].intro;
  return QUIPS[(wave.number * 7) % QUIPS.length].replaceAll('{NAME}', name.toUpperCase());
}

// "WAVE 3" slides in with a subtitle; boss waves get a hazard-stripe warning.
export function drawWaveBanner(ctx, view, waves, name, time) {
  if (waves.state !== 'banner' || !waves.wave) return;
  const s = view.scale;
  const t = waves.bannerProgress;
  const wave = waves.wave;
  const cy = view.h * 0.42;

  // In, hold, out.
  const enter = Math.min(1, t / 0.2);
  const exit = t > 0.82 ? (t - 0.82) / 0.18 : 0;
  const offset = (1 - easeOutBack(enter)) * -view.w + exit * exit * view.w * 1.2;
  const alpha = 1 - exit;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(offset, 0);

  const bandH = 118 * s;
  ctx.save();
  ctx.translate(view.w / 2, cy);
  ctx.rotate(-0.05);
  if (wave.boss) {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-view.w, -bandH / 2, view.w * 2, bandH);
    ctx.fillStyle = '#0b0620';
    const stripe = 28 * s;
    for (let x = -view.w; x < view.w; x += stripe * 2) {
      const shift = (time * 60 * s) % (stripe * 2);
      ctx.beginPath();
      ctx.moveTo(x + shift, -bandH / 2);
      ctx.lineTo(x + shift + stripe, -bandH / 2);
      ctx.lineTo(x + shift + stripe - bandH * 0.4, bandH / 2);
      ctx.lineTo(x + shift - bandH * 0.4, bandH / 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(11, 6, 32, 0.55)';
    ctx.fillRect(-view.w, -bandH / 2 + 10 * s, view.w * 2, bandH - 20 * s);
  } else {
    ctx.fillStyle = '#0b0620';
    ctx.fillRect(-view.w, -bandH / 2, view.w * 2, bandH);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-view.w, -bandH / 2 + 5 * s, view.w * 2, 4 * s);
    ctx.fillRect(-view.w, bandH / 2 - 9 * s, view.w * 2, 4 * s);
  }
  ctx.restore();

  const maxWidth = view.w - 30 * s;
  if (wave.boss) {
    const blink = Math.sin(time * 18) > -0.2;
    if (blink) comicText(ctx, '⚠ WARNING ⚠', view.w / 2, cy - 30 * s, 26 * s, { fill: '#ff2e63', rotation: -0.05, maxWidth });
    comicText(ctx, `${variantLabel(VARIANTS.boss, name)} APPROACHING`, view.w / 2, cy + 8 * s, 34 * s, { fill: '#ffd23f', rotation: -0.05, maxWidth });
    comicText(ctx, subtitleFor(wave, name), view.w / 2, cy + 40 * s, 17 * s, { fill: '#fff', rotation: -0.05, maxWidth });
  } else {
    comicText(ctx, `WAVE ${wave.number}`, view.w / 2, cy - 12 * s, 56 * s, { fill: '#ffd23f', rotation: -0.05, maxWidth });
    comicText(ctx, subtitleFor(wave, name), view.w / 2, cy + 32 * s, 18 * s, { fill: '#fff', rotation: -0.05, maxWidth });
  }
  ctx.restore();
}
