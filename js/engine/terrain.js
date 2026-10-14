/* Scorched Puma -- the dirt.
 *
 * One byte a pixel: 0 is air, 1-16 are the strata the land was made with
 * (the renderer gives each its colour), 17-19 dirt that a weapon added, and
 * BEDROCK the bottom row, which nothing breaks. Falling dirt moves the bytes
 * themselves, so the strata slump as they fall. */
(() => {
  const SP = globalThis.SP;
  const BEDROCK = 31, ADDED = 17;
  const T = SP.Terrain = { BEDROCK, ADDED };

  T.make = (w = SP.W, h = SP.H) => ({
    w, h,
    px: new Uint8Array(w * h),
    loose: new Uint8Array(w),       // 1 where a column may have dirt to fall
    looseN: 0,
    dirty: null,                    // [x0, y0, x1, y1] changed since the renderer last looked
    full: true,                     // the renderer should redraw everything
  });

  const mark = (t, x0, y0, x1, y1) => {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0);
    x1 = Math.min(t.w - 1, Math.ceil(x1)); y1 = Math.min(t.h - 1, Math.ceil(y1));
    if (x1 < x0 || y1 < y0) return;
    const d = t.dirty;
    if (!d) t.dirty = [x0, y0, x1, y1];
    else { d[0] = Math.min(d[0], x0); d[1] = Math.min(d[1], y0); d[2] = Math.max(d[2], x1); d[3] = Math.max(d[3], y1); }
  };
  T.mark = mark;
  const loosen = (t, x0, x1) => {
    for (let x = Math.max(0, x0 | 0); x <= Math.min(t.w - 1, x1 | 0); x++) if (!t.loose[x]) { t.loose[x] = 1; t.looseN++; }
  };
  T.loosen = loosen;

  T.solid = (t, x, y) => {
    x = Math.round(x); y = Math.round(y);
    if (y >= t.h) return true;
    if (x < 0 || x >= t.w || y < 0) return false;
    return t.px[y * t.w + x] !== 0;
  };
  /* the first solid row in a column, looking down from `from` */
  T.surface = (t, x, from = 0) => {
    x = SP.clamp(Math.round(x), 0, t.w - 1);
    for (let y = Math.max(0, from | 0); y < t.h; y++) if (t.px[y * t.w + x]) return y;
    return t.h - 1;
  };

  /* ---- making land ---- */
  T.generate = (t, rng, { land = "rolling", bumpiness = 50 } = {}) => {
    const { w, h } = t, n = 1024;
    const hs = new Float64Array(n + 1);
    const bump = bumpiness / 100;
    let lo, hi, rough;
    if (land === "mountains") { lo = 0.22; hi = 0.88; rough = 0.5 + bump * 0.12; }
    else if (land === "flat") { lo = 0.62; hi = 0.82; rough = 0.35 + bump * 0.1; }
    else { lo = 0.38; hi = 0.86; rough = 0.44 + bump * 0.12; }
    hs[0] = SP.randRange(rng, 0.2, 0.8);
    hs[n] = SP.randRange(rng, 0.2, 0.8);
    /* midpoint displacement: each halving adds detail at `rough` the size,
       down to a few pixels; below that the ground runs straight, so it has
       slopes a roller can roll down and no notches for napalm to catch in */
    let amp = 0.55 * (0.4 + bump);
    for (let step = n; step > 1; step >>= 1) {
      for (let i = 0; i < n; i += step) {
        const m = i + step / 2;
        hs[m] = (hs[i] + hs[i + step]) / 2 + (step > 8 ? SP.randRange(rng, -amp, amp) : 0);
      }
      amp *= rough;
    }
    let mn = Infinity, mx = -Infinity;
    for (const v of hs) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    const span = mx - mn || 1;
    const band = SP.randInt(rng, 10, 16);
    const wob = SP.randRange(rng, 2, 5);
    for (let x = 0; x < w; x++) {
      const f = x / (w - 1) * n, i = Math.min(n - 1, Math.floor(f));
      const v = hs[i] + (hs[i + 1] - hs[i]) * (f - i);
      const top = Math.round(h * (lo + (1 - (v - mn) / span) * (hi - lo)));
      for (let y = top; y < h; y++) {
        /* strata follow the surface, wobbling a little, so the bands read as layers */
        const depth = (y - top) + wob * Math.sin(x * 0.045 + y * 0.01);
        t.px[y * w + x] = y === h - 1 ? BEDROCK : 1 + SP.clamp(Math.floor(depth / band), 0, 15);
      }
    }
    t.full = true;
  };

  /* flatten a pad for a tank: dirt cut away above `y`, filled up to it below */
  T.pad = (t, cx, y, half) => {
    for (let x = Math.max(0, cx - half); x <= Math.min(t.w - 1, cx + half); x++) {
      for (let yy = 0; yy < y; yy++) t.px[yy * t.w + x] = 0;
      for (let yy = y; yy < t.h - 1; yy++) if (!t.px[yy * t.w + x]) t.px[yy * t.w + x] = 1 + Math.min(15, ((yy - y) / 12) | 0);
    }
    t.full = true;
  };

  /* ---- what weapons do to it ---- */
  T.carve = (t, cx, cy, r, { fall = true } = {}) => {
    const r2 = r * r;
    let n = 0;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(t.h - 2, Math.ceil(cy + r)); y++) {
      const dy = y - cy;
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(t.w - 1, Math.ceil(cx + r)); x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy <= r2) {
          const i = y * t.w + x;
          if (t.px[i] && t.px[i] !== BEDROCK) { t.px[i] = 0; n++; }
        }
      }
    }
    mark(t, cx - r, cy - r, cx + r, cy + r);
    if (fall && n) loosen(t, cx - r, cx + r);
    return n;
  };

  /* dirt into the air of a circle: a weapon's clod, or a ring of it */
  T.fill = (t, cx, cy, r, inner = 0, rng = null) => {
    const r2 = r * r, i2 = inner * inner;
    let n = 0;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(t.h - 1, Math.ceil(cy + r)); y++) {
      const dy = y - cy;
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(t.w - 1, Math.ceil(cx + r)); x++) {
        const dx = x - cx, d2 = dx * dx + dy * dy;
        if (d2 <= r2 && d2 >= i2) {
          const i = y * t.w + x;
          if (!t.px[i]) { t.px[i] = ADDED + (rng ? Math.floor(SP.rand(rng) * 3) : (x + y) % 3); n++; }
        }
      }
    }
    mark(t, cx - r, cy - r, cx + r, cy + r);
    if (n) loosen(t, cx - r, cx + r);
    return n;
  };

  /* a heap: dirt piled on the surface, highest in the middle */
  T.heap = (t, cx, r, tall) => {
    let n = 0;
    for (let x = Math.max(0, Math.round(cx - r)); x <= Math.min(t.w - 1, Math.round(cx + r)); x++) {
      const k = 1 - ((x - cx) / r) ** 2;
      let add = Math.round(tall * k);
      let y = T.surface(t, x) - 1;
      while (add-- > 0 && y > 0) { t.px[y * t.w + x] = ADDED + ((x + y) % 3); y--; n++; }
    }
    mark(t, cx - r, 0, cx + r, t.h - 1);
    return n;
  };

  T.setPixel = (t, x, y, v) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= t.w || y < 0 || y >= t.h - 1) return false;
    const i = y * t.w + x;
    if (v === 0 && t.px[i] === BEDROCK) return false;
    t.px[i] = v;
    mark(t, x, y, x, y);
    return true;
  };

  /* ---- falling dirt ----
   * Each pass, every pixel of dirt with air below it drops one: scanning a
   * column bottom-up, a hanging slab moves down whole. A column that makes
   * no move in a pass is settled. */
  T.settle = (t, passes = 2) => {
    if (!t.looseN) return false;
    const { w, h, px, loose } = t;
    for (let x = 0; x < w; x++) {
      if (!loose[x]) continue;
      let moved = false, ylo = h, yhi = -1;
      for (let p = 0; p < passes; p++) {
        let m = false;
        for (let y = h - 2; y >= 0; y--) {
          const i = y * w + x;
          if (px[i] && px[i + w] === 0 && px[i] !== BEDROCK) {
            px[i + w] = px[i]; px[i] = 0; m = true;
            if (y < ylo) ylo = y;
            if (y + 1 > yhi) yhi = y + 1;
          }
        }
        if (!m) break;
        moved = true;
      }
      if (moved) mark(t, x, ylo, x, yhi);
      else { loose[x] = 0; t.looseN--; }
    }
    return t.looseN > 0;
  };
  /* everything down at once: an Earth Disrupter, or a save restored */
  T.loosenAll = t => loosen(t, 0, t.w - 1);

  T.count = t => { let n = 0; for (const v of t.px) if (v && v !== BEDROCK) n++; return n; };
})();
