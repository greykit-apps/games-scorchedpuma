/* Scorched Puma -- a shot in flight.
 *
 * One tick: gravity, wind and the air act on the velocity, guidance and mag
 * deflectors bend it, then the shot moves in steps of no more than a pixel so
 * nothing thin is tunnelled through. The sky above the field is open; the
 * sides are whatever the round's walls are. AI aiming runs this same code. */
(() => {
  const SP = globalThis.SP, T = SP.Terrain, Tk = SP.Tanks, P = SP.PHYS, K = SP.TANK;
  const Ph = SP.Physics = {};

  Ph.speedFor = power => P.vMax * power / 1000;
  Ph.launch = (t, angle, power) => {
    const a = angle * Math.PI / 180, v = Ph.speedFor(power), m = Tk.muzzle({ ...t, angle });
    return { x: m.x, y: m.y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v };
  };

  /* the world a shot flies in: the state's, or a sim's light copy of it */
  Ph.env = s => ({
    g: P.g * s.opts.gravity,
    wind: s.wind * P.windA,
    drag: s.opts.viscosity * P.dragPerVisc,
    wall: s.wall,
  });

  /* Advance projectile p one tick. Returns null while it flies, or what
   * stopped it: { what: "ground" | "tank" | "wall" | "gone", x, y, tank } */
  Ph.step = (s, p, env) => {
    const t = s.terrain, w = t.w;
    const tgt = p.guide ? s.tanks[p.target] : null;
    const vy0 = p.vy;

    /* forces */
    if (!p.level) p.vy += env.g;
    if (p.guide !== "ballistic" && !p.level && !p.plumb) p.vx += env.wind;
    if (env.drag) { p.vx *= 1 - env.drag; p.vy *= 1 - env.drag; }

    /* guidance, steering toward the chosen target */
    if (tgt && tgt.alive) {
      const c = Tk.centre(tgt);
      if (p.guide === "heat") {
        const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy);
        if (d < SP.BY_ID.heat.reach) {
          const sp = Math.hypot(p.vx, p.vy), a = Math.atan2(p.vy, p.vx), want = Math.atan2(dy, dx);
          let da = want - a;
          while (da > Math.PI) da -= 2 * Math.PI;
          while (da < -Math.PI) da += 2 * Math.PI;
          const na = a + SP.clamp(da, -SP.BY_ID.heat.turn, SP.BY_ID.heat.turn);
          p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
        }
      } else if (p.guide === "horz" && !p.level && p.vy > 0 && p.y >= c.y - 2) {
        /* falling past the target's height: level off and fly at it */
        const sp = Math.max(2, Math.hypot(p.vx, p.vy));
        p.level = true; p.vy = 0; p.vx = Math.sign(c.x - p.x || 1) * sp;
      } else if (p.guide === "vert" && !p.plumb && Math.abs(c.x - p.x) <= Math.max(1, Math.abs(p.vx))) {
        /* over the target: straight down on it */
        const sp = Math.max(2, Math.hypot(p.vx, p.vy));
        p.plumb = true; p.vx = 0; p.vy = sp; p.x = c.x;
      }
    }

    /* mag deflectors push shots away, other than their owner's */
    for (const o of s.tanks) {
      if (!o.mag || !o.alive || o.id === p.owner) continue;
      const c = Tk.centre(o), dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
      if (d < o.mag.reach && d > 1) {
        const f = o.mag.push * (1 - d / o.mag.reach);
        p.vx += dx / d * f; p.vy += dy / d * f;
      }
    }

    if (vy0 < 0 && p.vy >= 0) p.apex = true;

    /* move, a pixel at a time */
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy))));
    for (let i = 0; i < n; i++) {
      p.x += p.vx / n; p.y += p.vy / n;

      /* the walls */
      if (p.x < 0 || p.x > w - 1) {
        const wall = env.wall;
        if (wall === "wrap") p.x = (p.x + w) % w;
        else if (wall === "none") { if (p.x < -8 || p.x > w + 7) return { what: "gone", x: p.x, y: p.y }; continue; }
        else if (wall === "concrete") { p.x = SP.clamp(p.x, 0, w - 1); return { what: "wall", x: p.x, y: p.y }; }
        else {
          const k = wall === "spring" ? 1.25 : wall === "padded" ? 0.45 : 1;
          p.x = p.x < 0 ? -p.x : 2 * (w - 1) - p.x;
          p.vx = -p.vx * k;
          if (wall === "padded") p.vy *= 0.7;
          p.bounces = (p.bounces || 0) + 1;
          s.events.push && s.events.push({ e: "bounce", x: p.x, y: p.y, sim: !!s.sim });
        }
      }
      if (p.y >= t.h - 1) return { what: "ground", x: p.x, y: t.h - 1 };
      if (p.y < 0) continue;                      // above the field: nothing to hit

      /* shields: a force shield turns a shot away, any other stops it at its edge */
      for (const o of s.tanks) {
        if (!o.shield || !o.alive || o.health <= 0) continue;
        if (o.id === p.owner && p.age < 30) continue;   // your own shot leaving your own bubble
        const c = Tk.centre(o), dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
        if (d > SP.SHIELD_R) continue;
        if (o.shield.force && !p.deflected) {
          const nx = dx / (d || 1), ny = dy / (d || 1), dot = p.vx * nx + p.vy * ny;
          if (dot < 0) { p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; }
          p.x = c.x + nx * (SP.SHIELD_R + 1); p.y = c.y + ny * (SP.SHIELD_R + 1);
          p.deflected = true;
          if (!s.sim) Tk.hurt(s, o, 12, null, "deflect");
          return null;
        }
        if (!o.shield.force) return { what: "tank", x: p.x, y: p.y, tank: o };
      }

      /* tanks, then the dirt */
      const hit = Tk.at(s, p.x, p.y, p.age < 12 ? s.tanks[p.owner] : null);
      if (hit) return { what: "tank", x: p.x, y: p.y, tank: hit };
      if (T.solid(t, p.x, p.y)) return { what: "ground", x: p.x, y: p.y };
    }
    p.age++;
    if (p.age > P.maxAge) return { what: "gone", x: p.x, y: p.y };
    return null;
  };
})();
