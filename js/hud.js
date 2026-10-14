/* Scorched Puma -- the HUD bar over the field, and the banner. Written from
 * the match state every frame, but only where something changed. */
(() => {
  const SP = globalThis.SP, Tk = SP.Tanks;
  const $ = id => document.getElementById(id);
  const H = SP.Hud = {};
  const last = {};
  const set = (key, el, fn, v) => { if (last[key] !== v) { last[key] = v; fn(el, v); } };
  const text = (el, v) => { el.textContent = v; };

  H.update = (s, ui) => {
    const t = SP.Game.current(s);
    if (!t) return;
    const human = t.kind === "human";
    set("sw", $("h-sw"), (el, v) => { el.style.background = v; }, t.colour);
    set("name", $("h-name"), text, t.name);
    set("side", $("h-side"), (el, v) => { el.textContent = SP.FACTIONS[v].one; el.className = "side " + v; }, t.faction);
    set("hp", $("h-hp"), (el, v) => { el.style.width = v + "%"; el.className = v > 50 ? "" : v > 25 ? "mid" : "low"; }, Math.max(0, Math.round(t.health)));
    set("angle", $("h-angle").querySelector("b"), text, String(t.angle));
    set("power", $("h-power").querySelector("b"), text, String(t.power));
    set("maxp", $("h-power").querySelector("small"), text, "/" + Tk.maxPower(t));
    const w = SP.BY_ID[t.weapon], n = Tk.count(t, t.weapon);
    set("wn", $("h-weapon").querySelector(".n"), text, w.name);
    set("wc", $("h-weapon").querySelector(".c"), text, n === Infinity ? "∞" : "×" + n);
    const armed = [t.guide && SP.BY_ID[t.guide].name.replace(" Guidance", ""), t.contact && "Contact"].filter(Boolean).join(" · ");
    set("armed", $("h-items").querySelector(".armed"), text, armed);
    const wind = s.wind;
    set("wind", $("h-wind").querySelector("b"), (el, v) => {
      el.textContent = v === 0 ? "calm" : (v < 0 ? "◀ " : "") + Math.abs(v) + (v > 0 ? " ▶" : "");
      el.className = v === 0 ? "calm" : "";
    }, wind);
    let state = "";
    if (s.phase === "resolve") state = "";
    else if (!human) state = "thinking";
    else if (ui.drive) state = `drive · fuel ${Tk.fuelLeft(t)}`;
    else if (s.opts.mode === "synchronous") state = "aim, then everyone fires";
    set("state", $("h-state"), text, state);
    set("cash", $("h-cash"), text, SP.money(t.cash));
    set("round", $("h-round"), text, `ROUND ${s.round}/${s.opts.rounds}`);
    const canFire = human && s.phase === "aim" && !ui.paused;
    set("fire", $("h-fire"), (el, v) => { el.disabled = !v; }, canFire);
    set("wbtn", $("h-weapon"), (el, v) => { el.disabled = !v; }, canFire);
    set("ibtn", $("h-items"), (el, v) => { el.disabled = !v; }, canFire);
  };
  H.reset = () => { for (const k of Object.keys(last)) delete last[k]; };

  let bannerT = null;
  H.banner = (html, ms = 1600) => {
    const b = $("banner");
    b.innerHTML = html;
    b.classList.add("on");
    clearTimeout(bannerT);
    bannerT = setTimeout(() => b.classList.remove("on"), ms);
  };
  H.say = msg => { $("live").textContent = msg; };
})();
