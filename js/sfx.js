/* Scorched Puma -- every sound, made in Web Audio as it plays: square waves,
 * sweeps and filtered noise, the PC-speaker-and-Sound-Blaster palette.
 * Nothing is fetched; the one recording is the boot's meow, which
 * js/gk-intro.js carries in itself.
 *
 * One switch, Sound (games-meta STANDARD.md §8): out, the master. Under it,
 * far: the battle behind the title, heard low and muffled through a wall. */
(() => {
  const SP = globalThis.SP;
  const S = SP.Sfx = { muted: false };
  let ac = null, out = null, far = null, noise = null;
  /* where the sound being made goes: out, or far for the title's battle */
  let dest = null;

  /* the context and its buses, made once; not resumed here, since the intro
     asks the browser first whether the page may play yet */
  const make = () => {
    if (ac) return ac;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      out = ac.createGain();
      out.gain.value = S.muted ? 0 : 0.42;
      out.connect(ac.destination);
      far = ac.createGain();
      far.gain.value = 0.3;
      const muffle = ac.createBiquadFilter();
      muffle.type = "lowpass";
      muffle.frequency.value = 900;
      muffle.Q.value = 0.5;
      far.connect(muffle);
      muffle.connect(out);
      const n = ac.sampleRate * 1.5;
      noise = ac.createBuffer(1, n, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    return ac;
  };
  S.ctx = make;
  /* the effects' way out, for the intro's ticks */
  S.fx = () => out;
  S.unlock = () => {
    try {
      if (make() && ac.state !== "running") ac.resume().catch(() => {});
    } catch (e) { /* no sound */ }
  };
  S.setMuted = m => {
    S.muted = m;
    if (out) out.gain.setTargetAtTime(m ? 0 : 0.42, ac.currentTime, 0.02);
  };

  /* a tone sliding f0 -> f1 over ms */
  const tone = (f0, f1, ms, type = "square", vol = 0.2, at = 0) => {
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + ms / 1000);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    o.connect(g); g.connect(dest || out);
    o.start(t); o.stop(t + ms / 1000 + 0.02);
  };
  /* filtered noise: a blast, a hiss, a rumble */
  const hiss = (ms, vol = 0.3, freq = 1200, at = 0, type = "lowpass", q = 0.7, sweep = 0) => {
    const t = ac.currentTime + at, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; src.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), t + ms / 1000);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    src.connect(f); f.connect(g); g.connect(dest || out);
    src.start(t, Math.random()); src.stop(t + ms / 1000 + 0.02);
  };

  const SOUNDS = {
    fire: () => { hiss(180, 0.35, 900, 0, "lowpass", 1, 200); tone(180, 60, 160, "square", 0.12); },
    laser: () => { tone(2400, 300, 380, "sawtooth", 0.1); tone(1800, 200, 380, "square", 0.05, 0.02); },
    plasma: () => { tone(90, 900, 500, "sawtooth", 0.1); hiss(500, 0.15, 3000, 0, "bandpass", 2, 400); },
    riot: () => hiss(260, 0.3, 2400, 0, "bandpass", 1, 300),
    small: () => { hiss(380, 0.5, 1400, 0, "lowpass", 0.8, 120); tone(120, 40, 260, "square", 0.12); },
    big: () => { hiss(900, 0.6, 900, 0, "lowpass", 0.8, 50); tone(80, 28, 700, "square", 0.16); },
    nuke: () => { hiss(2200, 0.7, 700, 0, "lowpass", 0.8, 30); tone(60, 20, 1800, "sawtooth", 0.18); hiss(1600, 0.25, 3000, 0.1, "highpass", 0.5, 800); },
    riotboom: () => hiss(420, 0.35, 700, 0, "lowpass", 0.6, 150),
    dirt: () => hiss(300, 0.25, 500, 0, "lowpass", 0.6, 120),
    dig: () => { for (let i = 0; i < 5; i++) hiss(60, 0.15, 300 + i * 40, i * 0.07, "bandpass", 3); },
    roll: () => tone(70, 50, 420, "triangle", 0.12),
    napalm: () => { hiss(900, 0.3, 2400, 0, "bandpass", 1.2, 600); for (let i = 0; i < 6; i++) hiss(40, 0.12, 4000, 0.1 + i * 0.12, "highpass", 1); },
    split: () => { tone(900, 1300, 90, "square", 0.08); tone(1300, 900, 90, "square", 0.08, 0.08); },
    bounce: () => tone(400, 650, 70, "square", 0.08),
    shieldHit: () => { tone(1500, 900, 160, "sine", 0.14); tone(2200, 1400, 160, "sine", 0.06); },
    shieldUp: () => tone(300, 1200, 260, "sine", 0.12),
    shieldDown: () => tone(1200, 200, 300, "sawtooth", 0.08),
    chute: () => hiss(200, 0.2, 1800, 0, "bandpass", 3, 900),
    tankDead: () => { hiss(1200, 0.6, 600, 0, "lowpass", 1, 40); tone(200, 30, 900, "square", 0.15); },
    battery: () => { tone(500, 500, 80, "square", 0.08); tone(750, 750, 80, "square", 0.08, 0.09); tone(1000, 1000, 120, "square", 0.08, 0.18); },
    drive: () => tone(55, 55, 60, "square", 0.05),
    buy: () => { tone(880, 880, 50, "square", 0.07); tone(1320, 1320, 80, "square", 0.07, 0.06); },
    sell: () => { tone(1320, 1320, 50, "square", 0.07); tone(880, 880, 80, "square", 0.07, 0.06); },
    nope: () => tone(160, 120, 160, "square", 0.08),
    blip: () => tone(1000, 1000, 30, "square", 0.05),
    turn: () => { tone(660, 660, 60, "square", 0.06); tone(990, 990, 90, "square", 0.06, 0.07); },
    talk: () => { for (let i = 0; i < 4; i++) tone(300 + Math.random() * 400, 300 + Math.random() * 400, 45, "square", 0.04, i * 0.05); },
    thunder: () => hiss(1800, 0.35, 300, 0.15, "lowpass", 0.6, 60),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 160, "square", 0.08, i * 0.12)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 220, "square", 0.08, i * 0.18)),
  };

  /* farOff: through far, low and muffled, as the battle behind the title */
  S.play = (name, farOff = false) => {
    if (!ac || ac.state !== "running" || S.muted || !SOUNDS[name]) return;
    dest = farOff ? far : out;
    try { SOUNDS[name](); } catch (e) { /* a sound is never worth an error */ }
    dest = null;
  };
  /* a blast's sound by its size */
  S.boom = (r, riot, farOff) => S.play(riot ? "riotboom" : r >= 60 ? "nuke" : r >= 30 ? "big" : "small", farOff);

})();
