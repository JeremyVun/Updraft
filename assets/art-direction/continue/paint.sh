#!/bin/zsh
# Repaint one room's title-screen painting from a fresh capture: see README.md.
# Usage: assets/art-direction/continue/paint.sh <room> ["<what to change>"]
set -euo pipefail

room=${1:?room: island washing boats meadow birches stairs drowned wood sleeping sea mirror home}
note=${2:-}
here=${0:A:h}
repo=${here:h:h:h}
base=${BASE:-http://127.0.0.1:5230/}
work=${WORK:-/tmp/updraft-paintings}
current=${CURRENT:-$repo/src/paintings}
stamp=$(date +%Y%m%d-%H%M%S)
[[ -f $here/rooms/$room.txt ]] || { print -u2 "no prompt for $room"; exit 1; }
mkdir -p $work/capture $work/gen $work/out $work/logs

OUT=$work/capture BASE=$base node $repo/tools/chapter-stills.mjs $room

images=($work/capture/$room.png)
attached="(1) a capture from the game, the shot to repaint"
if [[ -f $current/$room-land.webp && -f $current/$room-port.webp ]]; then
  dwebp -quiet $current/$room-land.webp -o $work/capture/$room-current-land.png
  dwebp -quiet $current/$room-port.webp -o $work/capture/$room-current-port.png
  images+=($work/capture/$room-current-land.png $work/capture/$room-current-port.png)
  attached+="; (2) and (3) the current landscape and portrait paintings of this room: keep their composition, light and finish, and follow the capture wherever the room has changed"
fi
if grep -q 'knitted wool sail' $here/rooms/$room.txt; then
  images+=($here/sail-closeup.jpg)
  attached+="; ($#images) a close-up of the boat's knitted sail as the game draws it"
fi

land=gen/$room-land-$stamp.png
port=gen/$room-port-$stamp.png
prompt="$(cat $here/common.txt)

Attached images, in order: $attached.
${note:+Change: $note
}$(cat $here/rooms/$room.txt)
Save to: $land and $port.

When both files are saved, answer with bare JSON only: {\"files\":[{\"path\":...,\"width\":...,\"height\":...}],\"notes\":\"one line\"}"

codex exec -m gpt-6-astra -s workspace-write --skip-git-repo-check -C $work -o $work/logs/$room-$stamp.json \
  -i $images -- "$prompt" < /dev/null > $work/logs/$room-$stamp.log 2>&1
[[ -f $work/$land && -f $work/$port ]] || { print -u2 "Astra did not save both files; see $work/logs/$room-$stamp.log"; exit 1; }

cwebp -quiet -q 78 -sharp_yuv $work/$land -o $work/out/$room-land.webp
cwebp -quiet -q 78 -sharp_yuv $work/$port -o $work/out/$room-port.webp
cwebp -quiet -q 78 -sharp_yuv -resize 400 250 $work/$land -o $work/out/$room.webp
print "Painted $room: $work/$land, $work/$port; encoded in $work/out/. Look at them beside $work/capture/$room.png before installing."
