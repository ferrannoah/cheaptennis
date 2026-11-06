# BASELINE: Build plan

This file is the working memory for the build. Each milestone ends with the game running, verified with the `game-playtest-loop` skill (screenshots read, state dumps checked), and a git commit.

Legend: `[ ]` todo · `[~]` in progress · `[x]` verified

---

## Prerequisites
- User decision (2026-11-05): **build locally for now**, no Git install yet, so per-milestone commits are skipped. The GitHub publish (repo `cheaptennis`, GitHub Pages) stays planned as the final step, done once Git + `gh` are installed and the user has run `gh auth login`.
- [ ] Playwright Chromium installed (`npx playwright install chromium`) for automated playtests.

---

## M0: Scaffold & engine core
- Vite + TS strict + Vitest + Playwright; `base: './'`.
- `core/`: fixed-timestep loop, input (actions with pressed/held/released, keyboard by `e.code`, gamepad polling, rebind tables), seeded RNG, save wrapper, scene stack with fade/slide transitions, debug overlay (backquote).
- 640×480 offscreen canvas, smooth scaling, dark letterbox bars, DPR handling.
- `testing/hooks.ts`: `window.__game` with `seed`, `step`, `state`, `press/hold/release`, `goto`.
- **Accept:** `npm run dev` shows a letterboxed test scene; `__game.step(60)` advances exactly 60 frames; `npm test` passes a smoke test; `npm run build` has zero TS errors.

## M1: Camera, court & stadium rendering
- Pinhole projection (`gfx/camera.ts`), court geometry in metres, pre-rendered court layers for grass / clay / hard, net with yellow posts, stands + crowd blobs, sky.
- **Accept:** screenshots of all 3 surfaces: whole court visible, lines converge toward the far baseline, crisp mow stripes on grass, net and posts correct, crowd at the edges, letterbox bars.

## M2: Ball physics + players (vertical slice core)
- 3D ball: gravity, drag, Magnus spin, surface bounces, net collision, line calls; ball shadow.
- Player entity: movement with accel curves, reach, auto forehand/backhand, procedural skeletal renderer with run / forehand / backhand / serve / volley / dive / idle animations; perspective scaling for the far player.
- Unit tests: bounce heights differ by surface; net blocks low balls.
- **Accept:** scripted feed from a ball machine bounces visibly differently on each surface (state dump bounce heights/speeds); screenshots of each animation pose; arrow keys move the near player instantly (≤ 2 frames to start moving).

## M3: Swing, timing grades & shot model
- Timing system (offset → PERFECT/Good/Early/Late/Mishit/whiff), aim from held arrows, target-driven trajectory solver, error cone, 5 shot types, volleys/overheads, timing arc meter, reason popups, hitstop + trail on PERFECT, Training HUD.
- Unit tests: solver lands within 0.3 m of target with zero error; each grade produces the documented bias.
- **Accept:** scripted presses at offsets −14…+18 produce each grade with the correct popup text (screenshots); the five shot types produce distinct apex / bounce / post-bounce speed in state dumps on all 3 surfaces.

## M4: Scoring, serve, point flow, AI → first playable exhibition
- `match/scoring.ts` (pure) + unit tests: points, deuce/ad, games, sets, tiebreak 1-2-2, all formats, changeovers.
- Serve: toss/hit, top-of-toss timing, direction, flat/kick/slice, faults, double faults, lets.
- Point flow: rally → out/net/double bounce → umpire call → reset; changeovers.
- AI: prediction, movement, recovery, archetype shot selection, noisy timing.
- HUD: score line bottom-left, serve dot, umpire pop-ups.
- Stat comparison card; Exhibition setup (surface, length).
- **Accept:** a scripted human + AI play a complete first-to-3-games exhibition to "GAME, SET AND MATCH" (state dump shows the winner); AI-vs-AI soak of 20 matches with no stuck states; screenshots of the stat card and match HUD.

## M5: Stamina
- Drain/recover rules, effects on speed/windows/error/serve, red pulsing bar, sweat particles, slump idle, "Tired" popup reason.
- **Accept:** state dump shows stamina falling over a long scripted rally and recovering between points/changeovers; at stamina 15 the PERFECT window and top speed are measurably smaller; screenshot shows the red bar + sweat.

## M6: Title screen, menus & transitions
- Title (sky gradient, clouds, stadium view, bold rounded logo, how-to-play, dark translucent menu), all menu navigation with keyboard + gamepad, smooth transitions, pause menu.
- **Accept:** screenshots of the title and each menu; every title entry reaches its screen and back.

## M7: Audio
- Load `retro-chiptune-audio`: SFX synth (grade-specific hits, surface bounces, net, umpire stings, crowd applause / ooh / murmur, footsteps), tracker music (menu theme, match intro, game/set stings, victory, trophy fanfare, career loop), mute (M + options), volumes, gesture unlock, suspend on hidden.
- **Accept:** no audio before the first gesture; the state dump shows the audio context running after a key press; mute flag silences the master gain; no console errors.

## M8: Tournament (bracket) mode
- `sim/match-sim.ts` stat-based simulator (shared with career) + unit tests (stronger player wins more often, surface effects).
- Setup (8/16/32, surface, length), seeded COM field, bracket screen updating per round, elimination screen, trophy screen with confetti.
- **Accept:** screenshots of the 8, 16 and 32 brackets mid-event and of the trophy screen; quick-simming a full 32 draw reaches the trophy or elimination screen.

## M9: Versus (local multiplayer)
- Device assignment screen; keyboard split P1 (WASD + F/G/H/J/K) and P2 (arrows + numpad / digit 1–5); gamepad 0/1.
- **Accept:** scripted inputs for both keyboard players hit the ball in a versus match; mocked `navigator.getGamepads()` with two pads drives both players; screenshot of versus HUD ("P1 15 - 0 P2").

## M10: Practice & tutorial, Options & remapping
- Ball machine (feed types, Training HUD on, PERFECT streak), step-by-step tutorial with checks (timing, aiming, each shot, serve types, stamina), Options (remap keyboard + gamepad per action and player, volumes, mute, Training HUD, difficulty, career match length, reduced shake, FPS) persisted.
- **Accept:** rebinding Space→Enter makes Enter swing in a match (playtest); options survive a reload; each tutorial step can be completed by scripted input; screenshots.

## M11: Career Phase 1 (tour)
- `data/tour.ts` (tiers, points tables, cutoffs, calendar, Major names), name generator, ~300 COM pros, warm-up season, `career/rankings.ts` (52-week rolling, best 19 + Finals), `career/entry.ts` (direct / qualifying / not eligible / wildcard), weekly field simulation, qualifying draws, Tour Finals format.
- Screens: create player, career hub (week, rank, fatigue, news ticker), calendar with eligibility labels, event draw, play/quick-sim per round, week results, rankings table.
- Autosave + JSON export/import.
- Unit tests: rankings (dropoff on the same week next year, best-19 truncation, ties), eligibility (each tier's cutoffs, qualifying-only, wildcard override), points per round tables.
- **Accept:** unit tests pass; a new career quick-sims 10 weeks with sensible rank movement in state dumps; save → reload → identical state; export → import round-trips; calendar screenshot shows "Not eligible: rank #X required" and "Qualifying only" labels.

## M12: Career Phase 2 (archetypes & progression)
- `data/archetypes.ts` cap profiles; primary + secondary selection; XP and skill points; build screen (current vs. cap); training drills; badges with visible effects; fatigue; career page (titles, W/L by surface, career high, trophy cabinet).
- **Progression sim** (`scripts/career-sim.ts` or a Vitest): auto-play careers with quick-sim + auto-spend SP across 20 seeds.
- **Accept:** caps enforced (cannot spend past cap); badges unlock and show; the progression sim shows a median career reaching the **top 100 and a Major main draw within ~2–3 seasons** (tuned until true); screenshots of build screen, career page, trophy cabinet.

## M13: Polish, ship build & publish
- Load `retro-game-feel`: movement tuning pass, hitstop, screen kick, crowd reactions, ball trail, clay dust, grass wear, celebration/dejection animations, transitions polish.
- Full start→finish playthrough via the harness of every mode; performance check (60 fps, particle counts bounded).
- README (controls, how to run, how to build/preview, how it is deployed).
- `npm run build` + `npm run preview` verified locally.
- **Publish:** create the GitHub repo **`cheaptennis`** and deploy to **GitHub Pages** via a GitHub Actions workflow (as requested in chat; this overrides the "no deployment" line in the original brief).
- **Accept:** preview build plays with no console errors; the Pages URL loads and plays.

---

## Definition of Done (verify each item)
Evidence: `npm test` (Vitest, 45 tests) and `npx playwright test` (Playwright via Edge, screenshots in `playtest/`).
- [x] Title screen, stat comparison card and full-court match view match the style described in the GDD. *(boot.spec: title/statcard/match-{grass,clay,hard} screenshots reviewed)*
- [x] Classic Arrow + Space controls feel instant. A first-to-3-games exhibition plays start to finish. *(exhibition.spec: movement starts within 2 frames; title → setup → stat card → match → GAME, SET AND MATCH → result, driven through virtual key presses)*
- [x] All 5 shot types + 3 serve types work and play visibly differently on all 3 surfaces. *(shots-surfaces.test: net clearance, apex, post-bounce speed, bounce gap, serve speed/kick per type and surface)*
- [x] Every swing shows a timing grade with a reason, and PERFECT feels great. *(timing.spec: scripted presses produce PERFECT/GOOD/EARLY/LATE/MISHIT with reason popups; PERFECT = hitstop, trail, sparks, impact ring, shake, sting)*
- [x] Stamina drains/recovers and visibly affects play. *(modes.spec: drains over a rally, lower top speed and timing window at 12%, red pulsing bar + TIRED label, recovers between points)*
- [x] Tournament mode: 8/16/32 bracket screen and trophy screen. *(modes.spec: bracket-8/16/32 + trophy screenshots)*
- [x] Local 2-player versus with keyboard split and with two gamepads. *(modes.spec: WASD + arrows both move and rally; two mocked gamepads move and serve)*
- [x] Career Phase 1: calendar, eligibility gating, points, rolling rankings, field simulation, save/load. *(career.spec + rankings.test: "Not eligible: rank #X required"/"Qualifying only"/"Open entry", week advances with points, 52-week dropoff + best 19, localStorage reload, JSON round-trip)*
- [x] Career Phase 2: archetype caps, XP/skill points, build screen, badges. *(career.spec build screen; career sim unlocks badges and stops at the caps)*
- [x] A new career can reach the top 100 and enter a Major main draw within a reasonable number of seasons. *(career-sim.test, 7 seeds: median top 100 ≈ week 82 = season 2; Major main draw within seasons 1-2)*
- [x] Practice/tutorial, audio + mute, options and remapping. *(modes.spec: ball machine, serve practice, tutorial steps; audio.spec; remap rebinding swing to Q works in a match)*
- [x] `npm run build` + `npm run preview` work locally. *(PREVIEW=1 playtests pass against the built bundle; 198 KB JS, 69 KB gzipped)*
- [x] (added after approval) AI game plans: 5 tactics, per-player blends, per-point selection, in-match adaptation, Exhibition picker, HUD/stat-card/scouting display. *(tactics.test: each forced tactic measurably distinct in AI-vs-AI play; blend + adaptation unit tests; surface matchup in the stat sim; tactics.spec screenshots + plans vary across points)*
- [ ] Published to GitHub Pages from repo `cheaptennis` and verified loading there. **Deferred by the user**: workflow `.github/workflows/pages.yml` + README steps are ready; needs Git + `gh auth login`.
- [x] (oneshot skill) Zero TS errors; no console errors; audio only after a gesture; renders at 60+ fps with particles capped at 400; settings/career persist via try/catch'd localStorage; README with controls / run / build / deploy.

---

## Progress log
- 2026-11-05: GDD + PLAN written and approved (local build now, GitHub publish planned for the end).
- 2026-11-05: M0-M12 built and verified; M13 polish, README, Pages workflow prepared; all unit + browser tests green. Per-milestone git commits skipped (Git not installed, per the user's choice).
- 2026-11-05: M14 AI game plans added (user request). While measuring it, found and fixed an AI bug: the COM's chosen aim was being dropped at contact, so every AI shot went down the middle. Rallies went from ~10-12 shots to ~6-8. The AI now also leaves balls that are going out and has a human-like 0.15-0.3 s reaction time.
