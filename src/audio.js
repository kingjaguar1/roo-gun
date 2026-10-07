// Every sound is synthesised with Web Audio, so there are no audio files.
// Browsers (especially iOS) only allow audio after a tap: call unlock() from input.
const MUTE_KEY = 'roogun.muted';
const VOLUME = 0.7;
const THROTTLE = { shot: 0.03, hit: 0.03, kill: 0.035, echo: 0.06, combo: 0.05, stolen: 0.25 };

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
  }

  // Safe to call on every tap: builds the graph once, then keeps nudging the
  // context awake. Phones need the nudging; a desktop is running after one call.
  unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : VOLUME;
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 8;
      this.master.connect(limiter);
      limiter.connect(this.ctx.destination);
      this.noise = this.makeNoise(2);
      this.watchForSleep();
    }
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

  // resume() is async on phones, and iOS parks the context in a non-standard
  // 'interrupted' state after a call, a lock screen or a switch to another app.
  wake() {
    if (!this.ctx || this.ctx.state === 'running') return Promise.resolve(true);
    return Promise.resolve(this.ctx.resume?.())
      .then(() => this.ctx.state === 'running', () => false);
  }

  // Coming back from the background leaves the context asleep with no tap to
  // ride on, so wake it whenever the page is in front again.
  watchForSleep() {
    const wake = () => this.wake();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
    this.ctx.addEventListener?.('statechange', () => { if (this.ctx.state !== 'running') wake(); });
  }

  // Unlocking on pointerdown alone isn't enough on every phone: older iOS only
  // counts touchend/click, and taps can land outside the canvas.
  listenForTaps(target = document) {
    const unlock = () => this.unlock();
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      target.addEventListener(type, unlock, { passive: true, capture: true });
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    writeMuted(this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : VOLUME, this.ctx.currentTime, 0.02);
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
  events.on('bossDown', () => audio.play('bossDown'));
  events.on('dataGone', () => audio.play('coreBreak'));
}
