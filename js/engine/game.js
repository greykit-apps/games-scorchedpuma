/* Scorched Puma -- a match, round by round and turn by turn.
 *
 * Phases: "shop" (between rounds, before the first too), "aim" (a tank's
 * turn), "resolve" (shots and their aftermath running), "roundOver" and
 * "matchOver". The match is deterministic from its seed and the commands
 * given; at every "aim" it can be saved and restored exactly. */
(() => {
  const SP = globalThis.SP, T = SP.Terrain, Tk = SP.Tanks, Wp = SP.Weapons, E = SP.Economy;
  const G = SP.Game = {};

  G.newMatch = (setup, seed = (Math.random() * 2 ** 32) >>> 0) => {
    const opts = { ...SP.DEFAULT_OPTS, ...(setup.opts || {}) };
    /* the field's width, fixed for the match: what the page asked for, even, in bounds */
    const w = SP.clamp(Math.round((setup.w || SP.W) / 2) * 2, SP.W, SP.MAX_W);
    const s = {
      v: 1, seed, rng: SP.rng(seed), opts, w,
      tanks: [], round: 0, phase: "shop",
      terrain: T.make(w), wind: 0, wall: "none", sky: "plain", dirt: 0,
      ents: [], events: [], smoke: [], traces: [],
      order: { ids: [], i: 0, dead: [] },
      pending: [], calm: 0, ticks: 0, history: [],
    };
    const real = SP.AIS.filter(a => a.id !== "unknown").map(a => a.id);
    s.tanks = setup.players.map((p, i) => {
      const t = Tk.make(p, i);
      if (t.kind === "ai") t.aiReal = t.ai === "unknown" ? SP.randPick(s.rng, real) : t.ai;
      t.cash = opts.cash;
      return t;
    });
    return s;
  };

  G.current = s => s.tanks[s.order.ids[s.order.i]] || null;
  G.living = s => Tk.living(s);

  /* the computer players shop; the humans' shop is a screen */
  G.aiShop = s => { for (const t of s.tanks) if (t.kind === "ai") E.aiShop(s, t); };

  G.startRound = s => {
    s.round++;
    const o = s.opts, r = s.rng;
    s.terrain = T.make(s.w || SP.W);
    const land = o.land === "random" ? SP.randPick(r, SP.LANDS) : o.land;
    T.generate(s.terrain, r, { land, bumpiness: o.bumpiness });
    s.land = land;
    s.sky = o.sky === "random" ? SP.randPick(r, SP.SKIES) : o.sky;
    s.dirt = SP.randInt(r, 0, 5);
    s.wall = pickWall(s);
    s.wind = o.wind === "none" ? 0 : SP.randInt(r, -o.maxWind, o.maxWind);
    s.ents = []; s.smoke = []; s.traces = []; s.pending = [];
    for (const t of s.tanks) {
      Object.assign(t, { alive: true, health: SP.TANK.health, dying: 0, shield: null, mag: null, guide: null, contact: false,
        fall: null, fuel: 0, earned: 0, pay: { dmg: 0, kill: 0, survive: 0, penalty: 0 }, roundKills: 0, interest: 0, memo: null, lastHitBy: -1, killedBy: -1, burn: 0, target: -1, lastShot: null });
      t.power = Math.min(t.power || 500, Tk.maxPower(t));
      if (!Tk.count(t, t.weapon)) t.weapon = "babymissile";
    }
    Tk.place(s);
    for (const t of s.tanks) {
      /* Auto Defense raises the best shield you own before the first shot */
      if (t.inv.autodefense > 0) for (const id of ["heavyshield", "forceshield", "shield"]) if (t.inv[id] > 0) { Tk.use(s, t, id); break; }
    }
    s.order = { ids: turnOrder(s), i: 0, dead: [], quiet: 0 };
    s.phase = "aim";
    s.calm = 0;
    s.events.push({ e: "round", round: s.round });
    s.events.push({ e: "turn", tank: G.current(s).id });
  };

  const pickWall = s => {
    const m = s.opts.walls;
    return m === "random" || m === "erratic" ? SP.randPick(s.rng, Object.keys(SP.WALLS)) : m;
  };

  const turnOrder = s => {
    const ids = s.tanks.map(t => t.id);
    const o = s.opts.order;
    if (o === "robin") { const k = (s.round - 1) % ids.length; return ids.slice(k).concat(ids.slice(0, k)); }
    for (let i = ids.length - 1; i > 0; i--) { const j = SP.randInt(s.rng, 0, i); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    if (o === "losers") ids.sort((a, b) => s.tanks[a].score - s.tanks[b].score);
    if (o === "winners") ids.sort((a, b) => s.tanks[b].score - s.tanks[a].score);
    return ids;
  };

  /* ---- a human's hands on the controls ---- */
  G.setAim = (s, angle, power) => {
    const t = G.current(s);
    if (!t || s.phase !== "aim") return;
    t.angle = SP.clamp(Math.round(angle), 0, 180);
    t.power = SP.clamp(Math.round(power), 0, Tk.maxPower(t));
  };
  G.cycleWeapon = (s, d = 1) => {
    const t = G.current(s);
    if (!t) return;
    const list = SP.WEAPONS.filter(w => Tk.count(t, w.id) > 0);
    const i = list.findIndex(w => w.id === t.weapon);
    t.weapon = list[(i + d + list.length) % list.length].id;
  };

  /* ---- firing ----
   * Sequential: the shot goes now. Synchronous: it is held until every tank
   * has aimed, then they all go at once. */
  G.fire = (s, cmd = {}) => {
    const t = G.current(s);
    if (!t || s.phase !== "aim") return false;
    if (cmd.weapon) t.weapon = cmd.weapon;
    if (!Tk.count(t, t.weapon)) t.weapon = "babymissile";
    if (cmd.angle !== undefined) t.angle = SP.clamp(Math.round(cmd.angle), 0, 180);
    if (cmd.power !== undefined) t.power = SP.clamp(Math.round(cmd.power), 0, Tk.maxPower(t));
    if (s.opts.mode === "synchronous") {
      s.pending.push({ id: t.id, weapon: t.weapon, angle: t.angle, power: t.power, guide: t.guide, target: t.target });
      t.guide = null;
      if (!advance(s, true)) launchAll(s);
      else s.events.push({ e: "turn", tank: G.current(s).id });
      return true;
    }
    Tk.take(t, t.weapon);
    remember(t);
    const w = t.weapon;
    Wp.fire(s, t, w);
    if (!Tk.count(t, w)) t.weapon = "babymissile";
    s.phase = "resolve";
    s.calm = 0;
    return true;
  };

  /* the shot just fired, for the console's corrections: where it was aimed,
     and (filled in when it comes down) where it landed */
  const remember = t => { t.lastShot = { angle: t.angle, power: t.power, weapon: t.weapon, x: null, y: null }; };

  const launchAll = s => {
    for (const c of s.pending) {
      const t = s.tanks[c.id];
      if (!t.alive || t.health <= 0) continue;
      Object.assign(t, { angle: c.angle, power: c.power, weapon: c.weapon, guide: c.guide, target: c.target });
      Tk.take(t, c.weapon);
      remember(t);
      Wp.fire(s, t, c.weapon);
      if (!Tk.count(t, c.weapon)) t.weapon = "babymissile";
    }
    s.pending = [];
    s.phase = "resolve";
    s.calm = 0;
  };

  /* the next living tank in the order; false when we came round to the start
   * (synchronous: everyone has aimed) */
  const advance = (s, stopAtWrap) => {
    const n = s.order.ids.length;
    for (let k = 1; k <= n; k++) {
      const j = s.order.i + k;
      if (stopAtWrap && j >= n) return false;
      const t = s.tanks[s.order.ids[j % n]];
      if (t.alive && t.health > 0) { s.order.i = j % n; return true; }
    }
    return false;
  };

  /* ---- one engine tick ---- */
  G.tick = s => {
    s.ticks++;
    if (s.phase !== "resolve") return;
    const a = Wp.tick(s);
    const b = T.settle(s.terrain, 3);
    const c = Tk.tick(s);
    if (a || b || c) { s.calm = 0; s.resolveTicks = (s.resolveTicks || 0) + 1; }
    else s.calm++;
    /* a resolve that never ends is ended: nothing in 1.5 ran this long */
    if (s.resolveTicks > 9000) { s.ents = []; s.terrain.loose.fill(0); s.terrain.looseN = 0; }
    if (s.calm >= 10) endTurn(s);
  };

  const endTurn = s => {
    s.resolveTicks = 0;
    s.traces = [];
    s.order.quiet = s.hurtThisTurn ? 0 : (s.order.quiet || 0) + 1;
    s.hurtThisTurn = false;
    const live = Tk.living(s);
    const oneSide = s.opts.teams && live.length > 0 && live.every(t => t.faction === live[0].faction);
    if (live.length <= 1 || oneSide) return roundOver(s, live);
    /* nobody has hurt anybody for a long while: the round is a draw (not in
       1.5, where such a round ran until someone gave up) */
    if (s.order.quiet > live.length * 10) return roundOver(s, [], true);
    if (s.opts.wind === "changing") s.wind = SP.clamp(s.wind + SP.randInt(s.rng, -5, 5), -s.opts.maxWind, s.opts.maxWind);
    if (s.opts.walls === "erratic") s.wall = pickWall(s);
    if (s.opts.mode === "synchronous") {
      s.order.i = -1;
      advance(s, false);
    } else advance(s, false);
    s.phase = "aim";
    s.events.push({ e: "turn", tank: G.current(s).id });
  };

  const roundOver = (s, winners, stalemate = false) => {
    E.roundEnd(s, winners);
    s.history.push({
      round: s.round,
      winners: winners.map(t => t.id),
      earned: s.tanks.map(t => t.earned),
    });
    s.phase = s.round >= s.opts.rounds ? "matchOver" : "roundOver";
    s.history[s.history.length - 1].stalemate = stalemate;
    s.events.push({ e: "roundOver", winners: winners.map(t => t.id), last: s.phase === "matchOver", stalemate });
  };

  G.toShop = s => { if (s.phase === "roundOver") s.phase = "shop"; };

  /* standings: score, then cash */
  G.standings = s => s.tanks.slice().sort((a, b) => b.score - a.score || b.cash - a.cash);
  G.teamScores = s => {
    const out = { puma: 0, wolf: 0 };
    for (const t of s.tanks) out[t.faction] += t.score;
    return out;
  };

  /* ---- a computer player's turn, all at once (headless; the page animates it) ---- */
  G.aiTurn = s => {
    const t = G.current(s);
    const plan = SP.AI.plan(s, t);
    return G.fire(s, plan);
  };

  /* ---- save and restore, at an aim, a shop or between rounds ---- */
  G.save = s => {
    if (s.phase === "resolve") return null;
    const { terrain, ents, events, ...rest } = s;
    return JSON.parse(JSON.stringify({
      ...rest,
      rng: s.rng.s,
      ter: SP.rleEncode(terrain.px),
      smoke: s.smoke.map(sm => ({ colour: sm.colour, pts: sm.pts.filter((_, i) => i % 2 === 0).map(([x, y]) => [Math.round(x), Math.round(y)]) })),
    }));
  };
  G.load = o => {
    const s = JSON.parse(JSON.stringify(o));
    s.rng = SP.rng(o.rng);
    s.w = o.w || SP.W;
    s.terrain = T.make(s.w);
    s.terrain.px = SP.rleDecode(o.ter, s.w * SP.H);
    delete s.ter;
    s.ents = []; s.events = []; s.traces = s.traces || [];
    return s;
  };
})();
