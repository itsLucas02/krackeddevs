# Malam Mania: Merdeka After Dark

A retro-futurist Malaysian pinball game built with native browser modules, Canvas 2D physics, and procedural Web Audio. The shipped game has no runtime dependencies or build step.

## Play locally

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173).

For the development server and automated tests:

```bash
npm install
npm run serve
npm test
npm run test:e2e
```

## Rules

1. Hit the KL Tower, Petronas Towers, and Parliament landmark shots.
2. Shoot the center storm scoop to begin two-ball Rainstorm Multiball.
3. Collect the lit West Coast jackpot, then the East Coast jackpot.
4. Shoot the illuminated skybridge for the Merdeka Super Jackpot.
5. Complete the `JOM` rollover lanes to raise the playfield multiplier.

The game includes a launch ball save, unique-shot combos, a decaying tilt meter, end-of-ball bonuses, ball search, and a local top-five initials table.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Left flipper | `Z` | `Flip L` |
| Right flipper | `/` | `Flip R` |
| Launch | Hold/release `Space` | Hold/release `Launch` |
| Nudge | `Left Arrow` / `Right Arrow` | - |
| Pause | `P` | Header control |

## Architecture

- `src/game.js`: application loop, input, game flow, and DOM HUD
- `src/rules.js`: deterministic scoring, mode, combo, tilt, and bonus rules
- `src/physics.js`: fixed-step balls, rails, bumpers, slingshots, and flippers
- `src/renderer.js`: DPR-aware playfield rendering and effects
- `src/audio.js`: reusable procedural sound graph
- `src/persistence.js`: versioned mute and leaderboard storage
- `src/table.js`: table geometry, sensors, and visual constants

Add `?debug=1` to show shot sensors. Local automated scenarios are available only with `?test=1` on loopback hosts.

## Final art handoff

The current playfield uses styled procedural placeholders. Final supplied artwork can replace them without changing mechanics. Preferred slots:

| Slot | Preferred format | Design requirement |
| --- | --- | --- |
| Backglass KL skyline | 1800x900 WebP/PNG | Midnight skyline, quiet center for title |
| Petronas/skybridge | SVG | Transparent, readable at 80 px wide |
| KL Tower | SVG | Transparent, vertical silhouette |
| Parliament | SVG | Transparent, vertical silhouette |
| Playfield texture | 1440x2160 WebP | Dark, low contrast, no baked labels |
| Songket side panels | SVG tile | Geometric repeat, verified original motif |
| Cabinet decals | SVG | Separate red, blue, yellow layers |

Artwork must be original or accompanied by usage rights, use sRGB, and preserve gameplay visibility at mobile scale. Runtime fallbacks remain available if an asset fails to load.

## License

[MIT](LICENSE)
