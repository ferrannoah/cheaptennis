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

One thing is in the tutorial you should allow the shots to finish out instead of skipping to the next shot instantly for feedback.

In game You should be able to press space to skip the players walking to their spots in between points seems pointless waste of time. 

In the menu limit the arrow keys to do one option change currently when you press down it skips one option on the menu. 

Overwall it seems pretty hard to win points on throwing fast balls into corners. I think the base players speed may be too fast. On the other end of that if you hit a perfect drop shot it almost always results in a point which doesnt seem to good either.

Net play seems a little too strong aswell if youre at the net you can pretty much get to any ball and if you get a lob you can still get back to it again i think (im not sure) but i think this falls back on players are far too quick. 

I think in general an idea is the tennis ball should be quicker then the person feeling obviously shot dependent but you get the idea.

Ive also added a freetennis video to take a look at I do enjoy their player art a little more. Big racket little person 3 dimensional design kinda maybe change that aswell. 

Also i want the score board to look more like a pro tennis scoreboard and also i would like the rolex backdrop that much of pro tennis events have maybe have a few maps dependent on ground type to machh the grand slams + regular events obviously the grand slams should feel grander especially as you approach the end of the tournament.

Maybe make a tutorial for tactics again i want this to be like real tennis so maybe look up basic tennis tactics to win points and give a tutorial on that i dont want a tutorial to hack beat the computer obvioulsy just basic concepts. 

I would also like forehand shots and backhand shots to look differnet in animation 2 hand backhand. 

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
