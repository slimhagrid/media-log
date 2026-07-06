import { parseUSDate, todayISO } from './dates.js';

export const VERBS = ['purchased', 'consumed', 'keep', 'sell', 'edit', 'remove', 'change', 'a-z', 'empty', 'testmode'];

// natural-language aliases for the universal verb
const VERB_ALIASES = { watched: 'consumed', listened: 'consumed', read: 'consumed' };

const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function splitList(s) {
  return s.split(',').map((t) => t.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

const err = (error) => ({ ok: false, error });

export const HELP_TEXT = [
  'commands:',
  '  log purchased <titles> [--label <labels>] [--date MM-DD-YYYY]',
  '  log consumed  <titles>            tab completes from your library',
  '                (watched, listened and read work too)',
  '  log keep      <titles>',
  '  log sell      <titles>',
  '  log edit      <title> [--title <new>] [--label <new>] [--date MM-DD-YYYY]',
  '  log edit      keep|sell <titles> --swap     flip keep ↔ sell',
  '  log remove    <titles>',
  '  log change    <media>             switch logs, e.g. "log change cd"',
  '  log a-z       on|off [--col 1|2|3]     toggle A–Z sort (all columns, or one)',
  '  log empty                         wipe the active log',
  '  log empty     <media>[, <media>]  wipe one or more other logs',
  '  log empty     --all               wipe every log',
  '  log testmode  on|off              add/remove sample data in every log',
  '  help · clear',
  'titles and labels are comma-separated; labels match title order.'
].join('\n');

export function parse(input) {
  const raw = input.trim();
  if (!raw) return err('');
  if (norm(raw) === 'help') return { ok: true, action: { type: 'help' } };
  if (norm(raw) === 'clear') return { ok: true, action: { type: 'clear' } };

  const m = /^log\s+(\S+)([\s\S]*)$/.exec(raw);
  if (!m) return err(`unknown command "${raw.split(/\s/)[0]}" — try "help"`);

  let verb = m[1].toLowerCase();
  verb = VERB_ALIASES[verb] || verb;
  if (!VERBS.includes(verb)) {
    return err(`unknown subcommand "${m[1]}" — expected purchased, consumed, keep, sell, edit, remove, change, a-z, empty or testmode`);
  }

  if (verb === 'change') {
    const target = m[2].trim();
    if (!target) return err(`which log? try "log change dvd"`);
    return { ok: true, action: { type: 'change', target } };
  }

  if (verb === 'a-z') {
    const rest = m[2].trim();
    const colMatch = /--col\s+(\S+)/i.exec(rest);
    let col = null;
    if (colMatch) {
      const colVal = colMatch[1].trim();
      if (!['1', '2', '3'].includes(colVal)) return err(`--col expects 1, 2 or 3 — got "${colVal}"`);
      col = Number(colVal);
    }
    const target = rest.replace(/--col\s+\S+/i, '').trim().toLowerCase();
    if (target !== 'on' && target !== 'off') return err(`log a-z expects "on" or "off"`);
    return { ok: true, action: { type: 'sort', on: target === 'on', col } };
  }

  if (verb === 'empty') {
    const rest = m[2].trim();
    if (!rest) return { ok: true, action: { type: 'empty', targets: null } }; // null = the active log
    if (rest.toLowerCase() === '--all') return { ok: true, action: { type: 'empty', targets: 'all' } };
    if (rest.startsWith('--')) {
      return err(`unknown flag for "log empty" — try "log empty --all" or "log empty <media>"`);
    }
    const targets = splitList(rest);
    if (!targets.length) return err(`nothing to empty — try "log empty" or "log empty dvd"`);
    return { ok: true, action: { type: 'empty', targets } };
  }

  if (verb === 'testmode') {
    const target = m[2].trim().toLowerCase();
    if (target !== 'on' && target !== 'off') return err(`log testmode expects "on" or "off"`);
    return { ok: true, action: { type: 'testmode', on: target === 'on' } };
  }

  let labelStr = null;
  let dateStr = null;
  let titleStr = null;
  let swap = false;
  const parts = m[2].trim().split(/\s--(?=label\b|date\b|title\b|swap\b)/);
  for (const p of parts.slice(1)) {
    if (p.startsWith('label')) labelStr = p.slice(5).trim();
    else if (p.startsWith('date')) dateStr = p.slice(4).trim();
    else if (p.startsWith('title')) titleStr = p.slice(5).trim();
    else if (p.startsWith('swap')) swap = true;
  }

  if (swap && verb !== 'edit') return err(`--swap only applies to "log edit"`);

  if (labelStr !== null && verb !== 'purchased' && verb !== 'edit') {
    return err(`--label only applies to "log purchased" and "log edit"`);
  }
  if (titleStr !== null && verb !== 'edit') return err(`--title only applies to "log edit"`);
  if (dateStr !== null && verb === 'remove') return err(`--date does not apply to "log remove"`);

  const titles = splitList(parts[0]);
  if (!titles.length) return err(`no titles given — try "log ${verb} Some Title"`);

  let date = null;
  if (dateStr !== null) {
    date = parseUSDate(dateStr);
    if (!date) return err(`invalid date "${dateStr}" — use MM-DD-YYYY`);
  }

  if (verb === 'edit' && swap) {
    if (titleStr !== null || labelStr !== null) return err(`--swap cannot be combined with --title or --label`);
    const sm = /^(keep|sell)\s+([\s\S]+)$/i.exec(parts[0].trim());
    if (!sm) return err(`--swap expects "log edit keep <titles> --swap" or "log edit sell <titles> --swap"`);
    const swapTitles = splitList(sm[2]);
    if (!swapTitles.length) return err(`no titles given to swap`);
    return { ok: true, action: { type: 'swap', from: sm[1].toLowerCase(), titles: swapTitles, date } };
  }

  if (verb === 'edit') {
    if (titles.length > 1) return err(`edit one title at a time`);
    if (titleStr === null && labelStr === null && dateStr === null) {
      return err(`nothing to change — pass --title, --label and/or --date`);
    }
    if (titleStr !== null && !titleStr) return err(`--title needs a value`);
    return { ok: true, action: { type: 'edit', titles, newTitle: titleStr, newLabel: labelStr, date } };
  }

  const labels = labelStr !== null ? splitList(labelStr) : [];
  if (labels.length && labels.length !== titles.length) {
    return err(`label count (${labels.length}) must match title count (${titles.length})`);
  }

  return { ok: true, action: { type: verb, titles, labels, date } };
}

// Resolve a typed title against the library: exact (case-insensitive) first,
// then a unique prefix match.
export function resolveTitle(typed, entries) {
  const n = norm(typed);
  const exact = entries.find((e) => norm(e.title) === n);
  if (exact) return { entry: exact };
  const prefix = entries.filter((e) => norm(e.title).startsWith(n));
  if (prefix.length === 1) return { entry: prefix[0] };
  if (prefix.length > 1) return { error: `"${typed}" is ambiguous: ${prefix.map((e) => e.title).join(', ')}` };
  return { error: `"${typed}" is not in your purchased list` };
}

// Applies a parsed action to state. Returns { lines: [{kind, text}] }.
export function execute(action, state) {
  const today = todayISO();
  const lines = [];
  const ok = (text) => lines.push({ kind: 'ok', text });
  const bad = (text) => lines.push({ kind: 'err', text });

  if (action.type === 'purchased') {
    const date = action.date || today;
    let added = 0;
    action.titles.forEach((title, i) => {
      if (state.entries.some((e) => norm(e.title) === norm(title))) {
        bad(`skipped "${title}" — already in your library`);
        return;
      }
      state.entries.push({
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        title,
        label: action.labels[i] || null,
        purchasedOn: date,
        watchedOn: [],
        status: null,
        statusOn: null
      });
      added++;
    });
    if (added) ok(`logged ${added} purchased (${date})`);
    return { lines, changed: added > 0 };
  }

  if (action.type === 'consumed') {
    const date = action.date || today;
    let changed = false;
    for (const typed of action.titles) {
      const { entry, error } = resolveTitle(typed, state.entries);
      if (error) { bad(error); continue; }
      if (entry.watchedOn.includes(date)) {
        bad(`"${entry.title}" already logged on ${date}`);
        continue;
      }
      entry.watchedOn.push(date);
      entry.watchedOn.sort();
      ok(`consumed "${entry.title}" (${date})`);
      changed = true;
    }
    return { lines, changed };
  }

  if (action.type === 'keep' || action.type === 'sell') {
    const date = action.date || today;
    let changed = false;
    for (const typed of action.titles) {
      const { entry, error } = resolveTitle(typed, state.entries);
      if (error) { bad(error); continue; }
      entry.status = action.type;
      entry.statusOn = date;
      ok(`${action.type} "${entry.title}" (${date})`);
      changed = true;
    }
    return { lines, changed };
  }

  if (action.type === 'edit') {
    const { entry, error } = resolveTitle(action.titles[0], state.entries);
    if (error) { bad(error); return { lines, changed: false }; }
    const changes = [];
    if (action.newTitle !== null) {
      const clash = state.entries.find((e) => e !== entry && norm(e.title) === norm(action.newTitle));
      if (clash) { bad(`"${action.newTitle}" is already in your library`); return { lines, changed: false }; }
      changes.push(`title → ${action.newTitle}`);
      entry.title = action.newTitle;
    }
    if (action.newLabel !== null) {
      entry.label = action.newLabel || null;
      changes.push(action.newLabel ? `label → ${action.newLabel}` : 'label cleared');
    }
    if (action.date !== null) {
      entry.purchasedOn = action.date;
      changes.push(`purchased → ${action.date}`);
    }
    ok(`edited "${action.titles[0]}": ${changes.join(', ')}`);
    return { lines, changed: true };
  }

  if (action.type === 'swap') {
    const to = action.from === 'keep' ? 'sell' : 'keep';
    const date = action.date || today;
    let changed = false;
    for (const typed of action.titles) {
      const { entry, error } = resolveTitle(typed, state.entries);
      if (error) { bad(error); continue; }
      if (entry.status !== action.from) {
        bad(`"${entry.title}" is not marked ${action.from}${entry.status ? ` (currently ${entry.status})` : ''}`);
        continue;
      }
      entry.status = to;
      entry.statusOn = date;
      ok(`swapped "${entry.title}": ${action.from} → ${to}`);
      changed = true;
    }
    return { lines, changed };
  }

  if (action.type === 'remove') {
    let changed = false;
    for (const typed of action.titles) {
      const { entry, error } = resolveTitle(typed, state.entries);
      if (error) { bad(error); continue; }
      state.entries.splice(state.entries.indexOf(entry), 1);
      ok(`removed "${entry.title}" and all its history`);
      changed = true;
    }
    return { lines, changed };
  }

  return { lines, changed: false };
}
