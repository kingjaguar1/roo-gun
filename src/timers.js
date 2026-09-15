// Delayed callbacks that run on game time (so they pause with hit-stop).
export class Timers {
  constructor() {
    this.pending = [];
  }

  after(seconds, fn) {
    this.pending.push({ remaining: seconds, fn });
  }

  update(dt) {
    if (!this.pending.length) return;
    const due = [];
    this.pending = this.pending.filter((t) => {
      t.remaining -= dt;
      if (t.remaining <= 0) { due.push(t.fn); return false; }
      return true;
    });
    for (const fn of due) fn();
  }

  clear() {
    this.pending = [];
  }
}
