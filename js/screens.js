/* Scorched Puma -- the sheets: the shop, the custom game, the scoreboard,
 * items, pause, Settings, Help and About. They wear the title block's
 * .gk-sheet look; this file only builds them and answers their buttons.
 * main.js hands in the game (SP.UI.game) and does what they decide. */
(() => {
  const SP = globalThis.SP, Tk = SP.Tanks, E = SP.Economy;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const UI = SP.UI = { esc };

  const CREDIT = 'Built by <a href="https://greykit.com/" target="_blank" rel="noopener">greykit.com</a>';

  /* ---- the sheet ---- */
  let sheet = null;
  UI.isOpen = () => !!sheet;
  UI.open = (title, o = {}) => {
    UI.close(true);
    const el = document.createElement("div");
    el.className = "gk-sheet";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", title);
    const back = document.activeElement;
    let tab = o.tab || 0;
    const draw = () => {
      const scroll = el.querySelector(".gk-body") ? el.querySelector(".gk-body").scrollTop : 0;
      const focused = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.f : null;
      el.innerHTML = '<div class="gk-box' + (o.wide ? " wide" : "") + '"><div class="gk-head"><h2>' + esc(o.heading || title) + "</h2>" +
        (o.closable === false ? "" : '<button data-x aria-label="Close">&times;</button>') + "</div>" +
        (o.tabs ? '<div class="gk-tabs" role="tablist">' + o.tabs.map(([t], i) => '<button role="tab" data-tab="' + i + '" aria-selected="' + (i === tab) + '">' + esc(t) + "</button>").join("") + "</div>" : "") +
        '<div class="gk-body">' + (o.tabs ? (typeof o.tabs[tab][1] === "function" ? o.tabs[tab][1]() : o.tabs[tab][1]) : o.html()) + "</div>" +
        (o.foot ? '<div class="gk-foot">' + o.foot() + "</div>" : "") + "</div>";
      el.querySelector(".gk-body").scrollTop = scroll;
      const f = focused && el.querySelector('[data-f="' + focused + '"]');
      if (f) f.focus({ preventScroll: true });
    };
    draw();
    const api = { refresh: draw, close: () => UI.close(), el, get tab() { return tab; } };
    el.addEventListener("click", ev => {
      if (ev.target === el) { if (o.closable !== false) UI.close(); return; }
      const b = ev.target.closest("button");
      if (!b || b.disabled) return;
      if (b.hasAttribute("data-x")) return UI.close();
      if (b.dataset.tab !== undefined) { tab = +b.dataset.tab; draw(); el.querySelector('[data-tab="' + tab + '"]').focus(); return; }
      if (o.onClick) o.onClick(b, api);
    });
    if (o.onInput) { el.addEventListener("input", ev => o.onInput(ev.target, api)); el.addEventListener("change", ev => o.onInput(ev.target, api)); }
    document.body.appendChild(el);
    sheet = { el, o, back, api };
    for (const id of ["game", "title"]) $(id).inert = true;
    (el.querySelector("[autofocus]") || el.querySelector(".gk-foot .primary") || el.querySelector('[role="tab"][aria-selected="true"]') || el.querySelector("button")).focus({ preventScroll: true });
    return api;
  };
  UI.close = (quiet = false) => {
    if (!sheet) return;
    const s = sheet; sheet = null;
    s.el.remove();
    for (const id of ["game", "title"]) $(id).inert = false;
    if (!quiet && s.o.onClose) s.o.onClose();
    if (s.back && s.back.isConnected && s.back.focus) s.back.focus({ preventScroll: true });
  };
  /* keys while a sheet is up: Escape closes, Tab stays inside, the sheet's own after */
  UI.key = ev => {
    if (!sheet) return false;
    if (ev.key === "Escape" && sheet.o.closable !== false) { ev.preventDefault(); UI.close(); return true; }
    if (ev.key === "Tab") {
      const f = [...sheet.el.querySelectorAll('button:not(:disabled), a[href], input, select')];
      if (f.length) {
        ev.preventDefault();
        const i = f.indexOf(document.activeElement), d = ev.shiftKey ? -1 : 1;
        f[i < 0 ? 0 : (i + d + f.length) % f.length].focus();
      }
      return true;
    }
    if (sheet.o.onKey && !(ev.target.closest && ev.target.closest("input,select"))) sheet.o.onKey(ev, sheet.api);
    return true;
  };
  UI.ask = (q, yes) => confirmSheet(q, yes);

  /* ---- what everything does, for the shop and Help ---- */
  const DESC = {
    babymissile: "A small blast. You always have these.", missile: "A bigger blast.", babynuke: "A big blast.", nuke: "A very big blast.",
    leapfrog: "Three blasts, each hopping on from the last.", funky: "Bursts, and scatters a handful of bomblets.",
    mirv: "Splits into five warheads at the top of its arc.", deathshead: "Splits into nine big warheads at the top of its arc.",
    napalm: "Fire that runs downhill and burns whoever it reaches.", hotnapalm: "More fire, and hotter.",
    tracer: "Shows where a shot would go. Harms nothing.", smoketracer: "Leaves its path in the sky for the rest of the round.",
    babyroller: "Lands, rolls downhill, and goes off in the hollow.", roller: "A bigger roller.", heavyroller: "A much bigger roller.",
    riotcharge: "Blasts the dirt away in front of your turret. Short reach.", riotblast: "A wider, longer riot charge.",
    riotbomb: "Clears a ball of dirt where it lands. Harms nobody.", heavyriotbomb: "Clears a bigger ball of dirt.",
    babydigger: "Tunnels into the dirt where it lands.", digger: "More tunnels.", heavydigger: "Wider tunnels, and more of them.",
    babysandhog: "Burrows at the nearest tank and goes off.", sandhog: "More burrowers, bigger blasts.", heavysandhog: "The most burrowers, the biggest blasts.",
    dirtclod: "A ball of dirt. Bury someone.", dirtball: "A bigger ball of dirt.", tonofdirt: "A ton of it.",
    liquiddirt: "Dirt that runs into the low places and sets there.", dirtcharge: "Heaps a mound of dirt where it lands.",
    disrupter: "Brings down every bit of dirt left hanging.",
    plasma: "A ring of energy around your own tank. Power sets how far it reaches.",
    laser: "A straight beam: burns through dirt and hits the first tank. Power sets its reach.",
    heat: "Your next shot homes in on the target once it is close.", ballistic: "Your next shot ignores the wind.",
    horz: "Your next shot levels off at the target's height and flies at it.", vert: "Your next shot drops straight down once it is over the target.",
    lazyboy: "Aims your turret at the target for you.", parachute: "Opens by itself when your tank falls.",
    battery: "Ten health back, and so a hundred more power.", mag: "Pushes other tanks' shots away from you. Raise it on your turn.",
    shield: "Soaks up 100 damage.", forceshield: "Soaks up 150, and turns shots aside.", heavyshield: "Soaks up 220 damage.",
    supermag: "A stronger, wider Mag Deflector.", autodefense: "Raises your best shield at the start of every round. Yours for good.",
    fuel: "Drive: F, then the arrows. 25 pixels a tank.", contact: "Rollers, diggers and sandhogs go off where they land.",
  };
  UI.DESC = DESC;
  const sw = t => '<span class="sw" style="background:' + t.colour + '"></span>';
  const who = t => sw(t) + esc(t.name) + ' <span class="' + t.faction + '">' + SP.FACTIONS[t.faction].one + "</span>";

  /* ---- the shop, one human at a time ---- */
  UI.shop = (s, t, done) => {
    const rows = type => E.stock(s).filter(x => x.type === type).map(x => {
      const have = t.inv[x.id] || 0;
      return "<tr" + (t.cash < x.price && !have ? ' class="dim"' : "") + "><td>" + esc(x.name) + '<span class="d">' + esc(DESC[x.id] || "") + "</span></td>" +
        '<td class="n">' + SP.money(x.price) + '<span class="d">for ' + x.bundle + "</span></td>" +
        '<td class="n">' + (have || "—") + "</td>" +
        '<td class="n"><button data-buy="' + x.id + '" data-f="b' + x.id + '"' + (t.cash < x.price ? " disabled" : "") + ">Buy</button> " +
        '<button data-sell="' + x.id + '" data-f="s' + x.id + '"' + (have ? "" : " disabled") + ' title="Sell one back for ' + SP.money(E.sellPrice(x.id)) + '">Sell</button></td></tr>';
    }).join("");
    const table = type => '<table class="list"><tr><th>' + (type === "weapon" ? "Weapon" : "Item") + '</th><th class="n">Price</th><th class="n">Have</th><th></th></tr>' + rows(type) + "</table>";
    return UI.open(SP.FACTIONS[t.faction].shop, {
      wide: true, closable: false,
      heading: SP.FACTIONS[t.faction].shop + " · round " + (s.round + 1) + " of " + s.opts.rounds,
      tabs: [["Weapons", () => head() + table("weapon")], ["Items", () => head() + table("item")]],
      foot: () => '<span class="grow">' + who(t) + ' · <span class="cash">' + SP.money(t.cash) + "</span></span>" +
        '<button class="primary" data-done>Done <kbd>Enter</kbd></button>',
      onClick: (b, api) => {
        if (b.dataset.buy) { SP.Sfx.play(E.buy(s, t, b.dataset.buy) ? "buy" : "nope"); api.refresh(); }
        else if (b.dataset.sell) { if (E.sell(s, t, b.dataset.sell)) SP.Sfx.play("sell"); api.refresh(); }
        else if (b.hasAttribute("data-done")) { UI.close(true); done(); }
      },
      onKey: ev => { if (ev.key === "Enter" && !(ev.target.closest && ev.target.closest("[data-buy],[data-sell],[role=tab]"))) { ev.preventDefault(); UI.close(true); done(); } },
    });
    function head() {
      const owned = SP.ALL.filter(x => t.inv[x.id] > 0).map(x => esc(x.name) + " ×" + t.inv[x.id]).join(", ") || "nothing yet";
      return '<p class="gk-note">' + who(t) + " has " + owned + ". Baby Missiles are free and never run out.</p>";
    }
  };

  /* ---- weapons and items on your turn ---- */
  UI.weapons = (s, t, pick) => UI.open("Weapon", {
    html: () => '<table class="list">' + SP.WEAPONS.filter(w => Tk.count(t, w.id) > 0).map(w =>
      "<tr><td>" + esc(w.name) + '<span class="d">' + esc(DESC[w.id]) + '</span></td><td class="n">' + (w.free ? "∞" : "×" + t.inv[w.id]) +
      '</td><td class="n"><button data-w="' + w.id + '"' + (w.id === t.weapon ? ' class="on" autofocus' : "") + ">" + (w.id === t.weapon ? "In use" : "Use") + "</button></td></tr>").join("") + "</table>",
    onClick: b => { if (b.dataset.w) { pick(b.dataset.w); UI.close(); } },
  });

  UI.items = (s, t, after) => UI.open("Items", {
    html: () => {
      const mine = SP.ITEMS.filter(x => t.inv[x.id] > 0 || (x.id === "fuel" && t.fuel > 0));
      const act = x => {
        switch (x.kind) {
          case "battery": return t.health >= SP.TANK.health ? "<button disabled>Full</button>" : '<button data-use="battery">Use</button>';
          case "shield": return t.shield ? "<button disabled>" + (t.shield.id === x.id ? "Up" : "Shield up") + "</button>" : '<button data-use="' + x.id + '">Raise</button>';
          case "mag": return t.mag ? "<button disabled>" + (t.mag.id === x.id ? "Up" : "Mag up") + "</button>" : '<button data-use="' + x.id + '">Raise</button>';
          case "guide": return '<button data-use="' + x.id + '"' + (t.guide === x.id ? ' class="on"' : "") + ">" + (t.guide === x.id ? "Armed" : "Arm") + "</button>";
          case "contact": return '<button data-use="contact"' + (t.contact ? ' class="on"' : "") + ">" + (t.contact ? "Armed" : "Arm") + "</button>";
          case "lazyboy": return '<button data-use="lazyboy"' + (t.target < 0 ? " disabled" : "") + ">Aim</button>";
          case "fuel": return '<button data-drive>Drive <kbd>F</kbd></button>';
          default: return '<span class="gk-note">by itself</span>';
        }
      };
      const targets = s.tanks.filter(o => o !== t && o.alive && o.health > 0);
      return (mine.length ? '<table class="list">' + mine.map(x => "<tr><td>" + esc(x.name) + '<span class="d">' + esc(DESC[x.id]) + '</span></td><td class="n">' +
        (x.id === "fuel" ? Tk.fuelLeft(t) + " px" : "×" + t.inv[x.id]) + '</td><td class="n">' + act(x) + "</td></tr>").join("") + "</table>"
        : '<p class="gk-note">You have no items. The shop between rounds sells them.</p>') +
        "<h3>Target</h3><p class=\"gk-note\">For guidance and Lazy Boy. <kbd>T</kbd> steps through them on the field.</p><div class=\"row\">" +
        targets.map(o => '<button data-target="' + o.id + '"' + (o.id === t.target ? ' class="on"' : "") + ">" + sw(o) + esc(o.name) + "</button>").join("") + "</div>";
    },
    onClick: (b, api) => {
      if (b.dataset.use) { if (Tk.use(s, t, b.dataset.use)) SP.Sfx.play("blip"); else SP.Sfx.play("nope"); api.refresh(); }
      else if (b.dataset.target) { t.target = +b.dataset.target; api.refresh(); }
      else if (b.hasAttribute("data-drive")) { UI.close(); after("drive"); }
    },
  });

  /* ---- between rounds ---- */
  UI.scoreboard = (s, ev, next) => {
    const last = s.history[s.history.length - 1];
    const winners = last.winners.map(i => s.tanks[i]);
    let line;
    if (last.stalemate) line = "Stalemate. Nobody could hurt anybody.";
    else if (!winners.length) line = "Nobody made it.";
    else if (s.opts.teams) line = SP.FACTIONS[winners[0].faction].name + " take the round.";
    else line = winners[0].name + " wins the round.";
    const rows = SP.Game.standings(s).map((t, i) => "<tr><td>" + (i + 1) + "</td><td>" + who(t) + (last.winners.includes(t.id) ? ' <span class="win">survived</span>' : "") + "</td>" +
      '<td class="n">' + SP.money(t.earned) + '</td><td class="n">' + SP.money(t.interest || 0) + '</td><td class="n">' + SP.money(t.cash) + '</td><td class="n">' + t.kills + '</td><td class="n">' + t.score + "</td></tr>").join("");
    const teams = s.opts.teams ? (() => { const ts = SP.Game.teamScores(s); return '<p><span class="puma">Pumas ' + ts.puma + '</span> · <span class="wolf">Wolves ' + ts.wolf + "</span></p>"; })() : "";
    const final = ev.last;
    let champ = "";
    if (final) {
      const top = SP.Game.standings(s)[0];
      if (s.opts.teams) { const ts = SP.Game.teamScores(s); champ = ts.puma === ts.wolf ? "The Pumas and the Wolves are level." : (ts.puma > ts.wolf ? "The Pumas" : "The Wolves") + " win the match."; }
      else champ = top.name + " wins the match.";
    }
    return UI.open(final ? "Final standings" : "Round " + s.round + " of " + s.opts.rounds, {
      wide: true, closable: false,
      html: () => (final ? '<p class="big">' + esc(champ) + "</p>" : "") + "<p>" + esc(line) + "</p>" + teams +
        '<table class="list"><tr><th></th><th>Tank</th><th class="n">This round</th><th class="n">Interest</th><th class="n">Cash</th><th class="n">Kills</th><th class="n">Score</th></tr>' + rows + "</table>" +
        '<p class="gk-note">Score: a point a kill, two for surviving a round, a point off for killing a friend or yourself.</p>',
      foot: () => final
        ? '<span class="grow"></span><button data-title>Title</button><button class="primary" data-again>Play again <kbd>Enter</kbd></button>'
        : '<span class="grow">Next: the shop, then round ' + (s.round + 1) + '.</span><button class="primary" data-next>Continue <kbd>Enter</kbd></button>',
      onClick: b => {
        if (b.hasAttribute("data-next")) { UI.close(true); next("next"); }
        else if (b.hasAttribute("data-again")) { UI.close(true); next("again"); }
        else if (b.hasAttribute("data-title")) { UI.close(true); next("title"); }
      },
      onKey: ev2 => { if (ev2.key === "Enter" && !(ev2.target.closest && ev2.target.closest("button"))) { ev2.preventDefault(); UI.close(true); next(final ? "again" : "next"); } },
    });
  };

  UI.pause = (act) => UI.open("Paused", {
    html: () => '<div class="row"><button class="primary" data-a="resume" autofocus>Resume <kbd>Esc</kbd></button></div>' +
      '<div class="row"><button data-a="settings">Settings</button><button data-a="help">Help <kbd>?</kbd></button></div>' +
      '<div class="row"><button data-a="title">Quit to title</button></div>' +
      '<p class="gk-note">The match is kept: Resume game on the title brings it back where this turn began.</p>',
    onClick: b => { const a = b.dataset.a; if (!a) return; UI.close(a !== "resume"); if (a !== "resume") act(a); },
    onClose: () => act("resume"),
  });

  /* ---- the custom game ---- */
  const PUMA_NAMES = ["Tawny", "Catamount", "Ghost Cat", "Sundance", "Shadow", "Panthera", "Cougar", "Mountain Lion", "Klaws", "Felix"];
  const WOLF_NAMES = ["Grey Fang", "Lobo", "Howler", "Fenris", "Timber", "Moonjaw", "Ragnar", "Ash", "Red", "Kibble"];
  UI.freshName = (setup, faction) => {
    const used = new Set(setup.players.map(p => p.name));
    return (faction === "puma" ? PUMA_NAMES : WOLF_NAMES).find(n => !used.has(n)) || (faction === "puma" ? "Puma " : "Wolf ") + (setup.players.length + 1);
  };
  UI.custom = (setup, start) => {
    const o = setup.opts;
    const pills = (key, list, fmt = v => v) => '<div class="row">' + list.map(v => '<button data-opt="' + key + '" data-v="' + v + '" data-f="' + key + v + '"' +
      (String(o[key]) === String(v) ? ' class="on"' : "") + ">" + esc(fmt(v)) + "</button>").join("") + "</div>";
    const opt = (label, inner, note = "") => '<div class="opt"><span>' + esc(label) + "</span>" + inner + "</div>" + (note ? '<p class="gk-note" style="margin:-4px 0 10px 162px">' + esc(note) + "</p>" : "");
    const players = () => '<div class="players">' + setup.players.map((p, i) =>
      '<div class="player"><span class="sw" style="background:' + SP.COLOURS[i] + '"></span>' +
      '<input type="text" maxlength="14" data-name="' + i + '" value="' + esc(p.name) + '" aria-label="Tank ' + (i + 1) + ' name">' +
      '<div class="seg"><button data-fac="' + i + '" data-v="puma" data-f="fp' + i + '"' + (p.faction === "puma" ? ' class="on"' : "") + ">Puma</button>" +
      '<button data-fac="' + i + '" data-v="wolf" data-f="fw' + i + '"' + (p.faction === "wolf" ? ' class="on"' : "") + ">Wolf</button></div>" +
      '<select data-kind="' + i + '" aria-label="Who drives tank ' + (i + 1) + '"><option value="human"' + (p.kind === "human" ? " selected" : "") + ">Human</option>" +
      SP.AIS.map(a => '<option value="' + a.id + '"' + (p.kind === "ai" && p.ai === a.id ? " selected" : "") + ">" + a.name + "</option>").join("") + "</select>" +
      '<button class="x" data-del="' + i + '" aria-label="Remove tank ' + (i + 1) + '"' + (setup.players.length <= 2 ? " disabled" : "") + ">&times;</button></div>").join("") + "</div>" +
      '<div class="row"><button data-add data-f="add"' + (setup.players.length >= 10 ? " disabled" : "") + ">Add a tank</button></div>" +
      '<p class="gk-note">Two to ten tanks. Humans take turns at the one keyboard. ' + SP.AIS.map(a => "<b>" + a.name + "</b>: " + esc(a.note)).join(" ") + "</p>";
    const k = n => n >= 1e6 ? (n / 1e6) + "M" : n >= 1000 ? (n / 1000) + "k" : n;
    const match = () =>
      opt("Rounds", pills("rounds", [1, 3, 5, 10, 20, 50])) +
      opt("Starting cash", pills("cash", [0, 5000, 15000, 50000, 100000, 1000000], v => "$" + k(v))) +
      opt("Interest", pills("interest", [0, 0.05, 0.1, 0.2], v => Math.round(v * 100) + "%")) +
      opt("Arms level", pills("arms", [0, 1, 2, 3, 4]), "What the shop stocks: 0 is missiles, rollers and dirt; 4 is everything.") +
      opt("Scoring", pills("scoring", Object.keys(SP.SCORING), v => SP.SCORING[v].name), SP.SCORING[o.scoring].note) +
      opt("Teams", pills("teams", [false, true], v => v ? "Pumas vs. Wolves" : "Every tank for itself"), o.teams ? "A round ends when one species is gone. Hurting your own kind costs." : "Puma or wolf is just who you are.") +
      opt("Turn order", pills("order", ["random", "losers", "winners", "robin"], v => ({ random: "Random", losers: "Losers first", winners: "Winners first", robin: "Round robin" })[v])) +
      opt("Play", pills("mode", ["sequential", "synchronous"], v => v[0].toUpperCase() + v.slice(1)), o.mode === "synchronous" ? "Everyone aims, then every shot flies at once." : "One shot at a time.");
    const world = () =>
      opt("Wind", pills("wind", ["none", "constant", "changing"], v => v[0].toUpperCase() + v.slice(1))) +
      opt("Strongest wind", pills("maxWind", [5, 10, 25, 50])) +
      opt("Gravity", pills("gravity", [0.5, 0.75, 1, 1.25, 1.5, 2], v => v + "×")) +
      opt("Air", pills("viscosity", [0, 5, 10, 20], v => v ? "thick " + v : "thin")) +
      opt("Walls", pills("walls", SP.WALL_MODES, v => v[0].toUpperCase() + v.slice(1)), o.walls === "random" ? "One kind each round." : o.walls === "erratic" ? "A different kind every turn." : SP.WALLS[o.walls]) +
      opt("Sky", pills("sky", ["random", ...SP.SKIES], v => v[0].toUpperCase() + v.slice(1))) +
      opt("Land", pills("land", ["random", ...SP.LANDS], v => v[0].toUpperCase() + v.slice(1))) +
      opt("Bumpiness", pills("bumpiness", [0, 25, 50, 75, 100])) +
      opt("Hanging dirt", pills("suspend", [0, 25, 50, 100], v => v + "%"), "How often a blast leaves the dirt above it hanging in the air.") +
      opt("Fall damage", pills("fallDamage", [true, false], v => v ? "On" : "Off"));
    return UI.open("Custom game", {
      wide: true,
      tabs: [["Tanks", players], ["Match", match], ["World", world]],
      foot: () => '<span class="grow">' + setup.players.length + " tanks · " + o.rounds + " round" + (o.rounds === 1 ? "" : "s") + '</span><button class="primary" data-start>Start <kbd>Enter</kbd></button>',
      onClick: (b, api) => {
        if (b.dataset.opt) {
          const cur = o[b.dataset.opt], v = b.dataset.v;
          o[b.dataset.opt] = typeof cur === "number" ? +v : typeof cur === "boolean" ? v === "true" : v;
        } else if (b.dataset.fac) {
          const p = setup.players[+b.dataset.fac], was = p.faction;
          p.faction = b.dataset.v;
          if (p.faction !== was && (PUMA_NAMES.includes(p.name) || WOLF_NAMES.includes(p.name))) p.name = UI.freshName(setup, p.faction);
        } else if (b.dataset.del) setup.players.splice(+b.dataset.del, 1);
        else if (b.hasAttribute("data-add")) {
          const faction = setup.players.filter(p => p.faction === "puma").length > setup.players.length / 2 ? "wolf" : "puma";
          setup.players.push({ name: UI.freshName(setup, faction), faction, kind: "ai", ai: "shooter" });
        } else if (b.hasAttribute("data-start")) { UI.close(true); return start(); }
        else return;
        api.refresh();
      },
      onInput: (el, api) => {
        if (el.dataset.name) setup.players[+el.dataset.name].name = el.value.trim() || "Tank " + (+el.dataset.name + 1);
        if (el.dataset.kind && el.tagName === "SELECT") {
          const p = setup.players[+el.dataset.kind];
          if (el.value === "human") { p.kind = "human"; delete p.ai; } else { p.kind = "ai"; p.ai = el.value; }
          void api;
        }
      },
      onKey: ev => { if (ev.key === "Enter" && !(ev.target.closest && ev.target.closest("button"))) { ev.preventDefault(); UI.close(true); start(); } },
    });
  };

  /* ---- Settings (games-meta STANDARD.md §7: the game's own, Sound, speed, This browser) ---- */
  function showSettings(prefs, change) {
    const pill = (on, label, act) => '<button data-set="' + act + '" data-f="' + act + '"' + (on ? ' class="on"' : "") + ' aria-pressed="' + on + '">' + label + "</button>";
    UI.open("Settings", {
      html: () => `
        <h3>Tank talk</h3>
        <div class="row">${["off", "sometimes", "often", "always"].map(v => pill(prefs.talk === v, v[0].toUpperCase() + v.slice(1), "talk:" + v)).join("")}</div>
        <p class="gk-note">Pumas and wolves say what they think of each other when they fire, and say last words when they go. None of it is nice.</p>
        <h3>Aim aid</h3>
        <div class="row">${pill(!prefs.aim, "Off", "aim:0")}${pill(prefs.aim, "On", "aim:1")}</div>
        <p class="gk-note">Off is 1991: you learn the arc. On draws the first stretch of your shot's path in still air. <kbd>L</kbd> switches it on the field.</p>
        <h3>Sound</h3>
        <div class="row">${pill(!SP.Sfx.muted, "On", "mute:0")}${pill(SP.Sfx.muted, "Off", "mute:1")}</div>
        <p class="gk-note"><kbd>M</kbd> switches it anywhere; so does the speaker in the bar.</p>
        <h3>Animation speed</h3>
        <div class="row">${[[1, "Slow"], [2, "Normal"], [4, "Fast"]].map(([v, l]) => pill(prefs.speed === v, l, "speed:" + v)).join("")}</div>
        <p class="gk-note">How fast shots fly and dirt falls. The computer players think at the same speed whatever this says.</p>
        <h3>This browser</h3>
        <div class="row"><button data-set="forget" class="danger">Forget everything</button></div>
        <p class="gk-note">Clears what Scorched Puma keeps in this browser: a match in progress, your last custom game, and these settings.</p>`,
      onClick: async (b, api) => {
        const v = b.dataset.set;
        if (!v) return;
        if (v === "forget") {
          if (await UI.ask("Forget everything Scorched Puma has saved in this browser: the match in progress, your last custom game and your settings? This cannot be undone.", "Forget everything")) SP.forgetEverything();
          return;
        }
        const [key, val] = v.split(":");
        change(key, val);
        api.refresh();
      },
    });
  }
  UI.settings = showSettings;

  /* ---- Help ---- */
  const kbdRow = (keys, what) => "<tr><td>" + keys.map(k => "<kbd>" + k + "</kbd>").join(" ") + "</td><td>" + what + "</td></tr>";
  UI.help = (tab = 0) => UI.open("Help", {
    wide: true, tab,
    tabs: [
      ["Playing", `<p>Every tank on the field is a puma crew or a wolf crew, and every one of them is out to be the last left. Take turns: set your <b>angle</b> and <b>power</b>, pick a weapon, and fire. Mind the <b>wind</b> in the bar; it pushes every shot.</p>
        <p>Blasts dig craters, and the dirt above them falls. Tanks fall too: a parachute saves a long drop, and without one the fall hurts. A tank is destroyed at no health, and blows up where it stands.</p>
        <p>A tank's health is also its strength: it fires no harder than ten times the health it has left. A <b>battery</b> gives some back.</p>
        <p>Between rounds is the shop: <b>Puma Arms</b> for pumas, <b>Wolf Surplus</b> for wolves. Damage to an enemy pays, a kill pays more, and surviving the round pays most. Cash in hand earns interest.</p>
        <p>The match is decided on score: a point for each kill, two for surviving a round, a point off for killing your own side or yourself.</p>
        <p class="gk-credit">${CREDIT}</p>`],
      ["Keys", '<table class="list">' + [
        [["←", "→"], "Turn the turret"], [["↑", "↓"], "Power up and down; hold to go faster, <kbd>Shift</kbd> for one at a time"],
        [["PgUp", "PgDn"], "Power by tens"], [["Space", "Enter"], "Fire"], [["Tab"], "Next weapon (<kbd>Shift</kbd> for the one before)"],
        [["I"], "Items: shields, batteries, guidance, the target"], [["T"], "Next target, for guidance and Lazy Boy"],
        [["F"], "Drive on fuel; the arrows move the tank, F again to stop"], [["L"], "Aim aid on or off"],
        [["Esc", "P"], "Pause"], [["M"], "Sound"], [["?"], "Help"],
      ].map(([k, w]) => kbdRow(k, w)).join("") + "</table><p class=\"gk-note\">The mouse aims too: press on the field and drag; the further from your tank, the more power. The wheel steps the power.</p>"],
      ["Weapons", '<table class="list"><tr><th>Weapon</th><th class="n">Price</th><th class="n">Arms</th></tr>' + SP.WEAPONS.map(w => "<tr><td>" + esc(w.name) + '<span class="d">' + esc(DESC[w.id]) + '</span></td><td class="n">' + (w.free ? "free" : SP.money(w.price) + " / " + w.bundle) + '</td><td class="n">' + w.arms + "</td></tr>").join("") + "</table>"],
      ["Items", '<table class="list"><tr><th>Item</th><th class="n">Price</th><th class="n">Arms</th></tr>' + SP.ITEMS.map(w => "<tr><td>" + esc(w.name) + '<span class="d">' + esc(DESC[w.id]) + '</span></td><td class="n">' + SP.money(w.price) + " / " + w.bundle + '</td><td class="n">' + w.arms + "</td></tr>").join("") + "</table>"],
      ["Computer players", '<table class="list">' + SP.AIS.map(a => "<tr><td><b>" + a.name + "</b></td><td>" + esc(a.note) + "</td></tr>").join("") + '</table><p class="gk-note">They aim by flying trial shots through the same physics you play in, wind and walls and all, then miss by as much as their type misses by.</p>'],
      ["The field", `<p><b>Walls</b>: ${Object.entries(SP.WALLS).map(([, d]) => esc(d)).join(". ")}. Random picks one a round; Erratic, one a turn.</p>
        <p><b>Skies</b> are plain, shaded, starry, stormy, sunset or black. Storms throw lightning, but only for show.</p>
        <p><b>Hanging dirt</b>: with it on, a blast can leave dirt in the air until an Earth Disrupter brings it down.</p>
        <p>The sky above the field is open: a shot that goes off the top keeps flying, and a marker on the edge shows where and how high.</p>`],
    ],
  });

  UI.about = () => UI.open("About", {
    html: () => `<p><b>Scorched Puma</b> is a remake of <b>Scorched Earth</b>, "the mother of all games", by Wendell Hicken: shareware for DOS, 1991, version 1.5 in 1995. Up to ten tanks, a field of falling dirt, and the shop between rounds.</p>
      <p>The tanks are crewed by pumas and wolves, and they do not get along.</p>
      <p>Plain scripts, nothing fetched, nothing sent. Every picture is drawn and every sound made in the page. Developed with Claude Code.</p>
      <p class="gk-note">Not affiliated with Wendell Hicken. No code, art, sound or text from the original is used.</p>
      <p class="gk-credit">${CREDIT}</p>`,
  });
})();
