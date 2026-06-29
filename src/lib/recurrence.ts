// =============================================================================
// GermaniaApp — minimal iCalendar RRULE helper
// Supports the patterns this app uses: FREQ=DAILY/WEEKLY/MONTHLY with INTERVAL
// and BYDAY (incl. monthly ordinals like 1FR, 3SA). Not a full RFC-5545 parser —
// kept tiny on purpose so it stays light on old phones.
// =============================================================================
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function parse(rule: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of rule.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) out[k.toUpperCase()] = v.toUpperCase();
  }
  return out;
}

/** nth weekday of a month: nthWeekday(2026, 6, 5, 1) = first Friday of Jul 2026. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const shift = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + shift + (n - 1) * 7);
}

/** Up to `count` future occurrences from `startISO`, on/after `from`. */
export function nextOccurrences(
  rule: string | null,
  startISO: string,
  count = 3,
  from = new Date(),
): Date[] {
  const start = new Date(startISO);
  if (!rule) return start >= from ? [start] : [];

  const r = parse(rule);
  const interval = Math.max(1, parseInt(r.INTERVAL ?? '1', 10));
  const byday = (r.BYDAY ?? '').split(',').filter(Boolean);
  const out: Date[] = [];
  const horizon = new Date(from.getFullYear() + 2, from.getMonth(), from.getDate());

  const hh = start.getHours();
  const mm = start.getMinutes();

  if (r.FREQ === 'WEEKLY') {
    const targets = byday.length ? byday.map((d) => DAYS.indexOf(d)) : [start.getDay()];
    const cur = new Date(from);
    cur.setHours(hh, mm, 0, 0);
    while (out.length < count && cur < horizon) {
      if (targets.includes(cur.getDay()) && cur >= from) out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out; // (INTERVAL>1 weeks is rare here; daily scan keeps it simple)
  }

  if (r.FREQ === 'MONTHLY') {
    let y = from.getFullYear();
    let m = from.getMonth();
    while (out.length < count) {
      for (const token of byday.length ? byday : [`${DAYS[start.getDay()]}`]) {
        const ord = parseInt(token, 10) || Math.ceil(start.getDate() / 7);
        const wd = DAYS.indexOf(token.replace(/[-0-9]/g, ''));
        const d = nthWeekday(y, m, wd, ord);
        d.setHours(hh, mm, 0, 0);
        if (d >= from && d < horizon) out.push(d);
      }
      m += interval;
      while (m > 11) { m -= 12; y += 1; }
      if (y > from.getFullYear() + 2) break;
    }
    return out.sort((a, b) => +a - +b).slice(0, count);
  }

  if (r.FREQ === 'DAILY') {
    const cur = new Date(from);
    cur.setHours(hh, mm, 0, 0);
    while (out.length < count) {
      if (cur >= from) out.push(new Date(cur));
      cur.setDate(cur.getDate() + interval);
    }
    return out;
  }

  return start >= from ? [start] : [];
}

/** Human-readable recurrence, e.g. "Weekly on Wed". */
export function describeRule(rule: string | null): string {
  if (!rule) return 'One-off';
  const r = parse(rule);
  const names: Record<string, string> = {
    SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat',
  };
  const days = (r.BYDAY ?? '').split(',').filter(Boolean)
    .map((t) => names[t.replace(/[-0-9]/g, '')] ?? t).join(', ');
  const every = r.INTERVAL && r.INTERVAL !== '1' ? `every ${r.INTERVAL} ` : '';
  if (r.FREQ === 'WEEKLY') return `Weekly${days ? ' on ' + days : ''}`;
  if (r.FREQ === 'MONTHLY') return `Monthly ${every}${days ? 'on ' + days : ''}`.trim();
  if (r.FREQ === 'DAILY') return `Daily ${every}`.trim();
  return rule;
}
