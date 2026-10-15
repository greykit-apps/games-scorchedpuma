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
  UI.refresh = () => { if (sheet) sheet.api.refresh(); };
  UI.shopping = null;       // the tank whose shop is open, while one is
  UI.open = (title, o = {}) => {
    UI.close(true);
    const el = document.createElement("div");
    el.className = "gk-sheet";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", title);
    const back = document.activeElement;
    let tab = o.tab || 0;
    const draw = () => {
      const panes = [...el.querySelectorAll(".gk-body, [data-scroll]")].map(p => p.scrollTop);
      const focused = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.f : null;
      el.innerHTML = '<div class="gk-box' + (o.wide ? " wide" : "") + (o.cls ? " " + o.cls : "") + '"><div class="gk-head"><h2>' + esc(o.heading || title) + "</h2>" +
        (o.headExtra ? o.headExtra() : "") +
        (o.closable === false ? "" : '<button data-x aria-label="Close">&times;</button>') + "</div>" +
        (o.tabs ? '<div class="gk-tabs" role="tablist">' + o.tabs.map(([t], i) => '<button role="tab" id="gk-tab-' + i + '" aria-controls="gk-panel" data-tab="' + i + '" data-f="tab' + i + '" aria-selected="' + (i === tab) + '"' + (i === tab ? "" : ' tabindex="-1"') + ">" + esc(t) + "</button>").join("") + "</div>" : "") +
        '<div class="gk-body"' + (o.tabs ? ' id="gk-panel" role="tabpanel" aria-labelledby="gk-tab-' + tab + '"' : "") + ">" + (o.tabs ? (typeof o.tabs[tab][1] === "function" ? o.tabs[tab][1]() : o.tabs[tab][1]) : o.html()) + "</div>" +
        (o.foot ? '<div class="gk-foot">' + o.foot() + "</div>" : "") + "</div>";
      [...el.querySelectorAll(".gk-body, [data-scroll]")].forEach((p, i) => { if (panes[i] !== undefined) p.scrollTop = panes[i]; });
      const f = focused && el.querySelector('[data-f="' + focused + '"]');
      if (f) f.focus({ preventScroll: true });
    };
    draw();
    const tabTo = i => { tab = i; draw(); el.querySelector('[data-tab="' + tab + '"]').focus(); };
    const api = { refresh: draw, close: () => UI.close(), el, tabTo, get tab() { return tab; }, get tabs() { return o.tabs ? o.tabs.length : 0; } };
    el.addEventListener("click", ev => {
      if (ev.target === el) { if (o.closable !== false) UI.close(); return; }
      const b = ev.target.closest("button");
      if (!b || b.disabled) return;
      if (b.hasAttribute("data-x")) return UI.close();
      if (b.dataset.tab !== undefined) return tabTo(+b.dataset.tab);
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
      const f = [...sheet.el.querySelectorAll('button:not(:disabled):not([tabindex="-1"]), a[href], input, select')];
      if (f.length) {
        ev.preventDefault();
        const i = f.indexOf(document.activeElement), d = ev.shiftKey ? -1 : 1;
        f[i < 0 ? 0 : (i + d + f.length) % f.length].focus();
      }
      return true;
    }
    /* the tab row: the arrows, Home and End move along it */
    if (ev.target.getAttribute && ev.target.getAttribute("role") === "tab" && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) {
      ev.preventDefault();
      const n = sheet.api.tabs, i = sheet.api.tab;
      sheet.api.tabTo(ev.key === "Home" ? 0 : ev.key === "End" ? n - 1 : (i + (ev.key === "ArrowLeft" ? -1 : 1) + n) % n);
      return true;
    }
    if (sheet.o.onKey && !(ev.target.closest && ev.target.closest("input,select"))) sheet.o.onKey(ev, sheet.api);
    return true;
  };
  /* a question, with the focus on Cancel: Enter by reflex never throws a match away */
  UI.ask = (q, yes, title) => {
    const p = confirmSheet(q, yes, title);
    const no = document.querySelector(".gk-sheet [data-no]");
    if (no) no.focus();
    return p;
  };
  /* arrows over a grid of cards: the nearest one that way from `cur` */
  const nearest = (cards, cur, dx, dy) => {
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bd = Infinity;
    for (const c of cards) {
      if (c === cur) continue;
      const b = c.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const along = (bx - ax) * dx + (by - ay) * dy, across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
      if (along <= 4) continue;
      const d = along + across * 3;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

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
    battery: "Ten health back.", mag: "Pushes other tanks' shots away from you. Raise it on your turn.",
    shield: "Soaks up 100 damage.", forceshield: "Soaks up 150, and turns shots aside.", heavyshield: "Soaks up 220 damage.",
    supermag: "A stronger, wider Mag Deflector.", autodefense: "Raises your best shield at the start of every round. Yours for good.",
    fuel: "Drive: F, then the arrows. 25 pixels a tank.", contact: "Rollers, diggers and sandhogs go off where they land.",
  };
  /* with 1.5's rule on, a battery's health is power too */
  Object.defineProperty(DESC, "battery", { enumerable: true, get: () => SP.RULES.weaken ? "Ten health back, and so a hundred more power." : "Ten health back." });
  UI.DESC = DESC;
  const sw = t => '<span class="sw" style="background:' + t.colour + '"></span>';
  const who = t => sw(t) + esc(t.name) + ' <span class="' + t.faction + '">' + SP.FACTIONS[t.faction].one + "</span>";

  /* ---- the shop, one human at a time ----
   * A shelf of big icon cards, grouped by what the things do, and beside
   * it the one picked out: what it does, its numbers, Buy and Sell. Arrows
   * walk the shelf, Enter buys, Delete sells, D is done. */
  const SHELVES = {
    weapon: [
      ["Missiles and bombs", ["babymissile", "missile", "babynuke", "nuke", "leapfrog", "funky", "mirv", "deathshead"]],
      ["Fire", ["napalm", "hotnapalm"]],
      ["Rollers", ["babyroller", "roller", "heavyroller"]],
      ["Burrowers", ["babysandhog", "sandhog", "heavysandhog", "babydigger", "digger", "heavydigger"]],
      ["Dirt", ["dirtclod", "dirtball", "tonofdirt", "liquiddirt", "dirtcharge", "riotcharge", "riotblast", "riotbomb", "heavyriotbomb", "disrupter"]],
      ["Beams", ["laser", "plasma"]],
      ["Tracers", ["tracer", "smoketracer"]],
    ],
    item: [
      ["Gear", ["parachute", "battery", "fuel", "contact"]],
      ["Defence", ["shield", "forceshield", "heavyshield", "mag", "supermag", "autodefense"]],
      ["Guidance", ["heat", "ballistic", "horz", "vert", "lazyboy"]],
    ],
  };
  /* the starter kit: what the shop's button buys, in order, while the money
     lasts. Something to shoot first; a parachute pack is dear, so it comes
     after the batteries */
  const KIT = ["missile", "battery", "missile", "parachute", "babynuke", "shield"];
  /* in 1991 pixels, as the weapon table was written */
  const blastWord = r => (r /= SP.K) <= 10 ? "small" : r <= 20 ? "medium" : r <= 40 ? "large" : "huge";
  const stats = x => {
    const rows = [];
    if (x.type !== "weapon") return rows;
    if (x.kind === "mirv") rows.push(["Warheads", x.n + ", each a " + blastWord(x.r) + " blast"]);
    else if (x.kind === "leapfrog") rows.push(["Blasts", "3, each bigger"]);
    else if (x.kind === "funky") rows.push(["Blasts", "1 " + blastWord(x.r) + ", then " + x.n + " bomblets"]);
    else if (x.kind === "sandhog") rows.push(["Burrowers", x.n + ", each a " + blastWord(x.r) + " blast"]);
    else if (x.kind === "digger") rows.push(["Tunnels", String(x.n)]);
    else if (x.r && x.dmg) rows.push(["Blast", blastWord(x.r)]);
    else if (x.r) rows.push(["Size", blastWord(x.r)]);
    if (x.dmg) rows.push(["Damage", "up to " + (x.hopDmg ? Math.max(...x.hopDmg) : x.dmg) + (x.kind === "mirv" || x.kind === "sandhog" ? " each" : "")]);
    if (x.kind === "napalm") rows.push(["Damage", "burns whatever it touches"]);
    if (["riotcharge", "riotbomb", "dirt", "liquid", "dirtcharge", "disrupter", "digger", "tracer"].includes(x.kind)) rows.push(["Damage", "none"]);
    return rows;
  };
  UI.stats = stats;
  UI.shop = (s, t, done) => {
    let sel = null, api = null;
    const bought = [];        // this visit's buys, newest last, for Undo at full price
    const kind = () => (api && api.tab === 1 ? "item" : "weapon");
    const stock = new Set(E.stock(s).map(x => x.id));
    const ids = k => SHELVES[k].flatMap(([, list]) => list).filter(id => stock.has(id));
    /* the pick starts on the first thing you can pay for */
    const pick = () => {
      const list = ids(kind());
      if (!sel || !list.includes(sel)) sel = list.find(id => SP.BY_ID[id].price <= t.cash) || list[0];
      return SP.BY_ID[sel];
    };
    const card = id => {
      const x = SP.BY_ID[id], have = t.inv[id] || 0, poor = t.cash < x.price;
      return '<button class="card' + (id === sel ? " sel" : "") + (poor ? " poor" : "") + '" data-pick="' + id + '" data-f="c' + id + '" aria-pressed="' + (id === sel) + '"' +
        ' aria-label="' + esc(x.name + ", " + SP.money(x.price) + " for " + x.bundle + (poor ? ", can't afford" : "") + (have ? ", you have " + have : "")) + '">' +
        SP.IconImg(id, 2) + (have ? '<span class="own">×' + have + "</span>" : "") +
        '<span class="nm">' + esc(x.name) + '</span><span class="pr">' + SP.money(x.price) + "<small> · " + x.bundle + "</small></span></button>";
    };
    const shelf = k => {
      pick();
      const broke = !ids(k).some(id => SP.BY_ID[id].price <= t.cash);
      const note = broke
        ? '<p class="broke">Nothing on these shelves is in reach at ' + SP.money(t.cash) + "." + (k === "weapon" ? " Baby Missiles are free and never run out." : "") +
          " Damage, kills and surviving the round pay for the next shop.</p>"
        : "";
      return '<div class="shelf" data-scroll>' + note + SHELVES[k].map(([head, list]) => {
        const here = list.filter(id => stock.has(id));
        return here.length ? "<h3>" + esc(head) + '</h3><div class="cards">' + here.map(card).join("") + "</div>" : "";
      }).join("") + (k === "weapon" && !broke ? '<p class="gk-note">Baby Missiles are free and never run out.</p>' : "") + "</div>";
    };
    const detail = () => {
      const x = pick(), have = t.inv[x.id] || 0, short = x.price - t.cash;
      return '<aside class="detail">' + SP.IconImg(x.id, 3, "big") + "<h4>" + esc(x.name) + '</h4><p class="what">' + esc(DESC[x.id] || "") + "</p>" +
        "<dl>" + stats(x).map(([k, v]) => "<dt>" + k + "</dt><dd>" + esc(v) + "</dd>").join("") +
        "<dt>Comes</dt><dd>" + x.bundle + " for " + SP.money(x.price) + (x.bundle > 1 ? " · " + SP.money(x.price / x.bundle) + " each" : "") + "</dd>" +
        "<dt>You have</dt><dd>" + (have || "none") + "</dd></dl>" +
        '<button class="primary buy" data-buy="' + x.id + '"' + (short > 0 ? " disabled" : "") + ">" +
        (short > 0 ? "Need " + SP.money(short) + " more" : "Buy " + x.bundle + " · " + SP.money(x.price) + " <kbd>Enter</kbd>") + "</button>" +
        '<button class="sell" data-sell="' + x.id + '"' + (have ? "" : " disabled") + ">Sell one · +" + SP.money(E.sellPrice(x.id)) + " <kbd>Del</kbd></button></aside>";
    };
    const buyOne = id => { if (!E.buy(s, t, id)) return false; bought.push(id); return true; };
    const buy = () => { const x = pick(); SP.Sfx.play(buyOne(x.id) ? "buy" : "nope"); api.refresh(); };
    const sell = () => { const x = pick(); SP.Sfx.play(E.sell(s, t, x.id) ? "sell" : "nope"); api.refresh(); };
    /* Undo takes back this visit's last buy at what it cost, while the whole bundle is still here */
    const undoable = () => { const id = bought[bought.length - 1]; return id && (t.inv[id] || 0) >= SP.BY_ID[id].bundle ? id : null; };
    const undo = () => {
      const id = undoable();
      if (!id) { SP.Sfx.play("nope"); return; }
      const x = SP.BY_ID[id];
      bought.pop();
      for (let i = 0; i < x.bundle; i++) Tk.take(t, id);
      t.cash += x.price;
      SP.Sfx.play("sell");
      api.refresh();
    };
    const kit = () => {
      let any = false;
      for (const id of KIT) if (stock.has(id) && buyOne(id)) any = true;
      SP.Sfx.play(any ? "buy" : "nope");
      api.refresh();
    };
    const kitFits = () => KIT.some(id => stock.has(id) && SP.BY_ID[id].price <= t.cash);
    const finish = () => { UI.shopping = null; UI.close(true); done(); };
    const focusSel = () => {
      const f = api.el.querySelector('[data-f="c' + sel + '"]');
      if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: "nearest" }); }
    };
    /* arrows: the nearest card that way */
    const walk = (ev, dx, dy) => {
      const cards = [...api.el.querySelectorAll(".card")];
      const cur = api.el.querySelector(".card.sel") || cards[0];
      if (!cur) return;
      ev.preventDefault();
      const best = nearest(cards, cur, dx, dy);
      if (!best) return;
      sel = best.dataset.pick;
      api.refresh();
      focusSel();
    };
    UI.shopping = t;
    api = UI.open(SP.FACTIONS[t.faction].shop, {
      wide: true, closable: false, cls: "shop fac-" + t.faction,
      heading: SP.FACTIONS[t.faction].shop,
      headExtra: () => '<span class="who">' + who(t) + '</span><span class="round">round ' + (s.round + 1) + " of " + s.opts.rounds + '</span><span class="cash big">' + SP.money(t.cash) + "</span>",
      tabs: [["Weapons", () => shelf("weapon") + detail()], ["Items", () => shelf("item") + detail()]],
      foot: () => '<span class="grow">' + (() => {
        const owned = SP.ALL.filter(x => t.inv[x.id] > 0);
        if (owned.length) return owned.map(x => '<span class="got">' + SP.IconImg(x.id, 0.5, "mini") + esc(x.name) + " ×" + t.inv[x.id] + "</span>").join("");
        return kitFits() ? '<button data-kit data-f="kit">Buy a starter kit</button><span class="hint">missiles, then batteries and a parachute, as far as the money goes</span>' : "Nothing bought yet.";
      })() + "</span>" +
        '<button data-undo data-f="undo"' + (undoable() ? "" : " disabled") + ' title="Take back the last buy at what it cost">Undo <kbd>U</kbd></button>' +
        '<button class="primary" data-done>Done <kbd>D</kbd></button>',
      onClick: (b, a) => {
        if (b.dataset.pick) { sel = b.dataset.pick; a.refresh(); focusSel(); }
        else if (b.dataset.buy) buy();
        else if (b.dataset.sell) sell();
        else if (b.hasAttribute("data-undo")) undo();
        else if (b.hasAttribute("data-kit")) kit();
        else if (b.hasAttribute("data-done")) finish();
      },
      onKey: ev => {
        const k = ev.key;
        if (ARROWS[k]) walk(ev, ...ARROWS[k]);
        else if (k === "Enter" && !(ev.target.closest && ev.target.closest("[data-done],[data-sell],[data-undo],[data-kit],[role=tab]"))) { ev.preventDefault(); buy(); }
        else if (k === "Delete" || k === "Backspace") { ev.preventDefault(); sell(); }
        else if (k === "u" || k === "U") { ev.preventDefault(); undo(); }
        else if (k === "d" || k === "D") { ev.preventDefault(); finish(); }
      },
    });
    /* the default pick is lit and has the focus, so the arrows start from it */
    api.refresh();
    focusSel();
    return api;
  };

  /* ---- weapons and items on your turn ---- */
  UI.weapons = (s, t, pick) => UI.open("Weapon", {
    wide: true, cls: "picker",
    html: () => '<div class="cards">' + SP.WEAPONS.filter(w => Tk.count(t, w.id) > 0).map((w, i) => {
      const key = SP.Hud.slotKey(i);
      return '<button class="card' + (w.id === t.weapon ? " sel" : "") + '" data-w="' + w.id + '" data-tip="' + w.id + '"' + (w.id === t.weapon ? " autofocus" : "") + ">" + SP.IconImg(w.id, 2) +
        (key ? '<span class="slot" aria-hidden="true">' + key + "</span>" : "") +
        '<span class="own">' + (w.free ? "∞" : "×" + t.inv[w.id]) + '</span><span class="nm">' + esc(w.name) + '</span><span class="d">' + esc(DESC[w.id]) + "</span></button>";
    }).join("") + '</div><p class="gk-note">Arrows move, <kbd>Enter</kbd> loads. On the field, <kbd>1</kbd> to <kbd>0</kbd> load these in this order.</p>',
    onClick: b => { if (b.dataset.w) { pick(b.dataset.w); UI.close(); } },
    onKey: (ev, api) => {
      const d = ARROWS[ev.key];
      if (!d) return;
      const cards = [...api.el.querySelectorAll(".card")], cur = document.activeElement && document.activeElement.closest(".card");
      const next = cur ? nearest(cards, cur, ...d) : cards[0];
      ev.preventDefault();
      if (next) next.focus();
    },
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
      return (mine.length ? '<table class="list">' + mine.map(x => '<tr><td class="ic">' + SP.IconImg(x.id, 1) + "</td><td>" + esc(x.name) + '<span class="d">' + esc(DESC[x.id]) + '</span></td><td class="n">' +
        (x.id === "fuel" ? Math.floor(Tk.fuelLeft(t)) + " px" : "×" + t.inv[x.id]) + '</td><td class="n">' + act(x) + "</td></tr>").join("") + "</table>"
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

  /* ---- between rounds ----
   * The winner first, in their colours, their tank drawn large and a word
   * from the crew; then what the round paid each human and why; then the
   * table. The last round's sheet is the final standings. */
  const VICTORY = {
    puma: ["Top cat. Obviously.", "I'll be in the sunbeam if anyone needs me.", "Nine lives, zero scratches.", "Cats rule. Told you.",
      "Somebody fetch me a saucer of milk.", "Wake me for the next one."],
    wolf: ["Pack leader. Say it.", "Who's a good boy? ME.", "Awoooooo!", "Cat's out of the bag. And out of the game.",
      "Belly rubs for the winner.", "The moon is mine tonight."],
  };
  const portrait = (t, scale = 3) => '<canvas class="champ" data-tank="' + t.id + '" width="40" height="28" style="width:' + 40 * scale + "px;height:" + 28 * scale + 'px" aria-hidden="true"></canvas>';
  const drawPortraits = (el, s) => {
    for (const cv of el.querySelectorAll("canvas.champ")) {
      const t = s.tanks[+cv.dataset.tank], g = cv.getContext("2d");
      g.imageSmoothingEnabled = false;
      SP.Art.drawTank(g, { ...t, x: 20, y: 25, angle: t.faction === "puma" ? 55 : 125 }, {});
    }
  };
  const fate = (s, t, last) => {
    if (last.winners.includes(t.id)) return '<span class="win">survived</span>';
    if (t.alive && t.health > 0) return '<span class="dim">still standing</span>';
    const k = s.tanks[t.killedBy];
    return '<span class="lose">' + (!k ? "destroyed" : k === t ? "destroyed by its own shot" : "destroyed by " + esc(k.name)) + "</span>";
  };
  /* the quick game's human is called You: "You win", not "You wins" */
  const wins = t => t.name + (t.name === "You" ? " win" : " wins");
  const PAYS = [["dmg", "Damage"], ["kill", "Kills"], ["survive", "Survived"], ["penalty", "Own goals"]];
  const paid = t => {
    const p = t.pay || {}, bits = PAYS.filter(([k]) => p[k]).map(([k, l]) => "<span>" + l + ' <b class="' + (p[k] < 0 ? "lose" : "win") + '">' + (p[k] < 0 ? "−" : "+") + SP.money(Math.abs(p[k])) + "</b></span>");
    if (t.interest) bits.push('<span>Interest <b class="win">+' + SP.money(t.interest) + "</b></span>");
    return bits.length ? bits.join("") : '<span class="dim">Nothing paid this round.</span>';
  };
  UI.scoreboard = (s, ev, next) => {
    const last = s.history[s.history.length - 1];
    const winners = last.winners.map(i => s.tanks[i]);
    const final = ev.last, board = SP.Game.standings(s);
    let line;
    if (last.stalemate) line = "Stalemate. Nobody could hurt anybody.";
    else if (!winners.length) line = "Nobody made it.";
    else if (s.opts.teams) line = SP.FACTIONS[winners[0].faction].name + " take the round.";
    else line = wins(winners[0]) + " the round.";
    /* the moment: who won (the match, on the last sheet), drawn large */
    let heroes = winners, head = line, faction = winners[0] && winners[0].faction, sub = "";
    if (final) {
      const top = board[0];
      if (s.opts.teams) {
        const ts = SP.Game.teamScores(s);
        faction = ts.puma === ts.wolf ? null : ts.puma > ts.wolf ? "puma" : "wolf";
        head = !faction ? "The Pumas and the Wolves are level." : SP.FACTIONS[faction].name + " win the match.";
        heroes = faction ? board.filter(t => t.faction === faction).slice(0, 4) : [];
        sub = '<span class="puma">Pumas ' + ts.puma + '</span> · <span class="wolf">Wolves ' + ts.wolf + "</span>";
      } else {
        heroes = [top]; faction = top.faction;
        head = wins(top) + " the match.";
        sub = "Score " + top.score + " · " + top.kills + " kill" + (top.kills === 1 ? "" : "s") + " · " + top.wins + " round" + (top.wins === 1 ? "" : "s") + " survived · " + SP.money(top.cash);
      }
    } else if (s.opts.teams) {
      const ts = SP.Game.teamScores(s);
      sub = '<span class="puma">Pumas ' + ts.puma + '</span> · <span class="wolf">Wolves ' + ts.wolf + "</span>";
      heroes = winners.slice(0, 4);
    } else heroes = winners.slice(0, 1);
    const quote = faction && heroes.length ? VICTORY[faction][Math.floor(Math.random() * VICTORY[faction].length)] : "";
    const hero = '<div class="hero' + (faction ? " fac-" + faction : " none") + (final ? " final" : "") + '">' +
      (heroes.length ? '<div class="champs">' + heroes.map(t => portrait(t, final && heroes.length === 1 ? 4 : 3)).join("") + "</div>" : "") +
      '<div class="said"><p class="head">' + esc(head) + "</p>" + (sub ? '<p class="sub">' + sub + "</p>" : "") +
      (quote ? '<p class="quote">“' + esc(quote) + "”" + (heroes.length === 1 && heroes[0].name !== "You" ? " <span>" + esc(heroes[0].name) + "</span>" : "") + "</p>" : "") + "</div></div>";
    /* each human's round: how it ended for them, and what it paid */
    const humans = s.tanks.filter(t => t.kind === "human");
    const yours = humans.map(t => '<div class="yours"><div class="who">' + who(t) + " " + fate(s, t, last) + "</div>" +
      '<div class="pay">' + paid(t) + '<span class="sum">This round <b>' + (t.earned + (t.interest || 0) < 0 ? "−" : "+") + SP.money(Math.abs(t.earned + (t.interest || 0))) + "</b> · cash " + SP.money(t.cash) + "</span></div></div>").join("");
    const rows = board.map((t, i) => '<tr class="' + (t.kind === "human" ? "me" : "") + '"><td class="rank">' + (i + 1) + "</td><td>" + who(t) + (last.winners.includes(t.id) ? ' <span class="win">survived</span>' : "") + "</td>" +
      '<td class="n">' + SP.money(t.earned) + '</td><td class="n">' + SP.money(t.interest || 0) + '</td><td class="n">' + SP.money(t.cash) + '</td><td class="n">' + t.kills + '</td><td class="n">' + t.score + "</td></tr>").join("");
    const api = UI.open(final ? "Final standings" : "Round " + s.round + " of " + s.opts.rounds, {
      wide: true, closable: false, cls: "scores",
      html: () => hero + yours +
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
    drawPortraits(api.el, s);
    return api;
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
  /* which tabs of the custom game have their finer options open; kept while the page is */
  const more = { match: false, world: false };
  UI.custom = (setup, start) => {
    const o = setup.opts;
    const press = on => (on ? ' class="on"' : "") + ' aria-pressed="' + on + '"';
    const pills = (key, list, fmt = v => v) => '<div class="row" role="group">' + list.map(v => '<button data-opt="' + key + '" data-v="' + v + '" data-f="' + key + v + '"' +
      press(String(o[key]) === String(v)) + ">" + esc(fmt(v)) + "</button>").join("") + "</div>";
    const opt = (label, inner, note = "") => '<div class="opt"><span>' + esc(label) + "</span>" + inner + "</div>" + (note ? '<p class="gk-note opt-note">' + esc(note) + "</p>" : "");
    /* a tab's finer options, behind a switch that says how many there are and what's changed */
    const finer = (tab, keys, html) => {
      const changed = keys.filter(k2 => String(o[k2]) !== String(SP.DEFAULT_OPTS[k2])).length;
      return '<button class="more" data-more="' + tab + '" data-f="more' + tab + '" aria-expanded="' + more[tab] + '">' + (more[tab] ? "Fewer options" : "More options") +
        ' <span class="dim">' + keys.length + (changed ? ", " + changed + " changed" : "") + "</span></button>" + (more[tab] ? '<div class="finer">' + html() + "</div>" : "");
    };
    const players = () => '<div class="players">' + setup.players.map((p, i) =>
      '<div class="player"><span class="sw" style="background:' + SP.COLOURS[i] + '"></span>' +
      '<input type="text" maxlength="14" data-name="' + i + '" value="' + esc(p.name) + '" aria-label="Tank ' + (i + 1) + ' name">' +
      '<div class="seg" role="group" aria-label="Tank ' + (i + 1) + ' species"><button data-fac="' + i + '" data-v="puma" data-f="fp' + i + '"' + press(p.faction === "puma") + ">Puma</button>" +
      '<button data-fac="' + i + '" data-v="wolf" data-f="fw' + i + '"' + press(p.faction === "wolf") + ">Wolf</button></div>" +
      '<select data-kind="' + i + '" aria-label="Who drives tank ' + (i + 1) + '"><option value="human"' + (p.kind === "human" ? " selected" : "") + ">Human</option>" +
      SP.AIS.map(a => '<option value="' + a.id + '"' + (p.kind === "ai" && p.ai === a.id ? " selected" : "") + ">" + a.name + "</option>").join("") + "</select>" +
      '<button class="x" data-del="' + i + '" aria-label="Remove tank ' + (i + 1) + '"' + (setup.players.length <= 2 ? " disabled" : "") + ">&times;</button></div>").join("") + "</div>" +
      '<div class="row"><button data-add data-f="add"' + (setup.players.length >= 10 ? " disabled" : "") + ">Add a tank</button><span class=\"gk-note\">Two to ten. Humans take turns at the one keyboard.</span></div>" +
      "<h3>Computer players</h3><dl class=\"ais\">" + SP.AIS.map(a => "<dt>" + a.name + "</dt><dd>" + esc(a.note) + "</dd>").join("") + "</dl>";
    const k = n => n >= 1e6 ? (n / 1e6) + "M" : n >= 1000 ? (n / 1000) + "k" : n;
    const match = () =>
      opt("Rounds", pills("rounds", [1, 3, 5, 10, 20, 50])) +
      opt("Starting cash", pills("cash", [0, 5000, 15000, 50000, 100000, 1000000], v => "$" + k(v))) +
      opt("Teams", pills("teams", [false, true], v => v ? "Pumas vs. Wolves" : "Every tank for itself"), o.teams ? "A round ends when one species is gone. Hurting your own kind costs." : "Puma or wolf is just who you are.") +
      opt("Arms level", pills("arms", [0, 1, 2, 3, 4]), "What the shop stocks: 0 is missiles, rollers and dirt; 4 is everything.") +
      finer("match", ["interest", "scoring", "order", "mode"], () =>
        opt("Interest", pills("interest", [0, 0.05, 0.1, 0.2], v => Math.round(v * 100) + "%")) +
        opt("Scoring", pills("scoring", Object.keys(SP.SCORING), v => SP.SCORING[v].name), SP.SCORING[o.scoring].note) +
        opt("Turn order", pills("order", ["random", "losers", "winners", "robin"], v => ({ random: "Random", losers: "Losers first", winners: "Winners first", robin: "Round robin" })[v])) +
        opt("Play", pills("mode", ["sequential", "synchronous"], v => v[0].toUpperCase() + v.slice(1)), o.mode === "synchronous" ? "Everyone aims, then every shot flies at once." : "One shot at a time."));
    const cap = v => v[0].toUpperCase() + v.slice(1);
    const world = () =>
      opt("Wind", pills("wind", ["none", "constant", "changing"], cap)) +
      opt("Walls", pills("walls", SP.WALL_MODES, cap), o.walls === "random" ? "One kind each round." : o.walls === "erratic" ? "A different kind every turn." : SP.WALLS[o.walls]) +
      opt("Sky", pills("sky", ["random", ...SP.SKIES], cap)) +
      opt("Land", pills("land", ["random", ...SP.LANDS], cap)) +
      finer("world", ["maxWind", "gravity", "viscosity", "bumpiness", "suspend", "fallDamage"], () =>
        opt("Strongest wind", pills("maxWind", [5, 10, 25, 50])) +
        opt("Gravity", pills("gravity", [0.5, 0.75, 1, 1.25, 1.5, 2], v => v + "×")) +
        opt("Air", pills("viscosity", [0, 5, 10, 20], v => v ? "thick " + v : "thin")) +
        opt("Bumpiness", pills("bumpiness", [0, 25, 50, 75, 100])) +
        opt("Hanging dirt", pills("suspend", [0, 25, 50, 100], v => v + "%"), "How often a blast leaves the dirt above it hanging in the air.") +
        opt("Fall damage", pills("fallDamage", [true, false], v => v ? "On" : "Off")));
    const changed = () => Object.keys(SP.DEFAULT_OPTS).some(k2 => String(o[k2]) !== String(SP.DEFAULT_OPTS[k2]));
    return UI.open("Custom game", {
      wide: true, cls: "custom",
      tabs: [["Tanks", players], ["Match", match], ["World", world]],
      foot: () => '<span class="grow">' + setup.players.length + " tanks · " + o.rounds + " round" + (o.rounds === 1 ? "" : "s") + "</span>" +
        '<button data-reset data-f="reset"' + (changed() ? "" : " disabled") + ">Reset options</button>" +
        '<button class="primary" data-start>Start <kbd>Enter</kbd></button>',
      onClick: (b, api) => {
        if (b.dataset.more) more[b.dataset.more] = !more[b.dataset.more];
        else if (b.hasAttribute("data-reset")) Object.assign(o, SP.DEFAULT_OPTS);
        else if (b.dataset.opt) {
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
        <h3>Damage weakens shots</h3>
        <div class="row">${pill(!prefs.weak, "Off", "weak:0")}${pill(prefs.weak, "On", "weak:1")}</div>
        <p class="gk-note">On is 1991: a tank fires no harder than ten times the health it has left, so a battery gives power back with the health. Off: every tank always has the full thousand, and batteries only heal. For every tank, the computer's too.</p>
        <h3>Sound</h3>
        <div class="row">${pill(!SP.Sfx.muted, "On", "mute:0")}${pill(SP.Sfx.muted, "Off", "mute:1")}</div>
        <p class="gk-note"><kbd>M</kbd> switches it anywhere; so does the speaker in the bar.</p>
        <h3>Animation speed</h3>
        <div class="row">${[[1, "Slow"], [2, "Normal"], [4, "Fast"]].map(([v, l]) => pill(prefs.speed === v, l, "speed:" + v)).join("")}</div>
        <p class="gk-note">How fast shots fly and dirt falls. Fast hurries the computer players' aiming too; on any speed, <kbd>Space</kbd> hurries one computer turn.</p>
        <h3>This browser</h3>
        <div class="row"><button data-set="forget" class="danger">Forget everything</button></div>
        <p class="gk-note">Clears what Scorched Puma keeps in this browser: a match in progress, your last custom game, and these settings.</p>`,
      onClick: async (b, api) => {
        const v = b.dataset.set;
        if (!v) return;
        if (v === "forget") {
          if (await UI.ask("Forget everything Scorched Puma has saved in this browser: the match in progress, your last custom game and your settings? This cannot be undone.", "Forget everything", "Forget everything?")) SP.forgetEverything();
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
      ["Playing", `<p>Every tank is a puma crew or a wolf crew, and every one of them is out to be the last left.</p>
        <h3>Your turn</h3>
        <ol><li>Set the <b>angle</b> (<kbd>←</kbd> <kbd>→</kbd>) and the <b>power</b> (<kbd>↑</kbd> <kbd>↓</kbd>). The arrow out of your barrel grows with the power, and its tip shows the angle and power. It is not where the shell lands.</li>
        <li>Pick a weapon: click it under the field, or <kbd>1</kbd> to <kbd>0</kbd>, or <kbd>Tab</kbd>.</li>
        <li>Fire with <kbd>Space</kbd>. Gravity pulls the shell down and the <b>wind</b> pushes it.</li>
        <li>Read what happened: the line top left of the field, and a cross where it came down. <b>Aim again</b> (<kbd>A</kbd>) goes back to that aim, to correct from.</li></ol>
        <h3>The field</h3>
        <p>Blasts dig craters and the dirt above them falls. Tanks fall too: a <b>parachute</b> saves a long drop. A <b>battery</b> gives back ten health.${SP.RULES.weaken ? " With <i>Damage weakens shots</i> on in Settings, a tank fires no harder than ten times the health it has left, so a battery is power too." : ""}</p>
        <h3>Money and score</h3>
        <p>Damage to an enemy pays, a kill pays more, surviving the round pays most; hurting yourself or your own side costs. Spend it between rounds at <b class="puma">Puma Arms</b> or <b class="wolf">Wolf Surplus</b>. The match goes to the best score: a point a kill, two for surviving a round, one off for an own goal.</p>
        <p class="gk-credit">${CREDIT}</p>`],
      ["Keys", '<table class="list">' + [
        [["←", "→"], "Turn the turret"], [["↑", "↓"], "Power up and down; hold to go faster, <kbd>Shift</kbd> for one at a time"],
        [["PgUp", "PgDn"], "Power by tens"], [["Space", "Enter"], "Fire; on a computer player's turn, hurry it"],
        [["1", "0"], "Load a weapon by its place in the strip (1 to 9, then 0)"], [["Tab"], "Next weapon (<kbd>Shift</kbd> for the one before)"],
        [["W"], "All your weapons, large"], [["A"], "Aim again: back to the last shot's angle and power"],
        [["I"], "Items: shields, batteries, guidance, the target"], [["T"], "Next target, for guidance and Lazy Boy"],
        [["F"], "Drive on fuel; the arrows move the tank, F again to stop"], [["L"], "Aim aid on or off"],
        [["F6"], "Into the console and back: there <kbd>Tab</kbd> moves and <kbd>Space</kbd> presses"],
        [["Esc", "P"], "Pause"], [["M"], "Sound"], [["?"], "Help"],
      ].map(([k, w]) => kbdRow(k, w)).join("") + "</table><p class=\"gk-note\">The mouse aims too: press anywhere on the field and the turret points there, with more power the further out you press; drag to fine-tune, and the wheel steps the power.</p>" +
        "<h3>The console</h3><p>Under the field, and always yours: your tank's health, cash and score; your angle and power with <b>▲ ▼</b> steppers; your <b>last shot</b> and <b>Aim again</b>; the wind; your weapons and items. Click a weapon to load it, an item to use, raise or arm it; when there are more than fit, rest the pointer on them and a drawer slides up with the lot. On a computer player's turn it dims, and the line by Fire says who is aiming.</p>"],
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
    html: () => `<p><b>Scorched Puma</b> is a remake of <b>Scorched Earth</b> (1991), "The mother of all games", by Wendell Hicken. Specifically the 1.5 version released in 1995. To simply say the game was incredibly popular would gloss over the fact that this game was incredibly popular before the internet took off and before Windows had a Start button.</p>
      <p>I hope I have done it justice.</p>
      <p class="gk-credit">${CREDIT}</p>`,
  });
})();
