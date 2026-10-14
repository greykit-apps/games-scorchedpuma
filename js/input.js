/* Scorched Puma -- aiming by hand: held keys that speed up the longer they
 * are held (Shift for one step at a time), and the mouse dragged from the
 * tank. Runs once an engine tick while a human has the turn. */
(() => {
  const SP = globalThis.SP, Tk = SP.Tanks;
  const I = SP.Input = { held: new Map() };

  const AIM_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown"];
  I.isAimKey = code => AIM_KEYS.includes(code);
  /* a press steps once at once, so a quick tap is never lost between ticks;
     holding it on is the tick's business */
  I.down = (ev, s, t, drive) => {
    const h = I.held.get(ev.code);
    if (h) { h.shift = ev.shiftKey; return; }
    const nh = { t: 0, shift: ev.shiftKey };
    I.held.set(ev.code, nh);
    apply(s, t, ev.code, 1, nh, drive);
    nh.t = 1;
  };
  I.up = ev => I.held.delete(ev.code);
  I.clear = () => I.held.clear();

  /* how many steps a held key gives this tick: one at once, then after a
   * pause a stream that quickens; with Shift, a slow even stream */
  const steps = h => {
    const t = h.t++;
    if (t === 0) return 1;
    if (h.shift) return t >= 14 && t % 5 === 0 ? 1 : 0;
    if (t < 14) return 0;
    return Math.min(8, 1 + Math.floor((t - 14) / 18));
  };

  /* one tick of held keys for tank t; driving takes the arrows when on */
  function apply(s, t, code, n, h, drive) {
    if (drive && (code === "ArrowLeft" || code === "ArrowRight")) { Tk.drive(s, t, code === "ArrowLeft" ? -1 : 1); return; }
    if (code === "ArrowLeft") SP.Game.setAim(s, t.angle + n, t.power);
    else if (code === "ArrowRight") SP.Game.setAim(s, t.angle - n, t.power);
    else if (code === "ArrowUp") SP.Game.setAim(s, t.angle, t.power + n);
    else if (code === "ArrowDown") SP.Game.setAim(s, t.angle, t.power - n);
    else if (code === "PageUp") SP.Game.setAim(s, t.angle, t.power + (h.t === 0 ? 10 : n * 3));
    else if (code === "PageDown") SP.Game.setAim(s, t.angle, t.power - (h.t === 0 ? 10 : n * 3));
  }
  I.tick = (s, t, drive) => {
    for (const [code, h] of I.held) {
      if (drive && (code === "ArrowLeft" || code === "ArrowRight")) {
        if (h.t++ % 3 === 0) apply(s, t, code, 1, h, drive);
        continue;
      }
      const n = steps(h);
      if (n) apply(s, t, code, n, h, drive);
    }
  };

  /* the mouse: point from the tank to aim, further out for more power */
  I.pointerAim = (s, t, fx, fy) => {
    const dx = fx - t.x, dy = (t.y - 5) - fy;
    const angle = Math.atan2(Math.max(dy, 0), dx) * 180 / Math.PI;
    const power = Math.hypot(dx, dy) * 3;
    SP.Game.setAim(s, angle, Math.min(power, Tk.maxPower(t)));
  };
})();
