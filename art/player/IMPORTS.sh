#!/usr/bin/env bash
# Every import used for the current player sprite art (run from the repo root).
set -e
I="node scripts/import-sprite-sheet.mjs"
$I art/player/forehand.png --rows "front/forehand|front/ready@0.6,back/forehand|back/ready@0.6"
$I art/player/run.png --rows "front/run,back/run" --stand 0.94
$I art/player/fh-lob.png --rows "front/fhLob,back/fhLob"
$I art/player/bh-lob.png --rows "front/bhLob,back/bhLob~"
$I art/player/volley.png --rows "front/volleyBh|front/volleyFh~,back/volleyFh|back/volleyBh~"
$I art/player/fh-slice.png --rows "front/fhSlice,back/fhSlice"
$I art/player/bh-slice.png --rows "front/bhSlice,back/bhSlice~"
$I art/player/backhand-1h.png --rows "front/backhand1h~,back/backhand1h~"
$I art/player/overhead.png --rows "front/overhead,back/overhead"
$I art/player/dive.png --rows "front/dive,back/dive"
$I art/player/celebrate.png --rows "front/celebrate,back/celebrate"
$I art/player/fist.png --rows "front/gFist,back/gFist"
$I art/player/rage.png --rows "front/gRage,back/gRage" --stand 0.95
$I art/player/sorry.png --rows "front/gSorry,back/gSorry"
$I art/player/applaud.png --rows "front/gApplaud,back/gApplaud"
$I art/player/facepalm.png --rows "front/gFacepalm,back/gFacepalm"
$I art/player/crazy.png --rows "front/gCrazy,back/gCrazy" --stand 1.3
$I art/player/tired.png --rows "front/slump,back/slump" --stand 0.85
$I art/player/idle-spin.png --rows "front/idleSpin,back/idleSpin"
