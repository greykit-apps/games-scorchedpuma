/* Scorched Puma -- the computer players.
 *
 * Every AI aims the same way underneath: it flies candidate shots through
 * the engine's own physics (wind, walls, shields and all) and keeps the one
 * that lands nearest its target. What makes them different is who they pick
 * on, what they fire, how much they miss by, and how they learn. */
(() => {
  const SP = globalThis.SP, Tk = SP.Tanks, Ph = SP.Physics, T = SP.Terrain;
  const AI = SP.AI = {};

  const gauss = r => {
    const u = Math.max(1e-9, SP.rand(r)), v = SP.rand(r);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  /* a light copy of the world a sim shot flies in: no events kept, no money */
  const simWorld = s => ({ sim: true, terrain: s.terrain, tanks: s.tanks, opts: s.opts, wind: s.wind, wall: s.wall, events: { push() {} } });

  AI.simulate = (s, t, angle, power, w = null) => {
    const sim = w || simWorld(s), env = Ph.env(sim);
    const v = Ph.launch(t, angle, power);
    const p = { ...v, owner: t.id, age: 0, guide: null };
    for (let i = 0; i < 1500; i++) {
      const hit = Ph.step(sim, p, env);
      if (hit) return hit;
    }
    return { what: "gone", x: p.x, y: p.y };
  };

  /* how far a landing is from what we want, and whether it would hurt us */
  const miss = (s, t, target, hit, r) => {
    if (hit.what === "gone") return 1e6;
    if (hit.tank === t) return 1e5;
    if (hit.tank === target) return 0;
    const c = Tk.centre(target);
    let d = Math.hypot(hit.x - c.x, (hit.y - c.y) * 0.7);
    const self = Math.hypot(hit.x - t.x, hit.y - (t.y - SP.TANK.mid));
    if (self < r + 10 * SP.K) d += 2000;
    return d;
  };

  /* Find an angle and power that land on target.
   *   exact   a fine search (Lazy Boy, Cyborg)
   *   anyWay  try both directions, for bank shots off the walls (Poolshark)
   *   flat    among good shots, prefer the flattest (Shooter) */
  AI.solve = (s, t, target, { exact = false, anyWay = false, flat = false, r = 12 * SP.K } = {}) => {
    const sim = simWorld(s), maxP = Tk.maxPower(t);
    if (maxP < 40) return null;
    const right = target.x > t.x;
    let a0 = right ? 8 : 92, a1 = right ? 88 : 172;
    if (anyWay || s.wall === "wrap") { a0 = 8; a1 = 172; }
    const aStep = exact ? 2 : 4, pStep = exact ? 25 : 50;
    const cands = [];
    for (let a = a0; a <= a1; a += aStep) {
      for (let p = 80; p <= maxP; p += pStep) {
        const d = miss(s, t, target, AI.simulate(s, t, a, p, sim), r);
        cands.push({ a, p, d });
      }
    }
    if (!cands.length) return null;
    cands.sort((x, y) => x.d - y.d);
    /* refine the few best */
    let best = cands[0];
    for (const c of cands.slice(0, exact ? 5 : 3)) {
      for (let da = -aStep; da <= aStep; da += 1) {
        for (let dp = -pStep; dp <= pStep; dp += exact ? 5 : 10) {
          const a = SP.clamp(c.a + da, 0, 180), p = SP.clamp(c.p + dp, 0, maxP);
          const d = miss(s, t, target, AI.simulate(s, t, a, p, sim), r);
          const better = d < best.d - 0.01 || (flat && d <= best.d + 3 && Math.abs(90 - a) > Math.abs(90 - best.a));
          if (better) best = { a, p, d };
        }
      }
    }
    return { angle: best.a, power: Math.round(best.p), err: best.d };
  };

  /* ---- choices ---- */
  const enemiesOf = (s, t) => s.tanks.filter(o => o.alive && o.health > 0 && Tk.enemies(s, t, o));
  const pickTarget = (s, t, type) => {
    const es = enemiesOf(s, t);
    if (!es.length) return null;
    const near = () => es.reduce((a, b) => Math.abs(a.x - t.x) <= Math.abs(b.x - t.x) ? a : b);
    switch (type) {
      case "moron": return SP.randPick(s.rng, es);
      case "spoiler": return es.reduce((a, b) => (b.score > a.score || (b.score === a.score && b.cash > a.cash)) ? b : a);
      case "cyborg": return es.reduce((a, b) => b.health < a.health || (b.health === a.health && Math.abs(b.x - t.x) < Math.abs(a.x - t.x)) ? b : a);
      default: return near();
    }
  };

  const buried = (s, t) => {
    let n = 0;
    for (let y = t.y - 13; y > t.y - 33; y--) for (let x = t.x - 3; x <= t.x + 3; x++) if (T.solid(s.terrain, x, y)) n++;
    return n > 27;
  };

  const DAMAGE_KINDS = ["missile", "leapfrog", "funky", "mirv", "napalm", "roller", "sandhog"];
  const owned = t => SP.WEAPONS.filter(w => Tk.count(t, w.id) > 0);
  const reachR = w => w.r || (w.kind === "napalm" ? 18 : 12) * SP.K;

  const pickWeapon = (s, t, target, type) => {
    const mine = owned(t);
    if (buried(s, t)) {
      const dig = mine.find(w => w.kind === "riotcharge") || mine.find(w => w.kind === "riotbomb");
      if (dig) return { w: dig, up: true };
    }
    const dist = Math.hypot(target.x - t.x, target.y - t.y);
    if (type === "moron") return { w: SP.randPick(s.rng, mine.filter(w => w.kind !== "tracer")) || SP.BY_ID.babymissile };
    /* never anything that would catch us in our own blast */
    const safe = mine.filter(w => DAMAGE_KINDS.includes(w.kind) && reachR(w) + 22 * SP.K < dist);
    if ((type === "chooser" || type === "cyborg") && dist < 70 * SP.K && mine.some(w => w.kind === "plasma")) return { w: SP.BY_ID.plasma };
    if (!safe.length) return { w: SP.BY_ID.babymissile };
    const byDmg = safe.slice().sort((a, b) => (b.dmg || 30) - (a.dmg || 30));
    if (type === "cyborg") {
      /* the smallest thing that finishes the job, else the biggest */
      const kill = byDmg.slice().reverse().find(w => (w.dmg || 0) * 0.8 >= target.health + (target.shield ? target.shield.hp : 0));
      return { w: kill || byDmg[0] };
    }
    if (type === "chooser") {
      /* rollers into valleys, napalm on a tank in a hollow, else the biggest */
      const low = target.y > SP.Terrain.surface(s.terrain, target.x - 18) + 6 && target.y > SP.Terrain.surface(s.terrain, target.x + 18) + 6;
      if (low) { const w = byDmg.find(w => w.kind === "napalm" || w.kind === "roller"); if (w) return { w }; }
      return { w: byDmg[0] };
    }
    /* the rest: usually something strong, now and then whatever comes to paw */
    return { w: SP.rand(s.rng) < 0.7 ? byDmg[0] : SP.randPick(s.rng, byDmg) };
  };

  /* items worth using before the shot */
  const prepare = (s, t, type) => {
    if (type === "moron") {
      if (SP.rand(s.rng) < 0.3) for (const id of Object.keys(t.inv)) if (SP.BY_ID[id].type === "item" && SP.rand(s.rng) < 0.3) Tk.use(s, t, id);
      return;
    }
    while (t.health < 70 && t.inv.battery > 0 && t.health < SP.TANK.health) Tk.use(s, t, "battery");
    if (!t.shield) for (const id of ["heavyshield", "forceshield", "shield"]) if (t.inv[id] > 0) { Tk.use(s, t, id); break; }
    if (!t.shield && !t.mag) for (const id of ["supermag", "mag"]) if (t.inv[id] > 0) { Tk.use(s, t, id); break; }
  };

  /* ---- the plan for this turn: { weapon, angle, power, target } ---- */
  AI.plan = (s, t) => {
    const type = t.aiReal || "shooter", spec = SP.AI_BY_ID[type];
    prepare(s, t, type);
    const target = pickTarget(s, t, type);
    if (!target) return { weapon: "babymissile", angle: 90, power: 200, target: -1 };
    t.target = target.id;
    const { w, up } = pickWeapon(s, t, target, type);
    if (up) return { weapon: w.id, angle: SP.clamp(t.angle, 60, 120), power: Math.min(500, Tk.maxPower(t)), target: target.id };
    if (w.kind === "plasma") return { weapon: w.id, angle: t.angle, power: Tk.maxPower(t), target: target.id };

    const maxP = Tk.maxPower(t);
    let angle, power;
    const memo = t.memo && t.memo.target === target.id && t.memo.round === s.round ? t.memo : null;
    if (type === "tosser" && memo) {
      /* learn from the last miss: push the power by how far off it landed */
      const span = Math.max(40, Math.abs(memo.x - t.x));
      const off = (target.x - memo.x) * Math.sign(target.x - t.x || 1);
      angle = memo.angle;
      power = memo.power + off / span * memo.power * 0.85;
      const k = Math.pow(0.5, memo.n);
      angle += gauss(s.rng) * spec.noiseA * 0.3 * k;
      power += gauss(s.rng) * spec.noiseP * 0.4 * k;
    } else {
      const how = { exact: type === "cyborg", anyWay: type === "poolshark", flat: type === "shooter", r: reachR(w) };
      let sol = AI.solve(s, t, target, how);
      /* out of reach on what health is left: top up and look again */
      while (type !== "moron" && (!sol || sol.err > 25) && t.inv.battery > 0 && t.health < SP.TANK.health) {
        Tk.use(s, t, "battery");
        sol = AI.solve(s, t, target, how);
      }
      if (!sol) return { weapon: "babymissile", angle: t.angle, power: Math.max(50, maxP), target: target.id };
      angle = sol.angle; power = sol.power;
      angle += gauss(s.rng) * spec.noiseA;
      power += gauss(s.rng) * spec.noiseP;
      if (type === "cyborg" && sol.err > 6 && t.inv.heat > 0) t.guide = "heat";
    }
    angle = Math.round(SP.clamp(angle, 0, 180));
    power = Math.round(SP.clamp(power, 30, maxP));
    /* remember where this one will land, for a Tosser's next go */
    if (type === "tosser") {
      const hit = AI.simulate(s, t, angle, power);
      t.memo = { target: target.id, angle, power, x: hit.x, n: memo ? memo.n + 1 : 1, round: s.round };
    }
    return { weapon: w.id, angle, power, target: target.id };
  };
})();
