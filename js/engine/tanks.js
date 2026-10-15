/* Scorched Puma -- tanks: where they sit, how they fall, what hurts them.
 *
 * A tank's (x, y) is the middle of its tracks and the row of dirt it sits on.
 * Its health is also its strength: as in 1.5, a tank can fire no harder than
 * ten times the health it has left. */
(() => {
  const SP = globalThis.SP, T = SP.Terrain, K = SP.TANK, KS = SP.K;
  const Tk = SP.Tanks = {};

  Tk.make = (p, i) => ({
    id: i,
    name: p.name,
    faction: p.faction,
    colour: p.colour || SP.COLOURS[i % SP.COLOURS.length],
    kind: p.kind,                   // human | ai
    ai: p.ai || null,               // the AI's type; Unknown is resolved per match into `aiReal`
    aiReal: p.aiReal || null,
    x: 0, y: 0,
    angle: 90, power: 500,
    health: K.health,
    alive: true,
    dying: 0,                       // ticks until a destroyed tank blows up
    cash: 0, score: 0,
    earned: 0, roundKills: 0,       // this round, for the scoreboard
    pay: { dmg: 0, kill: 0, survive: 0, penalty: 0 },   // what `earned` is made of
    kills: 0, wins: 0,
    inv: {},                        // id -> count
    weapon: "babymissile",
    shield: null,                   // { id, hp, max, force }
    mag: null,                      // { id, reach, push }
    guide: null,                    // an armed guidance id, used by the next shot
    target: -1,                     // the tank guidance and Lazy Boy aim at
    contact: false,                 // Contact Trigger armed
    fuel: 0,                        // px of travel left in the open Fuel Tank
    fall: null,                     // { from, v, chute }
    memo: null,                     // the AI's note on its last shot
  });

  Tk.living = s => s.tanks.filter(t => t.alive && t.health > 0);
  Tk.enemies = (s, a, b) => a !== b && (!s.opts.teams || a.faction !== b.faction);
  Tk.count = (t, id) => (SP.BY_ID[id] && SP.BY_ID[id].free) ? Infinity : (t.inv[id] || 0);
  Tk.give = (t, id, n) => { t.inv[id] = (t.inv[id] || 0) + n; };
  Tk.take = (t, id) => {
    if (SP.BY_ID[id] && SP.BY_ID[id].free) return true;
    if (!t.inv[id]) return false;
    if (--t.inv[id] <= 0) delete t.inv[id];
    return true;
  };
  Tk.maxPower = t => Math.max(0, Math.round(t.health * 10));
  Tk.centre = t => ({ x: t.x, y: t.y - K.mid });
  Tk.muzzle = t => {
    const a = t.angle * Math.PI / 180;
    return { x: t.x + Math.cos(a) * SP.PHYS.turretLen, y: t.y - K.turretY - Math.sin(a) * SP.PHYS.turretLen };
  };
  /* is (x, y) inside the tank's box? */
  Tk.hits = (t, x, y) => x >= t.x - K.half - 0.5 && x <= t.x + K.half + 0.5 && y >= t.y - K.tall && y <= t.y + 0.5;
  Tk.at = (s, x, y, skip = null) => {
    for (const t of s.tanks) if (t.alive && t !== skip && Tk.hits(t, x, y)) return t;
    return null;
  };

  /* the row a tank at column x would come to rest on, looking down from y */
  Tk.restY = (s, x, from) => {
    let best = s.terrain.h - 1;
    for (let c = x - K.half + 1; c <= x + K.half - 1; c++) {
      if (c < 0 || c >= s.terrain.w) continue;
      best = Math.min(best, T.surface(s.terrain, c, from));
    }
    return best;
  };
  Tk.supported = (s, t) => Tk.restY(s, t.x, t.y) <= t.y;

  /* ---- placing a round's tanks: spread out, each on a flattened pad ---- */
  Tk.place = s => {
    const live = s.tanks.filter(t => t.alive), n = live.length, w = s.terrain.w;
    const gap = (w - 60 * KS) / n;
    const slots = live.map((_, i) => Math.round(30 * KS + gap * (i + 0.5) + SP.randRange(s.rng, -gap * 0.22, gap * 0.22)));
    /* shuffle who gets which slot */
    for (let i = slots.length - 1; i > 0; i--) { const j = SP.randInt(s.rng, 0, i); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    live.forEach((t, i) => {
      t.x = SP.clamp(slots[i], 18, w - 19);
      t.y = Math.max(60, T.surface(s.terrain, t.x));
      T.pad(s.terrain, t.x, t.y, K.half + 2);
      t.angle = t.x < w / 2 ? 60 : 120;
    });
  };

  /* ---- damage ----
   * Shields take it first; whatever gets through comes off health. The one
   * who did it is told, through the event, so the economy can pay them. */
  Tk.hurt = (s, t, amount, by, why = "blast") => {
    if (!t.alive || t.health <= 0 || amount <= 0) return 0;
    amount = Math.round(amount);
    if (by && why !== "fall") t.lastHitBy = by.id;   // a fall is blamed on whoever dug the hole
    let soak = 0;
    if (t.shield) {
      soak = Math.min(t.shield.hp, amount);
      t.shield.hp -= soak;
      if (t.shield.hp <= 0) { t.shield = null; s.events.push({ e: "shieldDown", tank: t.id }); }
      else s.events.push({ e: "shieldHit", tank: t.id, x: t.x, y: t.y - K.mid });
    }
    const hp = Math.min(t.health, amount - soak);
    if (hp <= 0) return 0;
    t.health -= hp;
    s.hurtThisTurn = true;
    t.power = Math.min(t.power, Tk.maxPower(t));
    s.events.push({ e: "hit", tank: t.id, by: by ? by.id : -1, amount: hp, why, x: t.x, y: t.y - K.tall - 2 });
    SP.Economy.onDamage(s, t, by, hp);
    if (t.health <= 0) Tk.destroy(s, t, by);
    return hp;
  };

  Tk.destroy = (s, t, by) => {
    t.health = 0;
    t.dying = 45;
    t.shield = null;
    t.killedBy = by ? by.id : -1;
    s.events.push({ e: "dying", tank: t.id, by: t.killedBy });
    SP.Economy.onKill(s, t, by);
  };

  /* a blast at (x, y): everyone near it, full strength near the middle and
   * falling away to nothing at its edge */
  Tk.blast = (s, x, y, r, dmg, by) => {
    if (!dmg) return;
    for (const t of s.tanks) {
      if (!t.alive || t.health <= 0) continue;
      const c = Tk.centre(t), d = Math.hypot(c.x - x, c.y - y), reach = r + K.half;
      if (d < reach) Tk.hurt(s, t, dmg * (1 - (d / reach) ** 2), by);
    }
  };

  /* ---- a tick of tanks: falling, and the destroyed going up ----
   * returns true while anything is still happening */
  Tk.tick = s => {
    let busy = false;
    for (const t of s.tanks) {
      if (!t.alive) continue;
      if (t.dying > 0) {
        busy = true;
        if (--t.dying === 0) {
          t.alive = false;
          const r = Math.round(SP.randInt(s.rng, 14, 34) * KS);
          s.events.push({ e: "tankDead", tank: t.id, x: t.x, y: t.y - K.mid });
          SP.Weapons.boom(s, t.x, t.y - K.mid, r, 50, s.tanks[t.killedBy] || null, { death: true, colour: t.colour });
        }
        continue;
      }
      if (!t.fall) {
        if (Tk.supported(s, t)) continue;
        t.fall = { from: t.y, v: 0, chute: false };
        s.events.push({ e: "fall", tank: t.id });
      }
      busy = true;
      const f = t.fall;
      if (!f.chute && t.y - f.from >= K.chuteAfter && (t.inv.parachute || 0) > 0 && t.health > 0) {
        f.chute = true;
        Tk.take(t, "parachute");
        s.events.push({ e: "chute", tank: t.id });
      }
      f.v = f.chute ? K.chuteSpeed : Math.min(4 * KS, f.v + 0.12 * KS);
      const land = Tk.restY(s, t.x, t.y);
      t.y = Math.min(land, t.y + f.v);
      if (t.y >= land) {
        t.y = land;
        const dist = Math.round(land - f.from);
        t.fall = null;
        s.events.push({ e: "landed", tank: t.id, dist, chute: f.chute });
        if (!f.chute && s.opts.fallDamage && dist > K.fallFree) Tk.hurt(s, t, (dist - K.fallFree) * K.fallDmg, s.tanks[t.lastHitBy] || null, "fall");
      }
    }
    return busy;
  };

  /* ---- items, used on your own turn ---- */
  Tk.use = (s, t, id) => {
    const it = SP.BY_ID[id];
    if (!it || !(t.inv[id] > 0)) return false;
    if (it.kind === "battery") {
      if (t.health >= K.health) return false;
      Tk.take(t, id);
      t.health = Math.min(K.health, t.health + it.heal);
      s.events.push({ e: "battery", tank: t.id });
      return true;
    }
    if (it.kind === "shield") {
      Tk.take(t, id);
      t.shield = { id, hp: it.hp, max: it.hp, force: !!it.force };
      s.events.push({ e: "shieldUp", tank: t.id, id });
      return true;
    }
    if (it.kind === "mag") {
      Tk.take(t, id);
      t.mag = { id, reach: it.reach, push: it.push };
      s.events.push({ e: "shieldUp", tank: t.id, id });
      return true;
    }
    if (it.kind === "guide") {
      if (t.guide === id) { t.guide = null; return true; }   // disarm: it goes back in the box
      t.guide = id;
      return true;
    }
    if (it.kind === "contact") { t.contact = !t.contact; return true; }
    if (it.kind === "lazyboy") {
      const target = s.tanks[t.target];
      if (!target || !target.alive || target.health <= 0) return false;
      const sol = SP.AI.solve(s, t, target, { exact: true });
      if (!sol) return false;
      Tk.take(t, id);
      t.angle = sol.angle; t.power = sol.power;
      s.events.push({ e: "lazyboy", tank: t.id });
      return true;
    }
    return false;
  };

  /* the next living enemy for guidance and Lazy Boy, round the field */
  Tk.cycleTarget = (s, t, d = 1) => {
    const live = s.tanks.filter(o => o !== t && o.alive && o.health > 0);
    if (!live.length) { t.target = -1; return; }
    live.sort((a, b) => a.x - b.x);
    const i = live.findIndex(o => o.id === t.target);
    t.target = live[i < 0 ? (d > 0 ? 0 : live.length - 1) : (i + d + live.length) % live.length].id;
  };
  Tk.nearestEnemy = (s, t) => {
    let best = null, bd = Infinity;
    for (const o of s.tanks) {
      if (!o.alive || o.health <= 0 || !Tk.enemies(s, t, o)) continue;
      const d = Math.abs(o.x - t.x);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };

  /* ---- driving on fuel: one px a unit, two for a climb ---- */
  Tk.drive = (s, t, dir) => {
    const w = s.terrain.w;
    if (t.fuel <= 0) {
      if (!(t.inv.fuel > 0)) return false;
      Tk.take(t, "fuel");
      t.fuel = K.fuelPerTank;
    }
    const nx = t.x + dir;
    if (nx < K.half + 1 || nx > w - K.half - 2) return false;
    const ny = Tk.restY(s, nx, t.y - K.climb - K.tall);
    if (ny < t.y - K.climb) return false;            // too steep
    if (ny > t.y + K.drop) return false;             // over an edge
    const cost = ny < t.y ? 2 : 1;
    if (t.fuel < cost && !(t.inv.fuel > 0)) return false;
    t.fuel -= cost;
    if (t.fuel < 0) { Tk.take(t, "fuel"); t.fuel += K.fuelPerTank; }
    t.x = nx; t.y = ny;
    s.events.push({ e: "drive", tank: t.id });
    return true;
  };
  Tk.fuelLeft = t => t.fuel + (t.inv.fuel || 0) * K.fuelPerTank;
})();
