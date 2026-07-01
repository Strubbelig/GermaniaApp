// =============================================================================
// GermaniaApp — iCalendar (.ics) import & export
// parseIcs: read VEVENTs from an .ics file (admin import → create events).
// buildIcs: turn events into a downloadable .ics (any user → add to their calendar).
// Pragmatic, dependency-free; handles line folding and the common DTSTART forms.
// =============================================================================
export interface ParsedEvent {
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;      // ISO
  ends_at: string | null; // ISO
  rrule: string | null;
}

// --- import ------------------------------------------------------------------
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/** Parse an iCalendar datetime value into an ISO string. */
function parseIcsDate(value: string): string {
  const v = value.trim();
  if (/^\d{8}$/.test(v)) {
    const y = +v.slice(0, 4), m = +v.slice(4, 6), d = +v.slice(6, 8);
    return new Date(y, m - 1, d).toISOString();
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return new Date(v).toISOString(); // fallback
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
  return new Date(+y, +mo - 1, +d, +h, +mi, +s).toISOString(); // local wall time
}

export function parseIcs(text: string): ParsedEvent[] {
  const lines = unfold(text);
  const events: ParsedEvent[] = [];
  let cur: Partial<ParsedEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.starts_at) {
        events.push({
          title: cur.title ?? '(ohne Titel)',
          description: cur.description ?? null,
          location: cur.location ?? null,
          starts_at: cur.starts_at,
          ends_at: cur.ends_at ?? null,
          rrule: cur.rrule ?? null,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx).split(';')[0].toUpperCase();
    const value = line.slice(idx + 1);
    if (name === 'SUMMARY') cur.title = unescapeText(value);
    else if (name === 'DESCRIPTION') cur.description = unescapeText(value);
    else if (name === 'LOCATION') cur.location = unescapeText(value);
    else if (name === 'DTSTART') cur.starts_at = parseIcsDate(value);
    else if (name === 'DTEND') cur.ends_at = parseIcsDate(value);
    else if (name === 'RRULE') cur.rrule = value.trim();
  }
  return events;
}

// --- export ------------------------------------------------------------------
function esc(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function icsUtc(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export interface IcsEvent {
  id?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  starts_at: string;
  ends_at?: string | null;
  rrule?: string | null;
}

export function buildIcs(events: IcsEvent[], calName = 'Germania'): string {
  const now = icsUtc(new Date().toISOString());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Germania//App//DE', `X-WR-CALNAME:${esc(calName)}`];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id ?? Math.random().toString(36).slice(2)}@germania.app`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${icsUtc(e.starts_at)}`);
    if (e.ends_at) lines.push(`DTEND:${icsUtc(e.ends_at)}`);
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Trigger a browser download of an .ics file. */
export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
