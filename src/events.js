// Tiny event bus so gameplay, effects, audio and scoring stay decoupled.
export class Events {
  constructor() {
    this.listeners = new Map();
  }

  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) {
    const list = this.listeners.get(name);
    if (list) this.listeners.set(name, list.filter((f) => f !== fn));
  }

  emit(name, payload) {
    const list = this.listeners.get(name);
    if (list) for (const fn of list.slice()) fn(payload);
  }
}
