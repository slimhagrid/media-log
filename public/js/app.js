import { humanDate, todayISO } from './dates.js';
import { renderCalendar } from './grid.js';
import { parse, execute, HELP_TEXT, VERBS } from './parser.js';
import { CATEGORIES, ALL_MEDIA, DEFAULT_MEDIA, findMedia } from './media.js';
import { loadEntries, saveEntries, setTestMode } from './store.js';

const $ = (id) => document.getElementById(id);

let media = findMedia(localStorage.getItem('medialog-media')) || findMedia(DEFAULT_MEDIA);
const state = { entries: [], year: null }; // year null = rolling last 365 days
const filters = { purchased: null, watched: null, verdict: null };
const ui = {
  watchFocus: null,
  highlightYears: null,
  sortAZ: { purchased: false, watched: false, verdict: false },
  page: { purchased: 0, watched: 0, verdict: 0 }
};

const PAGE_SIZE = 10;

/* ── persistence — everything lives in this browser's localStorage ──── */

async function load() {
  state.entries = loadEntries(media.id);
}

async function save() {
  saveEntries(media.id, state.entries);
}

async function switchMedia(next) {
  media = next;
  localStorage.setItem('medialog-media', media.id);
  state.year = null;
  filters.purchased = filters.watched = filters.verdict = null;
  ui.watchFocus = null;
  ui.highlightYears = null;
  closeYearMenu();
  ui.page = { purchased: 0, watched: 0, verdict: 0 };
  await load();
  renderAll();
}

/* ── derived data ───────────────────────────────────────── */

function countsByDay() {
  const purchased = new Map();
  const watched = new Map();
  const verdict = new Map(); // iso -> {keep, sell}
  for (const e of state.entries) {
    purchased.set(e.purchasedOn, (purchased.get(e.purchasedOn) || 0) + 1);
    for (const d of e.watchedOn) watched.set(d, (watched.get(d) || 0) + 1);
    if (e.status && e.statusOn) {
      const v = verdict.get(e.statusOn) || { keep: 0, sell: 0 };
      v[e.status]++;
      verdict.set(e.statusOn, v);
    }
  }
  return { purchased, watched, verdict };
}

const intensity = (n) => (n >= 4 ? 'p4' : n === 3 ? 'p3' : n === 2 ? 'p2' : n === 1 ? 'p1' : '');

// Only years that actually appear in the data, plus the current year.
function yearsInData() {
  const years = new Set([new Date().getFullYear()]);
  for (const e of state.entries) {
    const dates = [e.purchasedOn, e.statusOn, ...e.watchedOn].filter(Boolean);
    for (const d of dates) years.add(Number(d.slice(0, 4)));
  }
  return [...years].sort((a, b) => a - b);
}

/* ── rendering ──────────────────────────────────────────── */

function li(parts) {
  const item = document.createElement('li');
  const title = document.createElement('span');
  title.className = 'li-title';
  title.textContent = parts.title;
  item.appendChild(title);
  if (parts.tag) {
    const tag = document.createElement(parts.tagAction ? 'button' : 'span');
    tag.className = 'li-tag' + (parts.tagClass ? ' ' + parts.tagClass : '');
    tag.textContent = parts.tag;
    if (parts.tagAction) {
      tag.type = 'button';
      tag.setAttribute('aria-pressed', String(Boolean(parts.tagPressed)));
      if (parts.tagLabel) tag.setAttribute('aria-label', parts.tagLabel);
      tag.addEventListener('click', parts.tagAction);
    }
    item.appendChild(tag);
  }
  if (parts.metaDates) {
    item.classList.add('has-dates');
    const col = document.createElement('span');
    col.className = 'li-meta li-dates';
    for (const d of parts.metaDates) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'li-date';
      btn.textContent = d.date;
      btn.setAttribute('aria-pressed', String(Boolean(d.active)));
      btn.setAttribute('aria-label', `${media.category.verb} ${d.date} — show year ${d.date.slice(0, 4)}`);
      btn.addEventListener('click', d.onClick);
      col.appendChild(btn);
    }
    item.appendChild(col);
  } else if (parts.meta) {
    const meta = document.createElement('span');
    meta.className = 'li-meta';
    meta.textContent = parts.meta;
    item.appendChild(meta);
  }
  return item;
}

function renderList(el, items) {
  el.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'nothing logged yet';
    el.appendChild(empty);
    return;
  }
  for (const it of items) el.appendChild(li(it));
}

// sorts (if A–Z is on), slices the current page, and renders list + pager
function renderPagedList(key, items) {
  if (ui.sortAZ[key]) {
    items = [...items].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  if (ui.page[key] >= pages) ui.page[key] = pages - 1;
  const page = ui.page[key];
  renderList($(`list-${key === 'verdict' ? 'verdict' : key}`), items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));

  $(`sort-${key}`).setAttribute('aria-pressed', String(ui.sortAZ[key]));

  const pager = $(`pager-${key}`);
  pager.hidden = pages <= 1;
  pager.innerHTML = '';
  if (pages <= 1) return;

  const nav = (label, target, disabled, aria) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.disabled = disabled;
    btn.setAttribute('aria-label', aria);
    btn.addEventListener('click', () => { ui.page[key] = target; renderAll(); });
    return btn;
  };
  const label = document.createElement('span');
  label.textContent = `${page + 1}/${pages}`;
  pager.append(
    nav('[ ‹ ]', page - 1, page === 0, 'Previous page'),
    label,
    nav('[ › ]', page + 1, page === pages - 1, 'Next page')
  );
}

function renderFilterChip(el, iso, clear) {
  if (!iso) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '';
  const label = document.createElement('span');
  label.textContent = humanDate(iso);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '[ clear ]';
  btn.setAttribute('aria-label', 'Clear date filter');
  btn.addEventListener('click', clear);
  el.append(label, btn);
}

function toggleWatchFocus(entry) {
  if (ui.watchFocus === entry.id) {
    ui.watchFocus = null;
    ui.highlightYears = null;
    closeYearMenu();
    state.year = null; // back to default: current year, rolling window
  } else {
    ui.watchFocus = entry.id;
    ui.highlightYears = new Set(entry.watchedOn.map((d) => Number(d.slice(0, 4))));
    openYearMenu({ focus: false }); // surface which years just lit up without stealing focus
  }
  renderAll();
}

function renderAll() {
  const meta = $('today-label');
  meta.textContent = state.year === null
    ? humanDate(todayISO())
    : `JAN 1 – DEC 31, ${state.year}`;
  document.querySelector('.masthead-meta').firstChild.textContent =
    state.year === null ? 'LAST 365 DAYS · ' : 'FULL YEAR · ';
  $('year-chip').textContent = `[ ${state.year === null ? new Date().getFullYear() : state.year} ]`;
  if (!yearMenu.hidden) renderYearMenu(); // keep an open menu's highlights/current mark live
  const { purchased, watched, verdict } = countsByDay();

  // stats
  const total = state.entries.length;
  const watchedCount = state.entries.filter((e) => e.watchedOn.length > 0).length;
  const keepCount = state.entries.filter((e) => e.status === 'keep').length;
  const sellCount = state.entries.filter((e) => e.status === 'sell').length;
  $('stat-purchased').textContent = `TOTAL ${total}`;
  $('stat-watched').textContent = `${media.category.verb} ${watchedCount}/${total}`;
  $('stat-verdict').textContent = `KEEP ${keepCount} · SELL ${sellCount}`;

  // per-media labels
  $('media-chip').textContent = `[ ${media.chip} ]`;
  $('t-prompt').textContent = `${media.chip} ▸`;
  $('t-chrome-log').textContent = `[ ${media.chip} ]`;
  $('h-watched').innerHTML =
    `<span class="bracket">[</span> ${media.category.verb} <span class="bracket">]</span>`;
  $('head-consumed-dates').textContent = media.category.dateHead;
  $('list-watched').setAttribute('aria-label', `${media.category.verb.toLowerCase()} titles`);

  // calendars
  const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;
  renderCalendar($('cal-purchased'), {
    year: state.year,
    selected: filters.purchased,
    classFor: (iso) => intensity(purchased.get(iso) || 0),
    labelFor: (iso) => plural(purchased.get(iso) || 0, ['purchase', 'purchases']),
    onSelect: (iso) => { filters.purchased = iso; renderAll(); }
  });
  renderCalendar($('cal-watched'), {
    year: state.year,
    selected: filters.watched,
    classFor: (iso) => intensity(watched.get(iso) || 0),
    labelFor: (iso) => plural(watched.get(iso) || 0, media.category.noun),
    onSelect: (iso) => { filters.watched = iso; renderAll(); }
  });
  renderCalendar($('cal-verdict'), {
    year: state.year,
    selected: filters.verdict,
    classFor: (iso) => {
      const v = verdict.get(iso);
      if (!v) return '';
      if (v.keep && v.sell) return 'v-both';
      return v.keep ? 'v-keep' : 'v-sell';
    },
    labelFor: (iso) => {
      const v = verdict.get(iso);
      return v ? `${v.keep} keep, ${v.sell} sell` : 'no verdicts';
    },
    onSelect: (iso) => { filters.verdict = iso; renderAll(); }
  });

  // filter chips
  renderFilterChip($('filter-purchased'), filters.purchased, () => { filters.purchased = null; renderAll(); });
  renderFilterChip($('filter-watched'), filters.watched, () => { filters.watched = null; renderAll(); });
  renderFilterChip($('filter-verdict'), filters.verdict, () => { filters.verdict = null; renderAll(); });

  // lists
  const byNewest = (a, b) => (a < b ? 1 : a > b ? -1 : 0);

  // unsorted = the order the user added titles (array order in the JSON)
  const purchasedItems = state.entries
    .filter((e) => !filters.purchased || e.purchasedOn === filters.purchased)
    .map((e) => ({ title: e.title, tag: e.label || null, meta: e.purchasedOn }));
  renderPagedList('purchased', purchasedItems);

  const watchedItems = state.entries
    .filter((e) => e.watchedOn.length > 0)
    .filter((e) => !filters.watched || e.watchedOn.includes(filters.watched))
    .sort((a, b) => byNewest(a.watchedOn.at(-1), b.watchedOn.at(-1)))
    .map((e) => {
      const focused = ui.watchFocus === e.id;
      const currentYear = new Date().getFullYear();
      const selectedYear = state.year === null ? currentYear : state.year;
      return {
        title: e.title,
        tag: e.watchedOn.length > 1 ? `×${e.watchedOn.length}` : null,
        tagAction: e.watchedOn.length > 1 ? () => toggleWatchFocus(e) : null,
        tagPressed: focused,
        tagLabel: `${media.category.verb} ${e.watchedOn.length} times — highlight those years`,
        meta: focused ? null : e.watchedOn.at(-1),
        metaDates: focused
          ? [...e.watchedOn].reverse().map((d) => ({
              date: d,
              active: Number(d.slice(0, 4)) === selectedYear,
              onClick: () => {
                const y = Number(d.slice(0, 4));
                state.year = y === currentYear ? null : y;
                filters.purchased = filters.watched = filters.verdict = null;
                renderAll();
              }
            }))
          : null
      };
    });
  renderPagedList('watched', watchedItems);

  const verdictItems = state.entries
    .filter((e) => e.status)
    .filter((e) => !filters.verdict || e.statusOn === filters.verdict)
    .sort((a, b) => byNewest(a.statusOn, b.statusOn))
    .map((e) => ({
      title: e.title,
      tag: e.status.toUpperCase(),
      tagClass: e.status === 'keep' ? 't-keep' : 't-sell',
      meta: e.statusOn
    }));
  renderPagedList('verdict', verdictItems);
}

/* ── terminal ───────────────────────────────────────────── */

const terminal = $('terminal');
const input = $('t-input');
const out = $('t-out');
const suggest = $('t-suggest');
const toggle = $('t-toggle');
const closeBtn = $('t-close');

let history = JSON.parse(localStorage.getItem('blulog-history') || '[]');
let historyIdx = history.length;
let draft = '';

let booted = false;

function bootSequence() {
  if (booted) return;
  booted = true;
  const line = document.createElement('div');
  line.className = 't-ok';
  out.appendChild(line);
  const msg = `MEDIA·LOG SHELL — ${ALL_MEDIA.length} logs mounted · type "help" for commands`;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    line.textContent = msg;
    return;
  }
  const start = performance.now();
  const tick = setInterval(() => {
    const n = Math.min(msg.length, Math.floor((performance.now() - start) / 16));
    line.textContent = msg.slice(0, n);
    out.scrollTop = out.scrollHeight;
    if (n >= msg.length) clearInterval(tick);
  }, 16);
}

function openTerminal() {
  terminal.classList.add('open');
  toggle.setAttribute('aria-expanded', 'true');
  bootSequence();
  input.focus();
  syncCursor();
}

function closeTerminal() {
  terminal.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
  input.blur();
}

function print(kind, text) {
  const div = document.createElement('div');
  div.className = `t-${kind}`;
  div.textContent = text;
  out.appendChild(div);
  while (out.children.length > 40) out.removeChild(out.firstChild);
  out.scrollTop = out.scrollHeight;
  if (kind === 'err') {
    const line = terminal.querySelector('.t-line');
    line.classList.remove('shake');
    void line.offsetWidth; // restart the animation
    line.classList.add('shake');
  }
}

/* block cursor: mirror the text before the caret to find its x position */
const cursorEl = $('t-cursor');
const mirror = $('t-mirror');

function syncCursor() {
  const caret = input.selectionStart ?? input.value.length;
  mirror.textContent = input.value.slice(0, caret);
  cursorEl.style.transform = `translateX(${mirror.offsetWidth - input.scrollLeft}px)`;
}

for (const ev of ['input', 'click', 'focus', 'keyup', 'select']) {
  input.addEventListener(ev, syncCursor);
}

async function run(raw) {
  print('echo', `▸ ${raw}`);
  const parsed = parse(raw);
  if (!parsed.ok) {
    if (parsed.error) print('err', parsed.error);
    return;
  }
  if (parsed.action.type === 'help') { print('ok', HELP_TEXT); return; }
  if (parsed.action.type === 'clear') { out.innerHTML = ''; return; }
  if (parsed.action.type === 'change') {
    const target = findMedia(parsed.action.target);
    if (!target) {
      print('err', `unknown log "${parsed.action.target}" — options: ${ALL_MEDIA.map((x) => x.id).join(', ')}`);
      return;
    }
    if (target.id === media.id) { print('ok', `already on ${target.chip}`); return; }
    await switchMedia(target);
    print('ok', `switched to ${target.chip}`);
    return;
  }
  if (parsed.action.type === 'sort') {
    const COL_KEYS = ['purchased', 'watched', 'verdict'];
    const COL_LABELS = { purchased: 'Purchased', watched: media.category.verb, verdict: 'Keep/Sell' };
    const keys = parsed.action.col ? [COL_KEYS[parsed.action.col - 1]] : COL_KEYS;
    for (const key of keys) {
      ui.sortAZ[key] = parsed.action.on;
      ui.page[key] = 0;
    }
    renderAll();
    const scope = parsed.action.col
      ? `column ${parsed.action.col} (${COL_LABELS[keys[0]]})`
      : 'every column';
    print('ok', `A–Z sort ${parsed.action.on ? 'on' : 'off'} for ${scope}`);
    return;
  }
  if (parsed.action.type === 'empty') {
    const { targets } = parsed.action;
    let list;
    if (targets === 'all') {
      list = ALL_MEDIA;
    } else if (targets === null) {
      list = [media];
    } else {
      list = [];
      for (const t of targets) {
        const found = findMedia(t);
        if (!found) {
          print('err', `unknown log "${t}" — options: ${ALL_MEDIA.map((x) => x.id).join(', ')}`);
          continue;
        }
        list.push(found);
      }
      if (!list.length) return;
    }

    for (const target of list) {
      try {
        let count;
        if (target.id === media.id) {
          count = state.entries.length;
          state.entries = [];
          await save();
        } else {
          const existing = loadEntries(target.id);
          count = existing.length;
          saveEntries(target.id, []);
        }
        print('ok', `emptied ${target.chip} — removed ${count} ${count === 1 ? 'entry' : 'entries'}`);
      } catch {
        print('err', `could not clear ${target.chip} — your browser storage may be full or blocked`);
      }
    }
    renderAll();
    return;
  }
  if (parsed.action.type === 'testmode') {
    try {
      const results = setTestMode(parsed.action.on, ALL_MEDIA.map((m) => m.id));
      await load(); // pick up whatever just changed for the active log
      renderAll();
      const total = Object.values(results).reduce((a, b) => a + b, 0);
      print('ok', parsed.action.on
        ? `test mode on — added ${total} sample entries across ${ALL_MEDIA.length} logs`
        : `test mode off — removed ${total} sample entries across ${ALL_MEDIA.length} logs`);
    } catch {
      print('err', 'could not toggle test mode — your browser storage may be full or blocked');
    }
    return;
  }

  const { lines, changed } = execute(parsed.action, state);
  for (const l of lines) print(l.kind, l.text);
  if (changed) {
    try {
      await save();
      renderAll();
    } catch {
      print('err', `could not save "${media.chip}" — your browser storage may be full or blocked`);
    }
  }
}

/* tab completion */
function complete() {
  const value = input.value;

  // complete "log"
  let m = /^(l|lo|log)$/i.exec(value.trim());
  if (m && value.trim() === value.trimStart()) {
    input.value = 'log ';
    suggest.textContent = '';
    return;
  }

  // complete the verb
  m = /^(log\s+)(\S*)$/i.exec(value);
  if (m) {
    const matches = VERBS.filter((v) => v.startsWith(m[2].toLowerCase()));
    if (matches.length === 1) {
      input.value = m[1] + matches[0] + ' ';
      suggest.textContent = '';
    } else if (matches.length > 1) {
      suggest.textContent = matches.join('   ');
    }
    return;
  }

  // complete media names for "log change"
  m = /^(log\s+change\s+)(\S*)$/i.exec(value);
  if (m) {
    const bank = ALL_MEDIA.map((x) => x.id);
    const matches = bank.filter((id) => id.startsWith(m[2].toLowerCase()));
    if (matches.length === 1) {
      input.value = m[1] + matches[0];
      suggest.textContent = '';
    } else if (matches.length > 1) {
      suggest.textContent = matches.join('   ');
    } else {
      suggest.textContent = `no log matches "${m[2]}"`;
    }
    return;
  }

  // complete media names (or --all) for "log empty", comma-separated
  m = /^(log\s+empty\s+)([\s\S]*)$/i.exec(value);
  if (m) {
    const head = m[1];
    const body = m[2];
    if (body.trimStart().startsWith('-')) {
      const typed = body.trimStart();
      if ('--all'.startsWith(typed.toLowerCase())) {
        input.value = head + '--all';
        suggest.textContent = '';
      }
      return;
    }
    const segments = body.split(',');
    const current = segments.pop();
    const typed = current.trimStart();
    const lead = current.slice(0, current.length - typed.length);
    const bank = ALL_MEDIA.map((x) => x.id);
    const matches = bank.filter((id) => id.startsWith(typed.toLowerCase()));
    if (!matches.length) {
      suggest.textContent = typed ? `no log matches "${typed}"` : '--all, or a log id (dvd, cd, vinyl…)';
      return;
    }
    if (matches.length === 1) {
      segments.push(lead + matches[0]);
      input.value = head + segments.join(',');
      suggest.textContent = '';
      return;
    }
    let prefix = matches[0];
    for (const t of matches.slice(1)) {
      let i = 0;
      while (i < prefix.length && i < t.length && prefix[i] === t[i]) i++;
      prefix = prefix.slice(0, i);
    }
    if (prefix.length > typed.length) {
      segments.push(lead + prefix);
      input.value = head + segments.join(',');
    }
    suggest.textContent = matches.join('   ');
    return;
  }

  // complete on/off for "log a-z" and "log testmode"
  m = /^(log\s+(?:a-z|testmode)\s+)(\S*)$/i.exec(value);
  if (m) {
    const matches = ['on', 'off'].filter((v) => v.startsWith(m[2].toLowerCase()));
    if (matches.length === 1) {
      input.value = m[1] + matches[0];
      suggest.textContent = '';
    } else if (matches.length > 1) {
      suggest.textContent = matches.join('   ');
    }
    return;
  }

  // complete "--col" for "log a-z on|off "
  m = /^(log\s+a-z\s+(?:on|off)\s+)(\S*)$/i.exec(value);
  if (m) {
    if (!m[2] || '--col'.startsWith(m[2].toLowerCase())) {
      if (m[2]) { input.value = m[1] + '--col '; suggest.textContent = ''; }
      else suggest.textContent = '--col';
    }
    return;
  }

  // complete the column number for "log a-z on|off --col"
  m = /^(log\s+a-z\s+(?:on|off)\s+--col\s+)(\S*)$/i.exec(value);
  if (m) {
    const matches = ['1', '2', '3'].filter((v) => v.startsWith(m[2]));
    if (matches.length === 1) {
      input.value = m[1] + matches[0];
      suggest.textContent = '';
    } else if (matches.length > 1) {
      suggest.textContent = matches.join('   ');
    }
    return;
  }

  // complete titles for consumed / keep / sell / edit / remove, per comma segment
  m = /^(log\s+(?:consumed|watched|listened|read|keep|sell|remove|edit(?:\s+(?:keep|sell))?)\s+)([\s\S]*)$/i.exec(value);
  if (!m) return;
  if (/\s--\S*$|\s--\S+\s/.test(m[2])) return; // past a --flag, nothing to complete
  const head = m[1];
  const segments = m[2].split(',');
  const current = segments.pop();
  const typed = current.trimStart();
  const lead = current.slice(0, current.length - typed.length);

  const bank = state.entries.map((e) => e.title);
  const matches = bank.filter((t) => t.toLowerCase().startsWith(typed.toLowerCase()));

  if (!matches.length) {
    suggest.textContent = typed ? `no matches for "${typed}"` : 'your purchased list is empty';
    return;
  }

  if (matches.length === 1) {
    segments.push(lead + matches[0]);
    input.value = head + segments.join(',');
    suggest.textContent = '';
    return;
  }

  // extend to the longest common prefix, show candidates
  let prefix = matches[0];
  for (const t of matches.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < t.length && prefix[i].toLowerCase() === t[i].toLowerCase()) i++;
    prefix = prefix.slice(0, i);
  }
  if (prefix.length > typed.length) {
    segments.push(lead + prefix);
    input.value = head + segments.join(',');
  }
  suggest.textContent = matches.join('   ');
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    complete();
    return;
  }
  if (e.key === 'Enter') {
    const raw = input.value.trim();
    if (!raw) return;
    history.push(raw);
    if (history.length > 200) history = history.slice(-200);
    localStorage.setItem('blulog-history', JSON.stringify(history));
    historyIdx = history.length;
    input.value = '';
    suggest.textContent = '';
    run(raw);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIdx === history.length) draft = input.value;
    if (historyIdx > 0) { historyIdx--; input.value = history[historyIdx]; }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIdx < history.length) {
      historyIdx++;
      input.value = historyIdx === history.length ? draft : history[historyIdx];
    }
    return;
  }
  if (e.key === 'ArrowRight') {
    // at the end of the line with nothing selected, → pushes the terminal away
    const atEnd = input.selectionStart === input.value.length && input.selectionStart === input.selectionEnd;
    if (atEnd) {
      e.preventDefault();
      closeTerminal();
    }
    return;
  }
  if (e.key === 'Escape') {
    closeTerminal();
  }
});

input.addEventListener('input', () => { suggest.textContent = ''; });

toggle.addEventListener('click', () => {
  terminal.classList.contains('open') ? closeTerminal() : openTerminal();
});

closeBtn.addEventListener('click', closeTerminal);

document.addEventListener('keydown', (e) => {
  const open = terminal.classList.contains('open');
  if (e.key === 'Escape' && open) {
    closeTerminal();
    return;
  }
  const t = e.target;
  const inWidget = t.closest && t.closest('input, textarea, select, .cal-grid, .media-menu, .year-menu');
  if (e.key === 'ArrowLeft' && !open && !inWidget) {
    e.preventDefault();
    openTerminal();
    return;
  }
  if (e.key === 'ArrowRight' && open && !inWidget) {
    e.preventDefault();
    closeTerminal();
  }
});

/* ── media picker ───────────────────────────────────────── */

const mediaChip = $('media-chip');
const mediaMenu = $('media-menu');

function renderMediaMenu() {
  mediaMenu.innerHTML = '';
  for (const cat of CATEGORIES) {
    const group = document.createElement('div');
    group.className = 'media-group';
    const label = document.createElement('div');
    label.className = 'media-group-label';
    label.textContent = cat.label;
    group.appendChild(label);
    for (const item of cat.items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'media-item';
      btn.setAttribute('role', 'menuitem');
      const current = item.id === media.id;
      btn.setAttribute('aria-current', String(current));
      btn.textContent = `${current ? '▸' : ' '} ${item.menu.toLowerCase()}`;
      btn.addEventListener('click', () => {
        closeMediaMenu();
        switchMedia({ ...item, category: cat });
      });
      group.appendChild(btn);
    }
    mediaMenu.appendChild(group);
  }
}

function openMediaMenu() {
  renderMediaMenu();
  mediaMenu.hidden = false;
  mediaChip.setAttribute('aria-expanded', 'true');
  const first = mediaMenu.querySelector('.media-item[aria-current="true"]') || mediaMenu.querySelector('.media-item');
  if (first) first.focus();
}

function closeMediaMenu() {
  mediaMenu.hidden = true;
  mediaChip.setAttribute('aria-expanded', 'false');
}

mediaChip.addEventListener('click', () => {
  mediaMenu.hidden ? openMediaMenu() : closeMediaMenu();
});

document.addEventListener('click', (e) => {
  if (!mediaMenu.hidden && !e.target.closest('.media-picker')) closeMediaMenu();
});

mediaMenu.addEventListener('keydown', (e) => {
  const items = [...mediaMenu.querySelectorAll('.media-item')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[(i + 1) % items.length].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    items[(i - 1 + items.length) % items.length].focus();
  } else if (e.key === 'Escape') {
    e.stopPropagation();
    closeMediaMenu();
    mediaChip.focus();
  }
});

/* ── year picker ────────────────────────────────────────── */

const yearChip = $('year-chip');
const yearMenu = $('year-menu');

function renderYearMenu() {
  yearMenu.innerHTML = '';
  const current = new Date().getFullYear();
  const selected = state.year === null ? current : state.year;
  for (const y of yearsInData()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'media-item';
    btn.setAttribute('role', 'menuitem');
    const isSelected = y === selected;
    btn.setAttribute('aria-current', String(isSelected));
    if (ui.highlightYears && ui.highlightYears.has(y)) btn.classList.add('is-hot');
    btn.textContent = `${isSelected ? '▸' : ' '} ${y}`;
    btn.addEventListener('click', () => {
      closeYearMenu();
      state.year = y === current ? null : y;
      filters.purchased = filters.watched = filters.verdict = null;
      renderAll();
    });
    yearMenu.appendChild(btn);
  }
}

function openYearMenu({ focus = true } = {}) {
  renderYearMenu();
  yearMenu.hidden = false;
  yearChip.setAttribute('aria-expanded', 'true');
  if (!focus) return;
  const first = yearMenu.querySelector('.media-item[aria-current="true"]') || yearMenu.querySelector('.media-item');
  if (first) first.focus();
}

function closeYearMenu() {
  yearMenu.hidden = true;
  yearChip.setAttribute('aria-expanded', 'false');
}

yearChip.addEventListener('click', () => {
  yearMenu.hidden ? openYearMenu() : closeYearMenu();
});

document.addEventListener('click', (e) => {
  if (!yearMenu.hidden && !e.target.closest('.year-picker')) closeYearMenu();
});

yearMenu.addEventListener('keydown', (e) => {
  const items = [...yearMenu.querySelectorAll('.media-item')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[(i + 1) % items.length].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    items[(i - 1 + items.length) % items.length].focus();
  } else if (e.key === 'Escape') {
    e.stopPropagation();
    closeYearMenu();
    yearChip.focus();
  }
});

// sort toggles: A–Z when pressed, the user's added order when not
for (const key of ['purchased', 'watched', 'verdict']) {
  $(`sort-${key}`).addEventListener('click', () => {
    ui.sortAZ[key] = !ui.sortAZ[key];
    ui.page[key] = 0;
    renderAll();
  });
}

/* ── boot ───────────────────────────────────────────────── */

load()
  .then(renderAll)
  .catch(() => {
    $('stat-purchased').textContent = 'COULD NOT LOAD DATA';
  });
