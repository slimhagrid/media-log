const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "MM-DD-YYYY" -> "YYYY-MM-DD" or null if invalid
export function parseUSDate(s) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function monthShort(d) {
  return MONTHS[d.getMonth()];
}

export function humanDate(iso) {
  const d = fromISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// year == null: rolling 365 days ending today. Otherwise: that calendar year.
// Either way, padded back to the previous Sunday.
export function calendarDays(year = null) {
  let start, end;
  if (year === null) {
    end = new Date();
    end.setHours(0, 0, 0, 0);
    start = new Date(end);
    start.setDate(start.getDate() - 364);
  } else {
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31);
  }
  const today = end;
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // back to Sunday

  const days = [];
  const cursor = new Date(gridStart);
  while (cursor <= today) {
    days.push({ date: new Date(cursor), iso: toISO(cursor), inWindow: cursor >= start });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
