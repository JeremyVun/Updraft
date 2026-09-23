#!/bin/bash
cd /private/tmp/updraft-p-tests
export BASE=http://127.0.0.1:5631/
results=/tmp/updraft-p-tests/nongpu-results.txt
: > "$results"
while IFS= read -r f; do
  name=$(basename "$f" .mjs)
  log="/tmp/updraft-p-tests/nongpu-run/${name}.log"
  start=$(date +%s)
  node "$f" > "$log" 2>&1 &
  pid=$!
  ( sleep 180; kill -TERM "$pid" 2>/dev/null ) &
  watcher=$!
  wait "$pid"
  code=$?
  kill "$watcher" 2>/dev/null
  dur=$(( $(date +%s) - start ))
  echo "$name exit=$code time=${dur}s" >> "$results"
done < /tmp/updraft-p-tests/nongpu-checks.txt
echo DONE >> "$results"
