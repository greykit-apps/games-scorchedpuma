/* Scorched Puma -- an icon for every weapon and item, showing what it does:
 * a little scene on a 48x48 pixel grid in the battlefield's own 16-bit
 * manner (lit spheres, dithered fire, outlined things), drawn once in code
 * and kept as a data URL. Shown at whole multiples, so pixels stay square. */
(() => {
  const SP = globalThis.SP, A = SP.Art;
  const N = 48, GY = 38;                         // grid size; the ground's top row
  const FIRE = A.FIRE, INK = "#0b0d14";
  const WHITE = "#f4f6fa", CYAN = "#54f2ff", VIOLET = "#b47dff", TRAIL = "#cfd8ff", YEL = "#ffd23f", RED = "#ff4d4d";
  const STEEL = ["#ffffff", "#c8ccd8", "#8d92a0", "#4a4e5a"], DIRTBALL = ["#d9a866", "#a8743a", "#7a5226", "#4a3014"];
  const SMOKE = ["#d8dce6", "#a8aebe", "#7a8090", "#4a4e5a"];

  /* ---- the drawing kit ---- */
  let g;
  const P = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const disc = (c, x, y, r) => { g.fillStyle = c; A.disc(g, x, y, r); };
  const ring = (c, x, y, r, dotted) => { g.fillStyle = c; A.ring(g, x, y, r, dotted); };
  const line = (c, x0, y0, x1, y1) => { g.fillStyle = c; A.line(g, x0, y0, x1, y1); };
  const thick = (c, x0, y0, x1, y1, edge = INK) => { line(edge, x0, y0 + 1, x1, y1 + 1); line(edge, x0, y0 - 1, x1, y1 - 1); line(c, x0, y0, x1, y1); };
  const sphere = (x, y, r, tones = STEEL, edge = INK) => A.sphere(g, x, y, r, tones, edge);
  const fireball = (x, y, r, pal = FIRE) => {
    A.fireball(g, x, y, r, pal);
    for (let i = 0; i < Math.round(r * 1.4); i++) {
      const a = i * 2.39996, d = r + 1 + (i * 7 % 4);
      P(pal[1 + (i % 3)], Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d));
    }
  };
  const sky = () => {
    const top = A.hex("#081028"), bot = A.hex("#1f3a78"), bands = 12;
    for (let y = 0; y < N; y++) {
      const f = y / (N - 1) * bands, b = Math.floor(f), fr = f - b;
      for (let x = 0; x < N; x++) {
        const k = fr * 16 > A.BAYER[(y & 3) * 4 + (x & 3)] ? b + 1 : b;
        P(A.rgb(A.mix(top, bot, k / bands)), x, y);
      }
    }
    P("#8a96c0", 7, 5); P("#ffffff", 40, 9); P("#6a7090", 29, 3);
  };
  /* ground whose top row at column x is top(x): a lit rim, then strata with grain */
  const STRATA = ["#b07a3e", "#9a6a34", "#86592a", "#724a22", "#5e3c1a"];
  const ground = (top = () => GY) => {
    for (let x = 0; x < N; x++) {
      const t = Math.round(top(x));
      for (let y = Math.max(0, t); y < N; y++) {
        const d = y - t;
        let c = d === 0 ? "#e8b878" : d === 1 ? "#c48a48" : STRATA[Math.min(4, (d - 2) >> 2)];
        if (d > 1 && ((x * 7 + y * 13) % 11 === 0)) c = A.shade(c, -0.18);
        P(c, x, y);
      }
    }
  };
  const valley = x => 24 + Math.round(14 * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - 2) / 40))));
  /* dotted path along a parabola from (x0,y0) to (x1,y1), h high */
  const arc = (c, x0, y0, x1, y1, h, step = 3, from = 0, to = 1) => {
    const n = 90;
    for (let i = Math.round(from * n); i <= Math.round(to * n); i += step) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - 4 * h * t * (1 - t);
      P(c, Math.round(x), Math.round(y));
    }
  };
  const tank = (x, y, angle = 60, colour = "#4fc9ff", faction = "puma") => A.drawTank(g, { x, y, angle, colour, faction });
  const crosshair = (x, y, c = RED) => {
    for (const [dx, dy, w, h] of [[-9, 0, 6, 1], [4, 0, 6, 1], [0, -9, 1, 6], [0, 4, 1, 6]]) { P(INK, x + dx - 1, y + dy - 1, w + 2, h + 2); }
    for (const [dx, dy, w, h] of [[-9, 0, 6, 1], [4, 0, 6, 1], [0, -9, 1, 6], [0, 4, 1, 6]]) P(c, x + dx, y + dy, w, h);
    ring(c, x, y, 6, true);
  };
  const arrow = (c, x, y, dir) => {           // dir: 1 down, -1 up
    P(INK, x - 1, y - 6 * dir - (dir > 0 ? 0 : 0), 4, 1);
    for (let i = 0; i < 6; i++) P(c, x, y - (6 - i) * dir, 2, 1);
    for (let i = 0; i < 3; i++) P(c, x - i, y - i * dir, 2 + i * 2, 1);
  };
  /* a box with a lit top-left, a shadowed bottom-right and an ink edge */
  const box = (x, y, w, h, c) => {
    P(INK, x - 1, y - 1, w + 2, h + 2);
    P(c, x, y, w, h);
    P(A.shade(c, 0.35), x, y, w, 1); P(A.shade(c, 0.2), x, y + 1, 1, h - 1);
    P(A.shade(c, -0.35), x, y + h - 1, w, 1); P(A.shade(c, -0.2), x + w - 1, y, 1, h - 1);
  };

  const shot = r => { sky(); ground(); arc(TRAIL, 3, 33, 24, GY - 2, 27, 3, 0, 0.92); fireball(24, GY - 2, r); };
  const mushroom = big => {
    sky(); ground();
    const cap = big ? 12 : 8, w = big ? 18 : 10;
    for (let x = 24 - w; x <= 24 + w; x++) { const h = 3 + Math.round(2 * Math.cos((x - 24) / w * 1.5)); for (let y = GY - h; y < GY; y++) P(FIRE[(GY - y) < 2 ? 2 : 4], x, y); }
    const sw = big ? 6 : 4;
    for (let y = 16; y < GY - 2; y++) for (let x = 24 - sw / 2; x < 24 + sw / 2; x++) P(SMOKE[x < 24 - sw / 4 ? 0 : x < 24 + sw / 4 ? 1 : 2], x, y);
    P(FIRE[3], 24 - sw / 2, 22, sw, 3);
    sphere(24, 14, cap, SMOKE);
    A.fireball(g, 24, 16, cap * 0.62);
    if (big) ring(YEL, 24, 16, 21, true);
  };

  const ICONS = {
    /* ---- missiles and bombs ---- */
    babymissile: () => shot(5),
    missile: () => shot(9),
    babynuke: () => mushroom(false),
    nuke: () => mushroom(true),
    leapfrog: () => {
      sky(); ground();
      arc(TRAIL, 2, 28, 16, GY - 2, 16); arc(TRAIL, 16, GY - 3, 30, GY - 2, 12); arc(TRAIL, 30, GY - 3, 42, GY - 2, 8);
      fireball(16, GY - 2, 3); fireball(30, GY - 2, 4); fireball(42, GY - 2, 5.5);
    },
    funky: () => {
      sky(); ground();
      const pts = [[6, 18], [13, 9], [24, 5], [35, 9], [42, 18], [9, 28], [39, 28]];
      pts.forEach(([x, y], i) => {
        const c = A.FUNKY[i % A.FUNKY.length];
        line(A.shade(c, -0.3), 24, GY - 6, x, y);
        sphere(x, y, 2.5, [A.shade(c, 0.6), c, A.shade(c, -0.3), A.shade(c, -0.55)]);
      });
      fireball(24, GY - 4, 7, A.FUNKY.concat(["#3a0806"]));
    },
    mirv: () => {
      sky(); ground();
      arc(TRAIL, 0, 42, 24, 9, 0, 3);
      for (const x of [6, 15, 24, 33, 42]) { arc(TRAIL, 24, 10, x, GY - 3, -2, 4); fireball(x, GY - 2, 3); }
      sphere(24, 9, 3.5);
    },
    deathshead: () => {
      sky(); ground();
      const BONE = ["#fffaee", "#e8e2cf", "#bfb8a2", "#7e7868"];
      sphere(24, 17, 12, BONE);
      box(17, 25, 14, 7, "#d8d2be");
      for (const x of [19, 23, 27]) P("#3a342a", x, 26, 1, 5);
      P(INK, 17, 13, 6, 6); P(INK, 26, 13, 6, 6); P(RED, 19, 15, 2, 2); P(RED, 28, 15, 2, 2); P("#ff9a9a", 19, 15);
      P(INK, 23, 20, 3, 3);
      for (const x of [4, 10, 38, 44]) fireball(x, GY, 2.5);
    },
    /* ---- fire ---- */
    napalm: () => flames(12, 35, 6, 6, false),
    hotnapalm: () => flames(5, 42, 11, 9, true),
    /* ---- tracers ---- */
    tracer: () => { sky(); ground(); arc(WHITE, 3, 34, 44, GY - 3, 29, 2); P(WHITE, 42, GY - 4, 4, 1); P(WHITE, 43, GY - 5, 2, 3); },
    smoketracer: () => {
      sky(); ground();
      for (let i = 0; i <= 16; i++) { const t = i / 16, x = 3 + 41 * t, y = 34 + 2 * t - 4 * 28 * t * (1 - t); sphere(x, y, 2.6 + (i % 2), SMOKE, null); }
    },
    /* ---- rollers ---- */
    babyroller: () => roller(3, 3), roller: () => roller(4.5, 5.5), heavyroller: () => roller(6, 9),
    /* ---- dirt movers ---- */
    riotcharge: () => riot(0.45, 18), riotblast: () => riot(0.75, 27),
    riotbomb: () => riotbomb(8), heavyriotbomb: () => riotbomb(13),
    babydigger: () => digger(2, 1), digger: () => digger(3, 1), heavydigger: () => digger(5, 2),
    babysandhog: () => sandhog(1), sandhog: () => sandhog(2), heavysandhog: () => sandhog(3),
    dirtclod: () => clod(5), dirtball: () => clod(8), tonofdirt: () => clod(12),
    liquiddirt: () => {
      sky(); ground(valley);
      for (let x = 0; x < N; x++) for (let y = 30; y < valley(x); y++) P(y === 30 ? "#d0a070" : (x + y) % 5 === 0 ? "#7a5226" : "#9a6a3a", x, y);
      P("#f0d0a0", 14, 30, 6, 1); P("#f0d0a0", 28, 30, 4, 1);
      for (const [x, y] of [[22, 7], [24, 15], [15, 19], [32, 21]]) { sphere(x, y, 1.6, DIRTBALL); P(DIRTBALL[0], x, y - 3, 1, 2); }
    },
    dirtcharge: () => {
      sky(); ground();
      for (let x = 5; x <= 42; x++) {
        const h = Math.round(16 * (1 - ((x - 23.5) / 19) ** 2));
        for (let y = GY - h; y < GY; y++) P(y === GY - h ? "#f0c890" : y === GY - h + 1 ? "#d9a866" : x < 23 ? "#c08a4a" : "#a8743a", x, y);
      }
      arrow(WHITE, 9, 14, -1); arrow(WHITE, 37, 14, -1);
    },
    disrupter: () => {
      sky(); ground();
      for (const [x, y, w, h] of [[4, 9, 10, 6], [20, 5, 12, 8], [36, 13, 8, 6]]) box(x, y, w, h, "#9a6a34");
      for (const x of [8, 26, 40]) arrow(WHITE, x, 32, 1);
      ring(VIOLET, 24, GY, 8, true); ring(VIOLET, 24, GY, 5, true);
    },
    /* ---- beams ---- */
    plasma: () => {
      sky(); ground();
      ring("#1a8ab0", 24, GY - 5, 21); ring(CYAN, 24, GY - 5, 20); ring(CYAN, 24, GY - 5, 14); ring(WHITE, 24, GY - 5, 14, true); ring(WHITE, 24, GY - 5, 9, true);
      tank(24, GY, 90, "#ff7ae6");
    },
    laser: () => {
      sky(); ground(x => x > 36 ? 26 : GY);
      tank(10, GY, 12, "#ff7ae6");
      const x0 = 21, y0 = GY - 10, x1 = 47, y1 = GY - 15;
      g.globalAlpha = 0.4; for (const d of [-3, -2, 2, 3]) line(RED, x0, y0 + d, x1, y1 + d);
      g.globalAlpha = 1; line(RED, x0, y0 - 1, x1, y1 - 1); line(RED, x0, y0 + 1, x1, y1 + 1); line(WHITE, x0, y0, x1, y1);
      A.fireball(g, 37, GY - 13, 3);
    },

    /* ---- guidance ---- */
    heat: () => {
      sky(); ground();
      tank(38, GY, 120, RED, "wolf");
      arc(TRAIL, 2, 30, 28, 16, 12, 3, 0, 0.75);
      for (let i = 0; i < 4; i++) line(i % 2 ? FIRE[3] : FIRE[2], 22 + i, 13 + i * 2, 33 + i, 26 + i);
      sphere(24, 15, 2.5);
      crosshair(38, GY - 5);
    },
    ballistic: () => {
      sky(); ground();
      arc(TRAIL, 3, 34, 42, GY - 4, 25, 3);
      thick(WHITE, 12, 7, 30, 7); P(WHITE, 12, 5, 3, 5); P(WHITE, 10, 6, 2, 3);
      thick(RED, 10, 1, 31, 13, "#5a0a0a"); thick(RED, 31, 1, 10, 13, "#5a0a0a");
      crosshair(42, GY - 5);
    },
    horz: () => {
      sky(); ground();
      tank(40, GY, 120, RED, "wolf");
      arc(TRAIL, 3, 32, 24, GY - 7, 18, 3, 0, 0.62);
      thick(YEL, 18, GY - 7, 31, GY - 7); P(YEL, 29, GY - 10, 2, 7); P(YEL, 31, GY - 9, 1, 5);
    },
    vert: () => {
      sky(); ground();
      tank(34, GY, 120, RED, "wolf");
      arc(TRAIL, 3, 32, 66, 32, 24, 3, 0, 0.5);
      thick(YEL, 34, 11, 34, GY - 18); P(YEL, 31, GY - 19, 7, 2); P(YEL, 32, GY - 17, 5, 1);
    },
    lazyboy: () => {
      sky(); ground();
      tank(9, GY, 35, "#4fc9ff");
      arc(YEL, 18, GY - 15, 38, GY - 5, 12, 4);
      crosshair(38, GY - 5);
      P(INK, 21, 3, 3, 9); P(INK, 18, 6, 9, 3); P(YEL, 22, 4, 1, 7); P(YEL, 19, 7, 7, 1);
    },
    /* ---- defence ---- */
    shield: () => bubble(CYAN, false),
    forceshield: () => {
      bubble(VIOLET, false);
      line(TRAIL, 3, 3, 12, 15); line(YEL, 12, 15, 4, 24); P(WHITE, 11, 14, 3, 3);
    },
    heavyshield: () => bubble(WHITE, true),
    mag: () => magnet(["#ff9090", "#e23a3a", "#a81e1e", "#5a0a0a"], 0),
    supermag: () => magnet(["#ffc8f2", "#ff7ae6", "#c23aa8", "#5a1050"], 1),
    autodefense: () => {
      bubble(CYAN, false);
      const bolt = [[37, 2], [33, 10], [37, 10], [32, 19]];
      for (let i = 1; i < bolt.length; i++) thick(YEL, ...bolt[i - 1], ...bolt[i]);
    },
    /* ---- gear ---- */
    parachute: () => {
      sky(); ground();
      for (let x = 7; x <= 40; x++) {
        const top = 5 + Math.round(((x - 23.5) / 17) ** 2 * 7);
        for (let y = top; y < top + 5; y++) P(y === top ? WHITE : ((x - 7) / 5 | 0) % 2 ? "#e23a3a" : "#f2f2f2", x, y);
        P(INK, x, top - 1); P(A.shade(((x - 7) / 5 | 0) % 2 ? "#e23a3a" : "#f2f2f2", -0.35), x, top + 5);
      }
      line("#c8c8c8", 8, 16, 19, 26); line("#c8c8c8", 39, 16, 29, 26); line("#c8c8c8", 24, 11, 24, 24);
      tank(24, 33, 60);
    },
    battery: () => {
      sky();
      box(19, 3, 10, 4, "#c8ccd8");
      box(13, 7, 22, 38, "#2b2f3a");
      for (let i = 0; i < 5; i++) box(16, 37 - i * 7, 16, 5, i > 3 ? "#8cff9a" : "#4ade6a");
      P(INK, 22, 15, 4, 10); P(INK, 19, 18, 10, 4); P(WHITE, 23, 16, 2, 8); P(WHITE, 20, 19, 8, 2);
    },
    fuel: () => {
      sky();
      box(9, 12, 30, 33, "#c22a24");
      box(15, 5, 12, 6, "#c22a24"); P(INK, 18, 7, 6, 2);
      box(31, 4, 5, 9, "#c8ccd8");
      thick("#8a1a16", 14, 18, 34, 40, "#e2453c"); thick("#8a1a16", 34, 18, 14, 40, "#e2453c");
    },
    contact: () => {
      sky(); ground();
      box(12, 26, 24, 12, "#7a5226");
      P(INK, 22, 10, 4, 16); P("#c8ccd8", 23, 10, 2, 16);
      box(13, 7, 22, 4, "#c8ccd8");
      line(YEL, 36, 31, 47, 31); line(YEL, 12, 31, 3, 25);
      fireball(4, 24, 3);
      P(RED, 23, 29, 3, 3);
    },
  };

  function flames(x0, x1, hMin, hVar, hot) {
    sky(); ground(x => GY + (x > x0 - 2 && x < x1 + 2 ? 1 : 0));
    for (let x = x0; x <= x1; x++) {
      const h = hMin + ((x * 7 + (x >> 2) * 3) % hVar);
      for (let i = 0; i < h; i++) P(FIRE[i < 2 ? (hot ? 0 : 1) : i < h * 0.45 ? 2 : i < h * 0.75 ? 3 : i < h - 1 ? 4 : 5], x, GY - i);
    }
    if (!hot) { sphere(23, 12, 2.5, ["#fff3a0", "#ff9a3c", "#d8261c", "#5a0a0a"]); P(FIRE[3], 23, 6, 1, 3); }
  }
  function roller(r, b) {
    sky(); ground(valley);
    const x = 10, y = valley(x) - r - 1;
    for (let i = 0; i < 3; i++) P(TRAIL, 0, y - 3 + i * 3, 4, 1);
    arc(TRAIL, x + 2, valley(x + 2) - 3, 24, GY - 3, -2, 4);
    sphere(x, y, r);
    fireball(24, GY - 1, b);
  }
  function riot(cone, len) {
    sky(); ground(x => x > 25 ? 20 : GY);
    for (let x = 26; x < N; x++) for (let y = 20; y < GY; y++) {
      const dx = x - 18, dy = (GY - 12) - y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (d < len && Math.abs(a - 0.3) < cone) P(((x + y) & 1) ? "#13224f" : "#182b5e", x, y);
      else if (d < len + 2 && Math.abs(a - 0.3) < cone + 0.06) P("#e8b878", x, y);
    }
    tank(9, GY, 18, "#8cff4a");
    for (let i = 0; i < (len > 20 ? 14 : 9); i++) {
      const a = 0.3 + cone * (((i * 37) % 21) / 10 - 1), d = len * (0.45 + ((i * 53) % 10) / 18);
      P(i % 2 ? "#f4e6c8" : "#d9c49a", Math.round(18 + Math.cos(a) * d), Math.round(GY - 12 - Math.sin(a) * d), 2, 2);
    }
  }
  function riotbomb(r) {
    sky(); ground(() => 18);
    disc("#e8b878", 24, 30, r + 1); disc("#182b5e", 24, 30, r);
    for (let y = 30 - r; y < 30 - r + 3; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - 24, y - 30) < r && ((x + y) & 1)) P("#13224f", x, y);
    ring("#f4e6c8", 24, 30, r + 3, true);
    arc(TRAIL, 1, 7, 24, 29 - r, 6, 3);
  }
  function digger(n, w) {
    sky(); ground(() => 14);
    const paths = [[[24, 14], [20, 22], [12, 26], [6, 36]], [[24, 14], [28, 22], [36, 24], [42, 32]], [[24, 14], [24, 24], [20, 34], [24, 44]],
      [[24, 14], [16, 18], [8, 18], [4, 24]], [[24, 14], [32, 18], [40, 16], [46, 20]]];
    for (const p of paths.slice(0, n)) for (let i = 1; i < p.length; i++) {
      for (let k = -w; k <= w; k++) line("#13182a", p[i - 1][0] + k, p[i - 1][1], p[i][0] + k, p[i][1]);
      line("#c48a48", p[i - 1][0] - w - 1, p[i - 1][1], p[i][0] - w - 1, p[i][1]);
    }
    arc(TRAIL, 3, 0, 24, 12, 4, 3);
    sphere(24, 13, 2);
  }
  function sandhog(n) {
    sky(); ground(() => 24);
    tank(38, 24, 120, RED, "wolf");
    for (let i = 0; i < n; i++) {
      const y = 30 + i * 4;
      for (const d of [-1, 0, 1]) line("#13182a", 6, 26 + i * 2 + d, 31, y + d);
      P(INK, 30, y - 2, 5, 5); P(YEL, 31, y - 1, 3, 3);
    }
    fireball(36, 30 + (n - 1) * 2, 4 + n);
    arc(TRAIL, 0, 6, 6, 24, 6, 3);
  }
  function clod(r) {
    sky(); ground();
    const y = GY - 3 - r * 1.25;
    for (let i = -1; i <= 1; i++) P(TRAIL, 24 + i * Math.max(4, r * 0.6), y - r - 9, 1, 6);
    sphere(24, y, r, DIRTBALL);
    for (let i = 0; i < r; i++) P("#5a3818", 24 + Math.round(Math.cos(i * 2.4) * r * 0.5), Math.round(y + Math.sin(i * 2.4) * r * 0.5));
  }
  function bubble(c, heavy) {
    sky(); ground(); tank(24, GY, 60);
    g.globalAlpha = 0.12; disc(c, 24, GY - 6, 16); g.globalAlpha = 1;
    ring(c, 24, GY - 6, 17); ring(c, 24, GY - 6, 16, !heavy);
    if (heavy) { ring(c, 24, GY - 6, 18); ring("#c8d4ff", 24, GY - 6, 15); }
    for (let i = 0; i < 6; i++) { const a = -2.3 + i * 0.1; P(WHITE, Math.round(24 + Math.cos(a) * 13), Math.round(GY - 6 + Math.sin(a) * 13)); }
  }
  function magnet(tones, big) {
    sky(); ground();
    const cx = 18, cy = 20;
    for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
      const d = Math.hypot(dx, dy);
      if (dy < 0 || d > 13 || d < 6) continue;
      const lit = (-dx * 0.5 - dy * 0.7) / 13;
      P(d > 12.2 || d < 6.8 ? INK : tones[lit > 0.2 ? 0 : lit > -0.2 ? 1 : lit > -0.6 ? 2 : 3], cx + dx, cy + dy);
    }
    box(5, 6, 8, 14, tones[1]); box(24, 6, 8, 14, tones[2]);
    box(5, 3, 8, 4, "#c8ccd8"); box(24, 3, 8, 4, "#c8ccd8");
    arc(TRAIL, 46, 3, 46, 36, -12 - big * 6, 3);
    for (let r = 0; r <= big; r++) ring(YEL, 18, 12, 18 + r * 5, true);
  }

  const cache = {};
  /* the icon for an item id, as a data URL */
  SP.Icon = id => {
    if (cache[id]) return cache[id];
    const cv = document.createElement("canvas");
    cv.width = N; cv.height = N;
    g = cv.getContext("2d");
    (ICONS[id] || (() => { sky(); ground(); }))();
    return (cache[id] = cv.toDataURL());
  };
  /* an <img> of it: scale 1 is 48 px, 2 is 96; below 1 it is smoothed down */
  SP.IconImg = (id, scale = 1, cls = "ico") => `<img class="${cls}" src="${SP.Icon(id)}" width="${N * scale}" height="${N * scale}" alt="">`;
  SP.ICON_IDS = Object.keys(ICONS);
})();
