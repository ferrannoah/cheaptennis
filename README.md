# Baseline (cheaptennis)

A bright arcade tennis game for the browser. A fixed broadcast camera shows the whole court. On top of the arcade core it adds shot timing with feedback, five shot types, stamina, a bracket mode, local versus, and a career that climbs a fictional pro tour on real ATP-style ranking rules.

Everything is drawn and synthesised in code: there are no image or audio files. All names, events and Majors are fictional. School project.

**Play it:** https://ferrannoah.github.io/cheaptennis/

## Controls

| Action | Keyboard (single player) | Gamepad |
|---|---|---|
| Move | Arrow keys | Left stick / D-pad |
| Aim (hold at contact) | ←/→ angle, ↑ deep, ↓ short (point the arrow where you want the ball to go) | Stick |
| Normal shot | Space | A |
| Topspin | Z | X |
| Slice | X | B |
| Lob | C | Y |
| Drop shot | V | RB |
| Serve | Space to toss, Space again at the top of the toss. Hold Z for a kick serve or X for a slice serve. ←/→ aims. | A (hold X/B) |
| Pause | Esc / P | Start |
| Mute | M | |

**Versus (one keyboard):** P1 uses WASD to move, with F/G/H/J/K for normal/topspin/slice/lob/drop. P2 uses the arrows to move, with Numpad 1-5 (or 1-5 on the number row). Two gamepads also work. All keys can be rebound in **Options**.

**Timing:** press the shot key as the ball arrives. The arc meter next to your player fills up; swing when it reaches the gold notch. Every swing is graded PERFECT / GOOD / EARLY / LATE / MISHIT, and a popup tells you why.

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
src/match     3D ball physics, shot model + timing, players, AI, scoring, match flow
src/sim       stat-based match simulator, brackets
src/career    rankings, entry rules, weekly field simulation, progression, save
src/data      tour.ts (all tiers, points, cutoffs, calendar), surfaces, archetypes, tuning, music
src/scenes    every screen
tests/        Vitest unit tests     e2e/   Playwright playtests     docs/   GDD + PLAN
```
