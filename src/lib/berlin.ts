// =============================================================================
// GermaniaApp — Europe/Berlin local time, DST-aware, without Intl
// The Stocherkahn is in Tübingen, so all boat times are German local time.
// We compute the CET/CEST offset ourselves (works on any browser) instead of
// relying on toLocaleTimeString(timeZone), which behaved inconsistently.
// CEST (+2) runs from the last Sunday of March 01:00 UTC to the last Sunday of
// October 01:00 UTC; otherwise CET (+1).
// =============================================================================
function lastSundayUTC(year: number, monthIndex0: number): Date {
  const d = new Date(Date.UTC(year, monthIndex0 + 1, 1)); // first of next month
  d.setUTCDate(0);                                         // last day of month
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());            // back to Sunday
  return d;
}

/** German UTC offset in hours (1 or 2) for a given instant. */
export function germanOffsetHours(instant: Date): number {
  const y = instant.getUTCFullYear();
  const start = lastSundayUTC(y, 2); start.setUTCHours(1);   // last Sun Mar 01:00 UTC
  const end = lastSundayUTC(y, 9); end.setUTCHours(1);       // last Sun Oct 01:00 UTC
  return instant >= start && instant < end ? 2 : 1;
}

/** Instant for a German wall-clock hour on a calendar date ('YYYY-MM-DD'). */
export function berlinInstant(dateStr: string, hour: number): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const off = germanOffsetHours(new Date(Date.UTC(y, m - 1, d, 12))); // stable midday offset
  return new Date(Date.UTC(y, m - 1, d, hour - off, 0, 0));
}

/** Format an instant as German HH:MM. */
export function berlinHHMM(iso: string | Date): string {
  const inst = new Date(iso);
  const off = germanOffsetHours(inst);
  const t = new Date(inst.getTime() + off * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

/** German local time of an instant as a decimal hour (e.g. 4.65 for 04:39). */
export function berlinDecimalHour(iso: string | Date): number {
  const inst = new Date(iso);
  const t = new Date(inst.getTime() + germanOffsetHours(inst) * 3_600_000);
  return t.getUTCHours() + t.getUTCMinutes() / 60;
}
