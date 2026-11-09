# Baseline: playtest notes

Write anything you notice while playing. Rough is fine: half sentences, typos and "this feels off" all work.
When you're ready, tell Claude: **"turn my notes into a prompt"**. Claude reads this file, asks about anything
unclear, and writes one prompt that it can then use to edit the game.

**Tips (all optional):**
- Put `!` at the start of a line that really matters: `! serve toss is way too fast`
- Say where it happened, if you know: Exhibition, Career week 12, clay, vs a Net Attack player…
- For a bug, say what you did, what happened, and what you expected.
- "More/less X" is useful as is. Numbers are a bonus: `rallies feel ~2x too long`.

---

## Quick dump
<!-- Don't want to sort? Put everything here. Claude will sort it. -->

-

## Bugs (something is broken or wrong)

-

## Feel & balance (too easy, too hard, too slow, too floaty…)
<!-- Shots, timing windows, movement speed, stamina, AI difficulty, career pace -->

-

## AI & tactics (how COM players behave)

-

## Looks & sound (graphics, animations, HUD, music, SFX)

-

## Menus, modes & career (screens, flow, options, tournaments, career)

-

## New ideas / wishlist

-

## Questions for Claude

-

---

## Done
<!-- Claude moves notes here after acting on them, with the date. -->

### 2026-11-09: play like Tennis Elbow 4, arcade version (M21)
- Controls and feel one to one with Tennis Elbow 4 (graphics aside), from its documentation → **done**, from the manual in your Steam install, in its Arcade mode:
  - Hold a strike button (X/Space, Z, both or C) before the ball arrives and keep holding: contact is automatic. While you hold, you auto-walk to the green spot and ←/→ sweeps the aim.
  - ↑/↓ picks one of 10 strikes (normal, short, topspin, slice, drop, lob, acceleration, short acceleration, attack lob, plus the safe strike when nothing is held).
  - Pressing earlier shrinks the aiming zone. Rising balls (the danger zone) and balls into the body cost accuracy.
  - Only a few good accelerations per point: when they run out the racket smokes and the extra ones get wild.
  - Serve: hold to toss, contact is automatic. Strong / Normal / Safe go in about 70 / 85 / 100%.
  - Also: the volley jump, gestures after a point, and a court preview with the danger zone, green spots and live aiming zone. Options gain Arcade/Simulation, auto-positioning speed and the preview level. The COM uses the same system. The tutorial is rewritten.

### 2026-11-06: match the Free Tennis gameplay (M20)
- Same dimensions as the Free Tennis recording: ball size, character size → **done**. The camera now frames the court like the recording, players are ≈1.4 court-metres tall with the bigger racket, and the ball was already the same size (0.2 m) and now has the same dark shadow. The crowd moved to the screen edges so it still shows.
- Hitting should stop movement unless it's a slide → **done**. You're rooted from the start of the swing animation until the follow-through ends (~0.4 s; Free Tennis players stand still for ~0.35 s after hitting). Swing while running fast and you slide through the shot instead, with a slide pose and a skid trail.
- Speed just like Free Tennis → **done, measured**. Top speed is up to ≈6.4 m/s like the recording, groundstrokes are 8% faster, and the COM plays around the baseline. A shot now comes back every ~1.08 s (1.00 s in the recording, 1.23 s before).

### 2026-11-06: playtest round 2 (M19)
- The advertisements can go → **removed**. The walls are plain themed windscreens (no sponsor names, clock or speed board); serve speed still pops up on court.
- See which stats get worse with stamina, show/hide with H → **done**. H toggles a panel listing top speed, acceleration, timing window, shot accuracy, shot power, serve speed and serve accuracy in %, from the game's own fatigue rules.
- Don't show the opponent's plan during the match, and never the % mix → **done**. Nothing in play; pregame only says e.g. "Mostly Net Attack, also Serve + 1".
- Z-index bugs with the player and racket → **fixed**. The racket and arms go behind or in front of the body depending on the stroke and which way the player faces.
- Tiny career tournaments should have almost no crowd → **done**. Futures are park courts with small bleachers, and the crowd grows through Challenger, 250, 500 and 1000 up to full Major stadiums.
- Skipping between points should also skip the point-won UI → **done**.

### 2026-11-06: playtest round 1 (prompt: docs/NEXT_PROMPT.md)
- Tutorial: let shots finish instead of skipping to the next one → **done**. Each shot plays out with an IN/OUT landing marker, then a 1 s pause (Space skips it), and a finished step waits for the ball.
- Space to skip players walking to their spots between points → **done**. It also skips changeovers, and a "SPACE skip" hint shows.
- Menu: one arrow press skipped two options → **fixed** (a held key was counted twice).
- Hard to win points with fast balls into corners / players too fast / perfect drop shot almost always wins → **retuned**:
  - players are ~17% slower and accelerate realistically
  - balls are ~10% faster
  - drop shots can be chased down
  - corner shots now win outright ~18% of the time (was ~1%)
- Net play too strong / you can still get back to lobs → **fixed**. Lobs fly higher and deeper, net players turn late, and smashing while backpedalling is off-balance. Lobs over a net player now win ~55% (was 18-39%).
- Ball should be quicker than the person → that is the design rule behind the balance changes (see GDD §2.9c for the numbers).
- Player art like the Free Tennis video (big racket, little person, 3D look) → **done** as an original design: big head, oversized racket with strings, shaded body.
- Pro-style scoreboard → **done**: broadcast scoreboard top-left with set columns, a point box and a BREAK/SET/MATCH POINT tab.
- Sponsor backdrop + maps per surface, grander Grand Slams near the end of the tournament → **done**:
  - green-and-gold style sponsor boards with a clock, using made-up brands, since real logos like Rolex can't go in a public game
  - a venue per surface, plus a night session
  - Majors get banners, the event name on court, photographers and a fuller, louder crowd each round, with a walk-on card and a flash burst in the final
- Tactics tutorial with real tennis concepts → **done**: Practice → Tactics School, 8 lessons with drills.
- Forehand and backhand should look different (2-hand backhand) → **done**: distinct forehand, two-handed backhand, one-handed backhand, slice, drop and lob swings.

---

<!--
============================================================================
FOR CLAUDE: how to turn these notes into a prompt
============================================================================
When the user asks you to turn their notes into a prompt:

1. Read every section above except "Done". Sort the notes from "Quick dump" into
   categories. Merge duplicates. Lines starting with "!" are top priority.
2. If a note is too vague to act on (e.g. "serve feels weird"), ask one short round
   of clarifying questions, or make a sensible reading and say what you assumed.
3. Write the prompt in a fenced code block for the user to read, saved as
   docs/NEXT_PROMPT.md. Structure:
     - Goal: one or two sentences.
     - Changes: numbered, priority order. For each: what the player experiences
       now, what it should become, the likely files (see the map below), and
       how to verify it (unit test, Playwright scenario, screenshot, or measured
       number such as average rally length).
     - Constraints: keep all existing tests passing (npm test, npm run play,
       npm run build); tuning numbers live in src/data/tuning.ts or the
       relevant data file; tour data stays in src/data/tour.ts; update
       docs/GDD.md / docs/PLAN.md when the design changes; commit after each
       milestone and push to main (GitHub Pages deploys automatically on push).
     - Out of scope: anything in the notes deliberately deferred.
4. Ask the user whether to run it. On their yes, do the work, then move the
   handled notes into "Done" with today's date.

File map:
  Shot timing / grades / windows .... src/data/tuning.ts, src/match/match.ts
  Shot targets / errors / serves .... src/match/shots.ts
  Ball physics / bounce / net ....... src/match/ball.ts, src/data/surfaces.ts
  Player movement / stamina ......... src/match/player.ts, src/data/tuning.ts
  COM AI / tactics / archetypes ..... src/match/ai.ts, src/data/tactics.ts, src/data/archetypes.ts
  Scoring / rules / umpire .......... src/match/scoring.ts, src/match/match.ts
  Simulated (non-played) matches .... src/sim/match-sim.ts, src/sim/bracket.ts
  Career rules / rankings / entry ... src/career/*, src/data/tour.ts
  Career screens .................... src/scenes/career/*
  Other menus & modes ............... src/scenes/*
  Match visuals / HUD ............... src/gfx/match-view.ts, src/gfx/court.ts, src/gfx/player-renderer.ts
  Camera / crowd / stands ........... src/gfx/camera.ts, src/gfx/backdrop.ts
  Sound effects / music ............. src/core/audio.ts, src/data/music.ts
  Controls / remapping / gamepad .... src/core/input.ts, src/core/settings.ts
  Pro roster / names ................ src/data/roster.ts, src/data/names.ts
  Tests ............................. tests/*.test.ts (Vitest), e2e/*.spec.ts (Playwright)
============================================================================
-->
