# Next prompt: playtest round 1 (from NOTES.md, 2026-11-06)

```text
Goal: act on the first round of playtest notes for Baseline. Fix the input and flow annoyances,
rebalance so the ball beats the player and well-placed shots win points, add a tennis-tactics
tutorial, and give the matches a pro-broadcast look (new player art, real forehand vs. two-handed
backhand animations, a TV-style scoreboard, sponsor boards, and grander Majors). Work in the
milestones below. Commit after each milestone and push to main, which deploys to GitHub Pages.

== Milestone A: quick fixes ==

1. Menu skips an option on a single arrow press (bug).
   Now: one tap of Down moves the cursor two rows. Cause, in src/core/input.ts menu(): on the press
   frame it returns true at the pressedNow check without touching the repeat counter, so on the next
   frame (key still held, t === 0) the "stick first push" branch returns true again.
   Should be: one tap = one move. Holding still auto-repeats after ~22 frames, every 6 frames after.
   Fix: update the repeat counter on the press frame too, and keep it correct if menu() is called
   more than once per frame. One stick push should still move exactly once.
   Verify: a Playwright test that uses page.keyboard.press('ArrowDown') (real key events, not the
   __game.menu hook) on the main menu and the Exhibition setup, and asserts the selection moves by
   exactly 1. A held key (keyboard.down, ~40 frames) moves 2-4 rows.

2. Skip the walk back to position between points.
   Now: after each point, players walk to their spots, and you have to wait.
   Should be: pressing Space (or the pad's A button) during that dead time snaps both players to
   their positions and goes straight to the next point. That same press must not also start the
   serve toss, so consume it. Keep the umpire call and score update. Changeovers can be skipped
   the same way.
   Files: src/match/match.ts (updateDead / setupPoint), src/scenes/match.ts.
   Verify: e2e test: play a point, press Space during the walk, and assert the next point is ready
   in under 10 frames and no toss started.

3. Tutorial: let each shot play out before the next one.
   Now: in the tutorial and practice drills, the next feed comes the instant you hit, so you never
   see where your shot landed.
   Should be: the ball flies until it bounces twice, goes out, or hits the net. The landing spot
   is marked and the grade text stays up, then a short pause (~0.8 s) before the next feed.
   Space skips the wait.
   Files: src/scenes/practice.ts, the practice paths in src/match/match.ts.
   Verify: in a scripted drill, the ball's landing position is recorded before the next feed,
   with a screenshot of the landing marker.

== Milestone B: speed balance (players too fast, ball too slow) ==

Notes: corner winners are almost impossible, because the base player speed is too high. A perfect
drop shot almost always wins, and that is too strong. A player at the net reaches everything and
even recovers in time for lobs. The general idea: the ball should beat the player, depending on
the shot.
Current tuning (src/data/tuning.ts): baseSpeed 5.4 m/s plus footworkSpeedBonus 2.3, accel 46,
reach 1.25, stretchReach 1.95.

4. Measure first. Add a balance harness (a Vitest or headless script on AI vs AI with fixed seeds,
   500+ points per surface). It records:
   - average rally length
   - winners vs. errors
   - win rate of balls landing within 1.2 m of a sideline corner
   - point win rate after a PERFECT drop shot
   - lob-over-the-net-player success rate
   - how far a player can cover in the ball's flight time (one baseline-to-baseline rally ball,
     one crosscourt angle)
   Save the "before" numbers in docs/PLAN.md.
5. Retune so that:
   - players are about 15-20% slower (lower baseSpeed and the footwork bonus), with more momentum:
     lower accel, slower change of direction, and a slower first step when wrong-footed
     (running the opposite way)
   - groundstrokes, especially flat and topspin shots, are 8-15% faster, and serves a touch faster
   - stretch/dive shots are weaker and less accurate
   - net coverage is smaller: running backwards is slower than running forwards, and a player at
     the net gets a reaction delay against lobs, so a good lob over a net player usually wins
   - drop shots are weaker: a PERFECT drop wins at most ~45% of the time against a player who is
     at or inside the baseline. A deep defender loses it most of the time, which is correct, but
     drops hit from behind the baseline float more and are easier to chase.
   Targets: rallies of about 4-7 shots; the "corner within 1.2 m" win rate is clearly higher than
   now (above about 35%); the lob vs. net player win rate is between 50% and 70%; the human
   timing windows are unchanged. All tuning goes in tuning.ts or the shot data, and every number
   is noted in the GDD.
6. Re-check the career quick-sim pace. If the sim used physics constants it shouldn't change; if
   it shifted, retune it so the top 100 still comes around season 2.

== Milestone C: tactics tutorial ==

7. Add a "Tactics School" track in Practice/Tutorial. It teaches real singles basics, not ways to
   exploit the AI. Each lesson has a short explanation, a guided drill with a pass condition,
   and a summary card:
   a. Crosscourt is the safe rally shot: the net is lower in the middle and the court is longer.
      Drill: 6 crosscourt balls in a row.
   b. Hit to the open court: move the opponent, then hit to the space they left.
   c. Change direction when you have a good ball. Down the line is the riskier shot; play it from
      a neutral or attacking position.
   d. Attack the short ball: step in, hit an approach shot, and follow it to the net.
   e. Serve placement plus the first shot: wide serve, then the open court; a T serve to jam the
      returner.
   f. Find the weaker side: notice the opponent's backhand and press on it.
   g. Beat the net player: passing shots down the line or at the feet, or a lob.
   h. Defend: get height and depth when stretched, then recover to the middle.
   Each lesson links to the matching Game Plan from the AI tactics (Serve + 1, Grind, Net Attack…).
   Save progress per lesson in localStorage. Write the text in plain student-friendly language and
   cite the sources in docs/GDD.md.
   Files: src/scenes/practice.ts (or a new src/scenes/tactics-school.ts), src/data/lessons.ts.
   Verify: autopilot clears every lesson; screenshot each lesson's intro and summary.

== Milestone D: broadcast look ==

8. New player art. The reference is a free browser tennis game shown in a screen recording: small
   3D-shaded players with big heads, a compact body and an oversized racket, a round drop shadow,
   and readable poses from a high camera. Redraw our players in that general STYLE with an
   ORIGINAL design. Don't copy that game's character art, colours or proportions exactly; it's a
   style reference only.
   Requirements:
   - a chunkier, stylised figure (head about 1/4 of the height)
   - a racket about 1.5x the current size with a visible string bed
   - smooth shading with a light direction that matches the court
   - kits stay customisable
   - readable at both the near and the far end of the court
   File: src/gfx/player-renderer.ts. Keep the hit timing and contact points the same.
9. Separate forehand and backhand animations. The forehand: unit turn, the racket drops, a low-to-
   high swing across the body, finishing over the opposite shoulder. The backhand: the shoulders
   turn the other way and both hands go on the grip (twoHanded) through the swing; one-handed
   players keep a one-arm swing with the other arm going back. Also add distinct slice (high-to-low),
   volley (short punch), lob and drop poses. Left-handers mirror correctly.
   Verify: a screenshot burst of 6 frames through one forehand and one backhand, for a right-hander
   and a left-hander.
10. Pro-style TV scoreboard. Replace the current score display with a broadcast-style score panel in
    the top-left corner:
    - one row per player, with a small flag or colour chip, the name and a serve-ball indicator
    - completed set scores, then the current set's games
    - the current point score in a highlighted box (0/15/30/40/AD, or tiebreak points)
    - it animates when the score changes, with a short "BREAK POINT" / "SET POINT" /
      "MATCH POINT" tab that slides out
    Original design, not a copy of any real broadcaster's graphics.
    File: src/gfx/match-view.ts.
11. Sponsor boards and venues. Add a back wall behind the baseline in the classic pro-event look:
    dark green boards with gold lettering, a big analogue clock-style board, and a speed-of-serve
    display. Use ONLY made-up brand names, no real trademarks (no Rolex or other real brands).
    Add venue themes per surface: grass (green and purple, ivy, cream stands), clay (terracotta and
    navy, an open-air bowl), hard (blue and teal, a night-session option). Majors get their own
    grander venue: taller stands, bigger crowd, banners, a tournament name on the wall, and
    photographers at courtside. The atmosphere builds through the event: in the QF/SF/F rounds the
    stands are fuller, the crowd is louder, there is more flash photography, and there is a short
    walk-on intro card. The final adds a court-level camera flash burst after match point and a
    trophy-ceremony tie-in.
    Venue data goes in src/data (no venue art in tour.ts beyond an id reference).
    Files: src/gfx/backdrop.ts, src/gfx/court.ts, src/scenes/match.ts.
    Verify: screenshots of each surface's regular venue and Major venue at R1 and in the Final.
    Performance stays at 60 fps with the bigger crowd (pre-render static layers).

== Constraints ==
- npm test, npm run play (Playwright, msedge channel) and npm run build all pass after every
  milestone; add the new tests listed above.
- Tuning numbers live in src/data/tuning.ts or the relevant data file. Tour data stays in
  src/data/tour.ts.
- Update docs/GDD.md and docs/PLAN.md (add milestones M15-M18 with acceptance tests and the
  measured before/after balance numbers).
- Original art, names and brands only.
- Git: commit after each milestone with a clear message, then push to main. The Pages workflow
  deploys automatically. Check that the Actions run succeeds and the live page boots.
- When done, move the handled notes in NOTES.md to "Done", with today's date.

== Out of scope ==
- Online multiplayer, licensed players/tournaments/brands, new game modes beyond the Tactics School.
```

## Assumptions I made
- **"Rolex backdrop"** means the look: dark-green and gold sponsor boards with a clock. It uses made-up brands, because real trademarks can't go in the game, especially once it's public on GitHub Pages.
- **"Like freetennis"** is a style reference (big racket, small stylised 3D-looking player). The new art is original, not a copy of that game's characters.
- **"Grand slams feel grander"** means the four Majors already in the tour data get special venues. The atmosphere builds round by round.
- **Balance:** I read your notes as "players are too fast" being the root cause. Milestone B measures first, then tunes toward the target numbers listed.
