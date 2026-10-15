/* Scorched Puma -- the hover tip. Anything marked data-tip="<weapon or item
 * id>" gets it: rest the pointer on it (or tab to it) and a panel opens
 * beside it with the icon blown up, the name in large type, what the thing
 * does, its numbers, and data-tip-note (what a click will do right now). */
(() => {
  const SP = globalThis.SP;
  const T = SP.Tips = {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let tip = null, cur = null, curId = null, timer = null, warm = false;

  const make = () => {
    tip = document.createElement("div");
    tip.id = "tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.appendChild(tip);
  };

  const content = host => {
    const id = host.dataset.tip, x = SP.BY_ID[id];
    if (!x) return "";
    const stats = SP.UI.stats ? SP.UI.stats(x) : [];
    const kind = x.type === "weapon" ? "Weapon" : "Item";
    const note = host.dataset.tipNote;
    return SP.IconImg(id, 3, "big") +
      '<div class="tx"><div class="kind">' + kind + "</div><h4>" + esc(x.name) + "</h4>" +
      '<p class="what">' + esc(SP.UI.DESC[id] || "") + "</p>" +
      (stats.length ? "<dl>" + stats.map(([k, v]) => "<dt>" + k + "</dt><dd>" + esc(v) + "</dd>").join("") + "</dl>" : "") +
      (note ? '<p class="note">' + esc(note) + "</p>" : "") + "</div>";
  };

  /* beside the thing: above it when there is room (the console sits at the
     foot of the screen), else below; kept inside the window */
  const place = host => {
    const r = host.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, m = 10;
    /* in an open drawer, above the whole drawer, so the tip never hides its tiles */
    const drawer = host.closest(".strip.open"), top = drawer ? drawer.getBoundingClientRect().top : r.top;
    let x = r.left + r.width / 2 - w / 2, y = top - h - m;
    if (y < m) y = r.bottom + m;
    if (y + h > innerHeight - m) y = Math.max(m, innerHeight - h - m);
    x = Math.max(m, Math.min(innerWidth - w - m, x));
    tip.style.left = Math.round(x) + "px";
    tip.style.top = Math.round(y) + "px";
  };

  const show = host => {
    if (!tip) make();
    if (cur && cur !== host) cur.removeAttribute("aria-describedby");
    cur = host; curId = host.dataset.tip;
    host.setAttribute("aria-describedby", "tip");
    tip.innerHTML = content(host);
    tip.hidden = false;
    place(host);
    tip.classList.add("on");
    warm = true;
  };
  T.hide = () => {
    clearTimeout(timer);
    if (cur) cur.removeAttribute("aria-describedby");
    cur = null; curId = null;
    if (tip) { tip.hidden = true; tip.classList.remove("on"); }
    /* moving straight on to the next thing shows it at once; a pause and it waits again */
    timer = setTimeout(() => { warm = false; }, 400);
  };
  const want = host => {
    if (host === cur) return;
    clearTimeout(timer);
    if (!host) return T.hide();
    if (warm && cur) return show(host);
    if (tip && !tip.hidden) T.hide();
    timer = setTimeout(() => show(host), warm ? 0 : 260);
  };

  /* the console rebuilds its tiles as things change: keep the tip on the
     tile it was on, with what it says now */
  T.reattach = () => {
    if (!curId || !cur || cur.isConnected) return;
    const again = document.querySelector('[data-tip="' + curId + '"]:hover') || null;
    if (again) show(again); else T.hide();
  };

  document.addEventListener("pointerover", ev => {
    if (ev.pointerType === "touch") return;
    want(ev.target.closest && ev.target.closest("[data-tip]"));
  });
  document.addEventListener("pointerleave", () => want(null));
  document.addEventListener("focusin", ev => { const h = ev.target.closest && ev.target.closest("[data-tip]"); if (h) show(h); });
  document.addEventListener("focusout", ev => { if (cur && ev.target === cur) T.hide(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && cur) T.hide(); }, true);
  addEventListener("blur", () => T.hide());
  addEventListener("scroll", () => { if (cur) place(cur); }, true);
})();
