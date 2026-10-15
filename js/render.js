/* Scorched Puma -- drawing a match onto its canvas: SP.H high, as wide as the match.
 *
 * new SP.Renderer(canvas) keeps its own sky and terrain layers. draw(s, fx)
 * paints the state as it stands, plus the page's own effects (fx: damage
 * numbers, the aim aid, and talk, which is page text over the canvas), which
 * never touch the engine. The title's attract mode is just a second Renderer
 * on a second match. */
(() => {
  const SP = globalThis.SP, A = SP.Art, F = SP.Font, KT = SP.TANK;

  /* a hash of small numbers to 0..1, for sparks that are random but steady from frame to frame */
  const h01 = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.sky = document.createElement("canvas");
      this.ter = document.createElement("canvas");
      this.size(SP.W);
      this.key = null;
      this.frame = 0;
      this.shake = 0;
      this.flash = 0;
      this.bolt = null;
    }

    /* a new round, or a restored match: new sky, whole terrain */
    /* the canvases at a match's width: every match is as wide as the
       window was when it began, the height always SP.H */
    size(w) {
      const h = SP.H, cv = this.cv;
      this.W = w;
      cv.width = w; cv.height = h;
      this.g = cv.getContext("2d");
      this.g.imageSmoothingEnabled = false;
      this.sky.width = w; this.sky.height = h;
      this.ter.width = w; this.ter.height = h;
      this.tg = this.ter.getContext("2d");
      this.img = this.tg.createImageData(w, h);
      this.u32 = new Uint32Array(this.img.data.buffer);
      /* the dirt's grain: three tones in clumps of two by two, fixed for the canvas */
      this.grain = new Uint8Array(w * h);
      const r = SP.rng(1991);
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const v = SP.rand(r), k = v < 0.22 ? 0 : v > 0.8 ? 2 : 1;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (x + dx < w && y + dy < h) this.grain[(y + dy) * w + x + dx] = SP.rand(r) < 0.8 ? k : 1;
      }
    }

    reset(s) {
      if (s.terrain.w !== this.W) this.size(s.terrain.w);
      A.drawSky(this.sky.getContext("2d"), s.sky, s.seed + s.round * 7919);
      this.pal = A.dirtPalettes(s.dirt);
      this.key = s.terrain;
      s.terrain.full = true;
    }

    syncTerrain(t) {
      let x0, y0, x1, y1;
      if (t.full) { x0 = 0; y0 = 0; x1 = t.w - 1; y1 = t.h - 1; t.full = false; t.dirty = null; }
      else if (t.dirty) { [x0, y0, x1, y1] = t.dirty; t.dirty = null; y1 = Math.min(t.h - 1, y1 + 2); }
      else return;
      const { px } = t, u = this.u32, w = t.w, { grain, rim, rim2 } = this.pal, gr = this.grain;
      for (let y = y0; y <= y1; y++) for (let x = x0, i = y * w + x0; x <= x1; x++, i++) {
        const v = px[i];
        if (!v) { u[i] = 0; continue; }
        /* the lit edge where dirt meets air, then the grain */
        u[i] = y > 0 && !px[i - w] ? rim[v] : y > 1 && !px[i - 2 * w] ? rim2[v] : grain[gr[i]][v];
      }
      this.tg.putImageData(this.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    }

    draw(s, fx = {}) {
      const g = this.g;
      this.frame++;
      if (this.key !== s.terrain) this.reset(s);
      this.syncTerrain(s.terrain);
      g.save();
      if (this.shake > 0.3) { g.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake)); this.shake *= 0.86; }
      else this.shake = 0;
      g.drawImage(this.sky, 0, 0);
      if (s.sky === "storm") this.storm(g);
      for (const sm of s.smoke) this.smoke(g, sm.pts, sm.colour);
      for (const tr of s.traces) this.trail(g, tr.pts, tr.colour, 0.9);
      g.drawImage(this.ter, 0, 0);
      for (const e of s.ents) if (e.k !== "boom") this.ent(g, s, e);
      const cur = fx.current != null ? s.tanks[fx.current] : null;
      for (const t of s.tanks) if (t.alive) this.tank(g, s, t, t === cur, fx);
      for (const e of s.ents) if (e.k === "boom") this.ent(g, s, e);
      if (fx.marks && cur && cur.alive && s.phase === "aim") this.marks(g, s, cur, fx.marks);
      if (fx.aim && cur && cur.alive) this.aimAid(g, s, cur);
      this.offscreen(g, s);
      for (const f of fx.floats || []) this.float(g, f);
      if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash})`; g.fillRect(0, 0, this.W, SP.H); this.flash = Math.max(0, this.flash - 0.08); }
      g.restore();
      this.talk(s, fx.bubbles || []);
    }

    storm(g) {
      if (!this.bolt && Math.random() < 0.004) {
        let x = 60 + Math.random() * (this.W - 120), y = 0;
        const pts = [[x, y]];
        while (y < SP.H * 0.6) { x += (Math.random() - 0.5) * 33; y += 9 + Math.random() * 21; pts.push([x, y]); }
        this.bolt = { pts, t: 10 };
        this.flash = 0.18;
        if (SP.Sfx) SP.Sfx.play("thunder");
      }
      if (this.bolt) {
        g.fillStyle = "#8aa0ff"; g.globalAlpha = 0.5;
        for (let i = 1; i < this.bolt.pts.length; i++) A.line(g, this.bolt.pts[i - 1][0] + 1, this.bolt.pts[i - 1][1], this.bolt.pts[i][0] + 1, this.bolt.pts[i][1]);
        g.globalAlpha = 1; g.fillStyle = this.bolt.t % 4 < 2 ? "#ffffff" : "#c8d4ff";
        for (let i = 1; i < this.bolt.pts.length; i++) A.line(g, ...this.bolt.pts[i - 1], ...this.bolt.pts[i]);
        if (--this.bolt.t <= 0) this.bolt = null;
      }
    }

    /* a trail, fading toward its tail */
    trail(g, pts, colour, alpha, fade = true) {
      if (!pts || pts.length < 2) return;
      g.fillStyle = colour;
      const n = pts.length;
      for (let i = 1; i < n; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        if (Math.abs(x1 - x0) > this.W / 2) continue;      // wrapped round
        g.globalAlpha = alpha * (fade ? 0.15 + 0.85 * i / n : 1);
        A.line(g, x0, y0, x1, y1);
      }
      g.globalAlpha = 1;
    }
    /* a smoke tracer's path: puffs, lit on top */
    smoke(g, pts, colour) {
      if (!pts) return;
      for (let i = 0; i < pts.length; i += 3) {
        const [x, y] = pts[i], r = 2 + (i * 7 % 3);
        g.globalAlpha = 0.35; g.fillStyle = "#4a4e5a"; A.disc(g, x, y + 1, r);
        g.globalAlpha = 0.45; g.fillStyle = A.shade(colour, 0.45); A.disc(g, x, y, r - 1);
      }
      g.globalAlpha = 1;
    }

    ent(g, s, e) {
      const f = this.frame;
      switch (e.k) {
        case "proj": {
          const o = s.tanks[e.owner], col = o ? o.colour : "#fff";
          const tail = e.trail.length > 220 ? e.trail.slice(-220) : e.trail;
          this.trail(g, tail, col, 0.85);
          const x = Math.round(e.x), y = Math.round(e.y);
          g.globalAlpha = 0.35; g.fillStyle = col; A.disc(g, x, y, 3); g.globalAlpha = 1;
          g.fillStyle = "#0b0d14"; g.fillRect(x - 1, y - 2, 3, 5); g.fillRect(x - 2, y - 1, 5, 3);
          g.fillStyle = "#ffffff"; g.fillRect(x - 1, y - 1, 3, 3);
          g.fillStyle = "#fff3a0"; g.fillRect(x, y, 1, 1);
          return;
        }
        case "boom": {
          const grow = e.t <= e.grow, k = grow ? e.t / e.grow : 1 - (e.t - e.grow) / (e.dur - e.grow);
          const r = Math.max(1, e.r * (grow ? Math.sqrt(k) : 1));
          const pal = e.riot ? A.DUST : e.funky ? A.FUNKY : A.FIRE;
          const seed = Math.round(e.x * 7 + e.y * 13);
          if (grow) {
            A.fireball(g, e.x, e.y, r, pal, (f >> 1) % pal.length * 0.5);
            if (e.death && e.colour) { g.fillStyle = e.colour; A.ring(g, e.x, e.y, r * 0.55, true); }
          } else {
            /* the ball sinks into smoke as it goes */
            g.globalAlpha = Math.max(0, k);
            A.fireball(g, e.x, e.y, r * (0.55 + 0.45 * k), pal, (f >> 1) % pal.length * 0.5);
            g.globalAlpha = Math.max(0, k * 0.6);
            for (let i = 0; i < 4; i++) {
              g.fillStyle = i % 2 ? "#3c3f4a" : "#5a5e6a";
              A.disc(g, e.x + (h01(seed, i) - 0.5) * r, e.y - r * 0.4 - (e.t - e.grow) * 0.8 - i * 3, r * 0.3 * (0.6 + h01(i, seed)));
            }
            g.globalAlpha = 1;
          }
          /* sparks thrown out past the edge */
          if (!e.riot) {
            const n = Math.min(28, 6 + Math.round(e.r * 0.35)), reach = e.r * (0.7 + 0.8 * e.t / e.dur);
            for (let i = 0; i < n; i++) {
              const a = h01(seed, i) * Math.PI * 2, d = reach * (0.7 + 0.5 * h01(i, seed));
              const sx = Math.round(e.x + Math.cos(a) * d), sy = Math.round(e.y + Math.sin(a) * d + (e.t / e.dur) ** 2 * 10);
              g.globalAlpha = Math.max(0, 1 - e.t / e.dur);
              g.fillStyle = pal[1 + (i % 3)]; g.fillRect(sx, sy, 2, 2);
            }
            g.globalAlpha = 1;
          } else {
            g.globalAlpha = Math.max(0, k) * 0.6; g.fillStyle = A.DUST[0];
            A.ring(g, e.x, e.y, r + 2, true); g.globalAlpha = 1;
          }
          return;
        }
        case "roller":
          A.sphere(g, e.x, e.y - 3, 2.5, ["#ffffff", "#c8ccd8", "#8d92a0", "#555a66"]);
          g.fillStyle = "#2b2d36"; g.fillRect(Math.round(e.x) + ((f >> 2) % 2 ? 0 : -1), Math.round(e.y) - 3, 1, 1);
          return;
        case "worm": case "hog": {
          const x = Math.round(e.x), y = Math.round(e.y);
          g.fillStyle = "#0b0d14"; g.fillRect(x - 2, y - 2, 4, 4);
          g.fillStyle = e.k === "hog" ? "#ffd23f" : "#f4e6c8"; g.fillRect(x - 1, y - 1, 2, 2);
          return;
        }
        case "fire": {
          /* a flickering tongue: pale at the root, red at the tip, with a glow */
          const fl = (((f >> 1) * 7 + e.x * 13 + (e.t || 0)) % 7);
          const h = 5 + fl + (e.hot ? 3 : 0) - (e.life < 30 ? 4 : 0);
          g.globalAlpha = 0.16; g.fillStyle = A.FIRE[3]; A.disc(g, e.x, e.y - 2, 5);
          g.globalAlpha = 1;
          for (let i = 0; i < h; i++) {
            g.fillStyle = A.FIRE[i < 2 ? 1 : i < h * 0.45 ? 2 : i < h * 0.75 ? 3 : 5];
            g.fillRect(e.x, e.y - i, 1, 1);
            if (i < h - 3) g.fillRect(e.x + ((fl & 1) ? 1 : -1), e.y - i, 1, 1);
          }
          return;
        }
        case "liquid":
          g.fillStyle = "#6a4a26"; g.fillRect(e.x, e.y - 1, 1, 2);
          g.fillStyle = "#b08050"; g.fillRect(e.x, e.y - 1, 1, 1);
          return;
        case "beam": {
          const k = 1 - e.t / e.dur;
          g.globalAlpha = k * 0.35; g.fillStyle = e.colour;
          for (const d of [-3, -2, 2, 3]) A.line(g, e.x0, e.y0 + d, e.x1, e.y1 + d);
          g.globalAlpha = k * 0.8;
          for (const d of [-1, 1]) A.line(g, e.x0, e.y0 + d, e.x1, e.y1 + d);
          g.globalAlpha = k; g.fillStyle = "#ffffff"; A.line(g, e.x0, e.y0, e.x1, e.y1);
          g.globalAlpha = 1;
          A.fireball(g, e.x1, e.y1, 4 * k + 1);
          return;
        }
        case "plasma": {
          const k = Math.min(1, e.t / e.grow), r = e.r * k;
          g.globalAlpha = e.t <= e.grow ? 0.9 : Math.max(0, 1 - (e.t - e.grow) / (e.dur - e.grow));
          g.fillStyle = "#1a8ab0"; A.ring(g, e.x, e.y, r + 1);
          g.fillStyle = "#54f2ff"; A.ring(g, e.x, e.y, r); A.ring(g, e.x, e.y, r - 1);
          g.fillStyle = "#ffffff"; A.ring(g, e.x, e.y, r * 0.75, true); A.ring(g, e.x, e.y, r * 0.45, true);
          g.globalAlpha = 1;
          return;
        }
        case "riot": {
          const k = e.t / e.dur;
          for (let i = 0; i < 18; i++) {
            const a = e.a + e.cone * (h01(i, 7) * 2 - 1), d = e.r * (0.25 + 0.75 * k) * (0.5 + 0.5 * h01(7, i));
            g.globalAlpha = 0.8 * (1 - k); g.fillStyle = A.DUST[i % 3];
            g.fillRect(Math.round(e.x + Math.cos(a) * d), Math.round(e.y - Math.sin(a) * d), 2, 2);
          }
          g.globalAlpha = 1;
          return;
        }
        case "ring":
          g.globalAlpha = 1 - e.t / e.dur; g.fillStyle = "#b48cff";
          A.ring(g, e.x, e.y, 6 + e.t * 4); A.ring(g, e.x, e.y, 4 + e.t * 4, true); g.globalAlpha = 1;
          return;
      }
    }

    tank(g, s, t, lit, fx) {
      const dying = t.health <= 0;
      if (dying && (this.frame >> 2) % 2) return;        // a destroyed tank flickers before it goes
      if (t.mag) A.drawMag(g, t, this.frame);
      A.drawTank(g, t, { lit: lit && (this.frame >> 4) % 2 === 0 });
      if (t.shield) A.drawShield(g, t, this.frame);
      if (t.fall && t.fall.chute) A.drawChute(g, t);
      /* a health bar over every tank, and an arrow over the one whose turn it is */
      const x = Math.round(t.x), y = Math.round(t.y) - (t.shield ? KT.mid + SP.SHIELD_R + 6 : KT.tall + 8);
      if (!dying) {
        g.fillStyle = "#0b0d14"; g.fillRect(x - 9, y, 19, 4);
        g.fillStyle = "#2b2d36"; g.fillRect(x - 8, y + 1, 17, 2);
        const w = Math.max(1, Math.round(17 * t.health / 100));
        g.fillStyle = t.health > 50 ? t.colour : t.health > 25 ? "#ffd23f" : "#ff4d4d";
        g.fillRect(x - 8, y + 1, w, 2);
        g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(x - 8, y + 1, w, 1);
      }
      if (lit) {
        const bob = (this.frame >> 3) % 2, ay = y - 10 + bob;
        g.fillStyle = "#0b0d14"; g.fillRect(x - 4, ay - 1, 9, 6);
        g.fillStyle = "#ffffff";
        g.fillRect(x - 3, ay, 7, 1); g.fillRect(x - 2, ay + 1, 5, 1); g.fillRect(x - 1, ay + 2, 3, 1); g.fillRect(x, ay + 3, 1, 1);
        if (fx.names !== false) {
          const name = t.name.toUpperCase(), w = F.width(name);
          F.shadow(g, name, SP.clamp(x - w / 2, 2, this.W - w - 2), ay - 12, "#ffffff");
        }
      }
      if (fx.you === t.id && !lit) {
        /* yours, on someone else's turn: a still white chevron over the bar */
        const ay = y - 7;
        g.fillStyle = "#0b0d14"; g.fillRect(x - 4, ay - 1, 9, 5);
        g.fillStyle = "#ffffff";
        g.fillRect(x - 3, ay, 7, 1); g.fillRect(x - 2, ay + 1, 5, 1); g.fillRect(x - 1, ay + 2, 3, 1);
      }
      if (fx.target === t.id) {
        g.fillStyle = (this.frame >> 3) % 2 ? "#ff4d4d" : "#ffffff";
        const cx = x, cy = Math.round(t.y) - KT.mid;
        g.fillRect(cx - 16, cy, 6, 1); g.fillRect(cx + 11, cy, 6, 1);
        g.fillRect(cx, cy - 16, 1, 6); g.fillRect(cx, cy + 11, 1, 6);
      }
    }

    /* The console's marks. The aim: an arrow out of the barrel as long as
     * the power (pinned to the edge when it runs off the field), and past its
     * tip the angle and power on a small plate. It is not a target: the shell
     * falls short of it, and the wind moves it. Last turn's aim as a faint
     * diamond, and where that shot came down as a cross. */
    marks(g, s, t, m) {
      const W = this.W, H = SP.H;
      const pin = p => ({ x: SP.clamp(Math.round(p.x), 8, W - 9), y: SP.clamp(Math.round(p.y), 8, H - 9), out: p.x < 8 || p.x > W - 9 || p.y < 8 || p.y > H - 9 });
      if (m.landed) {
        const x = m.landed.x, y = m.landed.y;
        for (const [c, o] of [["#0b0d14", 1], [m.colour, 0]]) {
          g.fillStyle = c;
          for (let i = -4; i <= 4; i++) { g.fillRect(x + i - o, y + i - o, 1 + o * 2, 1 + o * 2); g.fillRect(x + i - o, y - i - o, 1 + o * 2, 1 + o * 2); }
        }
      }
      if (m.last) {
        const p = pin(m.last);
        g.globalAlpha = 0.55; g.fillStyle = "#c8ccd8";
        for (let i = 0; i < 5; i++) { g.fillRect(p.x - 5 + i, p.y - i, 1, 1); g.fillRect(p.x + 5 - i, p.y - i, 1, 1); g.fillRect(p.x - 5 + i, p.y + i, 1, 1); g.fillRect(p.x + 5 - i, p.y + i, 1, 1); }
        g.globalAlpha = 1;
      }
      const a = m.aim, p = pin(a);
      const rx = t.x, ry = t.y - KT.turretY;                 // the turret's root
      const dx = a.x - rx, dy = a.y - ry, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;                               // across the shaft
      const shown = Math.min(len, Math.hypot(p.x - rx, p.y - ry)), from = SP.PHYS.turretLen + 3;
      /* the shaft, inked under, then lit, so it reads on any sky or dirt */
      if (shown > from + 6) {
        const x0 = rx + ux * from, y0 = ry + uy * from, x1 = rx + ux * (shown - 5), y1 = ry + uy * (shown - 5);
        g.fillStyle = "#0b0d14"; A.line(g, x0 + 1, y0 + 1, x1 + 1, y1 + 1);
        g.fillStyle = "#e6ebf7"; A.line(g, x0, y0, x1, y1);
      }
      /* the arrowhead, in the tank's colour */
      const head = (c, grow) => {
        g.fillStyle = c;
        for (let i = 0; i <= 6 + grow; i++) {
          const half = i * 0.6 + grow * 0.5;
          for (let j = -half; j <= half; j += 0.5) g.fillRect(Math.round(p.x - ux * (i - grow) + nx * j), Math.round(p.y - uy * (i - grow) + ny * j), 1, 1);
        }
      };
      head("#0b0d14", 1); head(m.colour, 0);
      /* angle and power past the tip, on a plate, kept on the field */
      const ang = t.angle + "°", pw = String(t.power), wa = F.width(ang), w = wa + 6 + F.width(pw);
      const cx = p.x + ux * (12 + Math.abs(ux) * w / 2), cy = p.y + uy * 12;
      const x = SP.clamp(Math.round(cx - w / 2), 4, W - w - 4), y = SP.clamp(Math.round(cy - 3), 4, H - 11);
      g.fillStyle = "rgba(11,13,20,.82)"; g.fillRect(x - 3, y - 2, w + 6, 11);
      F.draw(g, ang, x, y, "#54f2ff");
      F.draw(g, pw, x + wa + 6, y, "#ffffff");
    }

    /* where the shot would go in still air: Settings' aim aid, a short way only */
    aimAid(g, s, t) {
      const p = { ...SP.Physics.launch(t, t.angle, t.power), age: 0, owner: t.id };
      const env = { g: SP.PHYS.g * s.opts.gravity, wind: 0, drag: 0, wall: s.wall };
      const world = { sim: true, terrain: s.terrain, tanks: [], opts: s.opts, wind: 0, wall: s.wall, events: { push() {} } };
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 70; i++) {
        if (SP.Physics.step(world, p, env)) break;
        if (i % 4 === 0) { g.globalAlpha = 1 - i / 80; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
      }
      g.globalAlpha = 1;
    }

    /* a shot above the top of the field: a marker on the edge, and how high */
    offscreen(g, s) {
      for (const e of s.ents) {
        if (e.k !== "proj" || e.y >= 0) continue;
        const x = SP.clamp(Math.round(e.x), 5, this.W - 6), o = s.tanks[e.owner];
        g.fillStyle = "#0b0d14"; g.fillRect(x - 5, 0, 11, 6);
        g.fillStyle = o ? o.colour : "#fff";
        g.fillRect(x - 4, 1, 9, 1); g.fillRect(x - 3, 2, 7, 1); g.fillRect(x - 2, 3, 5, 1); g.fillRect(x - 1, 4, 3, 1);
        const h = String(Math.round(-e.y / SP.K));
        F.shadow(g, h, SP.clamp(x - F.width(h) / 2, 1, this.W - F.width(h) - 1), 9, "#ffffff");
      }
    }

    float(g, f) {
      g.globalAlpha = Math.min(1, f.life / 20);
      F.shadow(g, f.text, Math.round(f.x - F.width(f.text) / 2), Math.round(f.y), f.colour);
      g.globalAlpha = 1;
    }

    /* talk: page text in a layer over the canvas, not the pixel font, so a
       line reads as easily as anything else on the page. One bubble a tank,
       kept and moved from frame to frame. */
    talk(s, bubbles) {
      const cv = this.cv, host = cv.parentNode;
      if (!host) return;
      if (!this.layer || this.layer.parentNode !== host) {
        this.layer = document.createElement("div");
        this.layer.className = "talk";
        this.layer.setAttribute("aria-hidden", "true");
        host.appendChild(this.layer);
        this.said = new Map();
      }
      const keep = new Set();
      /* where the canvas is drawn: its box, and the scale it is shown at (covered, on the title) */
      const bw = cv.offsetWidth, bh = cv.offsetHeight;
      if (!bw || !bh) return;
      const sc = Math.max(bw / this.W, bh / SP.H), ox = cv.offsetLeft + (bw - this.W * sc) / 2, oy = cv.offsetTop + (bh - SP.H * sc) / 2;
      const lw = this.layer.clientWidth, m = 6;
      for (const b of bubbles) {
        const t = s.tanks[b.tank];
        if (!t) continue;
        keep.add(b.tank);
        let el = this.said.get(b.tank);
        if (!el) { el = document.createElement("div"); el.className = "say"; this.layer.appendChild(el); this.said.set(b.tank, el); }
        if (el.dataset.text !== b.text) { el.dataset.text = b.text; el.textContent = b.text; el.style.setProperty("--who", t.colour); }
        const ax = ox + t.x * sc, ay = oy + (t.y - KT.tall - 10) * sc, w = el.offsetWidth;
        const x = Math.max(m, Math.min(lw - w - m, ax - w / 2));
        el.style.left = Math.round(x) + "px";
        el.style.top = Math.round(Math.max(m, ay - el.offsetHeight - 10)) + "px";
        el.style.setProperty("--tail", Math.round(Math.max(12, Math.min(w - 12, ax - x))) + "px");
        el.style.opacity = Math.min(1, b.life / 20);
      }
      for (const [id, el] of this.said) if (!keep.has(id)) { el.remove(); this.said.delete(id); }
    }
  }
  SP.Renderer = Renderer;
})();
