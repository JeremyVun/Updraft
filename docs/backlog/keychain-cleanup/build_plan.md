# Keychain cleanup: build plan

Read `design.md` in this folder first; it is the spec. This is one careful operation on the Mac's keychain, not a code
change: the lead runs it, with no subagents, in the order below, and stops and reports at the first surprise. Nothing
here touches the repo except the done markers.

Throughout:

```sh
DB="$HOME/Library/Keychains/1B999341-F670-535E-88C1-9E0F8CE3C892/keychain-2.db"
GROUP='EQHXZ8M8AV.com.google.Chrome.unexportable-keys'
BK="$HOME/keychain-backup-$(date +%Y-%m-%d)"
```

Use `/usr/bin/log`, never bare `log`: zsh has a builtin of that name that prints nothing. Read the database only with
`sqlite3 -readonly "file:$DB?mode=ro"` except for the one delete in phase 2. Never print `data` or any other encrypted
column; counts and `agrp` are all the work needs.

## Phase 1: preflight and backup

1. Confirm the facts the design rests on still hold. Each is a single read-only query:
   - every row in `$GROUP` has `sync = 0`, `tomb = 0` and `tkid = 'com.apple.setoken'`;
   - no `ckmirror.UUID` or `currentitems.currentItemUUID` matches a `keys.UUID` in `$GROUP`;
   - `item_backup`, `outgoingqueue` and `incomingqueue` are empty.
   If any fails, stop and report to Jeremy before going further.
2. `mkdir -m 700 "$BK"`, then take the online backup:
   `sqlite3 "$DB" ".timeout 10000" ".backup '$BK/keychain-2.db'"`, and `chmod 600` the file.
3. Snapshot the per-group counts of the live database to `$BK/before.txt`:

   ```sql
   SELECT 'keys', agrp, count(*) FROM keys GROUP BY agrp
   UNION ALL SELECT 'genp', agrp, count(*) FROM genp GROUP BY agrp
   UNION ALL SELECT 'inet', agrp, count(*) FROM inet GROUP BY agrp
   UNION ALL SELECT 'cert', agrp, count(*) FROM cert GROUP BY agrp;
   ```

Verify: `PRAGMA integrity_check` on the backup returns `ok`; the backup's row count in `$GROUP` is within a few of the
live one (Chrome launches add keys as you go); `$BK` and the file are owned by jeremy with modes 700 and 600.

Done: [ ]

## Phase 2: delete and restart

1. Delete in one transaction and print how many rows went:

   ```sh
   sqlite3 "$DB" ".timeout 10000" "BEGIN IMMEDIATE; DELETE FROM keys WHERE agrp = '$GROUP'; SELECT changes(); COMMIT;"
   ```

   If SQLite refuses to write (`readonly database`, `operation not permitted`), macOS privacy controls are blocking the
   terminal: stop and tell Jeremy, who can grant the terminal Full Disk Access. Do not work around it.
2. `launchctl kickstart -k gui/501/com.apple.secd`, then confirm a new `secd` PID with `pgrep -x secd`.

Verify:
- `$GROUP` holds 0 rows, or only the handful a Chrome launch added after the delete.
- Every other group's count matches `$BK/before.txt`. A small difference in a group some app writes to (for example
  `com.apple.CoreSimulator`) is expected if time passed; a missing group or a large drop is not, and calls for the
  restore in design.md (Backup and restore).
- `PRAGMA integrity_check` on the live database (read-only) returns `ok`.
- One headless launch of the installed Google Chrome with a fresh `--user-data-dir` makes `secd` log
  `Returning <n> items … $GROUP` with `n` in single digits, and `top` shows `secd` and `ctkd` near idle afterwards.
- `/usr/bin/log show --last 10m --predicate 'process == "secd"'` shows no `SQLITE_CORRUPT`, `corrupt` or `malformed`.

Tell Jeremy the rows deleted, the before and after `secd` CPU, and ask him to use the Mac as normal (logins, Wi-Fi,
iCloud Keychain, Safari autofill, apps) before phase 3.

Done: [ ]

## Phase 3: drop the backup

Only after Jeremy confirms the Mac behaves normally: `rm -rf "$HOME/keychain-backup-<date>"` by its literal absolute
path. If he reports a problem first, restore from the backup as design.md describes, restart `secd`, and report.

Done: [ ]
