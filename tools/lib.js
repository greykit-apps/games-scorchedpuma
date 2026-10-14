/* The engine, loaded headless: the DOM-free scripts, in the page's order,
 * into a bare context with no document, no canvas and no sound. Used by
 * tools/sim-check.js. (Airborne Puma's tools/lib.js, for this game's files.) */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const ENGINE_FILES = ["js/util.js", "js/engine/const.js", "js/engine/terrain.js", "js/engine/tanks.js", "js/engine/physics.js",
  "js/engine/weapons.js", "js/engine/economy.js", "js/engine/ai.js", "js/engine/game.js"];
function load(files = ENGINE_FILES) {
  const ctx = { console, Math, JSON, Map, Set, WeakMap, Uint8Array, Int16Array, Int32Array, Uint16Array, Float64Array, Array, Object, Number, String, Infinity, NaN, parseInt };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  return ctx.SP;
}
module.exports = { ROOT, ENGINE_FILES, load };
