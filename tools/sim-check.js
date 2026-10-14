#!/usr/bin/env node
/* Scorched Puma's engine, checked headless.
 *
 *   node tools/sim-check.js            the rules, then AI matches on 3 seeds
 *   node tools/sim-check.js --seeds N  N seeds of AI matches
 *
 * Exits 1 on any failure. Runs in CI ahead of the deploy. */
"use strict";
const { load } = require("./lib.js");
const SP = load();
const { Terrain: T, Tanks: Tk, Physics: Ph, Game: G } = SP;

const argSeeds = process.argv.indexOf("--seeds");
const SEEDS = argSeeds > 0 ? +process.argv[argSeeds + 1] : 3;
let fails = 0, oks = 0;
const check = (name, ok, more = "") => {
  if (ok) oks++;
  else { fails++; console.log(`FAIL ${name}${more ? ": " + more : ""}`); }
};

/* a quiet two-tank world on flat land at row 300, no wind */
function scene(o = {}) {
  const s = G.newMatch({
    players: [
      { name: "A", faction: "puma", kind: "human" },
      { name: "B", faction: "wolf", kind: "human" },
      ...(o.more || []),
    ],
    opts: { rounds: 3, wind: "none", walls: "none", sky: "plain", land: "flat", suspend: 0, ...(o.opts || {}) },
  }, 7);
  G.startRound(s);
  const t = s.terrain;
  t.px.fill(0);
  for (let y = 300; y < t.h; y++) for (let x = 0; x < t.w; x++) t.px[y * t.w + x] = y === t.h - 1 ? T.BEDROCK : 5;
  t.loose.fill(0); t.looseN = 0;
  s.wall = o.wall || "none";
  s.wind = o.wind || 0;
  const xs = o.xs || [120, 520];
  s.tanks.forEach((tk, i) => { tk.x = xs[i] ?? 60 + i * 50; tk.y = 300; });
  s.order = { ids: s.tanks.map(t => t.id), i: 0, dead: [] };
  s.phase = "aim";
  s.events = [];
  return s;
}
/* run a resolve to its end; false if it never ends */
function resolve(s, limit = 20000) {
  for (let i = 0; i < limit && s.phase === "resolve"; i++) G.tick(s);
  return s.phase !== "resolve";
}

/* ---- terrain ---- */
{
  const t = T.make(), r = SP.rng(1);
  T.generate(t, r, { land: "rolling", bumpiness: 60 });
  const n0 = T.count(t);
  check("terrain generates land", n0 > t.w * 60);
  const cut = T.carve(t, 320, T.surface(t, 320) + 10, 25);
  check("carve removes what it says", T.count(t) === n0 - cut && cut > 0);
  const add = T.fill(t, 200, 100, 15, 0, r);
  check("fill adds what it says", T.count(t) === n0 - cut + add && add > 0);
  let passes = 0;
  while (T.settle(t, 2) && passes < 2000) passes++;
  check("falling dirt settles", passes < 2000, `${passes} passes`);
  check("falling dirt keeps every grain", T.count(t) === n0 - cut + add);
  let floating = 0;
  for (let x = 0; x < t.w; x++) { let air = false; for (let y = 0; y < t.h; y++) { const v = t.px[y * t.w + x]; if (!v && y > 0 && t.px[(y - 1) * t.w + x]) air = true; } if (air) floating++; }
  check("no dirt left hanging after a settle", floating === 0, `${floating} columns`);
  const enc = SP.rleEncode(t.px), dec = SP.rleDecode(enc, t.px.length);
  check("terrain round-trips through a save", dec.every((v, i) => v === t.px[i]), `${enc.length} chars`);
}

/* ---- flight ---- */
{
  const s = scene();
  const t = s.tanks[0];
  const hit = SP.AI.simulate(s, t, 45, 600);
  const v = Ph.speedFor(600), g = SP.PHYS.g, m = Tk.muzzle({ ...t, angle: 45 });
  /* range to the ground from the muzzle's height, by the formula */
  const vx = v * Math.SQRT1_2, vy = v * Math.SQRT1_2, h = 300 - m.y;
  const tFall = (vy + Math.sqrt(vy * vy + 2 * g * h)) / g, want = m.x + vx * tFall;
  check("a shot lands where the formula says", Math.abs(hit.x - want) < 8, `landed ${hit.x.toFixed(1)}, formula ${want.toFixed(1)}`);
  s.wind = 20;
  const windy = SP.AI.simulate(s, t, 45, 600);
  check("tail wind carries a shot further", windy.x > hit.x + 10);
  s.wind = 0;
  for (const [wall, what] of [["none", "gone"], ["concrete", "wall"]]) {
    s.wall = wall;
    const r = SP.AI.simulate(s, s.tanks[1], 25, 1000);
    check(`${wall} wall: a shot off the side ends as ${what}`, r.what === what, r.what);
  }
  s.wall = "rubber";
  const b = SP.AI.simulate(s, s.tanks[1], 25, 1000);
  check("rubber wall bounces a shot back", b.what !== "gone" && b.x < 639, `${b.what} at ${b.x.toFixed(0)}`);
  s.wall = "wrap";
  const wr = SP.AI.simulate(s, s.tanks[1], 25, 1000);
  check("wrap-around brings a shot in the other side", wr.what !== "gone", wr.what);
}

/* ---- every weapon, fired for real ---- */
for (const w of SP.WEAPONS) {
  const s = scene();
  const t = s.tanks[0];
  Tk.give(t, w.id, 5);
  let ok = true, err = "";
  try {
    G.fire(s, { weapon: w.id, angle: 50, power: 560 });
    ok = resolve(s);
    if (!ok) err = "never resolved";
  } catch (e) { ok = false; err = e.stack.split("\n").slice(0, 3).join(" | "); }
  check(`weapon ${w.name} fires and resolves`, ok, err);
  check(`weapon ${w.name} leaves the dirt valid`, s.terrain.px.every(v => v <= 31));
}

/* ---- damage and shields ---- */
{
  const s = scene();
  const a = s.tanks[0], b = s.tanks[1];
  Tk.give(b, "shield", 1);
  Tk.use(s, b, "shield");
  check("a shield goes up", b.shield && b.shield.hp === 100);
  Tk.hurt(s, b, 60, a);
  check("a shield takes damage first", b.health === 100 && b.shield.hp === 40);
  Tk.hurt(s, b, 70, a);
  check("damage past a shield reaches the tank", b.health === 70 && !b.shield, `health ${b.health}`);
  check("damage to an enemy pays", a.cash === 15000 + 30 * SP.PAY.dmg, SP.money(a.cash));
  check("a damaged tank fires weaker", Tk.maxPower(b) === 700);
  Tk.hurt(s, b, 500, a);
  check("a kill scores", a.score === 1 && a.kills === 1);
  check("a kill pays", a.cash === 15000 + 100 * SP.PAY.dmg + SP.PAY.kill, SP.money(a.cash));
  s.phase = "resolve";
  check("the dead blow up and the round ends", resolve(s) && s.phase === "roundOver");
  check("the survivor is paid and scores twice", a.score === 3 && a.wins === 1);
}

/* ---- falling and parachutes ---- */
{
  const s = scene();
  const a = s.tanks[0], b = s.tanks[1];
  T.carve(s.terrain, b.x, 300 + 20, 22);
  s.phase = "resolve";
  resolve(s);
  check("a tank with no dirt under it falls, and is hurt", b.health < 100 && b.y > 300, `y ${b.y} health ${b.health}`);
  const s2 = scene();
  const c = s2.tanks[1];
  Tk.give(c, "parachute", 2);
  T.carve(s2.terrain, c.x, 300 + 20, 22);
  s2.phase = "resolve";
  resolve(s2);
  check("a parachute saves a falling tank", c.health === 100 && c.inv.parachute === 1, `health ${c.health}`);
  void a;
}

/* ---- the shop and interest ---- */
{
  const s = scene();
  const a = s.tanks[0];
  check("buying takes the price and gives the bundle", SP.Economy.buy(s, a, "missile") && a.cash === 15000 - 1875 && a.inv.missile === 5);
  const before = a.cash;
  check("selling gives some back", SP.Economy.sell(s, a, "missile") && a.cash === before + SP.Economy.sellPrice("missile"));
  s.opts.arms = 0;
  check("the arms level keeps big weapons off the shelf", !SP.Economy.canBuy(s, a, "nuke"));
  const c0 = a.cash;
  SP.Economy.roundEnd(s, []);
  check("cash earns interest between rounds", a.cash === c0 + Math.round(c0 * 0.05));
}

/* ---- AI matches to the end ---- */
const AI_TYPES = SP.AIS.map(a => a.id);
function aiMatch(seed, n, o = {}) {
  const players = [];
  for (let i = 0; i < n; i++) players.push({ name: "P" + i, faction: i % 2 ? "wolf" : "puma", kind: "ai", ai: AI_TYPES[(seed + i) % AI_TYPES.length] });
  const s = G.newMatch({ players, opts: { rounds: 2, ...o } }, seed);
  let turns = 0;
  const t0 = Date.now();
  while (s.phase !== "matchOver" && turns < 400) {
    if (s.phase === "shop") { G.aiShop(s); G.startRound(s); }
    else if (s.phase === "roundOver") G.toShop(s);
    else if (s.phase === "aim") { G.aiTurn(s); turns++; }
    else if (s.phase === "resolve") { if (!resolve(s)) break; }
    s.events.length = 0;
  }
  return { s, turns, ms: Date.now() - t0 };
}
for (let seed = 1; seed <= SEEDS; seed++) {
  for (const [n, o] of [[2, {}], [4, { mode: "synchronous" }], [6, { teams: true, walls: "erratic" }], [10, { scoring: "vicious", order: "losers" }]]) {
    let r;
    try { r = aiMatch(seed, n, o); }
    catch (e) { check(`AI match seed ${seed}, ${n} players`, false, e.stack.split("\n").slice(0, 4).join(" | ")); continue; }
    const { s, turns, ms } = r;
    check(`AI match seed ${seed}, ${n} players ${JSON.stringify(o)} ends`, s.phase === "matchOver", `${s.phase} after ${turns} turns`);
    check(`AI match seed ${seed}, ${n} players: state stays sound`, s.tanks.every(t => Number.isFinite(t.cash) && Number.isFinite(t.score) && t.health >= 0 && Object.values(t.inv).every(c => c > 0)));
    if (process.argv.includes("-v")) console.log(`  seed ${seed} n ${n}: ${turns} turns, ${ms} ms, scores ${s.tanks.map(t => t.score).join(" ")}`);
  }
}

/* ---- save and restore reproduce the same match ---- */
{
  const players = [0, 1, 2].map(i => ({ name: "P" + i, faction: i ? "wolf" : "puma", kind: "ai", ai: ["tosser", "cyborg", "moron"][i] }));
  const a = G.newMatch({ players, opts: { rounds: 2 } }, 99);
  G.aiShop(a); G.startRound(a);
  for (let i = 0; i < 3 && a.phase === "aim"; i++) { G.aiTurn(a); resolve(a); }
  const saved = G.save(a);
  check("a match saves at an aim", !!saved);
  const b = G.load(JSON.parse(JSON.stringify(saved)));
  const go = s => { for (let i = 0; i < 4 && s.phase === "aim"; i++) { G.aiTurn(s); resolve(s); s.events.length = 0; } };
  go(a); go(b);
  const sig = s => JSON.stringify([s.phase, s.round, s.wind, s.rng.s, s.tanks.map(t => [t.x, t.y, t.health, t.cash, t.score, t.inv])]) + T.count(s.terrain);
  check("a restored match plays on exactly as the original", sig(a) === sig(b));
}

console.log(`${fails ? "FAILED" : "ok"}: ${oks} checks passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
