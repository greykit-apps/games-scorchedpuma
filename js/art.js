/* Scorched Puma -- the battlefield's pixel art, all drawn in code, in the
 * manner of a 16-bit era card: skies in fine dithered bands with far hills
 * behind, dirt in strata with grain and a lit rim, and tanks with outlines,
 * shading, road wheels and a puma or a wolf in the hatch. */
(() => {
  const SP = globalThis.SP;
  const A = SP.Art = {};

  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgb = ([r, g, b]) => `rgb(${r | 0},${g | 0},${b | 0})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  A.hex = hex; A.rgb = rgb; A.mix = mix;
  A.shade = (h, k) => rgb(mix(hex(h), k > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(k)));
  const pack = ([r, g, b]) => (255 << 24 | (Math.min(255, b) & 255) << 16 | (Math.min(255, g) & 255) << 8 | (Math.min(255, r) & 255)) >>> 0;
  A.BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  /* ---- dirt: six kinds of ground, a top colour and a deep one each ---- */
  const DIRTS = [
    { top: "#a8743a", deep: "#3a2210" },  // earth
    { top: "#e4c47a", deep: "#7a5626" },  // sand
    { top: "#c8603a", deep: "#4a1a0e" },  // red clay
    { top: "#78a840", deep: "#2e2414" },  // grass over loam
    { top: "#f2f6fa", deep: "#5c6c80" },  // snow
    { top: "#857e8c", deep: "#211e26" },  // basalt
  ];
  /* Palettes for the terrain bytes, as 0xAABBGGRR for an ImageData's Uint32
   * view: grain (three tones a shade apart, picked per pixel for texture),
   * and the rim, the lit edge where the dirt meets the sky. */
  A.dirtPalettes = k => {
    const d = DIRTS[k % DIRTS.length], top = hex(d.top), deep = hex(d.deep);
    const base = [];
    for (let i = 1; i <= 16; i++) base[i] = mix(top, deep, Math.pow((i - 1) / 15, 0.85)).map(v => v * (i % 2 ? 1.05 : 0.97));
    const mid = mix(top, deep, 0.35);
    base[17] = mid; base[18] = mid.map(v => v * 0.88); base[19] = mix(mid, top, 0.4);
    base[31] = [22, 19, 28];
    const tone = f => { const u = new Uint32Array(32); for (let i = 0; i < 32; i++) if (base[i]) u[i] = pack(base[i].map(v => v * f)); return u; };
    const rim = new Uint32Array(32), rim2 = new Uint32Array(32);
    for (let i = 0; i < 32; i++) if (base[i]) {
      rim[i] = pack(mix(base[i], [255, 250, 230], 0.42));
      rim2[i] = pack(mix(base[i], [255, 250, 230], 0.18));
    }
    return { grain: [tone(0.93), tone(1), tone(1.06)], rim, rim2 };
  };
  A.dirtTop = k => DIRTS[k % DIRTS.length].top;

  /* ---- skies ---- */
  /* stops: [[at 0..1, "#hex"], ...]; bands: how many flat colours, dithered at each edge */
  const colourAt = (stops, t) => {
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      return mix(hex(ca), hex(cb), (t - a) / (b - a || 1));
    }
    return hex(stops[stops.length - 1][1]);
  };
  const banded = (g, w, h, stops, bands, under) => {
    const img = g.createImageData(w, h), u = new Uint32Array(img.data.buffer);
    const pal = [];
    for (let i = 0; i <= bands; i++) pal.push(pack(colourAt(stops, i / bands)));
    for (let y = 0; y < h; y++) {
      const f = y / (h - 1) * bands, b = Math.floor(f), frac = f - b;
      for (let x = 0; x < w; x++) u[y * w + x] = pal[frac * 16 > A.BAYER[(y & 3) * 4 + (x & 3)] ? Math.min(bands, b + 1) : b];
    }
    if (under) under(u);
    g.putImageData(img, 0, 0);
  };
  /* far hills: a ridge line, filled down in the sky's own colour, darkened,
     written straight into the sky's pixels */
  const ridge = (u, w, h, r, stops, base, amp, dark, rough) => {
    const pts = [];
    let y = 0, v = 0;
    for (let x = 0; x <= w + 4; x += 4) {
      v += SP.randRange(r, -1, 1) * rough; v *= 0.94; y = SP.clamp(y + v, -1, 1);
      if (Math.abs(y) === 1) v *= -0.5;
      pts.push(base + (y * 0.6 + Math.sin(x * 0.006 + base) * 0.4) * amp);
    }
    const row = [], lit = [];
    for (let yy = 0; yy < h; yy++) { const c = mix(colourAt(stops, yy / h), [8, 10, 26], dark); row.push(pack(c)); lit.push(pack(mix(c, [255, 255, 255], 0.14))); }
    for (let x = 0; x < w; x++) {
      const top = Math.max(0, Math.round(pts[x >> 2] + (pts[(x >> 2) + 1] - pts[x >> 2]) * (x & 3) / 4));
      u[top * w + x] = lit[top];
      for (let yy = top + 1; yy < h; yy++) u[yy * w + x] = row[yy];
    }
  };
  const cloud = (g, r, x, y, s, light, dark) => {
    for (let i = 0; i < 6; i++) {
      const cx = x + SP.randRange(r, -1, 1) * s * 1.6, cy = y + SP.randRange(r, -0.3, 0.3) * s, rr = s * SP.randRange(r, 0.45, 0.8);
      g.fillStyle = dark; A.disc(g, cx, cy + 2, rr);
      g.fillStyle = light; A.disc(g, cx, cy, rr - 1);
    }
  };
  const SKIES = {
    plain: { stops: [[0, "#2a4fa8"], [1, "#4a78c8"]], bands: 18, hills: true, clouds: ["#eef3ff", "#b8c6e8"] },
    shaded: { stops: [[0, "#06103a"], [0.55, "#1f4d9c"], [1, "#8fc0ee"]], bands: 44, hills: true, clouds: ["#f2f6ff", "#a8bede"] },
    sunset: { stops: [[0, "#140a34"], [0.33, "#5a1f5e"], [0.6, "#c4483a"], [0.8, "#f08a3c"], [1, "#ffd27a"]], bands: 52, hills: true, clouds: ["#ffb08a", "#b4506a"] },
    storm: { stops: [[0, "#0b0d13"], [0.6, "#2a2f3a"], [1, "#4c5260"]], bands: 30, hills: true, clouds: ["#3c424e", "#22262e"] },
    stars: { stops: [[0, "#000006"], [1, "#0c0f28"]], bands: 18, stars: true },
    black: { stops: [[0, "#000000"], [1, "#000000"]], bands: 1 },
  };
  A.drawSky = (g, kind, seed) => {
    const k = SKIES[kind] || SKIES.plain, r = SP.rng(seed), W = g.canvas.width, H = g.canvas.height;
    banded(g, W, H, k.stops, k.bands, k.hills ? u => {
      ridge(u, W, H, r, k.stops, H * 0.5, H * 0.12, 0.35, 0.05);
      ridge(u, W, H, r, k.stops, H * 0.62, H * 0.08, 0.55, 0.08);
    } : null);
    if (k.stars) {
      for (let i = 0, n = Math.round(420 * W / SP.W); i < n; i++) {
        const x = Math.floor(SP.rand(r) * W), y = Math.floor(SP.rand(r) * H * 0.9), b = SP.rand(r);
        g.fillStyle = b > 0.93 ? "#ffffff" : b > 0.7 ? "#c8d4ff" : "#5a6080";
        g.fillRect(x, y, 1, 1);
        if (b > 0.988) { g.globalAlpha = 0.5; g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); g.globalAlpha = 1; }
      }
      /* the moon, with its seas */
      const mx = 120 + SP.rand(r) * (W - 240), my = 60 + SP.rand(r) * 60;
      g.fillStyle = "#3a3e52"; A.disc(g, mx, my, 23);
      g.fillStyle = "#e8e6da"; A.disc(g, mx, my, 21);
      g.fillStyle = "#c9c6b6"; A.disc(g, mx - 6, my - 4, 6); A.disc(g, mx + 7, my + 6, 4); A.disc(g, mx + 3, my - 9, 3);
      g.fillStyle = "#f8f6ee"; A.disc(g, mx - 8, my - 8, 3);
    }
    if (k.clouds) for (let i = 0, n = Math.round(5 * W / SP.W); i < n; i++) cloud(g, r, SP.rand(r) * W, 40 + SP.rand(r) * H * 0.22, 18 + SP.rand(r) * 16, k.clouds[0], k.clouds[1]);
  };
  A.skyIsDark = kind => kind !== "plain" && kind !== "shaded";

  /* ---- crisp shapes ---- */
  A.disc = (g, cx, cy, r) => {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -Math.floor(r); dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
  };
  A.ring = (g, cx, cy, r, dotted = false) => {
    cx = Math.round(cx); cy = Math.round(cy);
    const n = Math.max(16, Math.round(r * 6.3));
    for (let i = 0; i < n; i++) {
      if (dotted && i % 3) continue;
      const a = i / n * Math.PI * 2;
      g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
  };
  A.line = (g, x0, y0, x1, y1) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, n = 0;
    for (;;) {
      g.fillRect(x0, y0, 1, 1);
      if ((x0 === x1 && y0 === y1) || ++n > 3000) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  /* a lit sphere: four tones from the highlight (top left) to the shadow, a dark edge */
  A.sphere = (g, cx, cy, r, tones, edge = "#0b0d14") => {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -Math.ceil(r + 1); dy <= r + 1; dy++) for (let dx = -Math.ceil(r + 1); dx <= r + 1; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.9) continue;
      if (d > r - 0.1) { if (edge) { g.fillStyle = edge; g.fillRect(cx + dx, cy + dy, 1, 1); } continue; }
      const lit = (-dx * 0.55 - dy * 0.75) / r + (1 - d / r) * 0.35;
      const i = lit > 0.55 ? 0 : lit > 0.1 ? 1 : lit > -0.35 ? 2 : 3;
      g.fillStyle = tones[i]; g.fillRect(cx + dx, cy + dy, 1, 1);
    }
  };
  /* a fireball, banded from white heat to dark red and dithered between bands */
  A.fireball = (g, cx, cy, r, pal = A.FIRE, phase = 0) => {
    cx = Math.round(cx); cy = Math.round(cy);
    const n = pal.length - 2, st = r > 36 ? 2 : 1;       // a big one in 2x2 blocks: a quarter of the work
    for (let dy = -Math.ceil(r); dy <= r; dy += st) for (let dx = -Math.ceil(r); dx <= r; dx += st) {
      const d = Math.hypot(dx, dy) / r;
      if (d > 1) continue;
      const f = (d * n + phase) % (n + 1), b = Math.floor(f);
      const k = (f - b) * 16 > A.BAYER[(((cy + dy) / st) & 3) * 4 + (((cx + dx) / st) & 3)] ? b + 1 : b;
      g.fillStyle = pal[Math.min(pal.length - 1, k)]; g.fillRect(cx + dx, cy + dy, st, st);
    }
  };

  /* ---- the tank ----
   * Built once per colour, crew and facing as a sprite with its outline;
   * the barrel is drawn each frame, under it, at the turret's angle.
   *
   *         ^ ^             the crew: a puma (round ears, tawny) or a
   *        (o.o)            wolf (tall ears, grey, a snout), opposite the barrel
   *       #######  ==       dome, barrel
   *   #################     hull: lit top, the faction's badge, shadowed foot
   *   =o==o==o==o==o==      tracks and road wheels */
  const CREW = {
    puma: { fur: "#c98f4f", lite: "#ecca98", dark: "#5a3618" },
    wolf: { fur: "#8e96a6", lite: "#cfd4de", dark: "#2a2e38" },
  };
  const OX = 12, OY = 17, SW = 25, SH = 19;
  const sprites = new Map();
  const sprite = (colour, faction, side, outline) => {
    const key = colour + faction + side + outline;
    let c = sprites.get(key);
    if (c) return c;
    const a = document.createElement("canvas"); a.width = SW; a.height = SH;
    const g = a.getContext("2d");
    const P = (col, dx, dy, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(OX + dx, OY + dy, w, h); };
    const col = hex(colour), body = colour;
    const hi = rgb(mix(col, [255, 255, 255], 0.45)), hi2 = rgb(mix(col, [255, 255, 255], 0.2));
    const lo = rgb(mix(col, [0, 0, 0], 0.32)), lo2 = rgb(mix(col, [0, 0, 0], 0.55));
    /* tracks */
    P("#1a1b22", -7, -1, 15); P("#2b2d36", -8, -2, 17); P("#3c3f4a", -7, -3, 15);
    for (const wx of [-6, -3, 0, 3, 6]) { P("#a4a9b6", wx, -2); P("#6b7080", wx, -1); P("#555a66", wx + 1, -2); }
    /* hull */
    P(lo2, -8, -4, 17); P(lo, -7, -4, 15);
    P(body, -8, -5, 17);
    P(hi2, -7, -6, 15); P(hi, -6, -6, 6);
    P(SP.FACTIONS[faction].trim, 3, -5, 3); P(lo2, 3, -4, 3);
    /* dome */
    P(lo, -4, -7, 9); P(body, -3, -7, 7); P(hi2, -4, -7, 2);
    P(body, -3, -8, 7); P(hi, -3, -8, 2);
    P(hi2, -2, -9, 5); P(hi, -1, -9, 1);
    /* the crew, behind the barrel, looking the way it points */
    const cr = CREW[faction], hx = side > 0 ? -3 : 3, s = side;
    if (faction === "wolf") {
      /* long head, a snout out front with a black nose, tall pointed ears */
      P(cr.fur, hx - 2, -10, 5); P(cr.fur, hx - 2, -11, 5); P(cr.fur, hx - 1, -12, 3);
      P(cr.lite, hx + s * 2, -10); P(cr.lite, hx + s * 3, -10); P(cr.fur, hx + s * 3, -11);
      P(cr.dark, hx + s * 4, -11);                       // nose
      P(cr.dark, hx + s, -12);                           // eye
      P(cr.fur, hx - 1, -13); P(cr.fur, hx + 1, -13); P(cr.dark, hx - 1, -14); P(cr.dark, hx + 1, -14);
      P(cr.lite, hx - s * 2, -10);                       // cheek ruff
    } else {
      /* round head, a pale muzzle and chin, short round ears */
      P(cr.fur, hx - 2, -10, 5); P(cr.fur, hx - 2, -11, 5); P(cr.fur, hx - 1, -12, 3);
      P(cr.lite, hx + s, -10); P(cr.lite, hx + s * 2, -10); P(cr.lite, hx, -10);
      P(cr.dark, hx + s * 2, -11);                       // nose
      P(cr.dark, hx + s, -12);                           // eye
      P(cr.fur, hx - 2, -13); P(cr.fur, hx + 2, -13); P(cr.lite, hx - 2, -12); P(cr.lite, hx + 2, -12);
    }
    /* outline: the silhouette, one pixel out, behind */
    c = document.createElement("canvas"); c.width = SW; c.height = SH;
    const o = c.getContext("2d");
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) o.drawImage(a, dx, dy);
    o.globalCompositeOperation = "source-in";
    o.fillStyle = outline; o.fillRect(0, 0, SW, SH);
    o.globalCompositeOperation = "source-over";
    o.drawImage(a, 0, 0);
    sprites.set(key, c);
    return c;
  };
  A.drawTank = (g, t, o = {}) => {
    const x = Math.round(t.x), y = Math.round(t.y), a = t.angle * Math.PI / 180;
    const side = Math.cos(a) >= 0 ? 1 : -1;
    /* the barrel: two pixels thick, lit along its top */
    const L = SP.PHYS.turretLen, by = y - SP.TANK.turretY;
    const ex = x + Math.cos(a) * L, ey = by - Math.sin(a) * L;
    const nx = Math.round(Math.sin(a)), ny = Math.round(Math.cos(a));
    g.fillStyle = "#0b0d14"; A.line(g, x + nx, by + ny, ex + nx, ey + ny); A.line(g, x - nx, by - ny, ex - nx, ey - ny);
    g.fillStyle = "#6b7080"; A.line(g, x + (nx || 0) * 0.5, by + 0.5, ex + (nx || 0) * 0.5, ey + 0.5);
    g.fillStyle = "#d4d8e2"; A.line(g, x, by, ex, ey);
    g.fillStyle = "#f4f6fa"; g.fillRect(Math.round(ex), Math.round(ey), 1, 1);
    g.drawImage(sprite(t.colour, t.faction, side, o.lit ? "#ffffff" : "#0b0d14"), x - OX, y - OY);
  };

  A.drawShield = (g, t, frame) => {
    const c = { shield: "#54f2ff", forceshield: "#b47dff", heavyshield: "#ffffff" }[t.shield.id] || "#54f2ff";
    const cx = t.x, cy = t.y - SP.TANK.mid, R = SP.SHIELD_R, k = 0.35 + 0.5 * t.shield.hp / t.shield.max;
    g.globalAlpha = 0.1; g.fillStyle = c; A.disc(g, cx, cy, R - 1);
    g.globalAlpha = k; g.fillStyle = c; A.ring(g, cx, cy, R); A.ring(g, cx, cy, R - 1, true);
    /* a highlight on the bubble, top left, that wanders a little */
    g.globalAlpha = 0.85; g.fillStyle = "#ffffff";
    const a0 = -2.3 + Math.sin(frame / 30) * 0.15;
    for (let i = 0; i < 6; i++) { const a = a0 + i * 0.09; g.fillRect(Math.round(cx + Math.cos(a) * (R - 3)), Math.round(cy + Math.sin(a) * (R - 3)), 1, 1); }
    g.globalAlpha = 1;
  };
  A.drawMag = (g, t, frame) => {
    g.fillStyle = t.mag.id === "supermag" ? "#ff7ae6" : "#ffd23f";
    g.globalAlpha = 0.55;
    const r = 24 + (frame >> 3) % 4;
    A.ring(g, t.x, t.y - SP.TANK.mid, r, true);
    g.globalAlpha = 0.25; A.ring(g, t.x, t.y - SP.TANK.mid, r + 4, true);
    g.globalAlpha = 1;
  };
  A.drawChute = (g, t) => {
    const x = Math.round(t.x), y = Math.round(t.y);
    const rows = [[-27, 7], [-26, 11], [-25, 13], [-24, 13]];
    rows.forEach(([dy, half], j) => { for (let dx = -half; dx <= half; dx++) { g.fillStyle = j === 0 ? "#ffffff" : (((dx + 13) / 4 | 0) % 2 ? "#ff4d4d" : "#f2f2f2"); g.fillRect(x + dx, y + dy, 1, 1); } });
    g.fillStyle = "#0b0d14"; for (let dx = -13; dx <= 13; dx++) g.fillRect(x + dx, y - 23, 1, 1);
    g.fillStyle = "#c8c8c8"; A.line(g, x - 13, y - 23, x - 4, y - 12); A.line(g, x + 13, y - 23, x + 4, y - 12); A.line(g, x, y - 23, x, y - 14);
  };

  /* fire, hottest first */
  A.FIRE = ["#ffffff", "#fff3a0", "#ffd23f", "#ff9a3c", "#ff5a28", "#d8261c", "#8a1410", "#3a0806"];
  A.FUNKY = ["#ff4d4d", "#ffd23f", "#8cff4a", "#3dffb4", "#4fc9ff", "#b48cff", "#ff7ae6"];
  A.DUST = ["#f4e6c8", "#d9c49a", "#b49a6a", "#8a7048", "#5e4a2e"];
})();
