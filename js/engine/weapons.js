/* Scorched Puma -- what each weapon does.
 *
 * Everything that happens after the trigger is an entity in s.ents, ticked
 * until it is done: shots in flight, blasts, rollers, digger worms, sandhogs,
 * napalm flames, liquid dirt, beams. A turn resolves when the list is empty,
 * the dirt has settled and no tank is falling. */
(() => {
  const SP = globalThis.SP, T = SP.Terrain, Tk = SP.Tanks, Ph = SP.Physics, K = SP.K, KT = SP.TANK;
  const Wp = SP.Weapons = {};
  const PI = Math.PI;

  const owner = (s, e) => s.tanks[e.owner] || null;

  /* ---- a blast: grows, does its work at full size, fades ---- */
  Wp.boom = (s, x, y, r, dmg, by, o = {}) => {
    const grow = Math.round(SP.clamp(r / K * 0.55, 8, 36));
    s.ents.push({ k: "boom", x, y, r, dmg, owner: by ? by.id : -1, t: 0, grow, dur: grow + 14, riot: !!o.riot, death: !!o.death, funky: !!o.funky, colour: o.colour || null });
    s.events.push({ e: "boom", x, y, r, riot: !!o.riot, death: !!o.death });
  };
  const boomTick = (s, e) => {
    e.t++;
    if (e.t === e.grow) {
      const hang = s.opts.suspend > 0 && SP.rand(s.rng) * 100 < s.opts.suspend;
      T.carve(s.terrain, e.x, e.y, e.r, { fall: !hang });
      const by = owner(s, e);
      /* whoever opens a hole under a tank owns the fall that follows */
      if (by) for (const t of s.tanks) if (t.alive && Math.abs(t.x - e.x) < e.r + 8 * K && t.y >= e.y - e.r) t.lastHitBy = by.id;
      if (!e.riot) Tk.blast(s, e.x, e.y, e.r, e.dmg, by);
    }
    return e.t < e.dur;
  };

  /* ---- firing ---- */
  Wp.fire = (s, t, wid) => {
    const w = SP.BY_ID[wid];
    s.events.push({ e: "fire", tank: t.id, weapon: wid, kind: w.kind });
    if (w.kind === "riotcharge") return riotCharge(s, t, w);
    if (w.kind === "laser") return laser(s, t, w);
    if (w.kind === "plasma") return plasma(s, t, w);
    const v = Ph.launch(t, t.angle, t.power);
    let guide = null, target = -1;
    if (t.guide && Tk.take(t, t.guide)) {
      guide = t.guide;
      const tg = s.tanks[t.target];
      target = tg && tg.alive && tg.health > 0 && tg !== t ? tg.id : (Tk.nearestEnemy(s, t) || {}).id ?? -1;
    }
    t.guide = null;
    let contact = false;
    if (t.contact && ["roller", "digger", "sandhog"].includes(w.kind)) {
      contact = Tk.take(t, "contact");
      if (!(t.inv.contact > 0)) t.contact = false;
    }
    s.ents.push(Wp.shot(t.id, wid, v, { guide, target, contact }));
  };
  Wp.shot = (ownerId, wid, v, o = {}) => ({
    k: "proj", w: wid, owner: ownerId, x: v.x, y: v.y, vx: v.vx, vy: v.vy, age: 0,
    trail: [[v.x, v.y]], guide: o.guide || null, target: o.target ?? -1, contact: !!o.contact,
    hop: o.hop || 0, bomblet: !!o.bomblet, warhead: !!o.warhead,
  });

  const projTick = (s, p, env) => {
    const hit = Ph.step(s, p, env);
    if (p.trail.length < 900) p.trail.push([p.x, p.y]);
    const w = SP.BY_ID[p.w];
    if (!hit && w.kind === "mirv" && p.apex && !p.warhead) { split(s, p, w); return false; }
    if (!hit) return true;
    land(s, p, w, hit);
    return false;
  };

  const split = (s, p, w) => {
    for (let i = 0; i < w.n; i++) {
      const vx = p.vx + w.spread * (i - (w.n - 1) / 2);
      s.ents.push(Wp.shot(p.owner, p.w, { x: p.x, y: p.y, vx, vy: p.vy }, { warhead: true }));
    }
    s.events.push({ e: "split", x: p.x, y: p.y });
  };

  /* ---- landing ---- */
  const land = (s, p, w, hit) => {
    const by = s.tanks[p.owner] || null;
    /* the first thing down from a shot is where it landed, for next turn's correction */
    if (by && by.lastShot && by.lastShot.x === null && hit.what !== "gone") { by.lastShot.x = Math.round(hit.x); by.lastShot.y = Math.round(hit.y); }
    s.events.push({ e: "land", x: hit.x, y: hit.y, what: hit.what, weapon: p.w });
    if (w.kind === "tracer") {
      (w.smoke ? s.smoke : s.traces).push({ pts: p.trail, colour: by ? by.colour : "#fff" });
      return;
    }
    if (hit.what === "gone") return;
    const x = hit.x, y = hit.y, onTank = hit.what === "tank";
    switch (w.kind) {
      case "missile":
        return Wp.boom(s, x, y, w.r, w.dmg, by);
      case "mirv":
        return Wp.boom(s, x, y, w.r, w.dmg, by);
      case "leapfrog": {
        Wp.boom(s, x, y, w.hops[p.hop], w.hopDmg[p.hop], by);
        if (p.hop + 1 < w.hops.length && hit.what !== "wall") {
          const vx = SP.clamp(p.vx * 0.75, -4 * K, 4 * K), vy = -Math.max(2.4 * K, Math.abs(p.vy) * 0.55);
          s.ents.push(Wp.shot(p.owner, p.w, { x, y: y - 4 * K, vx, vy }, { hop: p.hop + 1 }));
        }
        return;
      }
      case "funky": {
        if (p.bomblet) return Wp.boom(s, x, y, w.br, w.bdmg, by, { funky: true });
        Wp.boom(s, x, y, w.r, w.dmg, by, { funky: true });
        for (let i = 0; i < w.n; i++) {
          const v = { x, y: y - 3 * K, vx: SP.randRange(s.rng, -2.8, 2.8) * K, vy: SP.randRange(s.rng, -4.8, -2) * K };
          s.ents.push(Wp.shot(p.owner, p.w, v, { bomblet: true }));
        }
        return;
      }
      case "napalm": {
        for (let i = 0; i < w.n; i++) {
          s.ents.push({ k: "fire", x: Math.round(x + SP.randRange(s.rng, -5, 5) * K), y, life: Math.round(w.life * SP.randRange(s.rng, 0.6, 1.1)), burn: w.burn, owner: p.owner, hot: w.id === "hotnapalm", t: SP.randInt(s.rng, 0, 9) });
        }
        s.events.push({ e: "napalm", x, y });
        return;
      }
      case "roller":
        if (p.contact || onTank) return Wp.boom(s, x, y, w.r, w.dmg, by);
        return roll(s, p, w, x);
      case "riotbomb":
        return Wp.boom(s, x, y, w.r, 0, by, { riot: true });
      case "digger":
        if (p.contact) return Wp.boom(s, x, y, 12 * K, 45, by);
        for (let i = 0; i < w.n; i++) s.ents.push({ k: "worm", x, y, a: SP.randRange(s.rng, 0.12, 0.88) * PI, steps: w.steps, wid: w.w, owner: p.owner });
        s.events.push({ e: "dig", x, y });
        return;
      case "sandhog":
        if (p.contact || onTank) return Wp.boom(s, x, y, w.r, w.dmg, by);
        for (let i = 0; i < w.n; i++) {
          s.ents.push({ k: "hog", x, y: y + 2 * K, dir: i % 2 ? 1 : -1, dy: SP.randRange(s.rng, -0.15, 0.6) * K, steps: w.steps + i * 6, w: w.id, owner: p.owner });
        }
        s.events.push({ e: "dig", x, y });
        return;
      case "dirt":
        T.fill(s.terrain, x, y, w.r, 0, s.rng);
        s.events.push({ e: "dirt", x, y, r: w.r });
        return;
      case "liquid":
        for (let i = 0; i < w.n; i++) s.ents.push({ k: "liquid", x: Math.round(x + SP.randRange(s.rng, -4, 4) * K), y, amt: 10, life: 700, still: 0 });
        s.events.push({ e: "dirt", x, y, r: 10 });
        return;
      case "dirtcharge":
        T.heap(s.terrain, x, w.r, w.r * 0.75);
        s.events.push({ e: "dirt", x, y, r: w.r });
        return;
      case "disrupter":
        T.loosenAll(s.terrain);
        s.ents.push({ k: "ring", x, y, t: 0, dur: 30 });
        s.events.push({ e: "disrupt", x, y });
        return;
    }
  };

  /* ---- rollers: downhill until they can't, then bang ---- */
  const roll = (s, p, w, x) => {
    const t = s.terrain;
    x = SP.clamp(Math.round(x), 0, t.w - 1);
    const y = T.surface(t, x, Math.max(0, Math.round(p.y - 6 * K)));
    const l = T.surface(t, x - 5, y - 12), r = T.surface(t, x + 5, y - 12);
    const dir = l > r ? -1 : r > l ? 1 : (p.vx < 0 ? -1 : 1);
    s.ents.push({ k: "roller", x, y, dir, w: w.id, owner: p.owner, steps: 500, acc: 0 });
    s.events.push({ e: "roll", x, y });
  };
  const rollerTick = (s, e) => {
    const t = s.terrain, w = SP.BY_ID[e.w], by = owner(s, e);
    e.acc += 1.6 * K;
    while (e.acc >= 1) {
      e.acc -= 1;
      let nx = e.x + e.dir;
      if (nx < 0 || nx > t.w - 1) {
        if (s.wall === "wrap") nx = (nx + t.w) % t.w;
        else if (s.wall === "none") return false;
        else if (s.wall === "concrete") { Wp.boom(s, e.x, e.y - 3, w.r, w.dmg, by); return false; }
        else { e.dir = -e.dir; continue; }
      }
      const ny = T.surface(t, nx, e.y - 5);
      const tank = Tk.at(s, nx, ny - 3) || Tk.at(s, nx, e.y - 3);
      if (tank || ny < e.y - 1 || --e.steps <= 0) { Wp.boom(s, e.x, e.y - 3, w.r, w.dmg, by); return false; }
      e.x = nx; e.y = ny;
    }
    return true;
  };

  /* ---- diggers: worms that eat tunnels, harming nothing ---- */
  const wormTick = (s, e) => {
    const t = s.terrain;
    for (let i = 0; i < 3; i++) {
      e.a = SP.clamp(e.a + SP.randRange(s.rng, -0.4, 0.4), 0.02 * PI, 0.98 * PI);
      e.x += Math.cos(e.a); e.y += Math.sin(e.a);
      if (e.x < 0 || e.x > t.w - 1 || e.y > t.h - 3) return false;
      T.carve(t, e.x, e.y, e.wid, { fall: false });
      if (--e.steps <= 0) return false;
    }
    return true;
  };

  /* ---- sandhogs: burrow at the nearest tank, then go off ---- */
  const hogTick = (s, e) => {
    const t = s.terrain, w = SP.BY_ID[e.w], by = owner(s, e);
    if (e.steps === w.steps || e.aim === undefined) {
      /* pick the nearest tank that isn't ours, and burrow its way */
      let best = null, bd = Infinity;
      for (const o of s.tanks) if (o.alive && o.health > 0 && o.id !== e.owner) { const d = Math.abs(o.x - e.x); if (d < bd) { bd = d; best = o; } }
      e.aim = best ? best.id : -1;
      if (best) e.dir = Math.sign(best.x - e.x) || e.dir;
    }
    const tg = s.tanks[e.aim];
    for (let i = 0; i < 2; i++) {
      e.x += e.dir * 0.8 * K;
      if (tg && tg.alive) e.y += SP.clamp((tg.y - 3 - e.y) * 0.05, -0.5 * K, 0.5 * K) + e.dy * 0.2;
      else e.y += e.dy * 0.3;
      if (e.x < 0 || e.x > t.w - 1 || e.y > t.h - 3) { Wp.boom(s, SP.clamp(e.x, 0, t.w - 1), Math.min(e.y, t.h - 3), w.r, w.dmg, by); return false; }
      T.carve(t, e.x, e.y, 2 * K, { fall: false });
      const hitTank = Tk.at(s, e.x, e.y) || Tk.at(s, e.x + e.dir * 3 * K, e.y);
      const surfaced = !T.solid(t, e.x, e.y + 3 * K) && !T.solid(t, e.x, e.y - 3 * K) && e.steps < w.steps - 6;
      if (hitTank || surfaced || --e.steps <= 0) { Wp.boom(s, e.x, e.y, w.r, w.dmg, by); return false; }
    }
    return true;
  };

  /* ---- napalm: flames that run downhill and burn what they touch ---- */
  /* Napalm and liquid dirt run like a liquid: downhill first, and where
   * many crowd into one column they stand higher there, so a pool spreads
   * out level across a hollow instead of piling into one pixel. `occ` counts
   * how many of the kind are in each column this tick. */
  let occ = { fire: null, liquid: null };
  const flow = (s, e) => {
    const t = s.terrain, o = occ[e.k];
    const here = T.surface(t, e.x, Math.max(0, e.y - 9));
    const level = here - (o ? Math.floor((o[e.x] - 1) / 2) : 0);
    e.y = here - 1;
    const l = e.x > 0 ? T.surface(t, e.x - 1, Math.max(0, e.y - 6)) : -1;
    const r = e.x < t.w - 1 ? T.surface(t, e.x + 1, Math.max(0, e.y - 6)) : -1;
    const move = (d, n) => { if (o) { o[e.x]--; o[e.x + d]++; } e.x += d; e.y = n - 1; };
    if (l > level && (l >= r || SP.rand(s.rng) < 0.5)) { move(-1, l); return true; }
    if (r > level) { move(1, r); return true; }
    /* level, or a lip a pixel high: spill over it now and then, so a
       notch never holds a pool */
    if (SP.rand(s.rng) < 0.35) {
      const d = SP.rand(s.rng) < 0.5 ? -1 : 1, n = d < 0 ? l : r;
      if (n >= level - 1 && n > 0) move(d, n);
    }
    return false;                 // spreading is not running downhill: liquid dirt still sets
  };
  const fireTick = (s, e) => {
    e.t++;
    if (e.t % 2 === 0) flow(s, e);
    for (const o of s.tanks) {
      if (!o.alive || o.health <= 0) continue;
      if (Math.abs(o.x - e.x) <= KT.half + 1 && e.y >= o.y - KT.tall - 3 && e.y <= o.y + 3) {
        o.burn = (o.burn || 0) + e.burn;
        if (o.burn >= 1) { const n = Math.floor(o.burn); o.burn -= n; Tk.hurt(s, o, n, owner(s, e), "fire"); }
      }
    }
    return --e.life > 0;
  };

  /* ---- liquid dirt: flows like napalm, then sets where it pools ---- */
  const liquidTick = (s, e) => {
    for (let i = 0; i < 3; i++) {
      if (flow(s, e)) { e.still = 0; continue; }
      if (++e.still >= 3) {
        if (!T.setPixel(s.terrain, e.x, e.y, T.ADDED + (e.x % 3))) return false;
        e.y--;
        if (--e.amt <= 0) return false;
      }
    }
    return --e.life > 0;
  };

  /* ---- the weapons that never leave the tank ---- */
  const riotCharge = (s, t, w) => {
    const a = t.angle * PI / 180, cx = t.x, cy = t.y - KT.turretY, ter = s.terrain;
    let n = 0;
    for (let y = Math.max(0, Math.floor(cy - w.r)); y <= Math.min(ter.h - 2, Math.ceil(cy + w.r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - w.r)); x <= Math.min(ter.w - 1, Math.ceil(cx + w.r)); x++) {
        const dx = x - cx, dy = cy - y, d = Math.hypot(dx, dy);
        if (d > w.r || d < 1) continue;
        let da = Math.atan2(dy, dx) - a;
        while (da > PI) da -= 2 * PI;
        while (da < -PI) da += 2 * PI;
        if (Math.abs(da) <= w.cone) {
          const i = y * ter.w + x;
          if (ter.px[i] && ter.px[i] !== T.BEDROCK) { ter.px[i] = 0; n++; }
        }
      }
    }
    T.mark(ter, cx - w.r, cy - w.r, cx + w.r, cy + w.r);
    T.loosen(ter, cx - w.r, cx + w.r);
    s.ents.push({ k: "riot", x: cx, y: cy, a, r: w.r, cone: w.cone, t: 0, dur: 20 });
  };

  const laser = (s, t, w) => {
    const a = t.angle * PI / 180, m = Tk.muzzle(t), ter = s.terrain;
    const len = w.len * t.power / 1000;
    let x = m.x, y = m.y, hit = null;
    for (let i = 0; i < len; i++) {
      x += Math.cos(a); y -= Math.sin(a);
      if (x < 0 || x > ter.w - 1 || y > ter.h - 2) break;
      if (y < 0) continue;
      const o = Tk.at(s, x, y, t);
      if (o) { hit = o; break; }
      if (T.solid(ter, x, y)) T.carve(ter, x, y, 1.5 * K);
    }
    if (hit) Tk.hurt(s, hit, w.dmg, t, "laser");
    s.ents.push({ k: "beam", x0: m.x, y0: m.y, x1: x, y1: y, t: 0, dur: 30, colour: t.colour });
  };

  const plasma = (s, t, w) => {
    const r = 20 * K + w.r * t.power / 1000;
    s.ents.push({ k: "plasma", x: t.x, y: t.y - KT.mid, r, dmg: w.dmg, owner: t.id, t: 0, grow: 20, dur: 36 });
  };
  const plasmaTick = (s, e) => {
    if (++e.t === e.grow) {
      for (const o of s.tanks) {
        if (!o.alive || o.health <= 0 || o.id === e.owner) continue;
        const c = Tk.centre(o), d = Math.hypot(c.x - e.x, c.y - e.y);
        if (d < e.r) Tk.hurt(s, o, e.dmg * (1 - d / e.r), owner(s, e), "plasma");
      }
    }
    return e.t < e.dur;
  };

  const fade = (s, e) => ++e.t < e.dur;

  /* ---- one tick of everything in flight ---- */
  Wp.tick = s => {
    const env = Ph.env(s), list = s.ents;
    occ = { fire: new Int16Array(s.terrain.w), liquid: new Int16Array(s.terrain.w) };
    for (const e of list) if (occ[e.k]) occ[e.k][SP.clamp(e.x, 0, s.terrain.w - 1)]++;
    s.ents = [];
    const keep = [];
    for (const e of list) {
      let alive;
      switch (e.k) {
        case "proj": alive = projTick(s, e, env); break;
        case "boom": alive = boomTick(s, e); break;
        case "roller": alive = rollerTick(s, e); break;
        case "worm": alive = wormTick(s, e); break;
        case "hog": alive = hogTick(s, e); break;
        case "fire": alive = fireTick(s, e); break;
        case "liquid": alive = liquidTick(s, e); break;
        case "plasma": alive = plasmaTick(s, e); break;
        default: alive = fade(s, e);
      }
      if (alive) keep.push(e);
    }
    /* what this tick spawned goes after what was already flying */
    s.ents = keep.concat(s.ents);
    return s.ents.length > 0;
  };
})();
