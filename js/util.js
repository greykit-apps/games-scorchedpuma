/* Scorched Puma -- the namespace and the small things every file uses.
 * No DOM here: the engine loads this headless in tools/lib.js. */
(() => {
  const SP = globalThis.SP = globalThis.SP || {};

  SP.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  SP.lerp = (a, b, t) => a + (b - a) * t;

  /* mulberry32: small, fast, and its whole state is one number, so a match
     saves and restores its luck exactly */
  SP.rng = seed => ({ s: seed >>> 0 });
  SP.rand = r => {
    let t = (r.s = (r.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  SP.randInt = (r, a, b) => a + Math.floor(SP.rand(r) * (b - a + 1));
  SP.randPick = (r, list) => list[Math.floor(SP.rand(r) * list.length)];
  SP.randRange = (r, a, b) => a + SP.rand(r) * (b - a);

  /* localStorage, quietly: a private window or blocked storage just means
     nothing is remembered */
  SP.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* no storage */ } },
  };

  /* bytes <-> a run-length string, for the terrain in a save: dirt is long
     runs of one colour, so a 960x540 field packs to a few kilobytes */
  SP.rleEncode = a => {
    const out = [];
    for (let i = 0; i < a.length;) {
      let j = i + 1;
      while (j < a.length && a[j] === a[i] && j - i < 65535) j++;
      out.push((j - i).toString(36) + "." + a[i].toString(36));
      i = j;
    }
    return out.join(",");
  };
  SP.rleDecode = (s, n) => {
    const a = new Uint8Array(n);
    let i = 0;
    for (const run of s.split(",")) {
      const [len, v] = run.split(".");
      a.fill(parseInt(v, 36), i, i + parseInt(len, 36));
      i += parseInt(len, 36);
    }
    return a;
  };

  SP.money = n => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
})();
