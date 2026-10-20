// How each version of HIM moves. A behaviour gets the enemy, the frame time
// and the world ({ core, view, rng }) and mutates the enemy's position.

function steer(e, target, dt, speedMul = 1) {
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  e.dirX = dx / dist;
  e.dirY = dy / dist;
  const step = Math.min(dist, e.speed * speedMul * dt);
  e.x += e.dirX * step;
  e.y += e.dirY * step;
  return dist;
}

// Side-to-side sway perpendicular to the direction of travel.
function sway(e, dt, amplitude, frequency) {
  const v = Math.cos(e.age * frequency + e.phase) * amplitude * frequency;
  e.x += -e.dirY * v * dt;
  e.y += e.dirX * v * dt;
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const BEHAVIOURS = {
  drift: {
    update(e, dt, world) {
      steer(e, world.core, dt);
      sway(e, dt, 14 * e.scale, 2.2);
    },
  },

  zigzag: {
    update(e, dt, world) {
      steer(e, world.core, dt);
      sway(e, dt, 36 * e.scale, 7);
    },
  },

  // Fades out, moves while invisible, reappears somewhere slightly different.
  blink: {
    init(e) {
      e.state.phase = 'visible';
      e.state.timer = 1.1 + e.rng() * 0.6;
    },
    update(e, dt, world) {
      const s = e.state;
      s.timer -= dt;
      if (s.phase === 'visible') {
        steer(e, world.core, dt);
        sway(e, dt, 12 * e.scale, 3);
        e.alpha = 1;
        if (s.timer <= 0) { s.phase = 'fading'; s.timer = 0.25; }
      } else if (s.phase === 'fading') {
        steer(e, world.core, dt);
        e.alpha = Math.max(0, s.timer / 0.25);
        if (s.timer <= 0) { s.phase = 'hidden'; s.timer = 0.55 + e.rng() * 0.4; }
      } else if (s.phase === 'hidden') {
        steer(e, world.core, dt, 1.6);
        e.alpha = 0;
        if (s.timer <= 0) {
          const jump = (50 + e.rng() * 40) * e.scale * (e.rng() < 0.5 ? -1 : 1);
          const { w, h } = world.view;
          e.x = clamp(e.x - e.dirY * jump, e.radius, w - e.radius);
          e.y = clamp(e.y + e.dirX * jump, e.radius, h - e.radius);
          s.phase = 'appearing';
          s.timer = 0.2;
          e.teleported = true;
        }
      } else {
        steer(e, world.core, dt);
        e.alpha = 1 - Math.max(0, s.timer / 0.2);
        if (s.timer <= 0) { s.phase = 'visible'; s.timer = 1.0 + e.rng() * 0.8; }
      }
      e.hittable = e.alpha > 0.45;
    },
  },

  // Silly Ruben has legs. He bounds at the core in flat arcs, kicks off the
  // walls, and flips on the way. Same entrance as any boss, then it gets daft.
  parkour: {
    init(e, world) {
      BEHAVIOURS.boss.init(e, world);
      e.state.vx = 0;
      e.state.vy = 0;
      e.state.crouch = 0;
    },
    update(e, dt, world) {
      const s = e.state;
      if (s.phase !== 'attacking') {
        BEHAVIOURS.boss.update(e, dt, world);
        return;
      }
      const g = 1900 * e.scale;
      e.legPhase += dt * 9;
      if (s.crouch > 0) {
        // Landed: a beat squatting before the next leap.
        s.crouch -= dt;
        e.spin = 0;
        if (s.crouch <= 0) {
          const dx = world.core.x - e.x;
          const dy = world.core.y - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          e.dirX = dx / dist;
          e.dirY = dy / dist;
          s.vx = e.dirX * Math.max(e.speed * 3, 170 * e.scale);
          s.vy = -(430 + Math.min(260, dist * 0.35)) * e.scale;
          e.spinRate = (e.rng() < 0.5 ? -1 : 1) * (4 + e.rng() * 4);
        }
        return;
      }
      s.vy += g * dt;
      e.x += s.vx * dt;
      e.y += s.vy * dt;
      e.spin += (e.spinRate ?? 6) * dt;
      // Kick off the side walls instead of leaving the screen.
      const { w, h } = world.view;
      if (e.x < e.radius) { e.x = e.radius; s.vx = Math.abs(s.vx); }
      if (e.x > w - e.radius) { e.x = w - e.radius; s.vx = -Math.abs(s.vx); }
      // He bounds along the bottom and only vaults up as he closes on the
      // core, instead of leaping straight to it and camping there.
      const near = 1 - clamp(Math.abs(e.x - world.core.x) / (w * 0.55), 0, 1);
      const ground = h - e.radius * 0.6;
      const ledge = world.core.y + e.radius * 0.8;
      const floor = ground + (ledge - ground) * near * near;
      if (s.vy > 0 && e.y >= floor) {
        e.y = floor;
        s.vy = 0;
        s.vx *= 0.3;
        s.crouch = 0.22 + e.rng() * 0.12;
        e.squash = 1;
        e.landed = true; // game.js turns this into dust
      }
    },
  },

  // Dramatic entrance from the top, a pause to taunt, then a slow advance.
  boss: {
    init(e, world) {
      e.state.phase = 'entering';
      e.state.hoverX = world.view.w * 0.42;
      e.state.hoverY = Math.max(world.view.h * 0.32, e.radius + 60 * e.scale);
      e.state.timer = 0;
    },
    update(e, dt, world) {
      const s = e.state;
      if (s.phase === 'entering') {
        const k = Math.min(1, dt * 1.6);
        e.x += (s.hoverX - e.x) * k;
        e.y += (s.hoverY - e.y) * k;
        if (Math.abs(s.hoverY - e.y) < 3 * e.scale) { s.phase = 'taunting'; s.timer = 1.9; }
      } else if (s.phase === 'taunting') {
        s.timer -= dt;
        e.y = s.hoverY + Math.sin(e.age * 6) * 6 * e.scale;
        if (s.timer <= 0) s.phase = 'attacking';
      } else {
        steer(e, world.core, dt);
        sway(e, dt, 22 * e.scale, 1.3);
      }
    },
  },
};
