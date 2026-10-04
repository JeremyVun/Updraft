# Keychain cleanup: Chrome's leftover keys

Remove the tens of thousands of signing keys Google Chrome left in this Mac's keychain, after taking a backup that can
put the keychain back exactly as it was.

## Jeremy's brief

> can you remove all those leftover keys? this seems insane to me.

> do the prevention bit first for now

> create a backlog item for the deletiong of the leftover keys with a backup first

## Why

Every launch of the installed Google Chrome with a fresh profile writes one or two hardware-backed signing keys into
the keychain group `EQHXZ8M8AV.com.google.Chrome.unexportable-keys`. Chrome only cleans up keys for profiles it can
still find, and the QA tools threw their profile away after every run, so the keys never went. On 2026-10-04 there were
36,134 of them out of 36,345 rows in the keychain's `keys` table, growing about 5 a minute while peer sessions ran
captures.

At every start Chrome lists all of its keys, twice. `secd` (the keychain daemon) has to decrypt every row in the group
to answer, and `ctkd` (which handles hardware-backed keys) works alongside it, so the pair ran at 75–190% CPU for the
whole machine. Each key Chrome deletes for itself costs another full pass, which is why deleting them through Chrome
does not work: on 2026-10-04, `chrome://unexportable-keys-internals`' own `deleteKey` deleted about 100 keys in
20 minutes, which works out to weeks for all of them.

Prevention shipped first (58d0cf8, 2026-10-04): every browser tool now launches Playwright's Chrome for Testing
(`channel: 'chromium'`), which is ad-hoc signed and so cannot write to Google's keychain groups at all. This item
clears what was left behind.

## Mechanism

The keychain is the SQLite database `~/Library/Keychains/1B999341-F670-535E-88C1-9E0F8CE3C892/keychain-2.db` (WAL
mode, 185 MB, of which almost all is these rows). The access group is stored in plain text in the `agrp` column, so the
rows can be selected without decrypting anything:

```sql
DELETE FROM keys WHERE agrp = 'EQHXZ8M8AV.com.google.Chrome.unexportable-keys';
```

What was checked read-only on 2026-10-04, and why it makes the delete safe:

- Every row in the group has `sync = 0`, `tomb = 0`, `tkid = 'com.apple.setoken'`: local-only Secure Enclave keys.
  iCloud Keychain never saw them, so no tombstones are needed and nothing syncs to other devices.
- No row in the sync tables (`ckmirror`, `currentitems`) points at any of them by `UUID`. `item_backup`,
  `outgoingqueue` and `incomingqueue` are empty.
- A Secure Enclave key lives entirely in its keychain row: the enclave holds no separate copy, so deleting the row
  removes the key.
- Chrome's other keychain entries are a different group (`EQHXZ8M8AV.com.google.common.folsom`, 5 rows in `genp`) and
  are not touched.
- Jeremy's everyday Chrome profile is not signed in to Google, so no live session depends on any of these keys. If a
  running Chrome finds its key gone, it makes a new one.

The delete goes through SQLite's own locking (`sqlite3` with a busy timeout) while `secd` runs, then `secd` is
restarted (`launchctl kickstart -k gui/501/com.apple.secd`) so it drops anything it had cached. `secd` checks its own
free pages and vacuums when it needs to (it logs `vacuum not needed page_count … free_count …`), so the cleanup does
not run `VACUUM` itself.

### Backup and restore

The backup is SQLite's online backup of the live database (`sqlite3 "$DB" ".backup '<file>'"`), which is consistent
even with the WAL in use and `secd` writing. It goes in `~/keychain-backup-<date>/` with mode 700. The rows in it are
still encrypted by this Mac's keybag, so the copy is no more readable than the original, but it holds every keychain
item and is treated like the keychain itself: never copied off the machine.

Restoring goes the same way in reverse, through SQLite's locking into the live file, then restarts `secd`:

```sh
sqlite3 "$DB" ".timeout 10000" ".restore '<backup>/keychain-2.db'"
launchctl kickstart -k gui/501/com.apple.secd
```

## Decisions

- Prevention first, deletion second (Jeremy, 2026-10-04).
- Delete with a backup first (Jeremy, 2026-10-04).
- Delete straight from the database instead of through Chrome, because Chrome's delete costs a full pass per key
  (measured 2026-10-04, see Why).
- Delete the whole group, not just keys older than some date: nothing of Jeremy's depends on any of them, and the
  database does not show which profile each key belongs to.
- Keep the backup until Jeremy confirms the Mac behaves normally (logins, Wi-Fi, iCloud Keychain, apps), then delete
  it. It holds every keychain item, so it should not linger.

## Rejected

- Deleting through Chrome (`chrome://unexportable-keys-internals`): one full pass per key, weeks of runtime.
- Resetting the keychain: destroys every password and certificate to remove one group.
- A Chrome flag that stops the keys: none could be shown to work. Each test window had a peer's Chrome launch in it,
  and others with the same problem found `--use-mock-keychain` (already passed) does not stop it. Chrome for Testing
  cannot write the group at all, which makes a flag unnecessary.

## What remains outside this item

Other projects on this Mac that launch the installed Google Chrome with throwaway profiles add keys the same way
(simtower did on 2026-10-04). They need the same `channel: 'chromium'` change. Until they have it, a later cleanup
may be needed; the build plan's phase 2 commands can be rerun as they stand.
