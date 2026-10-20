# Scorched Puma: development

How the game is put together and how to check a change. For what it is, see [README.md](README.md).

## Running it

Serve the folder rather than opening `index.html` from disk, since browsers restrict pages loaded from `file://`:

```bash
python3 -m http.server 8000
```

## What's in here

| | |
|---|---|
| `index.html`, `css/` | the page; `css/gk-tokens.css` and `js/gk-title.js` (`@gk-title` v0.4, the default title) are games-meta canon, byte for byte |
| `js/gk-intro.js` | the integrated intro, `@gk-intro` v0.2 taken whole from games-meta `canon/` (§14): the boot's meow, its hold for a press where the browser wants one, the title's entrance, the credit under the menu, the Sound switch, the menu's ticks. `js/main.js` drives it |
| `js/engine/` | the rules, with no DOM: terrain, tanks, physics, weapons, economy, AI, the match |
| `js/render.js`, `js/art.js`, `js/pixfont.js` | the battlefield, drawn on a canvas 540 high and as wide as the window was when the match began (960 to 1440), scaled up crisp |
| `js/screens.js`, `js/hud.js`, `js/main.js` | the sheets, the bar, and the loop that runs it all |
| `js/sfx.js` | every sound, made as it plays; the battle behind the title plays through `far`, low and muffled |
| `js/talk.js` | what the pumas and wolves say |
| `tools/sim-check.js` | the engine checked headless: terrain, flight, every weapon, damage, the shop, AI matches to the end, save and restore |
| `tools/stamp-assets.js` | puts each script's and stylesheet's content hash in its URL in `index.html` |
| `tools/check-assets.js` | every local file `index.html` and the manifest name is in the repo (games-meta canon) |
| `tools/make-icons.js`, `tools/og.html` | the icons and the share card |
| `screenshots/` | the README's pictures; not deployed |

Prices, damage and the money table are 1.5's as remembered, not read from its files; they live in `js/engine/const.js`, marked where they are guesses.

## Tech

- Plain scripts, vanilla JS and CSS, a canvas for the field; one byte a pixel of dirt, and falling dirt moves the bytes themselves
- A match is deterministic from its seed and the commands given, and saves at the start of every turn
- Web Audio for every sound; no music, so the title has only the Sound switch
- `localStorage` for a match in progress, the last custom game and the settings, all under `scorchedpuma_*`; Settings can forget everything
- Tactical look around a pixel-art field: the cyan-on-navy palette PumaRally, PumaCity and PumaApproach share

## Testing in the browser

`?test=<weapon>` (for example `?test=mirv`) opens a sandbox with everything in stock and nothing saved; `?debug` puts the game on the console as `SPDEBUG`. `?hold=always` makes the boot hold for a press even where the browser would already play sound, as the in-app preview browser and a launch from greykit.com/arcade do.

## Checks

The engine, headless:

```bash
node tools/sim-check.js
```

`--seeds N` sets how many seeds of AI matches it plays (3 by default).

Run the stamp after any change to a script or stylesheet: it puts each file's content hash in its URL, so a deploy is never served from an old cache.

```bash
node tools/stamp-assets.js
```

## CI

`.gitlab-ci.yml` has two stages. **validate** runs on every branch and merge request, and on `main` ahead of the deploy:

```bash
node tools/check-assets.js
for f in js/*.js js/engine/*.js tools/*.js; do node --check "$f"; done
node tools/sim-check.js --seeds 1
node tools/stamp-assets.js --check
```

**deploy** runs on `main` only: one rsync to `greykit.com/games/scorchedpuma/`, leaving out `.git`, `.claude`, `.gitlab-ci.yml`, `tools/` and `screenshots/`.
