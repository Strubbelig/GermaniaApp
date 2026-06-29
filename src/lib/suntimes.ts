// =============================================================================
// GermaniaApp — Sunrise/sunset & civil twilight (dawn/dusk)
// Self-contained implementation of the US Naval Observatory sunrise/sunset
// algorithm. Used to set a Stocherkahn booking's dawn→dusk window for a given
// calendar date and location. No dependencies.
//
// "Dawn"/"dusk" here = civil twilight (sun 6° below horizon), matching common
// usage. Returns UTC Date instants; format them in the venue's timezone for UI.
// =============================================================================
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const ZENITH_CIVIL = 96; // civil twilight
const norm = (v: number, max: number) => ((v % max) + max) % max;

const sin = (d: number) => Math.sin(d * D2R);
const cos = (d: number) => Math.cos(d * D2R);
const tan = (d: number) => Math.tan(d * D2R);

/**
 * Time the sun reaches `zenith` on a date at (lat, lon).
 * @param rising true = morning event (dawn/sunrise), false = evening (dusk/sunset)
 * Returns a UTC Date, or null if the event doesn't occur (polar day/night).
 */
function sunEvent(
  year: number, month: number, day: number,
  lat: number, lon: number, zenith: number, rising: boolean,
): Date | null {
  // 1. day of year
  const n1 = Math.floor((275 * month) / 9);
  const n2 = Math.floor((month + 9) / 12);
  const n3 = 1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3);
  const N = n1 - n2 * n3 + day - 30;

  // 2. approximate time
  const lngHour = lon / 15;
  const t = rising ? N + (6 - lngHour) / 24 : N + (18 - lngHour) / 24;

  // 3. sun's mean anomaly
  const M = 0.9856 * t - 3.289;

  // 4. true longitude
  let L = M + 1.916 * sin(M) + 0.02 * sin(2 * M) + 282.634;
  L = norm(L, 360);

  // 5. right ascension, put in same quadrant as L
  let RA = R2D * Math.atan(0.91764 * tan(L));
  RA = norm(RA, 360);
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15;

  // 6. declination
  const sinDec = 0.39782 * sin(L);
  const cosDec = Math.cos(Math.asin(sinDec));

  // 7. local hour angle
  const cosH = (cos(zenith) - sinDec * sin(lat)) / (cosDec * cos(lat));
  if (cosH > 1 || cosH < -1) return null; // no event this day

  let H = rising ? 360 - R2D * Math.acos(cosH) : R2D * Math.acos(cosH);
  H /= 15;

  // 8. local mean time -> UTC
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = norm(T - lngHour, 24);

  const hour = Math.floor(UT);
  const min = Math.floor((UT - hour) * 60);
  const sec = Math.floor(((UT - hour) * 60 - min) * 60);
  return new Date(Date.UTC(year, month - 1, day, hour, min, sec));
}

function ymd(date: string | Date): [number, number, number] {
  if (typeof date === 'string') {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    return [y, m, d];
  }
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

/** Civil dawn (start) and dusk (end) as UTC Date instants for a date+location. */
export function civilDawnDusk(
  date: string | Date, lat: number, lon: number,
): { dawn: Date | null; dusk: Date | null } {
  const [y, m, d] = ymd(date);
  return {
    dawn: sunEvent(y, m, d, lat, lon, ZENITH_CIVIL, true),
    dusk: sunEvent(y, m, d, lat, lon, ZENITH_CIVIL, false),
  };
}

/** Sunrise/sunset (official zenith) — handy if you prefer those over twilight. */
export function sunriseSunset(
  date: string | Date, lat: number, lon: number,
): { sunrise: Date | null; sunset: Date | null } {
  const [y, m, d] = ymd(date);
  return {
    sunrise: sunEvent(y, m, d, lat, lon, 90.833, true),
    sunset: sunEvent(y, m, d, lat, lon, 90.833, false),
  };
}
