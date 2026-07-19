# Merdeka Pinball Vertical Slice Plan

## Goal and Product Decisions

Replace the bare-bones **Dead Flip** presentation with a polished, desktop-showcase-first Malaysian pinball experience: **Malam Mania: Merdeka After Dark** (working title). Keep the shipped game as static HTML/CSS/native ES modules with custom Canvas physics and procedural Web Audio; npm/Playwright are development-only.

The release is a classic three-ball game with ball save, end-of-ball bonus, meaningful combos, proper tilt, a local top-five leaderboard, one signature mode, and one cinematic finale:

1. Hit the **Petronas Towers**, **KL Tower**, and **Parliament** landmark shots to light three virtual locks.
2. Shoot the storm scoop to start **Rainstorm Multiball** with two balls.
3. Collect alternating East/West Coast jackpots during multiball.
4. Completing both lights the Petronas skybridge.
5. Hit the skybridge before multiball ends for the **Merdeka Super Jackpot**, fireworks, and fanfare; then continue normal play.

Use English for objective clarity and restrained Malay flavor (`Jom!`, `Hebat!`, `Steady lah!`, `Merdeka!`). Visual direction is premium retro-futurist: midnight KL, chrome, geometric songket motifs, and neon Jalur Gemilang colors. Do not use government logos, copied landmark photography, synthetic accents, or culturally unverified decorative motifs.

## Implementation Plan

### 1. Establish a maintainable static architecture

- Convert `index.html` to load a native module entry point and split the current `game.js` closure into focused modules under `src/`: table constants/geometry, mutable game state and rules, physics/collisions, renderer/effects, procedural audio, input, persistence, and app orchestration.
- Keep one logical playfield coordinate system and fixed-step simulation, but represent balls as a collection so normal single-ball play and two-ball multiball share the same path.
- Make rule updates deterministic and independent from DOM/rendering. Route collisions into semantic events (`landmarkHit`, `jackpotHit`, `laneCompleted`, `ballDrained`) processed by the rules layer.
- Replace gameplay `setTimeout` transitions with simulation timers or cancellable generation-scoped timers. Restart must clear balls, held controls, accumulator, queued callouts, ball-save timers, mode state, tilt, effects, and pending drain/bonus transitions.
- Preserve automatic ball search/rescue, adapting it per active ball; never rescue a legitimately locked, launching, or drain-transition ball.

### 2. Rebuild the shell around the playfield

- Rework `index.html` and `styles.css` so the portrait cabinet is the visual focus, using nearly all available desktop height and substantially more width than the current 560 px center column.
- Integrate score, ball, multiplier, combo, tilt, current objective, mode timer/jackpot, and ball-save status into a compact backbox/HUD above the table. Move controls/rules into a secondary collapsible panel so they do not constrain the cabinet.
- Add fullscreen control and an attract screen that explains the three landmark shots and Rainstorm objective in a few seconds. Retain restart, pause, mute, and contextual rescue controls.
- Keep portrait mobile fully playable with dedicated touch flippers/plunger, a compact visible objective/status line, safe-area padding, and no dependence on hover. Desktop remains the judging/spectator priority.
- Resize the canvas backing store on layout/DPR changes while rendering in logical coordinates. Clamp DPR to a sensible maximum, handle orientation changes, and avoid distorted canvas content.
- Add visible keyboard focus, `aria-pressed` for pause/mute/fullscreen where applicable, targeted live announcements, and a textual game-state summary. Respect reduced motion in both CSS and Canvas by suppressing shake, long trails, rain streak motion, and large flashes while retaining state cues.

### 3. Build a richer, readable table

- Redesign table geometry around named shots: Petronas/skybridge center ramp, KL Tower left orbit, Parliament right shot, center storm scoop, East and West jackpot lanes, top `JOM` rollover lanes, inlanes/outlanes, lower slingshots, posts, and shooter lane.
- Implement collision shapes for ramps/guides, one-way gates, slingshots, target sensors, scoop capture/eject, and virtual landmark locks. Virtual locks qualify the mode without removing the only ball from play.
- Improve high-speed reliability with adaptive physics substeps or swept circle tests for thin rails/sensors. Explicitly handle zero-distance contacts and cap pathological velocities without making strong shots feel flat.
- Improve flipper contact using capsule geometry plus contact-point angular velocity. Add a short launch ball-save window, drain confirmation, and deterministic multiball drain handling.
- Tune layouts for recoverable feeds and intentional risk: landmark shots should return differently, jackpot lanes should be readable, and outlane danger should exist without random unavoidable drains.
- Add an optional debug overlay behind a query flag showing collision geometry, sensors, ball velocity, and active rule state; keep it absent from normal presentation.

### 4. Implement scoring and three-ball flow

- Define scoring values centrally and expose them to the rule card. Use base values approximately in this hierarchy: rollover/target < sling/bumper < landmark < jackpot < super jackpot.
- Make combos mechanical: unique or alternating major shots within a short timer increase a capped combo multiplier; repeating the same safe shot does not advance the chain. Display the next valid combo shots and award the combo factor separately from the persistent playfield multiplier.
- Complete `JOM` rollovers to raise the persistent playfield multiplier, capped for balance. Reset relevant progression according to explicit per-ball/per-game rules documented with the constants.
- Replace the nudge counter with a decaying tilt meter, two warnings (`Steady lah!`, then `Eh, jangan!`), and tilt at the threshold. Tilt disables flippers and scoring until all current balls drain, but does not corrupt mode or bonus state.
- Add end-of-ball bonus count-up from landmarks, jackpots, and multiplier. Skip or accelerate it on input, but guarantee identical awarded score either way.
- Add launch skill-shot timing/strength feedback and a visible ball-save countdown. Ensure the last ball cannot enter game-over until drain resolution and bonus award finish.

### 5. Implement the Rainstorm rules state machine

- Model mode progression explicitly: `qualifying` -> `stormReady` -> `multiball` -> `skybridgeReady` -> `completed`, with abort/end transitions for tilt, drains, restart, and game-over.
- During qualification, each landmark can light only once; show all three lock inserts and update the objective after each hit. The storm scoop is inert or gives a small award until all three are lit.
- On a qualified scoop hit, hold/eject the current ball safely, spawn the second ball through a controlled release, start a multiball ball-save grace period, and transition music/lighting to storm mode.
- During multiball, light one coast jackpot at a time; collecting it lights the opposite coast. Once both unique jackpots are collected, light the skybridge super jackpot. Define clear insert colors and HUD copy for the currently valid shot.
- End Rainstorm when only one ball remains after grace expires. If the skybridge was lit but not collected, preserve no partial finale claim; return to qualification with a documented reset policy. If collected, award the large jackpot, trigger the Merdeka celebration, mark the mode completed for end-of-ball bonus, then reset landmark qualification so skilled players can repeat the mode at a higher value.
- Queue callouts by priority so objective, combo, jackpot, tilt, and system messages do not overwrite one another. Critical state messages preempt cosmetic score messages.

### 6. Deliver the retro-futurist Malaysian presentation

- Replace Dead Flip naming/copy/colors with the working Merdeka identity throughout the DOM, canvas labels, metadata, accessible names, and storage namespace.
- Create styled procedural/SVG placeholders for all user-supplied final art slots. Define a stable asset manifest with filenames, intended dimensions/aspect ratios, transparency, safe zones, and fallback renderers for: KL skyline/backglass, Petronas ramp/skybridge, KL Tower, Parliament, songket side panels, playfield texture, and optional cabinet decals.
- Keep final raster/SVG art swappable without changing geometry or rules. Load assets asynchronously; missing or failed assets must fall back to placeholders and never block starting the game.
- Add restrained ambient table animation, insert lamps, landmark illumination, storm darkening/rain/lightning, and a finale fireworks layer. Use screen shake and white flashes only for high-value moments, with reduced-motion alternatives.
- Use Jalur Gemilang-derived red/white/blue/yellow as controlled accents rather than covering every surface. Maintain sufficient contrast and make shot readiness distinguishable without relying solely on color.

### 7. Expand procedural audio without external files

- Build one reusable Web Audio graph with master/music/effects gains, mute persistence, and safe context resume after user interaction.
- Generate distinct cues for flippers, slings, bumpers, rollovers, landmarks, scoop, jackpots, tilt warnings, drain, and super jackpot; apply slight deterministic variation to repetitive hits.
- Add a restrained synthesized attract/normal-play pulse, procedural rain/thunder layer for multiball, escalating percussion for jackpots, and a short Merdeka finale sting. Musical intensity must follow game state and pause/mute cleanly.
- Use text callouts rather than imitated speech; no synthetic culturally specific accent. Persist mute preference in the new storage namespace.

### 8. Add persistence and score entry

- Replace `deadFlipHigh` with a versioned Merdeka storage schema containing top five `{initials, score, achievedAt}` entries plus mute preference and lightweight best statistics if displayed.
- Do not migrate the old score because the scoring model is incompatible. Treat malformed or unavailable local storage as empty and continue gameplay without persistence.
- At game over, qualify against the top five and show a keyboard/touch-friendly three-character initials entry. Sanitize to uppercase alphanumeric characters, provide a default anonymous value, sort deterministically, and cap at five entries.
- Show the leaderboard in attract/game-over presentation without reducing playfield size during active play.

### 9. Development tooling and documentation

- Add development-only npm scripts and Playwright; production remains directly hostable as static files with no build output or runtime packages.
- Provide deterministic hooks only in development/test mode for starting games, seeding state, advancing rules, and inspecting snapshots. Do not expose score mutation controls in the normal UI.
- Update `README.md` with launch instructions, controls, rules, test commands, architecture summary, browser expectations, and the asset manifest workflow once implementation is complete.

## Asset Handoff Contract

Before final-art replacement, implementation should publish exact slots in the asset manifest. Supplied artwork must be original or accompanied by usage rights, exported in sRGB, and avoid baked-in labels that gameplay must update. Prefer SVG for landmarks/decals and 2x transparent WebP/PNG for textured illustration. Each slot must have a code-rendered fallback and preserve critical shot visibility at mobile scale.

## Failure Modes and Edge Cases

- Restart/pause/tab blur/fullscreen changes release held controls and cannot trigger stale drain or bonus callbacks.
- Simultaneous multiball drains are resolved once; ball-save respawns the correct count and never creates extra balls.
- A jackpot and drain in the same simulation step use deterministic event ordering; earned shots score before drain resolution unless tilted.
- Tilt during Rainstorm disables scoring/flippers and allows balls to drain naturally; it cannot award jackpots or leave mode music active.
- Scoop capture cannot strand the only ball. A failed second-ball spawn ejects the captured ball and restores a playable state.
- Missing art, unavailable Web Audio, denied fullscreen, unavailable local storage, and high-DPI resize all degrade gracefully.
- Pausing freezes simulation timers, combo windows, mode timers, ball save, animation-driven rule transitions, and audio progression.

## Validation and Acceptance

- Unit-test deterministic rules and physics boundaries: scoring/multipliers, combo eligibility/timeout, landmark uniqueness, every Rainstorm transition, simultaneous drains, ball save, tilt lockout, end-of-ball bonus, leaderboard ordering/sanitization, line/circle/capsule contacts, and high-speed sensor crossing.
- Playwright smoke-test start/charge/launch, keyboard flippers, independent nudge, pause/resume, restart during drain/bonus, mute persistence, fullscreen fallback, touch holds with pointer cancellation, initials entry, and reload persistence.
- Capture visual checks at representative desktop showcase, laptop, portrait phone, short landscape, and DPR 2 viewports. Verify the cabinet is materially larger than the current layout, HUD remains readable, no controls clip into safe areas, and supplied-asset fallbacks render.
- Exercise the full intended path through deterministic test hooks: qualify three landmarks, start Rainstorm, collect East/West jackpots, hit skybridge super jackpot, drain to bonus, and enter a top-five score.
- Run extended seeded simulations to detect tunneling, NaN state, impossible ball positions, duplicate drains, and stuck balls; retain manual tuning sessions for flipper feel and shot recoverability.
- Audit keyboard focus, accessible names/states, live-announcement frequency, color contrast, reduced motion, and gameplay with audio disabled.

## Explicitly Out of Scope

- Online accounts, network leaderboard, sharing, QR flow, controller support, daily challenges, unlockable cosmetics, a separate wizard mode, fourteen-state collection quest, licensed/sample audio, recorded voice lines, and migration to Phaser or another game engine.
- Final supplied raster/SVG artwork itself; this release prepares and uses styled placeholders until assets are handed off.
