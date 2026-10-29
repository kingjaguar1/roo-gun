// Every sound is synthesised with Web Audio, so there are no audio files.
// Browsers (especially iOS) only allow audio after a tap: call unlock() from input.
const MUTE_KEY = 'roogun.muted';
const VOLUME = 0.7;
const REBUILD_GAP = 1500; // ms: don't replace a dead context more than this often
const THROTTLE = { shot: 0.03, hit: 0.03, kill: 0.035, echo: 0.06, combo: 0.05, stolen: 0.25, boing: 0.12, whoosh: 0.1 };

// A short silent WAV, built in memory: no audio file, no network request.
// Only used by keepSpeakerAwake() on iOS without the Audio Session API.
function silentWavUrl(seconds = 0.05, rate = 8000) {
  const frames = Math.round(seconds * rate);
  const bytes = new ArrayBuffer(44 + frames * 2);
  const v = new DataView(bytes);
  const tag = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  tag(0, 'RIFF');
  v.setUint32(4, 36 + frames * 2, true);
  tag(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);        // fmt chunk size
  v.setUint16(20, 1, true);         // PCM
  v.setUint16(22, 1, true);         // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);  // byte rate
  v.setUint16(32, 2, true);         // block align
  v.setUint16(34, 16, true);        // bits per sample
  tag(36, 'data');
  v.setUint32(40, frames * 2, true);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

// A soft-knee clipping curve. Feeding a sawtooth through this is what makes
// the difference between a laugh and a monster's laugh.
const GROWL_CURVE = (() => {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 3.4);
  return curve;
})();

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function writeMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
}

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = readMuted();
    this.lastPlayed = new Map();
    this.started = false;
    this.silenceKeeper = null;
    this.lastRebuild = 0;
    this.watching = false;
  }

  // Safe to call on every tap: builds the graph once, then keeps nudging the
  // context awake. Phones need the nudging; a desktop is running after one call.
  unlock() {
    if (!this.ctx && !this.build()) return;
    // Re-asserted on every tap: the session type goes away with the session,
    // so claiming it once at startup isn't enough.
    if (!this.muted) this.setSession('playback');
    this.keepSpeakerAwake();
    this.wake();
    // iOS hands over the speaker only once a source has actually played inside a
    // gesture, so push silence through until the context reports it is running.
    if (!this.started) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      src.connect(this.ctx.destination);
      src.start(0);
      this.started = this.ctx.state === 'running';
    }
  }

  // The whole graph in one place, so a context another app killed can be
  // thrown away and replaced.
  build() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    this.ctx = new AudioContextClass();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : VOLUME;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    this.master.connect(limiter);
    limiter.connect(this.ctx.destination);
    this.noise = this.makeNoise(2);
    this.started = false;
    this.ctx.addEventListener?.('statechange', () => { if (this.ctx.state !== 'running') this.wake(); });
    this.watchPage();
    return true;
  }

  // Music (or a call) taking the speaker can leave iOS's context dead for good:
  // resume() reports success, nothing is audible, and pausing the music doesn't
  // give it back. Only a brand new context does.
  rebuild() {
    const dead = this.ctx;
    this.ctx = null;
    try { dead?.close?.(); } catch { /* already gone */ }
    this.lastPlayed.clear();
    return this.build();
  }

  // resume() is async on phones, and iOS parks the context in a non-standard
  // 'interrupted' state after a call, a lock screen or a switch to another app.
  async wake() {
    if (!this.ctx) return false;
    if (this.ctx.state === 'running') return true;
    if (!this.muted) this.setSession('playback');
    try { await this.ctx.resume?.(); } catch { /* fall through to the rebuild */ }
    if (this.ctx.state === 'running') return true;
    // A resume that "worked" but left the context stuck means it's dead.
    // Replace it, but not on every frame.
    if (Date.now() - this.lastRebuild < REBUILD_GAP) return false;
    this.lastRebuild = Date.now();
    if (!this.rebuild()) return false;
    try { await this.ctx.resume?.(); } catch { return false; }
    return this.ctx.state === 'running';
  }

  // Coming back from the background leaves the context asleep with no tap to
  // ride on, so wake it whenever the page is in front again. Page-level only:
  // the per-context listener is wired in build(), which can run more than once.
  watchPage() {
    if (this.watching) return;
    this.watching = true;
    const wake = () => this.wake();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
    // iOS reports the audio session being taken away and handed back.
    try { navigator.audioSession?.addEventListener?.('statechange', wake); } catch { /* unsupported */ }
  }

  // Unlocking on pointerdown alone isn't enough on every phone: older iOS only
  // counts touchend/click, and taps can land outside the canvas.
  listenForTaps(target = document) {
    const unlock = () => this.unlock();
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      target.addEventListener(type, unlock, { passive: true, capture: true });
    }
  }

  // iOS mutes "ambient" audio with the Ring/Silent switch, and a page that only
  // synthesises oscillators counts as ambient. Declaring playback claims the
  // speaker so the game is audible on silent; ambient hands it back when muted.
  setSession(type) {
    try {
      if ('audioSession' in navigator) navigator.audioSession.type = type;
    } catch { /* unsupported, or not allowed here */ }
  }

  // Older iOS has no Audio Session API. There, a looping (near-silent) media
  // element is what moves the whole page into a playback session. The WAV is
  // built here as a data URI: still no audio files, still no network requests.
  keepSpeakerAwake() {
    if ('audioSession' in navigator || this.silenceKeeper || this.muted) return;
    try {
      const el = new Audio(silentWavUrl());
      el.loop = true;
      el.playsInline = true;
      el.volume = 0.001;
      el.play().catch(() => { /* no gesture yet; the next tap tries again */ });
      this.silenceKeeper = el;
    } catch { /* no Audio element: the game is simply quiet on silent */ }
  }

  toggleMute() {
    this.muted = !this.muted;
    writeMuted(this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : VOLUME, this.ctx.currentTime, 0.02);
    // Give the speaker back when muted so the player's own music can resume.
    this.setSession(this.muted ? 'ambient' : 'playback');
    if (this.muted) {
      this.silenceKeeper?.pause();
      this.silenceKeeper = null;
    } else {
      this.keepSpeakerAwake();
    }
    return this.muted;
  }

  play(name, opts = {}, retry = true) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state !== 'running') {
      // Don't lose the sound that woke the context (the first tap's click).
      if (retry) this.wake().then((running) => { if (running) this.play(name, opts, false); });
      return;
    }
    const now = this.ctx.currentTime;
    const gap = THROTTLE[name] ?? 0.02;
    if (now - (this.lastPlayed.get(name) ?? -1) < gap) return;
    this.lastPlayed.set(name, now);
    SOUNDS[name]?.(this, now + 0.005, opts);
  }

  // ---- building blocks ----

  makeNoise(seconds) {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  envelope(start, duration, volume, attack = 0.005) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    g.connect(this.master);
    return g;
  }

  tone({ type = 'square', from, to = from, start, duration, volume = 0.2, attack = 0.005, vibrato = 0 }) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    if (vibrato) {
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = 6;
      depth.gain.value = vibrato;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + duration + 0.05);
    }
    osc.connect(this.envelope(start, duration, volume, attack));
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  // A buzzy "voice": sawtooth through vowel-like bandpass formants.
  voice({ from, to = from * 0.8, start, duration, volume = 0.3 }) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    const out = this.envelope(start, duration, volume, 0.01);
    for (const [freq, q, level] of [[650, 5, 1], [1100, 7, 0.6], [2400, 9, 0.25]]) {
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freq;
      band.Q.value = q;
      const gain = this.ctx.createGain();
      gain.gain.value = level;
      osc.connect(band);
      band.connect(gain);
      gain.connect(out);
    }
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  // A throat rather than a mouth: sawtooth, wobbled, clipped, then rolled off
  // so it stays low and gravelly instead of fizzing.
  growl({ from, to = from * 0.8, start, duration, volume = 0.4, wobble = 23 }) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);

    // A fast shallow waver in the pitch, like a voice that can't hold steady.
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    lfo.frequency.value = wobble;
    depth.gain.value = from * 0.07;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + duration + 0.05);

    const shaper = this.ctx.createWaveShaper();
    shaper.curve = GROWL_CURVE;
    shaper.oversample = '2x';
    const tame = this.ctx.createBiquadFilter();
    tame.type = 'lowpass';
    tame.frequency.setValueAtTime(1500, start);
    tame.frequency.exponentialRampToValueAtTime(700, start + duration);
    osc.connect(shaper);
    shaper.connect(tame);
    tame.connect(this.envelope(start, duration, volume, 0.014));
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  noiseBurst({ start, duration, volume = 0.5, type = 'lowpass', from = 3000, to = 200, q = 0.8 }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    src.connect(filter);
    filter.connect(this.envelope(start, duration, volume, 0.003));
    src.start(start, Math.random() * 1);
    src.stop(start + duration + 0.05);
  }
}

const SOUNDS = {
  click(a, t) {
    a.tone({ type: 'sine', from: 660, to: 990, start: t, duration: 0.07, volume: 0.15 });
  },

  shot(a, t) {
    a.tone({ type: 'square', from: 1300, to: 180, start: t, duration: 0.11, volume: 0.09 });
    a.tone({ type: 'sine', from: 2600, to: 900, start: t, duration: 0.05, volume: 0.05 });
  },

  hit(a, t) {
    a.noiseBurst({ start: t, duration: 0.08, volume: 0.35, type: 'bandpass', from: 2000, to: 600, q: 1.5 });
    a.tone({ type: 'triangle', from: 320, to: 110, start: t, duration: 0.09, volume: 0.22 });
  },

  kill(a, t, { power = 1 } = {}) {
    const p = Math.min(power, 6);
    a.noiseBurst({ start: t, duration: 0.3 + 0.22 * p, volume: Math.min(1, 0.55 + 0.1 * p), from: 5000, to: 70 });
    a.tone({ type: 'sine', from: 170, to: 38, start: t, duration: 0.25 + 0.18 * p, volume: Math.min(0.8, 0.4 + 0.1 * p) });
    if (p >= 2) a.noiseBurst({ start: t + 0.09, duration: 0.5 + 0.15 * p, volume: 0.5, from: 1800, to: 60 });
  },

  echo(a, t) {
    SOUNDS.kill(a, t, { power: 1.4 });
  },

  combo(a, t, { combo = 2 } = {}) {
    const semitones = Math.min(combo, 18);
    a.tone({ type: 'triangle', from: 440 * Math.pow(2, semitones / 12), start: t + 0.03, duration: 0.1, volume: 0.1 });
  },

  comboLost(a, t) {
    a.tone({ type: 'triangle', from: 420, to: 140, start: t, duration: 0.3, volume: 0.12 });
  },

  stolen(a, t) {
    for (let i = 0; i < 4; i++) {
      a.tone({ type: 'square', from: i % 2 ? 660 : 880, start: t + i * 0.13, duration: 0.12, volume: 0.09, attack: 0.002 });
    }
    a.tone({ type: 'sawtooth', from: 520, to: 70, start: t, duration: 0.6, volume: 0.1 });
  },

  waveStart(a, t) {
    [523, 659, 784, 1047].forEach((f, i) => {
      a.tone({ type: 'triangle', from: f, start: t + i * 0.07, duration: 0.12, volume: 0.12 });
    });
  },

  waveCleared(a, t) {
    [784, 988, 1175, 1568].forEach((f, i) => {
      a.tone({ type: 'square', from: f, start: t + i * 0.06, duration: 0.1, volume: 0.06 });
    });
  },

  bossWarning(a, t) {
    for (let i = 0; i < 4; i++) {
      a.tone({ type: 'sawtooth', from: 220, to: 110, start: t + i * 0.36, duration: 0.3, volume: 0.13 });
      a.tone({ type: 'square', from: 55, start: t + i * 0.36, duration: 0.3, volume: 0.1 });
    }
  },

  bossArrive(a, t) {
    a.noiseBurst({ start: t, duration: 1.2, volume: 0.6, from: 600, to: 40 });
    a.tone({ type: 'sine', from: 90, to: 30, start: t, duration: 1.2, volume: 0.7 });
  },

  // Evil grin: a sparkly "ting", then a low "heh-heh-heh-heh".
  evilGrin(a, t) {
    a.tone({ type: 'sine', from: 2400, to: 3200, start: t, duration: 0.25, volume: 0.12 });
    a.tone({ type: 'sine', from: 3600, start: t + 0.05, duration: 0.2, volume: 0.06 });
    for (let i = 0; i < 4; i++) {
      const at = t + 0.32 + i * 0.19;
      a.noiseBurst({ start: at, duration: 0.05, volume: 0.12, type: 'bandpass', from: 1600, to: 1200, q: 1 });
      a.voice({ from: 150 - i * 12, start: at + 0.02, duration: 0.13, volume: 0.35 });
    }
  },

  // Laser eyes: a wobbling buzz, a sizzle and an explosion at the gun.
  laser(a, t) {
    a.tone({ type: 'sawtooth', from: 1800, to: 120, start: t, duration: 0.9, volume: 0.14, vibrato: 60 });
    a.tone({ type: 'square', from: 90, to: 60, start: t, duration: 0.9, volume: 0.12 });
    a.noiseBurst({ start: t, duration: 0.9, volume: 0.35, type: 'bandpass', from: 3000, to: 800, q: 2 });
    SOUNDS.kill(a, t + 0.05, { power: 3 });
  },

  // Evil Ruben: MWAH HA HA HA. An octave below a human laugh, dragged
  // through a waveshaper, with a sub underneath so it lands in your chest.
  evilLaugh(a, t) {
    // MWAH - swells up into the shout, then sags away.
    a.growl({ from: 92, to: 148, start: t, duration: 0.17, volume: 0.5, wobble: 16 });
    a.growl({ from: 148, to: 104, start: t + 0.16, duration: 0.34, volume: 0.46 });
    a.tone({ type: 'sine', from: 46, to: 34, start: t, duration: 0.62, volume: 0.5 });

    // HA HA HA HA - each one lower, rougher and a little slower.
    for (let i = 0; i < 4; i++) {
      const at = t + 0.56 + i * 0.225;
      const f = 132 - i * 12;
      a.noiseBurst({ start: at, duration: 0.045, volume: 0.16, type: 'bandpass', from: 900, to: 480, q: 1.2 });
      a.growl({ from: f * 1.18, to: f * 0.78, start: at + 0.01, duration: 0.18, volume: 0.44 });
      a.tone({ type: 'sine', from: f / 2, to: f / 2.7, start: at, duration: 0.22, volume: 0.32 });
    }
    // The rumble he leaves behind.
    a.tone({ type: 'sine', from: 40, to: 28, start: t + 0.5, duration: 1.2, volume: 0.35, attack: 0.08 });
  },

  // Silly Ruben clearing a hurdle.
  whoosh(a, t) {
    a.noiseBurst({ start: t, duration: 0.28, volume: 0.3, type: 'bandpass', from: 500, to: 2600, q: 1.1 });
    a.tone({ type: 'sine', from: 300, to: 900, start: t, duration: 0.22, volume: 0.07 });
  },

  // Superstar Ruben: a crowd going up, then a fanfare he has not earned.
  crowdRoar(a, t) {
    // The roar is filtered noise swelling and falling away.
    a.noiseBurst({ start: t, duration: 2.2, volume: 0.45, type: 'bandpass', from: 700, to: 1600, q: 0.6 });
    a.noiseBurst({ start: t + 0.1, duration: 1.9, volume: 0.3, type: 'highpass', from: 2200, to: 3000 });
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      a.tone({ type: 'square', from: f, start: t + 0.35 + i * 0.1, duration: 0.3, volume: 0.075, attack: 0.01 });
    });
    a.tone({ type: 'sawtooth', from: 131, start: t + 0.35, duration: 1.1, volume: 0.09, attack: 0.02, vibrato: 4 });
  },

  // Silly Ruben: the spring in his new legs.
  boing(a, t) {
    a.tone({ type: 'sine', from: 180, to: 900, start: t, duration: 0.16, volume: 0.16, vibrato: 40 });
    a.tone({ type: 'triangle', from: 900, to: 220, start: t + 0.14, duration: 0.22, volume: 0.12, vibrato: 30 });
  },

  // Dun dun DUNNN.
  bossReveal(a, t) {
    a.noiseBurst({ start: t, duration: 0.4, volume: 0.6, type: 'highpass', from: 6000, to: 1500 });
    [[196, 0.18], [185, 0.18], [147, 1.1]].reduce((at, [f, d]) => {
      a.tone({ type: 'sawtooth', from: f, start: at, duration: d, volume: 0.14, attack: 0.01, vibrato: d > 1 ? 5 : 0 });
      a.tone({ type: 'square', from: f / 2, start: at, duration: d, volume: 0.1, attack: 0.01 });
      return at + d + 0.06;
    }, t + 0.15);
  },

  bossDown(a, t) {
    SOUNDS.kill(a, t, { power: 6 });
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      a.tone({ type: 'square', from: f, start: t + 0.9 + i * 0.09, duration: 0.18, volume: 0.07 });
    });
  },

  coreBreak(a, t) {
    SOUNDS.kill(a, t, { power: 4 });
    a.tone({ type: 'sawtooth', from: 900, to: 40, start: t, duration: 1.4, volume: 0.12 });
  },

  victory(a, t) {
    [523, 659, 784, 1047].forEach((f, i) => a.tone({ type: 'square', from: f, start: t + i * 0.12, duration: 0.14, volume: 0.08 }));
    [523, 659, 784].forEach((f) => a.tone({ type: 'triangle', from: f, start: t + 0.5, duration: 1.2, volume: 0.1, vibrato: 4 }));
  },

  // The sad trombone.
  gameOver(a, t) {
    const notes = [392, 370, 349];
    notes.forEach((f, i) => a.tone({ type: 'sawtooth', from: f, start: t + i * 0.42, duration: 0.38, volume: 0.1, attack: 0.03 }));
    a.tone({ type: 'sawtooth', from: 330, to: 310, start: t + notes.length * 0.42, duration: 1.2, volume: 0.1, attack: 0.03, vibrato: 9 });
  },
};

// Hooks sounds up to game events.
export function connectAudio(events, audio) {
  events.on('shot', () => audio.play('shot'));
  events.on('hit', () => audio.play('hit'));
  events.on('kill', ({ power, combo, echo }) => {
    if (echo) {
      audio.play('echo');
      return;
    }
    audio.play('kill', { power });
    if (combo >= 2) audio.play('combo', { combo });
  });
  events.on('stolen', () => audio.play('stolen'));
  events.on('comboLost', () => audio.play('comboLost'));
  events.on('waveStart', (wave) => audio.play(wave.boss ? 'bossWarning' : 'waveStart'));
  events.on('waveCleared', () => audio.play('waveCleared'));
  events.on('bossIncoming', () => audio.play('bossArrive'));
  events.on('bossReveal', () => audio.play('bossReveal'));
  events.on('stareCharge', () => audio.play('evilGrin'));
  events.on('rubenStare', () => audio.play('laser'));
  events.on('bossPersona', (key) => {
    const sound = { evil: 'evilLaugh', showman: 'crowdRoar', silly: 'boing' }[key];
    if (sound) audio.play(sound);
  });
  events.on('parkourLand', () => audio.play('boing'));
  events.on('parkourLeap', () => audio.play('whoosh'));
  events.on('bossDown', () => audio.play('bossDown'));
  events.on('dataGone', () => audio.play('coreBreak'));
}
