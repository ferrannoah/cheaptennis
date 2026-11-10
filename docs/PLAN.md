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

## Playtest round 1 (from NOTES.md, prompt in docs/NEXT_PROMPT.md)
### M15: Quick fixes
- [x] One arrow tap moves a menu one row; holding repeats after 22 frames, then every 6. *(menu-input.spec: real key events held 1/3/8/15 frames move exactly 1 row on the title and Exhibition menus; a 40-frame hold moves 2-4)*
- [x] Space skips the dead time and the walk to position between points (also changeovers); the press does not toss. A "SPACE skip" hint shows when available. *(skip-walk.spec: point is scored, players snapped, serve still 'ready')*
- [x] Practice/tutorial: each shot plays out (IN ring / OUT cross on the landing spot, OUT/NET calls), then a 1 s pause before the next feed (Space skips after 0.25 s). A tutorial step finished by a hit waits for that ball, shows STEP COMPLETE!, then moves on. *(practice-playout.spec)*
### M16: Speed balance: measure, then retune
- [x] Balance harness `tests/balance.test.ts`: AI-vs-AI across archetypes, about 530 points per surface. It measures rally length, corner vs. middle outright winners, drop and lob outcomes, aces, unreturned serves and double faults, and asserts the targets. The before/after table is in GDD §2.9c.
- [x] Players are ~17% slower with real momentum (acceleration 46→22 m/s²) and backpedal at 72% speed. The COM plans its run with the same acceleration model (`Player.timeTo`).
- [x] Groundstrokes are +10% faster, PERFECT drives land deeper, and serves are up to ~180 km/h. Corner outright winners went from 0-2% to 17-19%, and rallies are 5.3-5.7 shots.
- [x] Drop shots float longer and die less. Against a baseline player they win about 53% pooled (was up to 71%, and 83% for PERFECT drops).
- [x] Lobs fly higher and deeper, a net player turns late, and smashing while backpedalling is hard. Lobs over a net player now win 52-58% (was 18-39%).
- [x] Bug: untouched serves were never called "ACE!" (aces are now 3-6%).
- [x] Tactic profiles still distinct (tactics.test) and career quick-sim pace unchanged (career-sim.test: it uses the stat sim).
### M17: Tactics School
- [x] 8 lessons (GDD §3.5b): intro card → drill with target zones, stand-in opponent and progress pips → summary card linked to the matching AI game plan. Reached from Practice → Tactics School; progress saved in localStorage.
- [x] Ball machine can feed short balls (`depth`) and wide balls (`wide`) for the attack and defence drills.
- [x] *(lessons.test: every drill rule accepts the right shot and rejects wrong ones; tactics-school.spec: the autopilot follows each lesson's coaching hint and clears all 8 drills, progress saved, screenshots of every intro/drill/summary)*
### M18: Broadcast look
- [x] New player art: big head, short legs, an oversized racket with a string bed, shaded capsule limbs. It's an original design and applies everywhere figures are drawn (match, stat card, career create, Tactics School). *(art.spec: pose gallery for back/front view × right/left hand; 6-frame bursts through a match forehand and backhand)*
- [x] Distinct strokes: forehand, two-handed backhand, one-handed backhand, slice (both wings), drop and lob (`strokePoses`).
- [x] Broadcast scoreboard with set columns, a point box and a BREAK/SET/MATCH POINT tab. *(scoring.test: `pressureLabel`; scoreboard.spec screenshots)*
- [x] Venues: surface themes, made-up sponsor boards, a live clock and serve-speed display, a hard-court night session (Exhibition → Session). Majors and Finals get taller stands, banners, a painted event name and photographers. The crowd fills up and gets louder through the rounds, there's a walk-on card from the QF on, and a camera-flash burst after match point in a final. Career, Tournament and Exhibition all pass their venue. *(venues.spec: every surface regular/Major × R1/Final + night; a full Major crowd draws in under 1 ms per frame headless)*

## Playtest round 2 (NOTES.md, 2026-11-06)
### M19: Cleanup + fatigue info + venue scale
- [x] **No ads:** courtside boards are plain themed windscreens (no sponsor names, no branded clock, no serve-speed board). The serve speed stays in the on-court popup. *(venue screenshots)*
- [x] **COM plan hidden in play:** no PLAN chip and no "CHANGES TACTICS" popup during matches. The stat card and career scouting report show style names only ("Mostly Net Attack, also Serve + 1"), with no percentages. *(statcard screenshot)*
- [x] **Fatigue details (H):** H toggles a panel by your stamina bar showing top speed, acceleration, timing window, shot accuracy, shot power, serve speed and serve accuracy in %. The setting is saved, an "H fatigue" chip sits by the bar, and H is ignored when it's a shot key (keyboard versus). The values come from `src/match/fatigue.ts`, which the physics now uses too. *(fatigue.test: 0% fresh, worse when tired, same as Player; fatigue.spec: toggle + screenshot)*
- [x] **Racket/arm draw order:** each pose has a racket-arm and off-arm depth, interpolated. The near (back-view) player hides a racket held in front of the chest behind the body and draws a wrapped follow-through over the head; the far player is the reverse. *(pose gallery screenshots, back + front)*
- [x] **Crowd scales with the event:** venue level 0-5 from the career tier, with qualifying one level smaller. Futures and practice use a park court with two-row bleachers and a sparse crowd. Challengers get small stands, then 250 / 500 / 1000 grow, and Majors and Finals are full stadiums. *(venues.spec: level 0/1/2/4 screenshots)*
- [x] **Skip clears the point UI:** the Space skip also dismisses the umpire call, popups and banners. *(skip-walk.spec asserts call/popups/banner are empty after a skip)*

## Free Tennis reference (user request, 2026-11-06)
### M20: Same dimensions, stroke commitment, reference pace
- [x] **Measure the footage:** the user's Free Tennis recording, tracked at 20 Hz (ball blob, shadows, court-line calibration): sizes, player/ball speed, time between hits, contact depth, net height, still time. *(numbers in GDD §2.9d)*
- [x] **Same dimensions:** a long-lens camera fitted to the footage's court framing (max error ≈7 px), players ≈1.4 court-metres tall, a bigger racket, the same ball size and a darker ball shadow. Side walls/stands moved in to ±8.6 m so the event-size crowd stays on screen. *(match/venue screenshots compared with footage frames)*
- [x] **Stroke commitment + slide:** no steering from the swing animation to the end of the follow-through (and after the serve); a running swing becomes a slide with its own pose and skid trail. *(stroke-lock.test: no acceleration or turning while locked, planted strokes stop within 10 frames, slides happen; the lock window matches the swing)*
- [x] **Reference pace:** faster players, +8% groundstroke pace, and the COM plays around the baseline. A shot every 1.08 s versus 1.00 s in the footage. *(reference-pace.test asserts the footage targets; balance.test still green; timing.spec MISHIT fixed with a speed-scaled late-contact tolerance)*

## "Elbow" controls (user request, 2026-11-08)
Goal: the controls and feel of Tennis Elbow 4 in **Arcade** mode, taken from its manual (Steam install, `Doc/En_Documentation.html`); our own art, names and code.
### M21: Hold-to-strike controls and the shot model behind them
- [x] **Input:** two strike buttons (B1, B2), with both together or a dedicated key giving an acceleration, plus a gesture key. Defaults: solo X/Space, Z, C, V; versus P1 F, G, R, T; versus P2 Num1-4; pad A, X, B, Y. *(Options remap lists the new actions)*
- [x] **Hold to strike:** hold a strike button before the ball arrives and keep it held; contact is automatic. Holding a button stops manual running: you **auto-position** to the ideal spot (Slow/Average/Fast, default Fast), and left/right **sweeps the aim**. The longer you push, the further it goes, faster near the net (2-3x slower behind the baseline), and it drifts back to the centre when released. Nothing held at contact = a weak **safe strike**. *(strike.test: aim sweep rates, safe strike, auto-pos speed)*
- [x] **Strike menu** (held at contact): B1 Normal / ↑ Short / ↓ Topspin; B2 Slice / ↑ Drop / ↓ Defensive lob; B1+B2 Acceleration / ↑ Short acceleration / ↓ Attack lob. ↑ means toward the net. *(strike.test: all 10 strikes reachable)*
- [x] **Preparation = accuracy:** the aiming zone shrinks the earlier you press. Arcade shrinks it twice as fast as Simulation, and the COM uses Simulation, as in the manual. Earlier prep also hits deeper (short strikes shorter); off-centre or out of position does the opposite. Hitting from closer to the baseline goes deeper. *(strike.test: zone radius vs prep, depth rules)*
- [x] **Danger zone + centring:** contact on a rising ball (red/orange zone after the bounce) or off the racket's sweet spot (into the body, stretched) costs accuracy and power; red can lose control (net or long). Arcade halves these penalties. *(strike.test)*
- [x] **Accelerations:** limited good accelerations per point (1-5 from endurance, ± per archetype); the extra ones get wilder and slower, and the racket smokes from the last good one. Max pace at the top of the bounce, a bonus at shoulder height, a penalty for head-high balls. *(strike.test: quota + pace rules)*
- [x] **Serve:** press and hold to toss; contact is automatic at the top. B1 Normal, B2 Safe, both Strong; ↑ slice, ↓ kick; ←/→ sweeps the aim. Success ≈70% / 85% / 100% for Strong / Normal / Safe; second-serve stress (−10% / −4% and wider aim); speed from serve skill (≈102-204 km/h). Releasing just before contact lets you run in sooner. *(serve.test: measured success rates and speeds)*
- [x] **Volley jump:** at the net, holding a strike button lets you dive for a ball out of normal reach. *(strike.test)*
- [x] **Preview HUD (Off / Impact / +Danger zone / All):** the impact marker, the danger zone band with the two green spots, the live aiming spot and zone, acceleration pips, and the centring icon after an error. The old timing arc and toss meter are removed. *(screenshots reviewed)*
- [x] **Options:** Controls Arcade/Simulation (default Arcade), Auto-positioning Slow/Average/Fast (default Fast), Preview (default All).
- [x] **COM on the same system:** the COM runs, then holds the button early, auto-positions and aims through the same code (Simulation accuracy). Balance targets retuned and green. *(balance/tactics/reference-pace tests)*
- [x] **Gestures:** after a point, gesture key + direction (jump, fist, raging fist, apology / applaud, forehead slap, "crazy", racket throw).
- [x] **Tutorial rewritten** for the new controls (hold, aim sweep, green spots, both strike menus, acceleration, serve types); title, versus and Tactics School hints updated. *(practice e2e: every tutorial step completable by the autopilot)*
- [x] **Browser tests:** the autopilot holds buttons like a player; timing.spec becomes strike.spec; all e2e green; deployed and checked live.

---

## Definition of Done (verify each item)
Evidence: `npm test` (Vitest, 45 tests) and `npx playwright test` (Playwright via Edge, screenshots in `playtest/`).
- [x] Title screen, stat comparison card and full-court match view match the style described in the GDD. *(boot.spec: title/statcard/match-{grass,clay,hard} screenshots reviewed)*
- [x] Classic Arrow + Space controls feel instant. A first-to-3-games exhibition plays start to finish. *(exhibition.spec: movement starts within 2 frames; title → setup → stat card → match → GAME, SET AND MATCH → result, driven through virtual key presses)*
- [x] All 5 shot types + 3 serve types work and play visibly differently on all 3 surfaces. *(shots-surfaces.test: net clearance, apex, post-bounce speed, bounce gap, serve speed/kick per type and surface)*
- [x] Every strike shows a grade with a reason, and PERFECT feels great. *(M21 strike.spec: an early hold grades GOOD/PERFECT, a last-moment hold RUSHED, no button SAFE, accelerations named; PERFECT = hitstop, trail, sparks, impact ring, shake, sting)*
- [x] Stamina drains/recovers and visibly affects play. *(modes.spec: drains over a rally, lower top speed and timing window at 12%, red pulsing bar + TIRED label, recovers between points)*
- [x] Tournament mode: 8/16/32 bracket screen and trophy screen. *(modes.spec: bracket-8/16/32 + trophy screenshots)*
- [x] Local 2-player versus with keyboard split and with two gamepads. *(modes.spec: WASD + arrows both move and rally; two mocked gamepads move and serve)*
- [x] Career Phase 1: calendar, eligibility gating, points, rolling rankings, field simulation, save/load. *(career.spec + rankings.test: "Not eligible: rank #X required"/"Qualifying only"/"Open entry", week advances with points, 52-week dropoff + best 19, localStorage reload, JSON round-trip)*
- [x] Career Phase 2: archetype caps, XP/skill points, build screen, badges. *(career.spec build screen; career sim unlocks badges and stops at the caps)*
- [x] A new career can reach the top 100 and enter a Major main draw within a reasonable number of seasons. *(career-sim.test, 7 seeds: median top 100 ≈ week 82 = season 2; Major main draw within seasons 1-2)*
- [x] Practice/tutorial, audio + mute, options and remapping. *(modes.spec: ball machine, serve practice, tutorial steps; audio.spec; remap rebinding swing to Q works in a match)*
- [x] `npm run build` + `npm run preview` work locally. *(PREVIEW=1 playtests pass against the built bundle; 198 KB JS, 69 KB gzipped)*
- [x] (added after approval) AI game plans: 5 tactics, per-player blends, per-point selection, in-match adaptation, Exhibition picker, HUD/stat-card/scouting display. *(tactics.test: each forced tactic measurably distinct in AI-vs-AI play; blend + adaptation unit tests; surface matchup in the stat sim; tactics.spec screenshots + plans vary across points)*
- [x] Published to GitHub Pages from the public repo `ferrannoah/cheaptennis`; every push to `main` tests, builds and deploys. *(live at https://ferrannoah.github.io/cheaptennis/, title screen loads with no console errors)*
- [x] (oneshot skill) Zero TS errors; no console errors; audio only after a gesture; renders at 60+ fps with particles capped at 400; settings/career persist via try/catch'd localStorage; README with controls / run / build / deploy.

---

## Progress log
- 2026-11-05: GDD + PLAN written and approved (local build now, GitHub publish planned for the end).
- 2026-11-05: M0-M12 built and verified; M13 polish, README, Pages workflow prepared; all unit + browser tests green. Per-milestone git commits skipped (Git not installed, per the user's choice).
- 2026-11-05: M14 AI game plans added (user request). While measuring it, found and fixed an AI bug: the COM's chosen aim was being dropped at contact, so every AI shot went down the middle. Rallies went from ~10-12 shots to ~6-8. The AI now also leaves balls that are going out and has a human-like 0.15-0.3 s reaction time.
- 2026-11-06: Git set up; repo `ferrannoah/cheaptennis` (public) with auto-deploy to GitHub Pages. M15 quick fixes done (menu double-step, skip between points, practice shots play out).
- 2026-11-06: M16 speed balance (measured before/after), M17 Tactics School, M18 broadcast look. Playtest round 1 notes all handled; still needs a hand-played check of the new feel.
- 2026-11-06: M19 playtest round 2 (no ads, hidden COM plan, H fatigue panel, racket depth, crowd by event size, skip clears UI).
- 2026-11-06: M20 matched to the user's Free Tennis recording (camera framing, sizes, pace) and added stroke commitment with slide strokes. 76 unit tests + 28 browser tests green.
- 2026-11-09: M21 "Elbow" controls from the Tennis Elbow 4 manual: hold-to-strike with auto-positioning and aim sweep, the 10-strike menu, preparation-based aiming zone, danger zone with green spots, centring, accelerations per point, the Strong/Normal/Safe serve, volley jump, gestures, the court preview, the COM on the same system, and a rewritten tutorial. 94 unit tests + 28 browser tests green.
- 2026-11-10: Player graphics option: DRAWN (procedural figure) or SPRITES (sprite strips in public/sprites/player, placeholder art baked from the poses). Stroke frames are timed so the contact frame shows at contact. Sprite gallery test scene added. 99 unit tests + sprites.spec green.
- 2026-11-10: First real sprite art: the user's forehand sheet (both views) imported with the new sprite importer (npm run sprites:import), which removes painted checkerboard backgrounds and lines up the feet. The placeholder baker keeps imported strips.
