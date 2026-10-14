/* Scorched Puma -- the battlefield's pixel art, all drawn in code.
 *
 * Skies are banded gradients with an ordered dither at each band's edge,
 * the way a 256-colour card drew them; the dirt is sixteen strata from the
 * surface down; tanks are a dozen rows of pixels with puma or wolf ears. */
(() => {
  const SP = globalThis.SP;
  const A = SP.Art = {};

  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgb = ([r, g, b]) => `rgb(${r | 0},${g | 0},${b | 0})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  A.hex = hex; A.rgb = rgb; A.mix = mix;
  A.shade = (h, k) => rgb(mix(hex(h), k > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(k)));

  /* ---- dirt: six kinds of ground, a top colour and a deep one each ---- */
  const DIRTS = [
    { top: "#9a6a34", deep: "#3a2210" },  // earth
    { top: "#dcbc72", deep: "#7a5626" },  // sand
    { top: "#c25a32", deep: "#4a1a0e" },  // red clay
    { top: "#6f9a3c", deep: "#2e2414" },  // grass over loam
    { top: "#eef3f8", deep: "#5c6c80" },  // snow
    { top: "#7a7480", deep: "#211e26" },  // basalt
  ];
  /* index -> 0xAABBGGRR for an ImageData's Uint32 view */
  A.dirtPalette = k => {
    const d = DIRTS[k % DIRTS.length], top = hex(d.top), deep = hex(d.deep);
    const out = new Uint32Array(32);
    const pack = ([r, g, b]) => (255 << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
    for (let i = 1; i <= 16; i++) {
      const c = mix(top, deep, (i - 1) / 15);
      const lift = i % 2 ? 1.06 : 0.96;                     // alternate strata a shade apart
      out[i] = pack(c.map(v => Math.min(255, v * lift)));
    }
    const mid = mix(top, deep, 0.35);
    out[17] = pack(mid); out[18] = pack(mid.map(v => v * 0.9)); out[19] = pack(mix(mid, top, 0.4));
    out[31] = pack([22, 19, 28]);
    return out;
  };
  A.dirtTop = k => DIRTS[k % DIRTS.length].top;

  /* ---- skies ---- */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /* stops: [[at 0..1, "#hex"], ...]; bands: how many flat colours */
  const banded = (g, w, h, stops, bands) => {
    const colourAt = t => {
      for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
        const [a, ca] = stops[i - 1], [b, cb] = stops[i];
        return mix(hex(ca), hex(cb), (t - a) / (b - a || 1));
      }
      return hex(stops[stops.length - 1][1]);
    };
    const img = g.createImageData(w, h), u = new Uint32Array(img.data.buffer);
    const pal = [];
    for (let i = 0; i <= bands; i++) { const c = colourAt(i / bands); pal.push((255 << 24 | (c[2] & 255) << 16 | (c[1] & 255) << 8 | (c[0] & 255)) >>> 0); }
    for (let y = 0; y < h; y++) {
      const f = y / (h - 1) * bands, b = Math.floor(f), frac = f - b;
      for (let x = 0; x < w; x++) {
        const k = frac * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? Math.min(bands, b + 1) : b;
        u[y * w + x] = pal[k];
      }
    }
    g.putImageData(img, 0, 0);
  };
  const SKY = {
    plain: g => { g.fillStyle = "#2a52a8"; g.fillRect(0, 0, SP.W, SP.H); },
    shaded: g => banded(g, SP.W, SP.H, [[0, "#06103a"], [0.55, "#1f4d9c"], [1, "#7fb2e8"]], 22),
    sunset: g => banded(g, SP.W, SP.H, [[0, "#140a34"], [0.35, "#5a1f5e"], [0.62, "#c4483a"], [0.82, "#f08a3c"], [1, "#ffd27a"]], 26),
    storm: g => banded(g, SP.W, SP.H, [[0, "#0e1016"], [0.6, "#2c313c"], [1, "#4a505c"]], 16),
    stars: (g, r) => {
      banded(g, SP.W, SP.H, [[0, "#000006"], [1, "#0a0c22"]], 10);
      for (let i = 0; i < 260; i++) {
        const x = Math.floor(SP.rand(r) * SP.W), y = Math.floor(SP.rand(r) * SP.H * 0.9), b = SP.rand(r);
        g.fillStyle = b > 0.93 ? "#ffffff" : b > 0.7 ? "#c8d4ff" : "#6a7090";
        g.fillRect(x, y, 1, 1);
        if (b > 0.985) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
      }
    },
    black: g => { g.fillStyle = "#000"; g.fillRect(0, 0, SP.W, SP.H); },
  };
  A.drawSky = (g, kind, seed) => (SKY[kind] || SKY.plain)(g, SP.rng(seed));
  /* the sky's brightness, for what has to stand out against it */
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
      if ((x0 === x1 && y0 === y1) || ++n > 2000) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };

  /* ---- the tank ----
   *       ^ ^          ears: rounded for a puma crew, pointed for wolves
   *       ###   \      dome and turret
   *    #########       hull in the player's colour, trimmed in the faction's
   *   ###########
   *   o o o o o o      tracks */
  A.drawTank = (g, t, o = {}) => {
    const x = Math.round(t.x), y = Math.round(t.y), col = hex(t.colour);
    const light = rgb(mix(col, [255, 255, 255], 0.35)), dark = rgb(mix(col, [0, 0, 0], 0.45)), body = t.colour;
    const trim = SP.FACTIONS[t.faction].trim;
    /* turret first, so the dome sits over its root */
    const a = t.angle * Math.PI / 180;
    g.fillStyle = o.lit ? "#ffffff" : light;
    for (let i = 1; i <= SP.PHYS.turretLen; i++) g.fillRect(Math.round(x + Math.cos(a) * i), Math.round(y - 5 - Math.sin(a) * i), 1, 1);
    /* tracks */
    g.fillStyle = "#16161c"; g.fillRect(x - 5, y - 1, 11, 1);
    g.fillStyle = dark; for (let i = -4; i <= 4; i += 2) g.fillRect(x + i, y - 1, 1, 1);
    /* hull */
    g.fillStyle = body; g.fillRect(x - 5, y - 3, 11, 2);
    g.fillStyle = light; g.fillRect(x - 4, y - 4, 9, 1);
    g.fillStyle = trim; g.fillRect(x - 5, y - 2, 11, 1);
    /* dome */
    g.fillStyle = body; g.fillRect(x - 2, y - 5, 5, 1); g.fillRect(x - 1, y - 6, 3, 1);
    /* ears */
    g.fillStyle = trim;
    if (t.faction === "wolf") { g.fillRect(x - 2, y - 7, 1, 2); g.fillRect(x + 2, y - 7, 1, 2); g.fillRect(x - 2, y - 8, 1, 1); g.fillRect(x + 2, y - 8, 1, 1); }
    else { g.fillRect(x - 2, y - 7, 2, 1); g.fillRect(x + 1, y - 7, 2, 1); }
  };

  A.drawShield = (g, t, frame) => {
    const c = { shield: "#54f2ff", forceshield: "#b47dff", heavyshield: "#ffffff" }[t.shield.id] || "#54f2ff";
    g.fillStyle = c;
    g.globalAlpha = 0.35 + 0.5 * t.shield.hp / t.shield.max;
    A.ring(g, t.x, t.y - 3, SP.SHIELD_R, false);
    g.globalAlpha = 0.12;
    A.disc(g, t.x, t.y - 3, SP.SHIELD_R - 1);
    g.globalAlpha = 1;
    void frame;
  };
  A.drawMag = (g, t, frame) => {
    g.fillStyle = t.mag.id === "supermag" ? "#ff7ae6" : "#ffd23f";
    g.globalAlpha = 0.55;
    A.ring(g, t.x, t.y - 3, 16 + (frame >> 3) % 3, true);
    g.globalAlpha = 1;
  };
  A.drawChute = (g, t) => {
    const x = Math.round(t.x), y = Math.round(t.y);
    g.fillStyle = "#f2f2f2";
    g.fillRect(x - 6, y - 16, 13, 1); g.fillRect(x - 5, y - 17, 11, 1); g.fillRect(x - 3, y - 18, 7, 1);
    g.fillStyle = "#c8c8c8";
    A.line(g, x - 6, y - 15, x - 2, y - 7); A.line(g, x + 6, y - 15, x + 2, y - 7);
  };

  /* fire, hottest first */
  A.FIRE = ["#ffffff", "#fff3a0", "#ffd23f", "#ff9a3c", "#ff5a28", "#d8261c", "#8a1410", "#3a0806"];
  A.FUNKY = ["#ff4d4d", "#ffd23f", "#8cff4a", "#3dffb4", "#4fc9ff", "#b48cff", "#ff7ae6"];
  A.DUST = ["#f4e6c8", "#d9c49a", "#b49a6a", "#8a7048", "#5e4a2e"];
})();
