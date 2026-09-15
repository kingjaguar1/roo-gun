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
