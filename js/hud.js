/* Scorched Puma -- the console under the field, the banner and the log.
 *
 * The console is yours: your tank, health, cash and score, driving it on
 * fuel, your angle and power with steppers, your last shot to correct from, the wind, your weapons
 * and items as icons to click. On a computer player's turn it stays yours,
 * dimmed, and the turn line says who is aiming. It is written from the match
 * state every frame, but only where something changed; its strips are
 * rebuilt when the inventory does. */
(() => {
  const SP = globalThis.SP, Tk = SP.Tanks, G = SP.Game;
  const $ = id => document.getElementById(id);
  const H = SP.Hud = {};
  const last = {};
  const set = (key, el, fn, v) => { if (last[key] !== v) { last[key] = v; fn(el, v); } };
  const text = (el, v) => { el.textContent = v; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let cb = null;            // what main.js lends: the tank being aimed by a human, driving, the banner
  let meId = -1;            // whose console this is: the human who last had the turn

  /* the tank the console belongs to: the human aiming now, else the last
     human who aimed, else the first human; with no humans, whoever is up */
  H.me = s => {
    const cur = G.current(s);
    if (cur && cur.kind === "human") { meId = cur.id; return cur; }
    const was = s.tanks[meId];
    if (was && was.kind === "human") return was;
    const h = s.tanks.find(t => t.kind === "human");
    if (h) { meId = h.id; return h; }
    return cur;
  };
  const fuel = t => Math.floor(Tk.fuelLeft(t));

  /* ---- the strips ---- */
  const itemState = (t, x, drive) => {
    switch (x.kind) {
      case "shield": return t.shield ? (t.shield.id === x.id ? ["up", "UP"] : ["off", ""]) : ["", ""];
      case "mag": return t.mag ? (t.mag.id === x.id ? ["up", "UP"] : ["off", ""]) : ["", ""];
      case "guide": return t.guide === x.id ? ["armed", "ARMED"] : ["", ""];
      case "contact": return t.contact ? ["armed", "ARMED"] : ["", ""];
      case "fuel": return drive ? ["armed", "DRIVE"] : ["", ""];
      case "battery": return t.health >= SP.TANK.health ? ["off", "FULL"] : ["", ""];
      case "parachute": case "autodefense": return ["passive", "AUTO"];
      default: return ["", ""];
    }
  };
  /* what the hover tip says a click will do, by the item's state */
  const itemNote = (t, x, drive, human) => {
    const act = human ? "" : " (on your turn)";
    switch (x.kind) {
      case "battery": return t.health >= SP.TANK.health ? "Health is full." : "Click to use one: ten health back" + act + ".";
      case "shield": case "mag": {
        const up = x.kind === "shield" ? t.shield : t.mag;
        return up ? (up.id === x.id ? "Up now" + (up.hp !== undefined ? ": " + up.hp + " left in it." : ".") : "Another is up already.") : "Click to raise one" + act + ".";
      }
      case "guide": return t.guide === x.id ? "Armed for the next shot. Click to put it away." : "Click to arm it for the next shot" + act + ".";
      case "contact": return t.contact ? "Armed. Click to disarm." : "Click to arm" + act + ".";
      case "lazyboy": return "Click to aim at the target (T picks it)" + act + ".";
      case "fuel": return (drive ? "Driving now. " : "") + fuel(t) + " px of fuel. Click, or F, to " + (drive ? "stop." : "drive.");
      case "parachute": return "Opens by itself when you fall.";
      case "autodefense": return "Raises your best shield at the start of every round.";
      default: return "";
    }
  };
  /* the number keys load the first ten weapons in the strip, in its order */
  H.slotKey = i => (i < 9 ? String(i + 1) : i === 9 ? "0" : "");
  function strips(s, t, ui, human) {
    const ws = SP.WEAPONS.filter(w => Tk.count(t, w.id) > 0);
    $("c-weapons").innerHTML = ws.map((w, i) => {
      const n = Tk.count(t, w.id), key = H.slotKey(i);
      const note = (n === Infinity ? "Never runs out." : "You have " + n + ".") + (w.id === t.weapon ? " Loaded." : human ? " Click" + (key ? " or press " + key : "") + " to load it." : "");
      return '<button class="wb' + (w.id === t.weapon ? " sel" : "") + '" data-w="' + w.id + '" aria-disabled="' + !human + '"' +
        ' aria-label="' + esc(w.name + ", " + (n === Infinity ? "unlimited" : n + " left") + (w.id === t.weapon ? ", loaded" : "") + (key ? ", key " + key : "")) + '"' +
        ' data-tip="' + w.id + '" data-tip-note="' + esc(note) + '">' + SP.IconImg(w.id, 1) +
        (key ? '<span class="key" aria-hidden="true">' + key + "</span>" : "") +
        '<span class="n">' + (n === Infinity ? "∞" : n) + "</span></button>";
    }).join("");
    const its = SP.ITEMS.filter(x => (t.inv[x.id] || 0) > 0 || (x.id === "fuel" && t.fuel > 0));
    $("c-items").innerHTML = its.length ? its.map(x => {
      const [cls, tag] = itemState(t, x, ui.drive);
      const n = x.id === "fuel" ? fuel(t) : t.inv[x.id];
      return '<button class="ib ' + cls + '" data-i="' + x.id + '" aria-disabled="' + !human + '"' +
        ' aria-label="' + esc(x.name + ", " + n + (x.id === "fuel" ? " px" : " left") + (tag ? ", " + tag.toLowerCase() : "")) + '"' +
        ' data-tip="' + x.id + '" data-tip-note="' + esc(itemNote(t, x, ui.drive, human)) + '">' +
        SP.IconImg(x.id, 1) + '<span class="n">' + n + "</span>" + (tag ? '<span class="tag">' + tag + "</span>" : "") + "</button>";
    }).join("") : '<span class="none">None yet: the shop sells them.</span>';
    fitStrips();
    if (SP.Tips) SP.Tips.reattach();
  }

  /* The console keeps one height, so the field above it keeps its width. Each
     strip takes the biggest tile, 52px down to 44, that puts everything in
     its room; when even 44 won't, the strip is a drawer: what fits shows,
     "+N" says how many more, and the pointer (or the focus) on it slides the
     whole set up over the foot of the field. */
  const GAP = 4, PAD = 6;
  /* the compact console (css: under 900px wide or 480px tall) has a shorter
     well, 82px for 114: two rows of smaller tiles */
  const COMPACT = matchMedia("(max-width: 900px), (max-height: 479px)");
  let ROOM = 112, BIG = 52, MIN = 44;
  function fitStrip(el) {
    [ROOM, BIG, MIN] = COMPACT.matches ? [80, 44, 36] : [112, 52, 44];
    const n = el.querySelectorAll(".wb, .ib").length, w = el.clientWidth - PAD * 2 - 2;
    if (w <= 0) return;
    const cols = z => Math.max(1, Math.floor((w + GAP) / (z + GAP)));
    const high = z => Math.ceil(n / cols(z)) * (z + GAP) - GAP;
    let tile = 0;
    for (let z = BIG; z >= MIN; z -= 2) if (high(z) <= ROOM) { tile = z; break; }
    const over = !tile;
    if (over) tile = MIN;
    const rows = Math.floor((ROOM + GAP) / (tile + GAP)), fits = cols(tile) * rows;
    el.style.setProperty("--tile", tile + "px");
    /* shut, it shows whole rows only; open, all of them */
    el.style.setProperty("--closed", (over ? rows * (tile + GAP) - GAP : high(tile)) + 2 + "px");
    el.style.setProperty("--full", high(tile) + 2 + "px");
    el.classList.toggle("shrunk", tile < BIG);
    el.classList.toggle("over", over);
    if (!over) el.classList.remove("open");
    const more = el.closest("section").querySelector(".more");
    more.textContent = over ? "+" + (n - fits) : "";
    more.title = over ? "Rest the pointer here for all of them" : "";
  }
  let conH = 0;
  function fitStrips() {
    const nw = $("c-weapons").children.length, ni = $("c-items").querySelectorAll(".ib").length;
    $("c-weapons").closest("section").style.flexGrow = Math.max(4, nw);
    $("c-items").closest("section").style.flexGrow = Math.max(2, ni);
    fitStrip($("c-weapons"));
    fitStrip($("c-items"));
    const h = $("console").offsetHeight;
    if (h && h !== conH) { conH = h; if (cb && cb.relayout) cb.relayout(); }
  }
  addEventListener("resize", fitStrips);

  H.update = (s, ui) => {
    const cur = G.current(s), t = H.me(s);
    if (!t) return;
    const human = t.kind === "human";
    const live = human && t === cur && s.phase === "aim" && !ui.paused;
    set("sw", $("c-sw"), (el, v) => { el.style.background = v; }, t.colour);
    set("name", $("c-name"), text, t.name);
    set("side", $("c-side"), (el, v) => { el.textContent = SP.FACTIONS[v].one; el.className = "side " + v; }, t.faction);
    const hp = Math.max(0, Math.round(t.health)), out = !t.alive || t.health <= 0;
    set("hpt", $("c-hp").parentNode, (el, v) => { el.title = v ? "Health: a tank fires no harder than ten times what it has left" : "Health"; }, SP.RULES.weaken);
    set("hp", $("c-hp"), (el, v) => { el.style.width = v + "%"; el.className = v > 50 ? "" : v > 25 ? "mid" : "low"; }, hp);
    set("hpn", $("c-hpn"), (el, v) => { el.textContent = v; el.className = out ? "out" : ""; }, out ? "out" : String(hp));
    set("cash", $("c-cash"), text, SP.money(t.cash));
    set("score", $("c-score"), text, "Score " + t.score);
    set("round", $("c-round"), text, `Round ${s.round}/${s.opts.rounds}`);
    /* driving: always in view, so nobody has to find it; with no fuel a press says where to get some */
    const fl = fuel(t);
    set("drive", $("c-drive"), (el, v) => {
      /* the short form is for a narrow console, where the stylesheet swaps it in */
      $("c-fuel").innerHTML = fl > 0 ? fl + '<span class="long"> px</span>' : '<span class="long">no fuel</span><span class="short">none</span>';
      $("c-fuel").className = fl > 0 ? "" : "dim";
      el.classList.toggle("on", !!ui.drive);
      el.title = fl > 0 ? "Hold ◀ ▶ to drive, or F and then ← →. Fuel is spent by the pixel, double uphill." : "Driving needs fuel: buy a Fuel Tank in the shop";
      el.querySelectorAll("button").forEach(b => { b.disabled = !live; b.setAttribute("aria-disabled", String(fl <= 0)); });
    }, [fl, live, ui.drive].join());
    set("angle", $("c-angle").querySelector(".v"), text, t.angle + "°");
    set("power", $("c-power").querySelector(".v"), text, String(t.power));
    set("maxp", $("c-power").querySelector(".max"), text, "/" + Tk.maxPower(t));
    set("live", $("console"), (el, v) => { el.classList.toggle("idle", !v); el.querySelectorAll(".step button, #c-fire").forEach(b => { b.disabled = !v; }); }, live);
    /* the last shot, and how far the aim has moved from it */
    const ls = t.lastShot;
    set("last", $("c-last"), (el, v) => {
      if (!ls) { el.innerHTML = '<span class="k">Last shot</span> <span class="dim">none yet this round</span>'; return; }
      const da = t.angle - ls.angle, dp = t.power - ls.power, sign = n => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n);
      el.innerHTML = '<span class="k">Last shot</span> <b>' + ls.angle + "° · " + ls.power + "</b>" +
        ' <span class="d' + (da || dp ? "" : " same") + '">' + (da || dp ? sign(da) + "° " + sign(dp) : "same") + "</span>" +
        '<button data-again' + (live ? "" : " disabled") + ' title="Aim where the last shot was aimed (A)">Aim again</button>';
    }, ls ? [t.id, ls.angle, ls.power, t.angle, t.power, live].join() : "none" + t.id);
    /* wind: a number, and a gauge that fills from the middle the way it blows */
    set("wind", $("c-wind"), (el, v) => {
      el.querySelector(".v").textContent = v === 0 ? "calm" : Math.abs(v) + (v < 0 ? " ◀" : " ▶");
      const max = Math.max(1, s.opts.maxWind), f = Math.min(1, Math.abs(v) / max) * 50;
      el.querySelector(".arrow").innerHTML = '<i style="' + (v < 0 ? "right:50%" : "left:50%") + ";width:" + f + '%"></i>';
      el.classList.toggle("calm", v === 0);
    }, s.wind);
    const w = SP.BY_ID[t.weapon];
    set("wname", $("c-wname"), text, w.name);
    const sig = [t.id, JSON.stringify(t.inv), t.weapon, t.guide, t.contact, t.shield && t.shield.id + t.shield.hp, t.mag && t.mag.id, t.fuel, t.health >= SP.TANK.health, ui.drive, live].join("|");
    set("strips", null, () => strips(s, t, ui, live), sig);
    /* the turn line: whose turn, in their colour */
    let state = "", who = null, cls = "";
    if (s.phase === "aim" && cur) {
      who = cur;
      if (cur === t && human) {
        cls = "you";
        state = ui.drive ? "Driving" : s.opts.mode === "synchronous" ? "Your aim · all fire at once" : "Your turn";
      } else state = cur.name + (cur.kind === "ai" ? " aiming…" : "'s turn");
    } else if (s.phase === "resolve") state = "Shot in the air";
    else if (s.phase === "roundOver" || s.phase === "matchOver") state = "Round over";
    set("state", $("c-state"), (el, v) => { el.textContent = state; el.className = cls; el.title = cur && cur.kind === "ai" && s.phase === "aim" ? "Space hurries a computer player's turn" : ""; }, state + cls);
    set("tsw", $("c-tsw"), (el, v) => { el.style.background = v || "transparent"; el.hidden = !v; }, who ? who.colour : "");
  };
  H.reset = () => { for (const k of Object.keys(last)) delete last[k]; };

  /* ---- the console's buttons ---- */
  H.bind = c => {
    cb = c;
    const con = $("console");
    /* steppers: a click is one step (ten with Shift); held, they run, faster as they go */
    let hold = null;
    const step = (b, big) => {
      const t = cb.human();
      if (!t) return;
      const [k, d] = b.dataset.step.split(":"), n = +d * (big ? 10 : 1);
      if (k === "angle") G.setAim(cb.state(), t.angle + n, t.power);
      else G.setAim(cb.state(), t.angle, t.power + n);
    };
    const stop = () => { if (hold) { clearTimeout(hold.t); clearInterval(hold.i); hold = null; } };
    /* the drive buttons: a pixel a press, and held, the tank keeps rolling at the arrow keys' pace */
    const drive = (b, held) => {
      const t = cb.human();
      if (!t) return stop();
      if (Tk.fuelLeft(t) <= 0) {
        stop();
        if (!held) { H.banner("No fuel: buy a <b>Fuel Tank</b> in the shop", 1600); SP.Sfx.play("nope"); }
        return;
      }
      Tk.drive(cb.state(), t, +b.dataset.drive);
    };
    con.addEventListener("pointerdown", ev => {
      const d = ev.target.closest("[data-drive]");
      if (d) {
        if (d.disabled) return;
        ev.preventDefault();
        stop();
        drive(d, false);
        hold = { t: 0, i: setInterval(() => drive(d, true), 50) };
        return;
      }
      const b = ev.target.closest("[data-step]");
      if (!b || b.disabled) return;
      ev.preventDefault();
      step(b, ev.shiftKey);
      SP.Sfx.play("blip");
      let k = 0;
      hold = { t: setTimeout(() => { hold.i = setInterval(() => { step(b, ev.shiftKey || ++k > 25); }, 45); }, 320) };
    });
    for (const e of ["pointerup", "pointerleave", "pointercancel"]) con.addEventListener(e, stop);
    addEventListener("blur", stop);
    /* the drawers: open on the pointer or the focus, shut a moment after it leaves */
    for (const id of ["c-weapons", "c-items"]) {
      const el = $(id), sec = el.closest("section");
      let shut = null;
      const open = () => { clearTimeout(shut); if (el.classList.contains("over")) el.classList.add("open"); };
      const close = (ms = 260) => { clearTimeout(shut); shut = setTimeout(() => el.classList.remove("open"), ms); };
      sec.addEventListener("pointerenter", ev => { if (ev.pointerType !== "touch") open(); });
      sec.addEventListener("pointerleave", () => close());
      sec.addEventListener("focusin", open);
      sec.addEventListener("focusout", ev => { if (!sec.contains(ev.relatedTarget)) close(0); });
      /* a weapon picked: the drawer has done its job */
      el.addEventListener("click", ev => { if (ev.target.closest("[data-w]") && ev.detail !== 0) close(120); });
    }
    con.addEventListener("click", ev => {
      const b = ev.target.closest("button");
      /* a drive button from the keyboard: a short roll, since there is no holding it */
      if (b && b.dataset.drive && !b.disabled && ev.detail === 0) { for (let i = 0; i < 8; i++) drive(b, i > 0); return; }
      if (!b || b.disabled || b.getAttribute("aria-disabled") === "true") return;
      const t = cb.human(), s = cb.state();
      /* a stepper pressed from the keyboard (detail 0) has no pointerdown: step here */
      if (b.dataset.step && ev.detail === 0) { step(b, ev.shiftKey); SP.Sfx.play("blip"); }
      else if (b.dataset.w && t) { t.weapon = b.dataset.w; SP.Sfx.play("blip"); }
      else if (b.dataset.i && t) useItem(s, t, b.dataset.i);
      else if (b.hasAttribute("data-again")) H.aimAgain();
      /* a mouse click hands the keys back to the field, so Space fires; from
         the keyboard the focus stays where it is (F6 goes back to the field) */
      if (!b.dataset.step && ev.detail !== 0) b.blur();
    });
  };
  H.aimAgain = () => {
    const t = cb && cb.human();
    if (!t || !t.lastShot) { SP.Sfx.play("nope"); return; }
    G.setAim(cb.state(), t.lastShot.angle, t.lastShot.power);
    SP.Sfx.play("blip");
  };
  function useItem(s, t, id) {
    const x = SP.BY_ID[id];
    if (x.kind === "fuel") return cb.drive();
    if (x.kind === "parachute") return H.banner("Parachutes open by themselves when you fall", 1600);
    if (x.kind === "autodefense") return H.banner("Auto Defense raises your best shield each round", 1600);
    if (x.kind === "lazyboy" && (t.target < 0 || !s.tanks[t.target] || !s.tanks[t.target].alive)) { const e = Tk.nearestEnemy(s, t); if (e) t.target = e.id; }
    const ok = Tk.use(s, t, id);
    SP.Sfx.play(ok ? "blip" : "nope");
    if (ok && x.kind === "guide") H.banner(t.guide === id ? `<b>${esc(x.name)}</b> armed for the next shot` : `${esc(x.name)} put away`, 1300);
    if (ok && x.kind === "lazyboy") H.banner(`Aimed at <b>${esc(s.tanks[t.target].name)}</b>`, 1300);
  }

  let bannerT = null;
  H.banner = (html, ms = 1600) => {
    const b = $("banner");
    b.innerHTML = html;
    b.classList.add("on");
    clearTimeout(bannerT);
    bannerT = setTimeout(() => b.classList.remove("on"), ms);
  };
  H.say = msg => { $("live").textContent = msg; };

  /* ---- the log: what each shot did, top left of the field, the last few ---- */
  const LOG_MAX = 4;
  H.log = (html, o = {}) => {
    const ol = $("log"), li = document.createElement("li");
    li.innerHTML = html;
    if (o.you) li.className = "you";
    ol.appendChild(li);
    while (ol.children.length > LOG_MAX) ol.firstElementChild.remove();
    /* older lines step back so the newest reads first */
    [...ol.children].forEach((el, i, all) => el.classList.toggle("old", i < all.length - 2));
  };
  H.clearLog = () => { $("log").innerHTML = ""; };

  /* ---- the coach: a note for the first turn, until the first shot ---- */
  H.coach = html => {
    const c = $("coach");
    if (!html) { c.hidden = true; c.innerHTML = ""; return; }
    c.innerHTML = html;
    c.hidden = false;
  };
})();
