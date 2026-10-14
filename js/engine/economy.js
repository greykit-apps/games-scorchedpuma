/* Scorched Puma -- money and score.
 *
 * Money buys weapons; score decides the match. Damage to an enemy pays, a
 * kill pays and scores, the last tank (or team) standing is paid and scores
 * twice; hurting yourself or a friend costs. The scoring mode weights each,
 * and cash in hand earns interest between rounds. */
(() => {
  const SP = globalThis.SP, Tk = SP.Tanks, PAY = SP.PAY;
  const E = SP.Economy = {};

  const mode = s => SP.SCORING[s.opts.scoring] || SP.SCORING.standard;
  const credit = (t, n) => { n = Math.round(n); t.cash += n; t.earned += n; };

  E.onDamage = (s, victim, by, hp) => {
    if (!by || s.sim) return;
    const m = mode(s);
    if (Tk.enemies(s, by, victim)) credit(by, hp * PAY.dmg * m.dmg);
    else credit(by, -hp * PAY.dmg * m.penalty * 0.5);
  };

  E.onKill = (s, victim, by) => {
    if (s.sim) return;
    const m = mode(s);
    if (by && Tk.enemies(s, by, victim)) {
      credit(by, PAY.kill * m.kill);
      by.score += 1; by.kills++; by.roundKills++;
    } else if (by) {
      credit(by, -PAY.kill * m.penalty * 0.5);
      by.score -= 1;
    }
    s.order.dead.push(victim.id);
  };

  /* the round is over: pay the survivors, then interest on what everyone has */
  E.roundEnd = (s, winners) => {
    const m = mode(s);
    for (const t of winners) { credit(t, PAY.survive * m.survive); t.score += 2; t.wins++; }
    for (const t of s.tanks) {
      if (t.cash > 0 && s.opts.interest > 0) {
        const i = Math.round(t.cash * s.opts.interest * m.interest);
        t.cash += i; t.interest = i;
      } else t.interest = 0;
    }
  };

  /* ---- the shop ---- */
  E.stock = s => SP.ALL.filter(x => x.arms <= s.opts.arms && !x.free);
  E.canBuy = (s, t, id) => { const x = SP.BY_ID[id]; return !!x && x.arms <= s.opts.arms && !x.free && t.cash >= x.price; };
  E.buy = (s, t, id) => {
    if (!E.canBuy(s, t, id)) return false;
    const x = SP.BY_ID[id];
    t.cash -= x.price;
    Tk.give(t, id, x.bundle);
    return true;
  };
  E.sellPrice = id => { const x = SP.BY_ID[id]; return Math.floor(x.price / x.bundle * PAY.sellBack); };
  E.sell = (s, t, id) => {
    if (!(t.inv[id] > 0) || SP.BY_ID[id].free) return false;
    t.cash += E.sellPrice(id);
    Tk.take(t, id);
    return true;
  };

  /* ---- how the computer shops ----
   * Each type keeps a wish list in order; it buys down the list while it can
   * afford it and has fewer than it wants. A Moron buys at random. */
  const WISH = {
    shooter: [["battery", 4], ["missile", 10], ["parachute", 2], ["babynuke", 3], ["battery", 3], ["shield", 1], ["nuke", 1]],
    poolshark: [["battery", 4], ["missile", 10], ["parachute", 2], ["babynuke", 3], ["roller", 5], ["mirv", 3]],
    tosser: [["missile", 10], ["battery", 3], ["parachute", 1], ["babynuke", 3], ["napalm", 5]],
    chooser: [["battery", 5], ["parachute", 2], ["missile", 10], ["babynuke", 3], ["roller", 5], ["napalm", 10], ["riotcharge", 5], ["shield", 1], ["mirv", 3], ["heavyroller", 2]],
    spoiler: [["battery", 5], ["missile", 10], ["parachute", 2], ["babynuke", 6], ["shield", 1], ["mirv", 3], ["nuke", 1]],
    cyborg: [["battery", 8], ["parachute", 3], ["shield", 2], ["missile", 10], ["babynuke", 6], ["autodefense", 1], ["forceshield", 1], ["heavyroller", 2], ["mirv", 3], ["nuke", 2], ["deathshead", 1], ["riotcharge", 5], ["heavyshield", 1]],
  };
  E.aiShop = (s, t) => {
    const type = t.aiReal || "shooter";
    if (type === "moron") {
      const stock = E.stock(s);
      for (let i = 0; i < 12; i++) {
        const x = SP.randPick(s.rng, stock);
        if (t.cash - x.price >= 0 && SP.rand(s.rng) < 0.6) E.buy(s, t, x.id);
      }
      return;
    }
    /* keep a little back to earn interest, unless it's a Cyborg, which spends it all */
    const floor = type === "cyborg" ? 0 : Math.round(t.cash * 0.15);
    for (let pass = 0; pass < 3; pass++) {
      for (const [id, want] of WISH[type] || WISH.shooter) {
        const x = SP.BY_ID[id];
        if (!x || x.arms > s.opts.arms) continue;
        if ((t.inv[id] || 0) >= want * (pass + 1) / 3) continue;
        if (t.cash - x.price < floor) continue;
        E.buy(s, t, id);
      }
    }
  };
})();
