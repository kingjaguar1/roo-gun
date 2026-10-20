// Two kinds of HIM sprite:
// - cartoons (drawn in code) for every regular enemy, the menu and game over;
// - real photos from assets/him/manifest.json, used only for Boss Ruben's reveal.
// Gameplay asks for `hims.random()` or `hims.bossPhoto()`, so adding photos
// never touches game code.
const SPRITE_SIZE = 256;
// The two favourite faces. 'grin' is also drawable if you want it back.
const CARTOON_MOODS = ['smirk', 'scheming'];

export class HimLibrary {
  constructor(name, cartoons, photos) {
    this.name = name;
    this.cartoons = cartoons;
    this.photos = photos;
  }

  // A cartoon Ruben.
  random(rng = Math.random) {
    return this.cartoons[Math.floor(rng() * this.cartoons.length)];
  }

  // A real photo for the boss reveal, or null if none have been added.
  bossPhoto(rng = Math.random) {
    return this.photos.length ? this.photos[Math.floor(rng() * this.photos.length)] : null;
  }
}

const UNLOCK_KEY = 'roogun.unlock';

// The published game ships no photos in its public manifest. Someone with the
// code opens ?unlock=<code> once and their phone remembers it, which points
// the game at a second manifest only that code can name. It is a hidden door,
// not a lock: anyone given the code or the file name sees the photos too.
function unlockCode() {
  let code = null;
  let lock = false;
  try {
    const params = new URLSearchParams(location.search);
    code = params.get('unlock');
    lock = params.has('lock');
  } catch { /* no URL to read */ }
  try {
    if (lock) localStorage.removeItem(UNLOCK_KEY);   // ?lock forgets it again
    else if (code) localStorage.setItem(UNLOCK_KEY, code);
    else code = localStorage.getItem(UNLOCK_KEY);
  } catch { /* private mode: it just won't be remembered */ }
  if (lock) return null;
  return code && /^[\w-]{1,64}$/.test(code) ? code : null;
}

async function readManifest(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.ok) return await res.json();
    if (res.status !== 404) console.warn(`HIM manifest returned ${res.status}`);
  } catch (err) {
    console.warn('Could not read HIM manifest; Boss Ruben stays a cartoon.', err);
  }
  return null;
}

export async function loadHimLibrary(manifestUrl) {
  const url = new URL(manifestUrl, location.href);
  // With a code, try the unlocked manifest first and fall back if it isn't there.
  const code = unlockCode();
  let manifest = code ? await readManifest(new URL(`him-${code}.json`, url)) : null;
  if (!manifest) manifest = await readManifest(url);

  const name = String(manifest?.name || 'HIM');
  const entries = (manifest?.photos ?? []).map(normalizeEntry).filter(Boolean);
  const loaded = await Promise.all(entries.map(async (entry) => {
    try {
      const img = await loadImage(new URL(entry.file, url));
      return makePhotoSprite(img, entry);
    } catch (err) {
      console.warn(`Skipping HIM photo "${entry.file}"`, err);
      return null;
    }
  }));

  const photos = loaded.filter(Boolean);
  return new HimLibrary(name, CARTOON_MOODS.map(makeCartoonSprite), photos);
}

// A photo entry is either "file.jpg" or
// { "file": "file.jpg", "focusX": 0.5, "focusY": 0.4, "zoom": 1.2,
//   "eyes": [[x, y], [x, y]], "mouth": [x, y] }
// Every position is a fraction (0-1) across and down the original photo.
function normalizeEntry(entry) {
  if (typeof entry === 'string') entry = { file: entry };
  if (!entry || typeof entry.file !== 'string') return null;
  return { focusX: 0.5, focusY: 0.42, zoom: 1, ...entry };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function clipCircle(g, S) {
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  g.clip();
}

// The square of the photo that becomes the round sprite.
export function photoCrop(w, h, { focusX, focusY, zoom }) {
  const side = Math.min(w, h) / Math.max(1, zoom);
  return {
    side,
    sx: Math.max(0, Math.min(w - side, focusX * w - side / 2)),
    sy: Math.max(0, Math.min(h - side, focusY * h - side / 2)),
  };
}

// A point on the original photo -> the same point as a fraction of the sprite.
export function photoPointToSprite([px, py], w, h, crop) {
  return [(px * w - crop.sx) / crop.side, (py * h - crop.sy) / crop.side];
}

function makePhotoSprite(img, entry) {
  const S = SPRITE_SIZE;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  clipCircle(g, S);
  // Backdrop shows through photos with transparent (cut-out) backgrounds.
  const bg = g.createRadialGradient(S / 2, S * 0.4, 10, S / 2, S / 2, S * 0.7);
  bg.addColorStop(0, '#fff3b0');
  bg.addColorStop(1, '#ffb347');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const crop = photoCrop(w, h, entry);
  g.drawImage(img, crop.sx, crop.sy, crop.side, crop.side, 0, 0, S, S);
  // The uncropped photo, for anything that wants the whole picture
  // (fx/stageshow.js fills the screen with it).
  c.source = img;
  // Face features for the death stare, in sprite space.
  if (Array.isArray(entry.eyes) && entry.eyes.length === 2) c.eyes = entry.eyes.map((p) => photoPointToSprite(p, w, h, crop));
  if (Array.isArray(entry.mouth)) c.mouth = photoPointToSprite(entry.mouth, w, h, crop);
  return c;
}

// Cartoon Ruben. Pupils look toward the top-right, where the Data Core is.
function makeCartoonSprite(mood) {
  const S = SPRITE_SIZE;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const ellipse = (x, y, rx, ry, fill, rot = 0) => {
    g.beginPath();
    g.ellipse(x * S, y * S, rx * S, ry * S, rot, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  clipCircle(g, S);

  const bg = g.createRadialGradient(S / 2, S * 0.4, 10, S / 2, S / 2, S * 0.7);
  bg.addColorStop(0, '#fff3b0');
  bg.addColorStop(1, '#ffb347');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  ellipse(0.5, 1.08, 0.48, 0.36, '#2b2d42');      // hoodie
  g.fillStyle = '#d99a5f';
  g.fillRect(S * 0.42, S * 0.62, S * 0.16, S * 0.12); // neck
  ellipse(0.25, 0.47, 0.05, 0.08, '#e8b27a');      // ears
  ellipse(0.75, 0.47, 0.05, 0.08, '#e8b27a');
  ellipse(0.5, 0.46, 0.25, 0.29, '#f1c27d');       // head
  g.lineWidth = S * 0.018;
  g.strokeStyle = '#3a2410';
  g.stroke();

  // Hair with a quiff.
  g.fillStyle = '#4a2c14';
  g.beginPath();
  g.ellipse(S * 0.5, S * 0.3, S * 0.265, S * 0.15, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(S * 0.28, S * 0.3);
  g.quadraticCurveTo(S * 0.45, S * 0.02, S * 0.76, S * 0.22);
  g.quadraticCurveTo(S * 0.58, S * 0.18, S * 0.28, S * 0.3);
  g.fill();

  // Stubble.
  g.fillStyle = 'rgba(74, 44, 20, 0.35)';
  for (let i = 0; i < 40; i++) {
    const a = Math.PI * (0.15 + (i / 40) * 0.7);
    const r = 0.2 + ((i * 7) % 5) * 0.012;
    g.beginPath();
    g.arc(S * (0.5 + Math.cos(a) * r), S * (0.5 + Math.sin(a) * r * 1.05), S * 0.006, 0, Math.PI * 2);
    g.fill();
  }

  // Eyes looking up and right, at your data.
  ellipse(0.41, 0.44, 0.05, 0.04, '#fff');
  ellipse(0.59, 0.44, 0.05, 0.04, '#fff');
  ellipse(0.43, 0.43, 0.022, 0.025, '#1b1b1b');
  ellipse(0.61, 0.43, 0.022, 0.025, '#1b1b1b');

  // Eyebrows.
  g.strokeStyle = '#3a2410';
  g.lineWidth = S * 0.022;
  g.lineCap = 'round';
  const brow = (x1, y1, x2, y2) => {
    g.beginPath();
    g.moveTo(x1 * S, y1 * S);
    g.lineTo(x2 * S, y2 * S);
    g.stroke();
  };
  if (mood === 'scheming') {
    brow(0.35, 0.37, 0.46, 0.40);
    brow(0.65, 0.37, 0.54, 0.40);
  } else if (mood === 'grin') {
    brow(0.35, 0.37, 0.46, 0.36);
    brow(0.54, 0.36, 0.65, 0.37);
  } else {
    brow(0.35, 0.38, 0.46, 0.38);
    brow(0.54, 0.35, 0.65, 0.33);
  }

  // Nose.
  g.lineWidth = S * 0.014;
  g.beginPath();
  g.moveTo(S * 0.5, S * 0.47);
  g.quadraticCurveTo(S * 0.47, S * 0.53, S * 0.51, S * 0.535);
  g.stroke();

  // Mouth.
  if (mood === 'smirk') {
    g.lineWidth = S * 0.018;
    g.beginPath();
    g.moveTo(S * 0.42, S * 0.6);
    g.quadraticCurveTo(S * 0.52, S * 0.63, S * 0.62, S * 0.56);
    g.stroke();
  } else {
    const wide = mood === 'scheming' ? 0.13 : 0.1;
    g.beginPath();
    g.moveTo(S * (0.5 - wide), S * 0.58);
    g.quadraticCurveTo(S * 0.5, S * 0.72, S * (0.5 + wide), S * 0.58);
    g.closePath();
    g.fillStyle = '#5a1a1a';
    g.fill();
    g.stroke();
    g.save();
    g.clip();
    g.fillStyle = '#fff';
    g.fillRect(S * (0.5 - wide), S * 0.58, S * wide * 2, S * 0.035);
    g.restore();
  }
  return c;
}
