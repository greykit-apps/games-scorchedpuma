/* Scorched Puma -- boot, title, the match from shop to standings, the loop.
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
  const prefs = { talk: "sometimes", aim: false, speed: 2, ...SP.store.get(KEY_PREFS, {}) };
  let muted = false;
  try { muted = localStorage.getItem("scorchedpuma_muted_v1") === "1"; } catch (e) { /* no storage */ }
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
    try { localStorage.setItem("scorchedpuma_muted_v1", muted ? "1" : "0"); } catch (e) { /* no storage */ }
    syncSound();
    if (!muted) SP.Sfx.play("blip");
  }
  function syncSound() {
    const b = $("snd");
    b.setAttribute("aria-pressed", String(!muted));
    b.classList.toggle("muted", muted);
  }

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
        { act: "quick", label: "New quick game", key: "N", meta: "you and three wolves" },
        { act: "custom", label: "Custom game", key: "C", meta: "2 to 10 tanks, every option" },
        "gap",
        { act: "settings", label: "Settings", key: "S" },
        { act: "help", label: "Help", key: "?" },
        { act: "about", label: "About", key: "A" },
      ],
      scene: true
    };
  }
  function openTitle() {
    game.mode = "title";
    game.s = null;
    game.paused = false;
    const t = $("title");
    t.innerHTML = titleHTML(titleCfg());
    t.querySelector(".gk-name h1").insertAdjacentHTML("afterend",
      '<p class="gk-sub"><span class="p">Pumas</span> vs. <span class="w">Wolves</span> · after Scorched Earth, 1991</p>');
    t.hidden = false;
    $("game").hidden = true;
    document.body.classList.add("on-title");
    const cv = document.createElement("canvas");
    t.querySelector(".scene").appendChild(cv);
    game.scene = { r: new SP.Renderer(cv), s: null, ai: null, fx: { floats: [], bubbles: [] } };
    attractRound();
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
      if (saved && !(await confirmSheet("Start a new match? The one in progress will be lost.", "New match"))) return;
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
      sc.s = G.newMatch({ players, opts: { rounds: 1e6, cash: 0, walls: "random", sky: "random" } }, (Math.random() * 2 ** 32) >>> 0);
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
    handleEvents(sc, false);
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
  const quickSetup = () => ({
    players: [
      { name: "You", faction: "puma", kind: "human" },
      { name: "Grey Fang", faction: "wolf", kind: "ai", ai: "shooter" },
      { name: "Howler", faction: "wolf", kind: "ai", ai: "tosser" },
      { name: "Lobo", faction: "wolf", kind: "ai", ai: "moron" },
    ],
    opts: { ...SP.DEFAULT_OPTS, rounds: 5 },
  });

  function enterPlay() {
    game.mode = "play";
    game.scene = null;
    game.paused = false;
    game.ai = null; game.drive = false; game.roundWait = 0;
    game.fx = { floats: [], bubbles: [] };
    I.clear();
    H.reset();
    $("title").hidden = true;
    $("title").innerHTML = "";
    $("game").hidden = false;
    document.body.classList.remove("on-title");
    fit();
  }
  function startMatch(setup) {
    game.setup = JSON.parse(JSON.stringify(setup));
    game.s = G.newMatch(game.setup);
    enterPlay();
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
    const wall = SP.WALLS[s.wall].split(":")[0];
    H.banner(`Round <b>${s.round}</b> of ${s.opts.rounds} · ${esc(wall)} walls`, 2200);
    s.events = s.events.filter(e => e.e !== "turn");
    turnBanner(true);
    save();
  }
  function turnBanner(quiet) {
    const t = G.current(game.s);
    if (!t) return;
    game.drive = false;
    I.clear();
    if (t.kind === "human" && !quiet) {
      H.banner(`<b>${esc(t.name)}</b> · your shot`, 1300);
      SP.Sfx.play("turn");
    }
    H.say(t.name + "'s turn");
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
    const fast = ctx.fast ? 3 : 1;
    if (!ctx.ai) ctx.ai = { wait: ctx.fast ? 6 : 22, plan: null, settle: 0 };
    const a = ctx.ai;
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
  function handleEvents(ctx, loud) {
    const s = ctx.s, fx = ctx.fx, r = ctx.r || game.r;
    const play = n => { if (loud) SP.Sfx.play(n); };
    for (const e of s.events) {
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
          if (loud) SP.Sfx.boom(e.r, e.riot);
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
          if (ctx === game) { turnBanner(); save(); }
          break;
        case "roundOver":
          /* saved as between rounds, or, the match over, the save cleared */
          if (ctx === game) { game.roundWait = 75; game.roundEv = e; save(); }
          break;
      }
    }
    s.events.length = 0;
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
    G.fire(game.s);
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
    });
    H.update(s, game);
    /* paused with nothing on screen (Settings or Help, opened from the pause, has closed): the pause comes back */
    if (game.paused && !UI.isOpen() && !document.querySelector(".gk-sheet")) { game.paused = false; pause(); }
  }

  /* ---- the field's size: as big as fits under the bar, whole pixels where that's close ---- */
  function fit() {
    const hud = $("hud").offsetHeight || 46;
    const aw = innerWidth, ah = innerHeight - hud;
    const s0 = Math.max(0.5, Math.min(aw / SP.W, ah / SP.H)), si = Math.floor(s0);
    const sc = si >= 1 && si / s0 > 0.85 ? si : s0;
    const cv = $("field");
    cv.style.width = Math.floor(SP.W * sc) + "px";
    cv.style.height = Math.floor(SP.H * sc) + "px";
  }
  addEventListener("resize", fit);

  /* ---- keys ---- */
  document.addEventListener("keydown", ev => {
    SP.Sfx.unlock();
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (UI.key(ev)) return;
    if (document.querySelector(".gk-sheet")) return;        // a canon question is up: it has the keys
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    const typing = ev.target.closest && ev.target.closest("input,select,textarea");
    if (k === "m" && !typing) { toggleMute(); return; }
    if (game.mode === "title") return titleKey(ev);
    if (game.mode !== "play" || !game.s) return;
    if (k === "Escape" || k === "p" || k === "Pause") { ev.preventDefault(); return pause(); }
    if (k === "?" || k === "h" || k === "/") { ev.preventDefault(); return UI.help(); }
    const t = humanAiming();
    if (!t) return;
    if (I.isAimKey(ev.code)) { ev.preventDefault(); I.down(ev, game.s, t, game.drive); return; }
    if (k === " " || k === "Enter") { ev.preventDefault(); if (!ev.repeat) fire(); return; }
    if (k === "Tab") { ev.preventDefault(); G.cycleWeapon(game.s, ev.shiftKey ? -1 : 1); SP.Sfx.play("blip"); return; }
    if (k === "i") return UI.items(game.s, t, a => { if (a === "drive") game.drive = true; });
    if (k === "w") return UI.weapons(game.s, t, id => { t.weapon = id; });
    if (k === "t") { Tk.cycleTarget(game.s, t); SP.Sfx.play("blip"); return; }
    if (k === "l") { prefs.aim = !prefs.aim; SP.store.set(KEY_PREFS, prefs); H.banner("Aim aid " + (prefs.aim ? "on" : "off"), 900); return; }
    if (k === "f") {
      if (!game.drive && Tk.fuelLeft(t) <= 0) { H.banner("No fuel: the shop sells it", 1200); SP.Sfx.play("nope"); return; }
      game.drive = !game.drive;
      I.clear();
      H.banner(game.drive ? "Driving: <b>← →</b> to move, <b>F</b> to stop" : "Aiming", 1200);
    }
  });
  document.addEventListener("keyup", ev => I.up(ev));
  addEventListener("blur", () => { I.clear(); if (game.mode === "play" && game.s && !UI.isOpen()) pause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && game.mode === "play" && !UI.isOpen()) pause(); });

  /* ---- the mouse on the field ---- */
  const fieldXY = ev => {
    const r = $("field").getBoundingClientRect();
    return [(ev.clientX - r.left) / r.width * SP.W, (ev.clientY - r.top) / r.height * SP.H];
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
  $("h-fire").addEventListener("click", fire);
  $("snd").addEventListener("click", toggleMute);
  $("pausebtn").addEventListener("click", pause);
  $("h-weapon").addEventListener("click", () => { const t = humanAiming(); if (t) UI.weapons(game.s, t, id => { t.weapon = id; }); });
  $("h-items").addEventListener("click", () => { const t = humanAiming(); if (t) UI.items(game.s, t, a => { if (a === "drive") game.drive = true; }); });
  $("title").addEventListener("click", ev => { const b = ev.target.closest("[data-act]"); if (b) titleAct(b.dataset.act); });
  addEventListener("pointerdown", () => SP.Sfx.unlock(), true);

  /* ?debug puts the game on the window, for poking at from the console */
  if (/[?&]debug(=|&|$)/.test(location.search)) globalThis.SPDEBUG = game;

  /* ---- boot ---- */
  function boot() {
    injectTitleCSS();
    syncSound();
    game.r = new SP.Renderer($("field"));
    const small = matchMedia("(max-width: 759px), (max-height: 479px)").matches;
    const saved = SP.store.get(KEY_MATCH, null);
    const run = small ? { finish: async () => {}, cancel() {} } : runBoot({ lines: [bootReloadLine(), "terrain: seeded", "puma arms: open"] });
    openTitle();
    run.finish([saved ? "a match in progress" : "wolf surplus: open"]).then(() => revealTitle());
    requestAnimationFrame(frame);
    /* ?test=<weapon>: a sandbox to try weapons in, nothing saved */
    const test = new URLSearchParams(location.search).get("test");
    if (test) {
      run.cancel();
      game.setup = { players: [{ name: "You", faction: "puma", kind: "human" }, { name: "Target", faction: "wolf", kind: "ai", ai: "moron" }, { name: "Dummy", faction: "wolf", kind: "ai", ai: "moron" }],
        opts: { rounds: 99, cash: 0, order: "robin", wind: "none" } };
      game.s = G.newMatch(game.setup);
      enterPlay();
      game.test = true;
      for (const x of SP.ALL) if (!x.free) game.s.tanks[0].inv[x.id] = 99;
      G.startRound(game.s);
      if (SP.BY_ID[test]) game.s.tanks[0].weapon = test;
      H.banner("Sandbox: everything in stock, nothing saved", 2500);
    }
  }
  boot();
})();
