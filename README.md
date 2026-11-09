# Baseline (cheaptennis)

A bright arcade tennis game for the browser. A fixed broadcast camera shows the whole court. Its controls and feel follow Tennis Elbow 4's Arcade mode: hold-to-strike shots, a danger zone, aim sweeping, ten strikes and limited accelerations. Around that it adds stamina, a bracket mode, local versus, and a career that climbs a fictional pro tour on real ATP-style ranking rules.

Everything is drawn and synthesised in code: there are no image or audio files. All names, events and Majors are fictional. School project.

**Play it:** https://ferrannoah.github.io/cheaptennis/

## Controls

The controls work like Tennis Elbow 4's **Arcade** mode: you hold a strike button through the shot instead of timing a press.

| Action | Keyboard (single player) | Gamepad |
|---|---|---|
| Move (no button held) | Arrow keys | Left stick / D-pad |
| Strike 1: normal / ↑ short / ↓ topspin | **hold** X (or Space) | A |
| Strike 2: slice / ↑ drop / ↓ lob | **hold** Z | X |
| Acceleration / ↑ short accel. / ↓ attack lob | **hold** X + Z, or C | B |
| Serve | **hold** X (normal), Z (safe) or X + Z (strong) through the toss; ↑ slice, ↓ kick; ←/→ aims | A / X / B |
| Gesture after a point | V + an arrow | Y |
| Pause | Esc / P | Start |
| Mute | M | |

**How to hit:** press and hold a strike button *before* the ball reaches you, and keep holding: you hit it automatically when it arrives. While you hold, your player walks to the ball on their own (to the green spot), ←/→ sweeps your aim (the longer you push, the further it goes), and ↑/↓ (toward / away from the net) picks the strike. The earlier you press, the more accurate and deeper the shot: the ring at your feet fills up and the aiming zone on the other side shrinks. Don't hit the ball while it is still rising in the red/orange danger zone, and keep it beside your body, not into it. You only get a few good accelerations per point (the ACC pips). With no button held you play a weak safe shot.

**Versus (one keyboard):** P1 uses WASD to move, with F / G / R / T for strike 1 / strike 2 / acceleration / gesture. P2 uses the arrows, with Numpad 1-4 (or 1-4 on the number row). Two gamepads also work. All keys can be rebound in **Options**, which also has Arcade/Simulation controls, auto-positioning speed and the court preview.

## Modes

- **Exhibition:** one match against a COM player, with a choice of surface and length (default: first to 3 games).
- **Tournament:** an 8, 16 or 32-player seeded knockout. The bracket screen updates every round, and winning ends on a trophy screen.
- **Career:** create a player (pick a primary and secondary style, which set your stat caps) and start unranked. You climb a 500-player fictional tour, from Futures up to the four Majors and the Tour Finals. Rankings use a rolling 52 weeks and count your best 19 results. You earn XP, spend skill points, unlock badges and manage fatigue. The career autosaves and can be exported or imported as JSON.
- **Versus:** local two-player.
- **Practice:** a ball machine, serve practice and an 11-step tutorial.
- **Options:** key and button remapping, volumes and mute, Training HUD, difficulty, career match length.

## Run it

Requires Node 18+.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5199.

### Production build and preview

```bash
npm run build
```

```bash
npm run preview
```

Then open http://localhost:4199. The build uses relative paths (`base: './'`), so `dist/` works from any sub-folder.

### Tests

```bash
npm test
```

This runs the unit tests: scoring, the 52-week rolling rankings with the best-19 rule, entry eligibility, ball physics, shot types on each surface, the match simulator, and a career quick-sim.

```bash
npx playwright test
```

This runs the browser playtests (they use the installed Microsoft Edge; set `PW_CHANNEL=chromium` to use Playwright's Chromium). Screenshots are written to `playtest/`.

## Deploying to GitHub Pages

Auto-publishing is set up: every push to `main` runs `.github/workflows/pages.yml`. It runs the unit tests, builds the game and deploys `dist/` to https://ferrannoah.github.io/cheaptennis/. If the tests fail, nothing is deployed. You can watch each run in the repo's **Actions** tab.

```bash
git push
```

## Project layout

```
src/core      loop, input, audio synth + tracker, settings, save, rng
src/gfx       camera projection, court/stadium, player renderer, HUD, trophies
src/match     3D ball physics, shot model + Elbow strike rules (strike.ts), players, AI, scoring, match flow
src/sim       stat-based match simulator, brackets
src/career    rankings, entry rules, weekly field simulation, progression, save
src/data      tour.ts (all tiers, points, cutoffs, calendar), surfaces, archetypes, tuning, music
src/scenes    every screen
tests/        Vitest unit tests     e2e/   Playwright playtests     docs/   GDD + PLAN
```
