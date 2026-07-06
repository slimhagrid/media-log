import { calendarDays, humanDate, monthShort } from './dates.js';

// Renders a GitHub-style contribution grid into `root`.
// classFor(iso) -> extra class string for the cell (intensity/verdict), '' for empty
// labelFor(iso) -> aria-label suffix, e.g. "2 purchased"
// onSelect(iso|null) -> called when a day is toggled
export function renderCalendar(root, { classFor, labelFor, onSelect, selected, year = null }) {
  const days = calendarDays(year);
  const weeks = Math.ceil(days.length / 7);

  root.innerHTML = '';

  // month labels
  const months = document.createElement('div');
  months.className = 'cal-months';
  months.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
  months.setAttribute('aria-hidden', 'true');
  for (let w = 0; w < weeks; w++) {
    const week = days.slice(w * 7, w * 7 + 7);
    const firstOfMonth = week.find((d) => d.inWindow && d.date.getDate() === 1);
    if (firstOfMonth) {
      const span = document.createElement('span');
      span.textContent = monthShort(firstOfMonth.date);
      span.style.gridColumn = String(w + 1);
      months.appendChild(span);
    }
  }
  root.appendChild(months);

  // day cells
  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', root.getAttribute('data-cal-label') || 'Activity calendar');

  const cells = [];
  days.forEach((day, i) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.setAttribute('role', 'gridcell');
    cell.tabIndex = -1;
    if (!day.inWindow) {
      cell.classList.add('is-blank');
      cell.setAttribute('aria-hidden', 'true');
    } else {
      const extra = classFor(day.iso);
      if (extra) cell.className += ' ' + extra;
      if (selected === day.iso) cell.classList.add('is-selected');
      cell.dataset.date = day.iso;
      cell.setAttribute('aria-label', `${humanDate(day.iso)} — ${labelFor(day.iso)}`);
      if (selected === day.iso) cell.setAttribute('aria-pressed', 'true');
      cell.addEventListener('click', () => onSelect(selected === day.iso ? null : day.iso));
    }
    cells.push(cell);
    grid.appendChild(cell);
  });

  // roving tabindex: one tab stop, arrows move within the grid
  const active = cells.filter((c) => !c.classList.contains('is-blank'));
  let focusIdx = active.length - 1; // today
  if (active.length) active[focusIdx].tabIndex = 0;

  grid.addEventListener('keydown', (e) => {
    const moves = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = Math.min(Math.max(focusIdx + moves[e.key], 0), active.length - 1);
    if (next === focusIdx) return;
    active[focusIdx].tabIndex = -1;
    focusIdx = next;
    active[focusIdx].tabIndex = 0;
    active[focusIdx].focus();
  });

  root.appendChild(grid);
}
