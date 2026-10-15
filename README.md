# Scorched Puma

**Artillery on a field of falling dirt, pumas against wolves.** A remake of *Scorched Earth* (Wendell Hicken, 1991, DOS; version 1.5, 1995), "the mother of all games", with every tank crewed by a puma or a wolf, and none of them polite about it.

## Play

[greykit.com/games/scorchedpuma](https://greykit.com/games/scorchedpuma/)

No install required. Plain scripts, no build step, nothing fetched at play time: every picture is drawn and every sound made in the page. Built for a desktop: a keyboard and a mouse.

## How it plays

Two to ten tanks on a hilly field, each one human or computer, each a **Puma** or a **Wolf**. Take turns: set the turret's **angle** and the shot's **power**, pick a weapon, fire. The **wind** in the bar pushes every shot; the **walls** at the sides may let shots out, wrap them round, bounce them back or blow them up.

Blasts dig craters and the dirt above them falls. Tanks fall too: a **parachute** opens by itself, and without one a long drop hurts. A tank's health is also its strength, as in 1.5: it fires no harder than ten times the health it has left, and a **battery** gives some back. Destroyed tanks blow up where they stand, sometimes taking a neighbour with them.

Between rounds is the shop, **Puma Arms** or **Wolf Surplus** by who you are. Damage to an enemy pays, a kill pays more, surviving the round pays most, and cash in hand earns interest. The match is decided on score: a point a kill, two for surviving a round, a point off for killing your own side or yourself.

The tanks talk. When they fire they tell the other species what they think of it (dogs, fleas, fetch, the pound; cats, hairballs, the litter box, nine lives), and when they go they say last words. Settings sets how often, or turns it off.

### Everything from 1.5

- **33 weapons**: Baby Missile, Missile, Baby Nuke, Nuke, LeapFrog, Funky Bomb, MIRV, Death's Head, Napalm, Hot Napalm, Tracer, Smoke Tracer, three Rollers, Riot Charge and Blast, Riot Bomb and Heavy Riot Bomb, three Diggers, three Sandhogs, Dirt Clod, Dirt Ball, Ton of Dirt, Liquid Dirt, Dirt Charge, Earth Disrupter, Plasma Blast, Laser.
- **15 items**: Heat, Ballistic, Horizontal and Vertical Guidance, Lazy Boy, Parachute, Battery, Mag Deflector and Super Mag, Shield, Force Shield and Heavy Shield, Auto Defense, Fuel Tank, Contact Trigger.
- **8 computer players**: Moron, Shooter, Poolshark, Tosser, Chooser, Spoiler, Cyborg, and Unknown, which is one of the others and won't say which. They aim by flying trial shots through the same physics you play in, then miss by as much as their type misses by.
- **The options**: rounds, starting cash, interest, arms level 0 to 4, Standard, Corporate or Vicious scoring, turn order (random, losers first, winners first, round robin), Sequential or Synchronous play, wind (none, constant, changing) and its strength, gravity, air, walls (none, wrap-around, concrete, rubber, spring, padded, random, erratic), six skies with lightning in the storms, three kinds of land and their bumpiness, hanging dirt, fall damage.
- **Pumas vs. Wolves**: a team match where a round ends when one species is gone.

### Not in this version

- *Simultaneous* play, 1.5's real-time mode: several people cannot play in real time at one keyboard. Network play is not planned either.
- 1.5's choice of tank shapes: every tank here is the one sprite, in its player's colour with its crew's ears.

Prices, damage and the money table are 1.5's as remembered, not read from its files; they live in `js/engine/const.js`, marked where they are guesses.

## Keys

| Key | Action |
|---|---|
| ← → | turn the turret |
| ↑ ↓ | power; hold to go faster, Shift for one at a time |
| PgUp, PgDn | power by tens |
| Space, Enter | fire; on a computer player's turn, hurry it |
| 1 … 9, 0 | load a weapon by its place in the strip |
| Tab, Shift+Tab | next or previous weapon |
| W | all your weapons, large |
| A | aim again: back to the last shot's angle and power |
| I | items: shields, batteries, guidance, the target |
| T | next target, for guidance and Lazy Boy |
| F | drive on fuel; the arrows move the tank |
| L | aim aid (off by default, as in 1991) |
| F6 | into the console and back (there Tab moves, Space presses) |
| Esc, P | pause |
| M | sound |
| ? | help |

The mouse aims too: press on the field and the turret points there, further from the tank for more power; drag to fine-tune, and the wheel steps the power. An arrow out of the barrel is the aim, as long as the power, with the angle and power at its tip. It is not where the shell lands.

The console under the field is always yours (on a computer player's turn it dims and says who is aiming). It has your health, cash and score, the angle and power with ▲▼ steppers, the last shot (and how far the aim has moved from it, with **Aim again** to go back, and a cross on the field where it landed), the wind, and your weapons and items as icons: click a weapon to load it, an item to use, raise or arm it. When there are more than fit, the strip shows a count ("+7") and a drawer slides up with all of them when the pointer rests on it; the console never changes height, so the field keeps its size. After every shot a line top left of the field says what it hit and what it paid.

## What's in here

| | |
|---|---|
| `index.html`, `css/` | the page; `css/gk-tokens.css` and `js/gk-title.js` are games-meta canon, byte for byte |
| `js/engine/` | the rules, with no DOM: terrain, tanks, physics, weapons, economy, AI, the match |
| `js/render.js`, `js/art.js`, `js/pixfont.js` | the battlefield, drawn on a canvas 540 high and as wide as the window was when the match began (960 to 1440), scaled up crisp |
| `js/screens.js`, `js/hud.js`, `js/main.js` | the sheets, the bar, and the loop that runs it all |
| `js/talk.js` | what the pumas and wolves say |
| `tools/sim-check.js` | the engine checked headless: terrain, flight, every weapon, damage, the shop, AI matches to the end, save and restore |
| `tools/make-icons.js`, `tools/og.html` | the icons and the share card |

`?test=<weapon>` (for example `?test=mirv`) opens a sandbox with everything in stock and nothing saved; `?debug` puts the game on the console as `SPDEBUG`.

```bash
node tools/sim-check.js
```

```bash
node tools/stamp-assets.js
```

Run the stamp after any change to a script or stylesheet: it puts each file's content hash in its URL, so a deploy is never served from an old cache. CI checks it.

## Tech

- Plain scripts, vanilla JS and CSS, a canvas for the field; one byte a pixel of dirt, and falling dirt moves the bytes themselves
- A match is deterministic from its seed and the commands given, and saves at the start of every turn
- Web Audio for every sound
- `localStorage` for a match in progress, the last custom game and the settings, all under `scorchedpuma_*`; Settings can forget everything
- Tactical look around a pixel-art field: the cyan-on-navy palette PumaRally, PumaCity and PumaApproach share

## Credits

Game design and code by [shandower](https://gitlab.com/shandower) with AI assistance from Claude.

After Scorched Earth by Wendell Hicken. Not affiliated with Wendell Hicken; no code, art, sound or text from the original is used.
