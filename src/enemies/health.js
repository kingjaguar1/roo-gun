export class Health {
  constructor(max) {
    this.max = max;
    this.hp = max;
  }

  // Returns true when this damage was the killing blow.
  damage(amount = 1) {
    if (this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    return this.hp === 0;
  }

  get dead() { return this.hp <= 0; }
  get fraction() { return this.max > 0 ? this.hp / this.max : 0; }
}
