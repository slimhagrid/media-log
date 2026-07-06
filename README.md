# [ MEDIALOG ] — demo build

A static, browser-only demo of MEDIALOG. Three contribution grids — purchased,
consumed, keep/sell — covering the last 365 days, driven by a git-style
terminal that slides in from the right when you press the **←** key.

This is the `no-server` branch: no backend, no build step, just the
`public/` folder served as static files (e.g. on Vercel). There's no server
to write to — every log lives entirely in **your browser's localStorage**.
Nothing is sent anywhere, and nothing is shared between devices or browsers.
See the main branch for the self-hosted version that persists to
real JSON files on disk.

The first time you open a log, it boots pre-populated with sample data (the
same set `log testmode on` uses) so there's always something to look at.
Everything you type is real and persists in your browser, exactly like the
self-hosted version — it just doesn't leave your device.

Thirteen logs across three categories:

- **Watch** — blu (default), dvd, 4k, vhs, laserdisc, betamax, hddvd
- **Listen** — cd, vinyl, cassette, 8track
- **Read** — book, manga

The middle column's heading adapts: WATCHED, LISTENED, or READ.

## Run it

Deploy `public/` to any static host — on Vercel this repo already has a
`vercel.json` pointing at it, so pushing this branch is enough.

For local preview: `vercel dev`, or serve `public/` with any static file
server (the ES module scripts need to be loaded over http, not `file://`).
There's no `npm start` here since there's nothing to run — no dependencies,
no build.

## Commands

Press **←** (or tap `[ >_ ]`) to open the terminal.

```
log purchased <titles> [--label <labels>] [--date MM-DD-YYYY]
log consumed  <titles>
log keep      <titles>
log sell      <titles>
log edit      <title> [--title <new>] [--label <new>] [--date MM-DD-YYYY]
log edit      keep|sell <titles> --swap
log remove    <titles>
log change    <media>
log a-z       on|off [--col 1|2|3]
log empty
log empty     <media>[, <media>]
log empty     --all
log testmode  on|off
help
clear
```

- `log consumed` is the universal verb for watching / listening / reading;
  `log watched`, `log listened`, and `log read` are accepted as aliases.
- `log change dvd` (or `cd`, `vinyl`, `manga`, …) switches which log is shown.
  You can also click the `[ BLULOG ]` chip in the subhead for a menu.
- `log a-z on` / `log a-z off` toggles the A–Z sort tag on all three columns
  at once — the same toggle as clicking each column's `A–Z` tag by hand.
  Add `--col 1|2|3` to target just one column (1 = Purchased, 2 = the middle
  consumed column, 3 = Keep/Sell), e.g. `log a-z on --col 2`.
- Titles and labels are comma-separated; labels match title order.
- For title commands, **Tab** completes from the active log's purchased list —
  after each comma, like directory completion in a shell.
- Entries are stamped with the current date unless you pass `--date`.
- `log edit` changes one title at a time; `--label` with an empty value clears the label.
- `log edit keep <titles> --swap` flips titles currently marked keep to sell
  (and `log edit sell <titles> --swap` the other way).
- `log remove` deletes a title and all of its history.
- The `[ YYYY ]` chip in the subhead opens a dropdown listing only years present
  in the active log's data — the same picker pattern as the log switcher.
  The current year shows the rolling last 365 days, past years Jan 1 – Dec 31.
- Clicking a `×n` count tag in the middle list unfolds all dates for that title,
  opens the year picker with those years highlighted, and lets you click a date
  to jump straight to that year; click the tag again to reset.
- `log empty` wipes every entry from the active log. `log empty dvd, cd` wipes
  specific other logs by name (comma-separated, aliases work) without switching
  to them. `log empty --all` wipes every log. There's no undo — localStorage is
  overwritten immediately.
- `log testmode on` drops a set of sample titles into every log at once (this
  is also what happens automatically the first time you ever open a log).
  `log testmode off` removes exactly those sample entries again — anything you
  added yourself (even while test mode was on) is left alone, since sample
  entries are tagged internally and real ones never are.

## Keyboard

- **←** — open terminal · **→** (at the end of the line) or **Esc** — close
- **Tab** — complete command / title / media name
- **↑ / ↓** in terminal — command history
- Grid squares are focusable: arrow keys move between days, **Enter** filters
  the column's list to that day.
- The log picker and year picker menus are arrow-key navigable; **Esc** closes them.
- The `[ >_ ]` button and the `×` badge in the terminal's top-right corner both
  open/close it — handy on touch devices where there's no arrow keys.
