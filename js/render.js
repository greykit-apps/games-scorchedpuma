/* Scorched Puma -- drawing a match onto a 640x360 canvas.
 *
 * new SP.Renderer(canvas) keeps its own sky and terrain layers. draw(s, fx)
 * paints the state as it stands, plus the page's own effects (fx: damage
 * numbers, talk, the aim aid), which never touch the engine. The title's
 * attract mode is just a second Renderer on a second match. */
(() => {
  const SP = globalThis.SP, A = SP.Art, F = SP.Font, Tk = SP.Tanks;

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      canvas.width = SP.W; canvas.height = SP.H;
      this.g = canvas.getContext("2d");
      this.g.imageSmoothingEnabled = false;
      this.sky = document.createElement("canvas"); this.sky.width = SP.W; this.sky.height = SP.H;
      this.ter = document.createElement("canvas"); this.ter.width = SP.W; this.ter.height = SP.H;
      this.tg = this.ter.getContext("2d");
      this.img = this.tg.createImageData(SP.W, SP.H);
      this.u32 = new Uint32Array(this.img.data.buffer);
      this.key = null;
      this.frame = 0;
      this.shake = 0;
      this.flash = 0;
      this.bolt = null;
    }

    /* a new round, or a restored match: new sky, whole terrain */
    reset(s) {
      A.drawSky(this.sky.getContext("2d"), s.sky, s.seed + s.round * 7919);
      this.pal = A.dirtPalette(s.dirt);
      this.key = s.terrain;
      s.terrain.full = true;
    }

    syncTerrain(t) {
      let x0, y0, x1, y1;
      if (t.full) { x0 = 0; y0 = 0; x1 = t.w - 1; y1 = t.h - 1; t.full = false; t.dirty = null; }
      else if (t.dirty) { [x0, y0, x1, y1] = t.dirty; t.dirty = null; }
      else return;
      const { px } = t, u = this.u32, pal = this.pal, w = t.w;
      for (let y = y0; y <= y1; y++) for (let x = x0, i = y * w + x0; x <= x1; x++, i++) u[i] = px[i] ? pal[px[i]] : 0;
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
      for (const sm of s.smoke) this.trail(g, sm.pts, sm.colour, 0.55);
      for (const tr of s.traces) this.trail(g, tr.pts, tr.colour, 0.9);
      g.drawImage(this.ter, 0, 0);
      for (const e of s.ents) this.ent(g, s, e);
      const cur = fx.current != null ? s.tanks[fx.current] : null;
      for (const t of s.tanks) if (t.alive) this.tank(g, s, t, t === cur, fx);
      if (fx.aim && cur && cur.alive) this.aimAid(g, s, cur);
      this.offscreen(g, s);
      for (const f of fx.floats || []) this.float(g, f);
      for (const b of fx.bubbles || []) this.bubble(g, s, b);
      if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash})`; g.fillRect(0, 0, SP.W, SP.H); this.flash = Math.max(0, this.flash - 0.08); }
      g.restore();
    }

    storm(g) {
      if (!this.bolt && Math.random() < 0.004) {
        let x = 40 + Math.random() * (SP.W - 80), y = 0;
        const pts = [[x, y]];
        while (y < SP.H * 0.6) { x += (Math.random() - 0.5) * 22; y += 6 + Math.random() * 14; pts.push([x, y]); }
        this.bolt = { pts, t: 10 };
        this.flash = 0.18;
        if (SP.Sfx) SP.Sfx.play("thunder");
      }
      if (this.bolt) {
        g.fillStyle = this.bolt.t % 4 < 2 ? "#ffffff" : "#c8d4ff";
        for (let i = 1; i < this.bolt.pts.length; i++) A.line(g, ...this.bolt.pts[i - 1], ...this.bolt.pts[i]);
        if (--this.bolt.t <= 0) this.bolt = null;
      }
    }

    trail(g, pts, colour, alpha) {
      if (!pts || pts.length < 2) return;
      g.globalAlpha = alpha; g.fillStyle = colour;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        if (Math.abs(x1 - x0) > SP.W / 2) continue;     // wrapped round
        A.line(g, x0, y0, x1, y1);
      }
      g.globalAlpha = 1;
    }

    ent(g, s, e) {
      const f = this.frame;
      switch (e.k) {
        case "proj": {
          const o = s.tanks[e.owner], col = o ? o.colour : "#fff";
          const tail = e.trail.length > 160 ? e.trail.slice(-160) : e.trail;
          this.trail(g, tail, col, 0.75);
          g.fillStyle = "#ffffff"; g.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 2, 2);
          return;
        }
        case "boom": {
          const grow = e.t <= e.grow, k = grow ? e.t / e.grow : 1 - (e.t - e.grow) / (e.dur - e.grow);
          const r = Math.max(1, e.r * (grow ? Math.sqrt(k) : 1));
          const pal = e.riot ? A.DUST : e.funky ? A.FUNKY : A.FIRE;
          g.globalAlpha = grow ? 1 : Math.max(0, k);
          /* concentric bands, cycling outward: the colour-cycled fireball */
          for (let i = 0, rr = r; rr > 0; i++, rr -= Math.max(2, r / 7)) {
            g.fillStyle = e.death && i === 0 ? e.colour || pal[0] : pal[(i + (f >> 1)) % pal.length];
            A.disc(g, e.x, e.y, rr);
          }
          g.globalAlpha = 1;
          return;
        }
        case "roller":
          g.fillStyle = "#e8e8e8"; A.disc(g, e.x, e.y - 2, 1.6);
          g.fillStyle = "#404040"; g.fillRect(Math.round(e.x) + ((f >> 2) % 2 ? 0 : -1), Math.round(e.y) - 2, 1, 1);
          return;
        case "worm": case "hog":
          g.fillStyle = e.k === "hog" ? "#ffd23f" : "#f4e6c8";
          g.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 2, 2);
          return;
        case "fire": {
          /* a flickering tongue: pale at the root, red at the tip, with a glow */
          const fl = (((f >> 1) * 7 + e.x * 13 + (e.t || 0)) % 6);
          const h = 3 + fl + (e.hot ? 2 : 0) - (e.life < 30 ? 3 : 0);
          g.globalAlpha = 0.18; g.fillStyle = A.FIRE[3]; A.disc(g, e.x, e.y - 1, 3);
          g.globalAlpha = 1;
          for (let i = 0; i < h; i++) {
            g.fillStyle = A.FIRE[i < 2 ? 1 : i < h * 0.6 ? 3 : 5];
            g.fillRect(e.x, e.y - i, 1, 1);
            if (i < h - 2) g.fillRect(e.x + ((fl & 1) ? 1 : -1), e.y - i, 1, 1);
          }
          return;
        }
        case "liquid":
          g.fillStyle = "#8a6438"; g.fillRect(e.x, e.y, 1, 1);
          return;
        case "beam": {
          const k = 1 - e.t / e.dur;
          g.globalAlpha = k; g.fillStyle = "#ffffff"; A.line(g, e.x0, e.y0, e.x1, e.y1);
          g.globalAlpha = k * 0.5; g.fillStyle = e.colour;
          A.line(g, e.x0, e.y0 - 1, e.x1, e.y1 - 1); A.line(g, e.x0, e.y0 + 1, e.x1, e.y1 + 1);
          g.globalAlpha = 1;
          return;
        }
        case "plasma": {
          const k = Math.min(1, e.t / e.grow), r = e.r * k;
          g.globalAlpha = e.t <= e.grow ? 0.85 : Math.max(0, 1 - (e.t - e.grow) / (e.dur - e.grow));
          g.fillStyle = "#54f2ff"; A.ring(g, e.x, e.y, r); A.ring(g, e.x, e.y, r - 1);
          g.fillStyle = "#ffffff"; A.ring(g, e.x, e.y, r * 0.7, true);
          g.globalAlpha = 1;
          return;
        }
        case "riot": {
          g.globalAlpha = 0.6 * (1 - e.t / e.dur); g.fillStyle = "#f4e6c8";
          for (let i = -4; i <= 4; i++) {
            const a = e.a + e.cone * i / 4, rr = e.r * (0.4 + 0.6 * e.t / e.dur);
            A.line(g, e.x, e.y, e.x + Math.cos(a) * rr, e.y - Math.sin(a) * rr);
          }
          g.globalAlpha = 1;
          return;
        }
        case "ring":
          g.globalAlpha = 1 - e.t / e.dur; g.fillStyle = "#b48cff";
          A.ring(g, e.x, e.y, 4 + e.t * 3); g.globalAlpha = 1;
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
      /* a health pip over every tank, and an arrow over the one whose turn it is */
      const x = Math.round(t.x), y = Math.round(t.y) - 12;
      if (!dying) {
        g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(x - 6, y, 13, 3);
        g.fillStyle = t.health > 50 ? t.colour : t.health > 25 ? "#ffd23f" : "#ff4d4d";
        g.fillRect(x - 5, y + 1, Math.max(1, Math.round(11 * t.health / 100)), 1);
      }
      if (lit) {
        const bob = (this.frame >> 3) % 2;
        g.fillStyle = "#ffffff";
        g.fillRect(x - 2, y - 6 + bob, 5, 1); g.fillRect(x - 1, y - 5 + bob, 3, 1); g.fillRect(x, y - 4 + bob, 1, 1);
        if (fx.names !== false) {
          const w = F.width(t.name.toUpperCase());
          F.shadow(g, t.name.toUpperCase(), SP.clamp(x - w / 2, 2, SP.W - w - 2), y - 16, "#ffffff");
        }
      }
      if (fx.target === t.id) {
        g.fillStyle = (this.frame >> 3) % 2 ? "#ff4d4d" : "#ffffff";
        const cx = x, cy = Math.round(t.y) - 3;
        g.fillRect(cx - 11, cy, 4, 1); g.fillRect(cx + 8, cy, 4, 1);
        g.fillRect(cx, cy - 11, 1, 4); g.fillRect(cx, cy + 8, 1, 4);
      }
    }

    /* where the shot would go in still air: Settings' aim aid, a short way only */
    aimAid(g, s, t) {
      const p = { ...SP.Physics.launch(t, t.angle, t.power), age: 0, owner: t.id };
      const env = { g: SP.PHYS.g * s.opts.gravity, wind: 0, drag: 0, wall: s.wall };
      const world = { sim: true, terrain: s.terrain, tanks: [], opts: s.opts, wind: 0, wall: s.wall, events: { push() {} } };
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 70; i++) {
        if (SP.Physics.step(world, p, env)) break;
        if (i % 4 === 0) { g.globalAlpha = 1 - i / 80; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      }
      g.globalAlpha = 1;
    }

    /* a shot above the top of the field: a marker on the edge, and how high */
    offscreen(g, s) {
      for (const e of s.ents) {
        if (e.k !== "proj" || e.y >= 0) continue;
        const x = SP.clamp(Math.round(e.x), 3, SP.W - 4), o = s.tanks[e.owner];
        g.fillStyle = o ? o.colour : "#fff";
        g.fillRect(x - 2, 1, 5, 1); g.fillRect(x - 1, 2, 3, 1); g.fillRect(x, 3, 1, 1);
        const h = String(Math.round(-e.y));
        F.shadow(g, h, SP.clamp(x - F.width(h) / 2, 1, SP.W - F.width(h) - 1), 6, "#ffffff");
      }
    }

    float(g, f) {
      g.globalAlpha = Math.min(1, f.life / 20);
      F.shadow(g, f.text, Math.round(f.x - F.width(f.text) / 2), Math.round(f.y), f.colour);
      g.globalAlpha = 1;
    }

    bubble(g, s, b) {
      const t = s.tanks[b.tank];
      if (!t) return;
      const lines = F.wrap(b.text.toUpperCase(), 30);
      const w = Math.max(...lines.map(F.width)) + 8, h = lines.length * 9 + 5;
      const ax = Math.round(t.x), ay = Math.round(t.y) - 24;
      const x = SP.clamp(ax - Math.round(w / 2), 2, SP.W - w - 2), y = Math.max(2, ay - h);
      g.fillStyle = "#000"; g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = "#f4f4f4"; g.fillRect(x, y, w, h);
      /* the tail, pointing down at the speaker */
      const tx = SP.clamp(ax, x + 3, x + w - 4);
      g.fillStyle = "#000"; g.fillRect(tx - 2, y + h + 1, 5, 1); g.fillRect(tx - 1, y + h + 2, 3, 1); g.fillRect(tx, y + h + 3, 1, 1);
      g.fillStyle = "#f4f4f4"; g.fillRect(tx - 1, y + h, 3, 1); g.fillRect(tx, y + h + 1, 1, 1);
      lines.forEach((l, i) => F.draw(g, l, x + 4, y + 3 + i * 9, "#101018"));
      g.fillStyle = t.colour; g.fillRect(x, y, 2, h);
    }
  }
  SP.Renderer = Renderer;
})();
