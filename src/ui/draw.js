// Shared canvas drawing helpers for the comic-book look.
export const FONT_FAMILY = '"Bangers", Impact, "Arial Black", "Helvetica Neue", sans-serif';
export const font = (size) => `bold ${Math.max(1, Math.round(size))}px ${FONT_FAMILY}`;

export async function loadFonts(timeoutMs = 1500) {
  if (!document.fonts?.load) return;
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  try {
    await Promise.race([document.fonts.load(font(32), 'ROO GUN 0123456789'), timeout]);
  } catch {
    // Offline or blocked: the fallback fonts are fine.
  }
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Star / explosion burst. `jitter` (array of multipliers) makes it jagged.
export function starPath(ctx, x, y, points, outer, inner, rotation = 0, jitter = null) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rotation + (i * Math.PI) / points;
    let r = i % 2 === 0 ? outer : inner;
    if (jitter) r *= jitter[i % jitter.length];
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function polygonPath(ctx, x, y, sides, r, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * Math.PI * 2) / sides;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Chunky comic text: offset shadow, thick outline, coloured fill.
export function comicText(ctx, text, x, y, size, opts = {}) {
  const {
    fill = '#fff', stroke = '#0b0620', align = 'center', baseline = 'middle',
    strokeWidth = size * 0.2, shadow = true, rotation = 0, maxWidth = 0,
  } = opts;
  if (maxWidth > 0) size = fitFontSize(ctx, text, maxWidth, size);
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.font = font(size);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  ctx.lineWidth = strokeWidth;
  if (shadow) {
    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.strokeText(text, size * 0.05, size * 0.09);
    ctx.fillText(text, size * 0.05, size * 0.09);
  }
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function fitFontSize(ctx, text, maxWidth, size) {
  ctx.font = font(size);
  const width = ctx.measureText(text).width;
  return width > maxWidth ? (size * maxWidth) / width : size;
}

export function emoji(ctx, char, x, y, size, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.font = `${Math.round(size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, 0, 0);
  ctx.restore();
}
