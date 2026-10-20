/* Scorched Puma -- boot, title, the match from shop to standings, the loop.
 *
 * The greykit.games integrated intro (games-meta STANDARD.md §14, the shared
 * gk-intro.js over the canon @gk-title boot): the boot with its meow, a press
 * to let the sound in where the browser wants one, then the default title
 * fading up over computer tanks having at it, heard low and muffled behind
 * it, with the Sound switch and the credit under the menu.
 *
 * The engine (js/engine/*) knows nothing of the page; this file feeds it
 * commands, ticks it sixty times a second, and turns what it reports
 * (s.events) into sound, damage numbers and the tanks' remarks. */
(() => {
  const SP = globalThis.SP, G = SP.Game, Tk = SP.Tanks, UI = SP.UI, H = SP.Hud, I = SP.Input;
  const $ = id => document.getElementById(id);
  const esc = UI.esc;
  const STEP = 1000 / SP.HZ;

  /* games-meta STANDARD.md §5: every key starts with the game's name */
  const KEY_MATCH = "scorchedpuma_match_v1", KEY_SETUP = "scorchedpuma_setup_v1", KEY_PREFS = "scorchedpuma_prefs_v1";
  /* coached: the first-turn note has been shown and a shot fired after it */
  /* weak: 1.5's rule that damage weakens a tank's shots (SP.RULES.weaken); off unless switched on */
  const prefs = { talk: "sometimes", aim: false, speed: 2, coached: false, weak: false, ...SP.store.get(KEY_PREFS, {}) };
  SP.RULES.weaken = prefs.weak;
  const KEY_MUTED = "scorchedpuma_muted_v1";
  const readFlag = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch (e) { return d; } };
  const writeFlag = (k, on) => { try { localStorage.setItem(k, on ? "1" : "0"); } catch (e) { /* no storage */ } };
  let muted = readFlag(KEY_MUTED, false);
  SP.Sfx.muted = muted;

  const game = {
    mode: "boot", s: null, setup: null, r: null,
    fx: { floats: [], bubbles: [] }, ai: null, drive: false, paused: false,
    last: 0, acc: 0, roundWait: 0, roundEv: null, dragging: false,
    scene: null,
  };

  /* ---- sound (STANDARD.md §8) ---- */
  function toggleMute() {
    SP.Sfx.unlock();
    muted = !muted;
    SP.Sfx.setMuted(muted);
    writeFlag(KEY_MUTED, muted);
    syncSound();
    if (!muted) SP.Sfx.play("blip");
  }
  /* the bar's speaker, and the title's switch */
  function syncSound() {
    const b = $("snd");
    b.setAttribute("aria-pressed", String(!muted));
    b.classList.toggle("muted", muted);
    if (game.sw) game.sw.refresh();
  }
  /* the title's Sound switch (§14), which is M; no music, so no Music switch */
  const toggles = {
    sound: { get: () => !muted, set: on => { if (on === muted) toggleMute(); } },
  };
  const tick = () => gkTick(SP.Sfx.ctx(), SP.Sfx.fx());

  /* Settings' "Forget everything" (STANDARD.md §2): every key the game owns,
     found by its prefix, and only those -- every game on greykit.com shares
     one origin, so one storage. */
  SP.forgetEverything = () => {
    for (const area of ["localStorage", "sessionStorage"]) {
      try {
        const st = window[area];
        for (let i = st.length - 1; i >= 0; i--) {
          const k = st.key(i);
          if (k && k.startsWith("scorchedpuma")) st.removeItem(k);
        }
      } catch (e) { /* no storage */ }
    }
    location.reload();
  };

  function changeSetting(key, val) {
    if (key === "mute") { if ((val === "1") !== muted) toggleMute(); return; }
    if (key === "talk") prefs.talk = val;
    if (key === "aim") prefs.aim = val === "1";
    if (key === "speed") prefs.speed = +val;
    if (key === "weak") {
      prefs.weak = SP.RULES.weaken = val === "1";
      /* switched on mid-match: no tank keeps more power than it now may have */
      if (game.s) for (const t of game.s.tanks) t.power = Math.min(t.power, SP.Tanks.maxPower(t));
    }
    SP.store.set(KEY_PREFS, prefs);
  }

  /* ---- the title ---- */
  function titleCfg() {
    const saved = SP.store.get(KEY_MATCH, null);
    const meta = saved && saved.s ? `round ${Math.max(1, saved.s.round)} of ${saved.s.opts.rounds}` : "";
    return {
      name: "Scorched Puma",
      primary: saved ? "resume" : "quick",
      items: [
        saved && { act: "resume", label: "Resume game", key: "R", meta },
        { act: "quick", label: "New quick game", key: "N", meta: "you and seven others" },
        { act: "custom", label: "Custom game", key: "C", meta: "2 to 10 tanks, every option" },
        "gap",
        { act: "settings", label: "Settings", key: "S" },
        { act: "help", label: "Help", key: "?" },
        { act: "about", label: "About", key: "A" },
      ],
      scene: true
    };
  }
  /* integrate: the credit under the menu, the switches, the ticks (§14);
     the intro does it itself the first time */
  function openTitle(integrate = true) {
    game.mode = "title";
    game.s = null;
    game.paused = false;
    const t = $("title");
    t.innerHTML = titleHTML(titleCfg());
    t.querySelector("h1").insertAdjacentHTML("afterend",
      '<p class="gk-sub"><span class="p">Pumas</span> vs. <span class="w">Wolves</span> · after Scorched Earth, 1991</p>');
    t.hidden = false;
    $("game").hidden = true;
    document.body.classList.add("on-title");
    const cv = document.createElement("canvas");
    t.querySelector(".scene").appendChild(cv);
    game.scene = { r: new SP.Renderer(cv), s: null, ai: null, fx: { floats: [], bubbles: [] } };
    attractRound();
    if (integrate) game.sw = gkIntegrate(t.querySelector(".gk-title"), { toggles, tick });
  }
  function titleKey(ev) {
    const k = ev.key;
    if (k === "Enter" || k === " " || k === "Tab" || k === "Shift") return;
    const menu = document.querySelector("#title .gk-menu"), hit = menu && titleKeyButton(menu, k);
    if (hit) { ev.preventDefault(); titleAct(hit.dataset.act); return; }
    if (menu) titleArrow(menu, ev);
  }
  async function titleAct(a) {
    SP.Sfx.play("blip");
    const saved = SP.store.get(KEY_MATCH, null);
    if (a === "resume") return resumeMatch();
    if (a === "quick" || a === "custom") {
      if (saved && !(await UI.ask("Start a new match? The one in progress, " + titleCfg().items[0].meta + ", will be lost.", "Start a new match", "Abandon this match?"))) return;
      if (a === "quick") return startMatch(quickSetup());
      const setup = SP.store.get(KEY_SETUP, null) || defaultSetup();
      setup.opts = { ...SP.DEFAULT_OPTS, ...setup.opts };
      return UI.custom(setup, () => { SP.store.set(KEY_SETUP, setup); startMatch(setup); });
    }
    if (a === "settings") return UI.settings(prefs, changeSetting);
    if (a === "help") return UI.help();
    if (a === "about") return UI.about();
  }

  /* the attract mode behind the title: computer tanks having at it */
  function attractRound() {
    const sc = game.scene;
    if (!sc) return;
    if (!sc.s || sc.s.phase === "matchOver") {
      const types = ["shooter", "tosser", "chooser", "poolshark", "spoiler", "moron"];
      const n = 5, players = [];
      for (let i = 0; i < n; i++) {
        const faction = i % 2 ? "wolf" : "puma";
        players.push({ name: "", faction, kind: "ai", ai: types[Math.floor(Math.random() * types.length)] });
      }
      const fake = { players: [] };
      for (const p of players) { p.name = UI.freshName(fake, p.faction); fake.players.push(p); }
      sc.s = G.newMatch({ players, w: fieldWidth(innerHeight), opts: { rounds: 1e6, cash: 0, walls: "random", sky: "random" } }, (Math.random() * 2 ** 32) >>> 0);
    }
    const s = sc.s;
    for (const t of s.tanks) for (const [id, n] of [["missile", 6], ["babynuke", 1], ["funky", 1], ["mirv", 1], ["napalm", 2], ["roller", 2], ["leapfrog", 1], ["parachute", 2]]) t.inv[id] = n;
    G.startRound(s);
    s.events.length = 0;
    sc.ai = null;
    sc.fx = { floats: [], bubbles: [] };
  }
  function attractStep() {
    const sc = game.scene, s = sc && sc.s;
    if (!s) return;
    if (s.phase === "aim") aiStep(sc);
    else if (s.phase === "resolve") { G.tick(s); G.tick(s); }
    else { if (!sc.wait) sc.wait = 90; if (--sc.wait === 0) attractRound(); }
    /* heard once the intro has brought the title in, never under the boot */
    handleEvents(sc, game.entering === false && "far");
    tickFx(sc.fx);
  }

  /* ---- matches ---- */
  const defaultSetup = () => ({
    players: [
      { name: "You", faction: "puma", kind: "human" },
      { name: "Grey Fang", faction: "wolf", kind: "ai", ai: "shooter" },
      { name: "Catamount", faction: "puma", kind: "ai", ai: "tosser" },
      { name: "Lobo", faction: "wolf", kind: "ai", ai: "chooser" },
    ],
    opts: { ...SP.DEFAULT_OPTS },
  });
  /* eight tanks, every one for itself: the 1991 game was chaos */
  const quickSetup = () => ({
    players: [
      { name: "You", faction: "puma", kind: "human" },
      { name: "Grey Fang", faction: "wolf", kind: "ai", ai: "shooter" },
      { name: "Catamount", faction: "puma", kind: "ai", ai: "tosser" },
      { name: "Howler", faction: "wolf", kind: "ai", ai: "tosser" },
      { name: "Tawny", faction: "puma", kind: "ai", ai: "moron" },
      { name: "Lobo", faction: "wolf", kind: "ai", ai: "moron" },
      { name: "Ghost Cat", faction: "puma", kind: "ai", ai: "poolshark" },
      { name: "Fenris", faction: "wolf", kind: "ai", ai: "chooser" },
    ],
    opts: { ...SP.DEFAULT_OPTS, rounds: 5 },
  });

  function enterPlay() {
    game.mode = "play";
    game.scene = null;
    game.paused = false;
    game.ai = null; game.drive = false; game.roundWait = 0; game.hurry = false;
    game.fx = { floats: [], bubbles: [] };
    tally = null;
    I.clear();
    H.reset();
    H.clearLog();
    H.coach(null);
    $("title").hidden = true;
    $("title").innerHTML = "";
    game.sw = null;
    $("game").hidden = false;
    document.body.classList.remove("on-title");
    fit();
  }
  /* a match's field is as wide as the window, for the field's height of SP.H:
     the room over the console now, as a width (between SP.W and SP.MAX_W) */
  function fieldWidth(room = innerHeight - ($("console").offsetHeight || 134)) {
    return Math.round(SP.H * innerWidth / Math.max(1, room));
  }
  function startMatch(setup) {
    game.setup = JSON.parse(JSON.stringify(setup));
    /* the game screen up first, so the console can be measured for the field's width */
    game.s = null;
    enterPlay();
    game.setup.w = fieldWidth();
    game.s = G.newMatch(game.setup);
    fit();
    G.aiShop(game.s);
    save();
    shops(beginRound);
  }
  function resumeMatch() {
    const o = SP.store.get(KEY_MATCH, null);
    if (!o) return;
    try { game.s = G.load(o.s); } catch (e) { SP.store.del(KEY_MATCH); return openTitle(); }
    game.setup = o.setup;
    enterPlay();
    const s = game.s;
    if (s.phase === "shop") shops(beginRound);
    else if (s.phase === "roundOver") showScoreboard({ last: false });
    else if (s.phase === "aim") turnBanner();
    else openTitle();
  }
  function save() {
    const s = game.s;
    if (game.test) return;
    if (!s || s.phase === "matchOver") { SP.store.del(KEY_MATCH); return; }
    const snap = G.save(s);
    if (snap) SP.store.set(KEY_MATCH, { setup: game.setup, s: snap });
  }
  function toTitle() {
    UI.close(true);
    openTitle();
    revealTitle();
  }

  /* the humans shop one after another; the computer has already shopped */
  function shops(done) {
    const s = game.s, humans = s.tanks.filter(t => t.kind === "human");
    let i = 0;
    const next = () => { if (i < humans.length) UI.shop(s, humans[i++], next); else done(); };
    next();
  }
  function beginRound() {
    const s = game.s;
    G.startRound(s);
    H.reset();
    H.clearLog();
    tally = null;
    const wall = SP.WALLS[s.wall].split(":")[0];
    H.banner(`Round <b>${s.round}</b> of ${s.opts.rounds} · ${esc(wall)} walls`, 2200);
    s.events = s.events.filter(e => e.e !== "turn");
    turnBanner(true);
    save();
  }
  /* a new turn: the banner for a human's, with what just happened to them
     (said) in front of it, and the first-turn note if it hasn't been read */
  function turnBanner(quiet, said = null) {
    const t = G.current(game.s);
    if (!t) return;
    game.drive = false;
    game.hurry = false;
    I.clear();
    if (t.kind === "human") {
      if (!quiet || said) H.banner((said ? said.html + " · " : "") + `<b>${esc(t.name)}</b> · your shot`, said ? 2600 : 1300);
      if (!quiet) SP.Sfx.play("turn");
      coach(t);
    } else if (said) H.banner(said.html, 2600);
    H.say((said ? said.text + ". " : "") + t.name + "'s turn");
  }
  function coach(t) {
    if (prefs.coached || game.test) return;
    const w = game.s.wind, wind = w === 0 ? "calm today" : `${Math.abs(w)} ${w < 0 ? "◀" : "▶"} now`;
    H.coach(`<p><b>Your shot.</b> <kbd>←</kbd> <kbd>→</kbd> turn the turret, <kbd>↑</kbd> <kbd>↓</kbd> set the power, <kbd>Space</kbd> fires. Or press on the field and drag.</p>` +
      `<p>The arrow from your barrel is your aim, its angle and power at the tip. It is not where the shell lands: gravity pulls it down and the wind (${wind}) pushes it. Fire, then correct from the cross where it came down.</p>`);
  }
  function showScoreboard(ev) {
    const s = game.s;
    SP.Sfx.play(ev.last ? "win" : "turn");
    UI.scoreboard(s, ev, act => {
      if (act === "next") {
        G.toShop(s);
        G.aiShop(s);
        save();
        shops(beginRound);
      } else if (act === "again") {
        SP.store.del(KEY_MATCH);
        startMatch(game.setup);
      } else {
        SP.store.del(KEY_MATCH);
        toTitle();
      }
    });
  }

  /* ---- a computer player's turn, shown: a pause, the turret swinging round, the shot ---- */
  function aiStep(ctx) {
    const s = ctx.s, t = G.current(s);
    /* hurried: every human out of the round, Fast in Settings, or Space pressed this turn */
    const quick = ctx.fast || ctx.hurry || (ctx === game && prefs.speed >= 4);
    const fast = quick ? 3 : 1;
    if (!ctx.ai) ctx.ai = { wait: quick ? 6 : 22, plan: null, settle: 0 };
    const a = ctx.ai;
    if (ctx.hurry && a.wait > 2) a.wait = 2;
    if (a.wait > 0) { a.wait--; return; }
    if (!a.plan) { a.plan = SP.AI.plan(s, t); t.weapon = a.plan.weapon; return; }
    const da = a.plan.angle - t.angle, dp = a.plan.power - t.power;
    if (da || dp) {
      t.angle += Math.sign(da) * Math.min(Math.abs(da), 2 * fast);
      t.power += Math.sign(dp) * Math.min(Math.abs(dp), 20 * fast);
      return;
    }
    if (a.settle++ < 10 / fast) return;
    ctx.ai = null;
    G.fire(s, a.plan);
  }

  /* ---- what the engine reports ---- */
  /* sound: true for the match, "far" for the battle behind the title (low
     and muffled), false for none */
  function handleEvents(ctx, sound) {
    const s = ctx.s, fx = ctx.fx, r = ctx.r || game.r;
    const play = n => { if (sound) SP.Sfx.play(n, sound === "far"); };
    for (const e of s.events) {
      if (ctx === game) track(s, e);
      switch (e.e) {
        case "fire": {
          const t = s.tanks[e.tank];
          play(e.kind === "laser" ? "laser" : e.kind === "plasma" ? "plasma" : e.kind === "riotcharge" ? "riot" : "fire");
          const tg = s.tanks[t.target] && s.tanks[t.target].alive ? s.tanks[t.target] : aimedAt(s, t);
          const line = SP.Talk.attack(prefs.talk, t, tg);
          if (line) { say(fx, t.id, line); play("talk"); }
          break;
        }
        case "boom":
          if (sound) SP.Sfx.boom(e.r, e.riot, sound === "far");
          if (e.r >= 25 && !e.riot) r.shake = Math.min(9, r.shake + e.r / 9);
          if (e.r >= 60) r.flash = 0.35;
          break;
        case "hit":
          fx.floats.push({ x: e.x, y: e.y - 10, text: "-" + e.amount, colour: e.amount >= 30 ? "#ff5a5a" : "#ffd23f", life: 70 });
          break;
        case "dying": {
          const line = SP.Talk.death(prefs.talk, s.tanks[e.tank]);
          if (line) say(fx, e.tank, line);
          break;
        }
        case "tankDead": play("tankDead"); break;
        case "shieldHit": case "shieldUp": case "shieldDown": case "chute": case "battery": case "split": case "napalm": case "dig": case "roll": case "dirt":
          play(e.e); break;
        case "bounce": if (!e.sim) play("bounce"); break;
        case "disrupt": play("dirt"); break;
        case "turn":
          if (ctx === game) { turnBanner(false, told(s)); save(); }
          break;
        case "roundOver":
          /* saved as between rounds, or, the match over, the save cleared */
          if (ctx === game) {
            const said = told(s);
            if (said) { H.banner(said.html, 2400); H.say(said.text); }
            game.roundWait = 75; game.roundEv = e; save();
          }
          break;
      }
    }
    s.events.length = 0;
  }

  /* ---- what a shot did ----
   * From the first "fire" of a turn to the next turn (or the round's end),
   * the hits, the kills and the money are gathered; then each shooter gets a
   * line in the log, and what touched a human comes back for the banner and
   * the screen reader. */
  let tally = null;
  function track(s, e) {
    if (e.e === "fire") {
      if (!tally) tally = { shooters: [], weapon: {}, cash: s.tanks.map(t => t.cash), hits: [], deaths: [] };
      if (!tally.shooters.includes(e.tank)) tally.shooters.push(e.tank);
      if (!tally.weapon[e.tank]) tally.weapon[e.tank] = e.weapon;
    } else if (e.e === "hit" && tally) tally.hits.push(e);
    else if (e.e === "dying" && tally) tally.deaths.push(e);
  }
  const HARMLESS = ["riotcharge", "riotbomb", "dirt", "liquid", "dirtcharge", "disrupter", "digger", "tracer"];
  const signed = n => (n < 0 ? "−" : "+") + SP.money(Math.abs(n));
  function told(s) {
    const t = tally;
    tally = null;
    if (!t) return null;
    const swatch = k => '<span class="sw" style="background:' + k.colour + '"></span>';
    const mine = [], plain = [];
    for (const id of t.shooters) {
      const sh = s.tanks[id], dealt = new Map();
      for (const h of t.hits) if (h.by === id) dealt.set(h.tank, (dealt.get(h.tank) || 0) + h.amount);
      const killed = new Set(t.deaths.filter(d => d.by === id).map(d => d.tank));
      const money = sh.cash - t.cash[id];
      const touches = [...dealt.keys()].some(v => s.tanks[v].kind === "human");
      /* the log: shooter, then each tank it hurt, then what it was paid */
      const hurt = [...dealt].map(([v, n]) => {
        const vt = s.tanks[v];
        return swatch(vt) + esc(v === id ? "itself" : vt.name) + ' <b class="dmg">−' + n + "</b>" + (killed.has(v) ? ' <span class="ko">destroyed</span>' : "");
      });
      const w = SP.BY_ID[t.weapon[id]];
      const what = hurt.length ? hurt.join(" ") : HARMLESS.includes(w && w.kind) ? "fired " + esc(w.name) : '<span class="miss">missed</span>';
      H.log(swatch(sh) + "<b>" + esc(sh.name) + "</b> " + what + (money ? ' <span class="' + (money > 0 ? "paid" : "cost") + '">' + signed(money) + "</span>" : ""),
        { you: sh.kind === "human" || touches });
      /* the banner and the reader: a human's own shot, or what was done to a human */
      if (sh.kind === "human") {
        const parts = [...dealt].map(([v, n]) => (v === id ? "hit yourself" : "hit " + s.tanks[v].name) + " −" + n + (killed.has(v) ? ", destroyed" : ""));
        const said = parts.length ? parts.join(", ") : HARMLESS.includes(w && w.kind) ? "" : "missed" + (s.wind ? ", wind " + Math.abs(s.wind) + (s.wind < 0 ? " ◀" : " ▶") : "");
        if (said || money) {
          const lead = (t.shooters.length > 1 || s.tanks.filter(k => k.kind === "human").length > 1 ? sh.name + ": " : "");
          const line = lead + (said ? said[0].toUpperCase() + said.slice(1) : "") + (money ? (said ? " · " : "") + signed(money) : "");
          mine.push(esc(line).replace(/(−\d+|[+−]\$[\d,]+)/g, "<b>$1</b>"));
          plain.push(line);
        }
      } else if (touches) {
        for (const [v, n] of dealt) if (s.tanks[v].kind === "human") {
          const line = sh.name + " hit " + (s.tanks[v].name === "You" ? "you" : s.tanks[v].name) + " −" + n + (killed.has(v) ? ", destroyed" : "");
          mine.push(esc(line).replace(/(−\d+)/g, "<b>$1</b>"));
          plain.push(line);
        }
      }
    }
    /* a human hurt by nobody's shot: a fall from dirt that just gave way */
    for (const h of t.hits) if (h.by < 0 && s.tanks[h.tank].kind === "human") {
      const line = s.tanks[h.tank].name + (h.why === "fall" ? " fell" : " took") + " −" + h.amount;
      H.log(swatch(s.tanks[h.tank]) + esc(line), { you: true });
      mine.push(esc(line)); plain.push(line);
    }
    return mine.length ? { html: mine.join(" · "), text: plain.join(". ") } : null;
  }
  /* who a shot is meant for, when nobody said: the nearest tank the turret faces */
  function aimedAt(s, t) {
    const right = t.angle < 90;
    let best = null, bd = Infinity;
    for (const o of s.tanks) {
      if (o === t || !o.alive || o.health <= 0 || (o.x > t.x) !== right) continue;
      const d = Math.abs(o.x - t.x);
      if (d < bd) { bd = d; best = o; }
    }
    return best || Tk.nearestEnemy(s, t);
  }
  function say(fx, tank, text) {
    fx.bubbles = fx.bubbles.filter(b => b.tank !== tank);
    fx.bubbles.push({ tank, text, life: 150 + text.length * 3 });
    if (fx.bubbles.length > 3) fx.bubbles.shift();
  }
  function tickFx(fx) {
    for (const f of fx.floats) { f.y -= 0.35; f.life--; }
    fx.floats = fx.floats.filter(f => f.life > 0);
    for (const b of fx.bubbles) b.life--;
    fx.bubbles = fx.bubbles.filter(b => b.life > 0);
  }

  /* ---- one engine step of the match ---- */
  function playStep() {
    const s = game.s;
    /* with every human out of the round, the rest is the computer's: hurry it */
    game.fast = !s.tanks.some(t => t.kind === "human" && t.alive && t.health > 0);
    if (s.phase === "aim") {
      const t = G.current(s);
      if (t.kind === "ai") aiStep(game);
      else I.tick(s, t, game.drive);
    } else if (s.phase === "resolve") {
      const n = game.fast ? Math.max(4, prefs.speed) : prefs.speed;
      for (let i = 0; i < n && s.phase === "resolve"; i++) G.tick(s);
    }
    handleEvents(game, true);
    tickFx(game.fx);
    if (game.roundWait > 0 && --game.roundWait === 0) showScoreboard(game.roundEv);
  }

  const humanAiming = () => {
    const s = game.s;
    if (!s || s.phase !== "aim") return null;
    const t = G.current(s);
    return t && t.kind === "human" ? t : null;
  };
  function fire() {
    const t = humanAiming();
    if (!t || game.paused || UI.isOpen()) return;
    game.drive = false;
    I.clear();
    if (!$("coach").hidden) { H.coach(null); if (!game.test) { prefs.coached = true; SP.store.set(KEY_PREFS, prefs); } }
    G.fire(game.s);
  }
  /* Space on a computer player's turn: it stops dawdling */
  function hurry() {
    const s = game.s, t = s && G.current(s);
    if (game.paused || !t || t.kind !== "ai" || s.phase !== "aim" || game.hurry) return;
    game.hurry = true;
    SP.Sfx.play("blip");
  }
  /* F6: into the console and back out to the field */
  function focusConsole() {
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#console")) { document.activeElement.blur(); return; }
    const con = $("console"), b = con.querySelector(".wb.sel") || con.querySelector(".wb, #c-fire:not(:disabled), #snd");
    if (b) b.focus();
  }
  function toggleDrive() {
    const t = humanAiming();
    if (!t) return;
    if (!game.drive && Tk.fuelLeft(t) <= 0) { H.banner("No fuel: the shop sells it", 1200); SP.Sfx.play("nope"); return; }
    game.drive = !game.drive;
    I.clear();
    H.banner(game.drive ? "Driving: <b>← →</b> to move, <b>F</b> to stop" : "Aiming", 1200);
  }
  function pause() {
    if (game.mode !== "play" || UI.isOpen()) return;
    game.paused = true;
    I.clear();
    UI.pause(a => {
      if (a === "resume") game.paused = false;
      else if (a === "settings") UI.settings(prefs, changeSetting);
      else if (a === "help") UI.help();
      else if (a === "title") { save(); toTitle(); }
    });
  }

  /* ---- the loop ---- */
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(100, now - (game.last || now));
    game.last = now;
    if (game.mode === "title" && game.scene) {
      game.acc += dt;
      let n = 0;
      while (game.acc >= STEP && n++ < 4) { game.acc -= STEP; attractStep(); }
      if (n >= 4) game.acc = 0;
      const sc = game.scene;
      if (sc.s) sc.r.draw(sc.s, { ...sc.fx, current: sc.s.phase === "aim" ? G.current(sc.s).id : null, names: false });
      return;
    }
    if (game.mode !== "play" || !game.s) return;
    const blocked = game.paused || UI.isOpen() || document.querySelector(".gk-sheet");
    if (!blocked) {
      game.acc += dt;
      let n = 0;
      while (game.acc >= STEP && n++ < 4) { game.acc -= STEP; playStep(); if (game.mode !== "play") return; }
      if (n >= 4) game.acc = 0;
    } else game.acc = 0;
    const s = game.s, t = G.current(s), human = humanAiming();
    game.r.draw(s, {
      ...game.fx,
      current: s.phase === "aim" && t ? t.id : null,
      aim: prefs.aim && !!human,
      target: human && human.target >= 0 ? human.target : null,
      /* while the computer plays, a mark over your tank so it is easy to find */
      you: !human && s.phase !== "resolve" ? (() => { const me = H.me(s); return me && me.kind === "human" && me.alive ? me.id : null; })() : null,
      /* the console's marks: where the aim points, where it pointed last turn, where that shot came down */
      marks: human ? {
        aim: I.markFor(human, human.angle, human.power),
        last: human.lastShot ? I.markFor(human, human.lastShot.angle, human.lastShot.power) : null,
        landed: human.lastShot && human.lastShot.x !== null ? { x: human.lastShot.x, y: human.lastShot.y } : null,
        colour: human.colour,
      } : null,
    });
    H.update(s, game);
    /* paused with nothing on screen (Settings or Help, opened from the pause, has closed): the pause comes back */
    if (game.paused && !UI.isOpen() && !document.querySelector(".gk-sheet")) { game.paused = false; pause(); }
  }

  /* ---- the field's size: as big as fits under the bar, whole pixels where that's close ---- */
  function fit() {
    const hud = $("console").offsetHeight || 96;
    const aw = innerWidth, ah = innerHeight - hud, fw = game.s ? game.s.terrain.w : SP.W;
    const s0 = Math.max(0.5, Math.min(aw / fw, ah / SP.H)), si = Math.floor(s0);
    /* whole pixels only when that costs next to nothing: the field fills the window */
    const sc = si >= 1 && si / s0 > 0.97 ? si : s0;
    const cv = $("field"), w = Math.floor(fw * sc), h = Math.floor(SP.H * sc);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    /* the field's inset in the stage, for the log and the coach to sit inside it */
    $("stage").style.setProperty("--fx", Math.max(0, Math.floor((aw - w) / 2)) + "px");
    $("stage").style.setProperty("--fy", Math.max(0, Math.floor((ah - h) / 2)) + "px");
  }
  addEventListener("resize", fit);

  /* ---- keys ---- */
  /* the Konami code, in a match or its shop: every weapon and item, 99 of each */
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let konami = 0;
  function konamiKey(ev) {
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    konami = k === KONAMI[konami] ? konami + 1 : k === KONAMI[0] ? 1 : 0;
    if (konami < KONAMI.length) return false;
    konami = 0;
    const s = game.s, t = UI.shopping || (s && H.me(s));
    if (game.mode !== "play" || !t || t.kind !== "human") return false;
    for (const x of SP.ALL) if (!x.free) t.inv[x.id] = 99;
    SP.Sfx.play("buy");
    H.banner(`<b>${esc(t.name)}</b> · every weapon and item, ×99`, 2400);
    H.say(t.name + " has every weapon and item, 99 of each");
    UI.refresh();
    save();
    return true;
  }
  document.addEventListener("keydown", ev => {
    SP.Sfx.unlock();
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    /* a key on the boot is the intro's: it continues, and does nothing else */
    if (document.querySelector(".gk-boot")) return;
    if (!ev.repeat && konamiKey(ev)) { ev.preventDefault(); return; }
    if (UI.key(ev)) return;
    if (document.querySelector(".gk-sheet")) return;        // a canon question is up: it has the keys
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    const typing = ev.target.closest && ev.target.closest("input,select,textarea");
    if (k === "m" && !typing) { toggleMute(); return; }
    if (game.mode === "title") return titleKey(ev);
    if (game.mode !== "play" || !game.s) return;
    if (k === "Escape" || k === "p" || k === "Pause") { ev.preventDefault(); return pause(); }
    if (k === "?" || k === "h" || k === "/") { ev.preventDefault(); return UI.help(); }
    if (k === "F6") { ev.preventDefault(); return focusConsole(); }
    /* in the console the keyboard works the page way: Tab moves, Space and Enter press */
    const inConsole = ev.target.closest && ev.target.closest("#console");
    if (inConsole && (k === "Tab" || k === " " || k === "Enter")) return;
    const t = humanAiming();
    if (!t) { if ((k === " " || k === "Enter") && !ev.repeat) { ev.preventDefault(); hurry(); } return; }
    if (I.isAimKey(ev.code)) { ev.preventDefault(); I.down(ev, game.s, t, game.drive); return; }
    if (k === " " || k === "Enter") { ev.preventDefault(); if (!ev.repeat) fire(); return; }
    if (k === "Tab") { ev.preventDefault(); G.cycleWeapon(game.s, ev.shiftKey ? -1 : 1); SP.Sfx.play("blip"); return; }
    if (/^[0-9]$/.test(k)) {
      const list = SP.WEAPONS.filter(w => Tk.count(t, w.id) > 0), w = list[k === "0" ? 9 : +k - 1];
      if (w) { t.weapon = w.id; SP.Sfx.play("blip"); } else SP.Sfx.play("nope");
      return;
    }
    if (k === "a") return H.aimAgain();
    if (k === "i") return UI.items(game.s, t, a => { if (a === "drive") game.drive = true; });
    if (k === "w") return UI.weapons(game.s, t, id => { t.weapon = id; });
    if (k === "t") { Tk.cycleTarget(game.s, t); SP.Sfx.play("blip"); return; }
    if (k === "l") { prefs.aim = !prefs.aim; SP.store.set(KEY_PREFS, prefs); H.banner("Aim aid " + (prefs.aim ? "on" : "off"), 900); return; }
    if (k === "f") toggleDrive();
  });
  document.addEventListener("keyup", ev => I.up(ev));
  addEventListener("blur", () => { I.clear(); if (game.mode === "play" && game.s && !UI.isOpen()) pause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && game.mode === "play" && !UI.isOpen()) pause(); });

  /* ---- the mouse on the field ---- */
  const fieldXY = ev => {
    const r = $("field").getBoundingClientRect();
    return [(ev.clientX - r.left) / r.width * game.s.terrain.w, (ev.clientY - r.top) / r.height * SP.H];
  };
  $("field").addEventListener("pointerdown", ev => {
    const t = humanAiming();
    if (!t || game.drive || game.paused) return;
    game.dragging = true;
    $("field").setPointerCapture(ev.pointerId);
    I.pointerAim(game.s, t, ...fieldXY(ev));
  });
  $("field").addEventListener("pointermove", ev => {
    const t = humanAiming();
    if (game.dragging && t) I.pointerAim(game.s, t, ...fieldXY(ev));
  });
  const endDrag = () => { game.dragging = false; };
  $("field").addEventListener("pointerup", endDrag);
  $("field").addEventListener("pointercancel", endDrag);
  $("field").addEventListener("wheel", ev => {
    const t = humanAiming();
    if (!t) return;
    ev.preventDefault();
    G.setAim(game.s, t.angle, t.power + (ev.deltaY < 0 ? 1 : -1) * (ev.shiftKey ? 1 : 10));
  }, { passive: false });

  /* ---- the bar's buttons ---- */
  $("c-fire").addEventListener("click", ev => { fire(); if (ev.detail !== 0) ev.currentTarget.blur(); });
  H.bind({ human: humanAiming, state: () => game.s, drive: toggleDrive, relayout: fit });
  $("snd").addEventListener("click", toggleMute);
  $("pausebtn").addEventListener("click", pause);
  $("title").addEventListener("click", ev => { const b = ev.target.closest("[data-act]"); if (b) titleAct(b.dataset.act); });
  addEventListener("pointerdown", () => SP.Sfx.unlock(), true);

  /* ?debug puts the game on the window, for poking at from the console */
  if (/[?&]debug(=|&|$)/.test(location.search)) globalThis.SPDEBUG = game;

  /* ---- boot ---- */
  /* The title's entrance, in ms from the title's arrival, when the battle
   * behind it starts to be heard: "Scorched" then "Puma" decoding, then the
   * menu. */
  const INTRO = { name: 500, step: 650, menu: 2200, done: 3400 };
  function boot() {
    injectTitleCSS();
    syncSound();
    game.r = new SP.Renderer($("field"));
    const q = new URLSearchParams(location.search);
    const small = matchMedia("(max-width: 759px), (max-height: 479px)").matches;
    const saved = SP.store.get(KEY_MATCH, null);
    const lines = [bootReloadLine(), "terrain: seeded", "puma arms: open"], more = [saved ? "a match in progress" : "wolf surplus: open"];
    /* the integrated intro, but not on a small screen (the page asks for a
       computer) or in the ?test sandbox */
    if (small || q.has("test")) { openTitle(); revealTitle(); }
    else {
      /* the boot's meow at canon's own level, straight out rather than
         through the game's quieter effects */
      const intro = startIntro({ lines, audio: SP.Sfx.ctx, bootSound: (ac, out, o) => { if (!muted) gkBootSound(ac, ac.destination, o); } });
      game.entering = true;
      openTitle(false);
      intro.finish({
        more, name: "decode", timing: INTRO, toggles, tick,
        /* ?hold=always holds for the press even where the browser would
           already play sound (a launch from the arcade, the in-app browser) */
        hold: q.get("hold") === "always" ? "always" : "auto",
        onContinue: () => SP.Sfx.unlock(),
        onTitle: () => { game.entering = false; },
      }).then(r => { game.sw = r.toggles; });
    }
    requestAnimationFrame(frame);
    /* ?test=<weapon>: a sandbox to try weapons in, nothing saved */
    const test = new URLSearchParams(location.search).get("test");
    if (test) {
      game.setup = { players: [{ name: "You", faction: "puma", kind: "human" }, { name: "Target", faction: "wolf", kind: "ai", ai: "moron" }, { name: "Dummy", faction: "wolf", kind: "ai", ai: "moron" }],
        opts: { rounds: 99, cash: 0, order: "robin", wind: "none" } };
      enterPlay();
      game.setup.w = fieldWidth();
      game.s = G.newMatch(game.setup);
      fit();
      game.test = true;
      for (const x of SP.ALL) if (!x.free) game.s.tanks[0].inv[x.id] = 99;
      G.startRound(game.s);
      if (SP.BY_ID[test]) game.s.tanks[0].weapon = test;
      H.banner("Sandbox: everything in stock, nothing saved", 2500);
    }
  }
  boot();
})();
