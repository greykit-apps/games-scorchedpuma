/* Scorched Puma -- every number in one place.
 *
 * The weapon and item list, the shop's prices and bundle sizes, and the arms
 * levels follow Scorched Earth 1.5 as remembered from its shop and manual;
 * nothing was read from the original's files. Where a value is a guess it is
 * marked UNCERTAIN, and tuning it is a change to this file alone. */
(() => {
  const SP = globalThis.SP;

  /* The playfield, in its own pixels, scaled up crisp on the page. The
   * numbers in this file are in 1991's pixels, a field 640 wide; K scales
   * every distance to this finer field (speeds and gravity too, so a shot
   * takes as long to land as it did). */
  const K = SP.K = 1.5;
  SP.W = 960;                       // the narrowest field; a match is as wide as the window was (s.w), up to MAX_W
  SP.MAX_W = 1440;                  // a full-power shot carries about 1230 px on the level
  SP.H = 540;
  SP.HZ = 60;                       // engine steps a second
  /* rules the page can switch for every tank at once. weaken: 1.5's rule
     that a tank fires no harder than ten times the health it has left (the
     engine defaults to 1.5; the page sets it from Settings) */
  SP.RULES = { weaken: true };

  SP.PHYS = {
    g: 0.05 * K,                    // px / tick^2 at gravity 1.0
    vMax: 6.4 * K,                  // px / tick at power 1000: a 45-degree shot carries about the field's width
    windA: 0.0003 * K,              // px / tick^2 per point of wind
    dragPerVisc: 0.0004,            // fraction of velocity lost a tick, per step of air viscosity
    maxAge: 3600,                   // ticks before a shot that never lands is given up on
    turretLen: 8 * K,
  };

  SP.TANK = {
    health: 100,
    half: 8,                        // body spans x-8 .. x+8
    tall: 11,                       // hit box rises this far above the ground it sits on
    mid: 5,                         // the tank's middle, this far up: where blasts are measured to
    turretY: 8,                     // the turret's root, this far up
    fallFree: 4 * K,                // px a tank may drop without harm
    fallDmg: 0.6 / K,               // damage per px beyond that, UNCERTAIN
    chuteAfter: 5 * K,              // a parachute opens once a fall passes this many px
    chuteSpeed: 0.6 * K,
    fuelPerTank: 25 * K,            // px of travel in one Fuel Tank, UNCERTAIN
    climb: 2 * K,                   // steepest step up a tank can drive
    drop: 6 * K,                    // furthest step down a tank will drive
  };

  /* Ten player colours: the order Scorched handed them out was red first;
     the rest are picked to stay apart on every sky. */
  SP.COLOURS = ["#ff4d4d", "#4fc9ff", "#8cff4a", "#ffd23f", "#ff7ae6", "#ff9a3c", "#b48cff", "#3dffb4", "#f2f2f2", "#5a82ff"];

  SP.FACTIONS = {
    puma: { name: "Pumas", one: "Puma", shop: "Puma Arms", trim: "#d8a25e" },
    wolf: { name: "Wolves", one: "Wolf", shop: "Wolf Surplus", trim: "#9aa4b4" },
  };

  /* ---- weapons ----
   * kind      what it does in flight and on landing (js/engine/weapons.js)
   * r, dmg    blast radius in px and damage at its centre (falls off to the edge)
   * price, bundle   the shop: so many dollars buys so many
   * arms      the lowest arms level that stocks it (0-4)
   * Prices and bundles are the 1.5 shop's as remembered: UNCERTAIN. */
  const W = (id, name, kind, price, bundle, arms, o = {}) => ({ id, name, kind, price, bundle, arms, type: "weapon", ...o });
  SP.WEAPONS = [
    W("babymissile", "Baby Missile", "missile", 400, 10, 0, { r: 10, dmg: 45, free: true }),
    W("missile", "Missile", "missile", 1875, 5, 0, { r: 20, dmg: 85 }),
    W("babynuke", "Baby Nuke", "missile", 10000, 3, 1, { r: 40, dmg: 150 }),
    W("nuke", "Nuke", "missile", 12000, 1, 3, { r: 75, dmg: 260 }),
    W("leapfrog", "LeapFrog", "leapfrog", 10000, 2, 2, { r: 15, dmg: 50, hops: [15, 20, 25], hopDmg: [50, 60, 70] }),
    W("funky", "Funky Bomb", "funky", 7000, 2, 2, { r: 20, dmg: 70, n: 7, br: 14, bdmg: 45 }),
    W("mirv", "MIRV", "mirv", 10000, 3, 3, { r: 20, dmg: 75, n: 5, spread: 0.55 }),
    W("deathshead", "Death's Head", "mirv", 20000, 1, 4, { r: 35, dmg: 120, n: 9, spread: 0.5 }),
    W("napalm", "Napalm", "napalm", 10000, 10, 1, { n: 16, life: 200, burn: 0.3 }),
    W("hotnapalm", "Hot Napalm", "napalm", 20000, 2, 3, { n: 32, life: 260, burn: 0.55 }),
    W("tracer", "Tracer", "tracer", 10, 20, 0, {}),
    W("smoketracer", "Smoke Tracer", "tracer", 500, 10, 0, { smoke: true }),
    W("babyroller", "Baby Roller", "roller", 5000, 10, 0, { r: 10, dmg: 45 }),
    W("roller", "Roller", "roller", 6000, 5, 1, { r: 20, dmg: 85 }),
    W("heavyroller", "Heavy Roller", "roller", 6750, 2, 2, { r: 45, dmg: 170 }),
    W("riotcharge", "Riot Charge", "riotcharge", 2000, 10, 0, { r: 36, cone: 0.6 }),
    W("riotblast", "Riot Blast", "riotcharge", 5000, 5, 2, { r: 62, cone: 0.7 }),
    W("riotbomb", "Riot Bomb", "riotbomb", 5000, 5, 1, { r: 30 }),
    W("heavyriotbomb", "Heavy Riot Bomb", "riotbomb", 4750, 2, 2, { r: 50 }),
    W("babydigger", "Baby Digger", "digger", 3000, 10, 0, { n: 3, steps: 45, w: 2 }),
    W("digger", "Digger", "digger", 2500, 5, 1, { n: 5, steps: 70, w: 2 }),
    W("heavydigger", "Heavy Digger", "digger", 6750, 2, 2, { n: 8, steps: 100, w: 3 }),
    W("babysandhog", "Baby Sandhog", "sandhog", 10000, 10, 2, { n: 3, steps: 70, r: 12, dmg: 50 }),
    W("sandhog", "Sandhog", "sandhog", 16750, 5, 3, { n: 5, steps: 90, r: 16, dmg: 60 }),
    W("heavysandhog", "Heavy Sandhog", "sandhog", 25000, 2, 4, { n: 7, steps: 110, r: 20, dmg: 75 }),
    W("dirtclod", "Dirt Clod", "dirt", 5000, 10, 0, { r: 20 }),
    W("dirtball", "Dirt Ball", "dirt", 5000, 5, 1, { r: 35 }),
    W("tonofdirt", "Ton of Dirt", "dirt", 6750, 2, 2, { r: 70 }),
    W("liquiddirt", "Liquid Dirt", "liquid", 5000, 10, 1, { n: 70 }),
    W("dirtcharge", "Dirt Charge", "dirtcharge", 5000, 5, 2, { r: 42 }),
    W("disrupter", "Earth Disrupter", "disrupter", 5000, 10, 1, {}),
    W("plasma", "Plasma Blast", "plasma", 9000, 5, 3, { r: 100, dmg: 100 }),
    W("laser", "Laser", "laser", 5000, 5, 2, { dmg: 70, len: 700 }),
  ];

  /* ---- items ---- (price, bundle and arms as above, UNCERTAIN) */
  const I = (id, name, kind, price, bundle, arms, o = {}) => ({ id, name, kind, price, bundle, arms, type: "item", ...o });
  SP.ITEMS = [
    I("heat", "Heat Guidance", "guide", 10000, 6, 1, { reach: 90, turn: 0.07 }),
    I("ballistic", "Ballistic Guidance", "guide", 10000, 2, 1, {}),
    I("horz", "Horz Guidance", "guide", 15000, 5, 2, {}),
    I("vert", "Vert Guidance", "guide", 20000, 5, 2, {}),
    I("lazyboy", "Lazy Boy", "lazyboy", 20000, 2, 3, {}),
    I("parachute", "Parachute", "parachute", 10000, 8, 0, {}),
    I("battery", "Battery", "battery", 5000, 10, 0, { heal: 10 }),
    I("mag", "Mag Deflector", "mag", 10000, 2, 1, { reach: 45, push: 0.09 }),
    I("shield", "Shield", "shield", 20000, 3, 0, { hp: 100 }),
    I("forceshield", "Force Shield", "shield", 25000, 3, 2, { hp: 150, force: true }),
    I("heavyshield", "Heavy Shield", "shield", 30000, 2, 3, { hp: 220 }),
    I("supermag", "Super Mag", "mag", 40000, 2, 3, { reach: 75, push: 0.16 }),
    I("autodefense", "Auto Defense", "autodefense", 1500, 1, 0, {}),
    I("fuel", "Fuel Tank", "fuel", 10000, 10, 0, {}),
    I("contact", "Contact Trigger", "contact", 1000, 25, 0, {}),
  ];
  SP.SHIELD_R = 20;                 // px: a raised shield's bubble around the tank

  /* the tables above are in 1991's pixels: every distance in them to this field's */
  for (const w of SP.WEAPONS) {
    for (const k of ["r", "br", "len", "spread", "w"]) if (w[k] !== undefined) w[k] *= K;
    if (w.hops) w.hops = w.hops.map(h => h * K);
    if (w.steps) w.steps = Math.round(w.steps * K);
    if (w.kind === "napalm") w.n = Math.round(w.n * K);
    if (w.kind === "liquid") w.n = Math.round(w.n * K * K);
  }
  for (const it of SP.ITEMS) for (const k of ["reach", "push"]) if (it[k] !== undefined) it[k] *= K;

  SP.ALL = [...SP.WEAPONS, ...SP.ITEMS];
  SP.BY_ID = Object.fromEntries(SP.ALL.map(x => [x.id, x]));

  /* ---- computer players ----
   * noiseA / noiseP: how far off a shot is, in degrees and power (one sigma)
   * Their characters follow the 1.5 manual's one-line sketches. */
  SP.AIS = [
    { id: "moron", name: "Moron", noiseA: 18, noiseP: 180, note: "Fires in your general direction. Mostly." },
    { id: "shooter", name: "Shooter", noiseA: 3, noiseP: 30, note: "Takes the straightest shot it can find." },
    { id: "poolshark", name: "Poolshark", noiseA: 2, noiseP: 24, note: "Banks shots off the walls." },
    { id: "tosser", name: "Tosser", noiseA: 9, noiseP: 110, note: "Bad first shot; each one after is closer." },
    { id: "chooser", name: "Chooser", noiseA: 1.5, noiseP: 16, note: "Picks the right weapon for the job." },
    { id: "spoiler", name: "Spoiler", noiseA: 1.5, noiseP: 16, note: "Goes after whoever is winning." },
    { id: "cyborg", name: "Cyborg", noiseA: 0.5, noiseP: 5, note: "Aims and shops like a machine." },
    { id: "unknown", name: "Unknown", note: "One of the others, and it isn't telling." },
  ];
  SP.AI_BY_ID = Object.fromEntries(SP.AIS.map(a => [a.id, a]));

  /* ---- money (UNCERTAIN: tuned so a good round buys a Baby Nuke) ---- */
  SP.PAY = {
    dmg: 60,                        // per point of damage to an enemy
    kill: 4000,                     // per enemy tank destroyed
    survive: 8000,                  // to the last tank (or team) standing
    sellBack: 0.65,                 // fraction of what a thing cost
  };
  SP.SCORING = {
    standard: { name: "Standard", dmg: 1, kill: 1, survive: 1, interest: 1, penalty: 1, note: "Paid for damage, kills and surviving." },
    corporate: { name: "Corporate", dmg: 1.5, kill: 0, survive: 0.5, interest: 2, penalty: 1, note: "Paid for damage; money grows at double interest." },
    vicious: { name: "Vicious", dmg: 0.5, kill: 2.5, survive: 0, interest: 1, penalty: 2, note: "Kills pay big; hurting a friend costs double." },
  };

  /* ---- the world ---- */
  SP.WALLS = {
    none: "None: shots fly off the sides",
    wrap: "Wrap-around: out one side, in the other",
    concrete: "Concrete: shots explode on the walls",
    rubber: "Rubber: shots bounce off",
    spring: "Spring: shots bounce off faster",
    padded: "Padded: shots bounce off slower",
  };
  SP.WALL_MODES = ["none", "wrap", "concrete", "rubber", "spring", "padded", "random", "erratic"];
  SP.SKIES = ["plain", "shaded", "stars", "storm", "sunset", "black"];
  SP.LANDS = ["rolling", "mountains", "flat"];

  /* a match's settings, as the Custom game sheet starts them */
  SP.DEFAULT_OPTS = {
    rounds: 10,
    cash: 15000,
    interest: 0.05,
    arms: 4,
    scoring: "standard",
    order: "random",                // random | losers | winners | robin
    mode: "sequential",             // sequential | synchronous
    teams: false,                   // Pumas vs Wolves: the factions are teams
    wind: "changing",               // none | constant | changing
    maxWind: 25,
    gravity: 1,
    viscosity: 0,
    walls: "random",
    sky: "random",
    land: "random",
    bumpiness: 50,
    suspend: 0,                     // percent chance a blast's dirt hangs in the air
    fallDamage: true,
  };
})();
