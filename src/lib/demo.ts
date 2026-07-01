// =============================================================================
// GermaniaApp — DEMO data layer (no backend)
// In-memory implementation matching the queries.ts surface, used when no
// Supabase credentials are present (e.g. the GitHub Pages prototype). The same
// 10 members as supabase/seed.sql. Edits live only until page refresh.
// =============================================================================
import { ageFromDob, toCsv, downloadCsv } from './queries';
import { toast } from './ui';
import type {
  Member, Address, ProfessionCategory, MemberProfession, Relative, RelativeDetail,
  Gathering, GatheringAttendance, DirectoryEntry, DeceasedEntry, NearbyMember, ProfessionMatch, Rsvp, Role,
  StocherkahnSeason, StocherkahnBooking,
} from './database.types';

const now = new Date().toISOString();
const uid = () => 'demo-' + Math.random().toString(36).slice(2, 10);

interface Src {
  id: string; sal: string; first: string; last: string; email: string; phone: string;
  dob: string; gender: Member['gender']; bio: string;
  street: string; postal: string; city: string; region: string; cc: string;
  lat: number; lon: number; profTitle: string; catName: string; catSlug: string; org: string;
}

const SRC: Src[] = [
  { id: 'm1', sal: 'Dr.', first: 'Anna', last: 'Berger', email: 'anna.berger@example.org', phone: '+49 30 1110001', dob: '1978-03-12', gender: 'female', bio: 'Urologist in Berlin.', street: 'Hauptstrasse 5', postal: '10115', city: 'Berlin', region: 'Berlin', cc: 'DE', lat: 52.52, lon: 13.405, profTitle: 'Urologist', catName: 'Urology', catSlug: 'urology', org: 'Charité Berlin' },
  { id: 'm2', sal: '', first: 'Thomas', last: 'Klein', email: 'thomas.klein@example.org', phone: '+49 89 1110002', dob: '1982-07-08', gender: 'male', bio: 'Real-estate lawyer in Munich.', street: 'Leopoldstrasse 12', postal: '80802', city: 'Munich', region: 'Bavaria', cc: 'DE', lat: 48.1351, lon: 11.582, profTitle: 'Real-estate-specialized lawyer', catName: 'Real estate law', catSlug: 'real-estate-law', org: 'Klein & Partner' },
  { id: 'm3', sal: 'Dr.', first: 'Sophie', last: 'Wagner', email: 'sophie.wagner@example.org', phone: '+49 40 1110003', dob: '1985-11-22', gender: 'female', bio: 'Pediatric cardiologist in Hamburg.', street: 'Elbchaussee 100', postal: '22763', city: 'Hamburg', region: 'Hamburg', cc: 'DE', lat: 53.5511, lon: 9.9937, profTitle: 'Pediatric cardiologist', catName: 'Pediatric cardiology', catSlug: 'pediatric-cardiology', org: 'UKE Hamburg' },
  { id: 'm4', sal: '', first: 'Markus', last: 'Vogel', email: 'markus.vogel@example.org', phone: '+41 44 1110004', dob: '1975-01-30', gender: 'male', bio: 'Tax lawyer in Zurich.', street: 'Bahnhofstrasse 3', postal: '8001', city: 'Zurich', region: 'Zurich', cc: 'CH', lat: 47.3769, lon: 8.5417, profTitle: 'Tax lawyer', catName: 'Tax law', catSlug: 'tax-law', org: 'Vogel Steuerrecht' },
  { id: 'm5', sal: 'Dipl.-Ing.', first: 'Elena', last: 'Fischer', email: 'elena.fischer@example.org', phone: '+43 1 1110005', dob: '1983-05-17', gender: 'female', bio: 'Architect in Vienna.', street: 'Ringstrasse 22', postal: '1010', city: 'Vienna', region: 'Vienna', cc: 'AT', lat: 48.2082, lon: 16.3738, profTitle: 'Architect', catName: 'Architecture', catSlug: 'architecture', org: 'Fischer Atelier' },
  { id: 'm6', sal: '', first: 'David', last: 'Cohen', email: 'david.cohen@example.org', phone: '+1 212 1110006', dob: '1972-09-03', gender: 'male', bio: 'Investment banker in New York.', street: '5th Avenue 700', postal: '10019', city: 'New York', region: 'NY', cc: 'US', lat: 40.7128, lon: -74.006, profTitle: 'Investment banker', catName: 'Finance', catSlug: 'finance', org: 'Cohen Capital' },
  { id: 'm7', sal: 'Dr.', first: 'Charlotte', last: 'Bauer', email: 'charlotte.bauer@example.org', phone: '+44 20 1110007', dob: '1988-02-14', gender: 'female', bio: 'Dermatologist in London.', street: 'Baker Street 21', postal: 'NW1', city: 'London', region: 'England', cc: 'GB', lat: 51.5074, lon: -0.1278, profTitle: 'Dermatologist', catName: 'Dermatology', catSlug: 'dermatology', org: 'Harley Street Clinic' },
  { id: 'm8', sal: '', first: 'Johann', last: 'Schmidt', email: 'johann.schmidt@example.org', phone: '+49 69 1110008', dob: '1969-12-01', gender: 'male', bio: 'Notary in Frankfurt.', street: 'Zeil 50', postal: '60313', city: 'Frankfurt', region: 'Hesse', cc: 'DE', lat: 50.1109, lon: 8.6821, profTitle: 'Notary', catName: 'Notary', catSlug: 'notary', org: 'Schmidt Notariat' },
  { id: 'm9', sal: 'Dr.', first: 'Lukas', last: 'Hoffmann', email: 'lukas.hoffmann@example.org', phone: '+49 221 1110009', dob: '1974-06-25', gender: 'male', bio: 'Orthopedic surgeon in Cologne.', street: 'Domkloster 4', postal: '50667', city: 'Cologne', region: 'NRW', cc: 'DE', lat: 50.9375, lon: 6.9603, profTitle: 'Orthopedic surgeon', catName: 'Orthopedic surgery', catSlug: 'orthopedic-surgery', org: 'Köln Klinik' },
  { id: 'm10', sal: '', first: 'Camille', last: 'Laurent', email: 'camille.laurent@example.org', phone: '+33 1 1110010', dob: '1986-10-09', gender: 'female', bio: 'IP lawyer in Paris.', street: 'Rue de Rivoli 10', postal: '75001', city: 'Paris', region: 'Ile-de-France', cc: 'FR', lat: 48.8566, lon: 2.3522, profTitle: 'Intellectual property lawyer', catName: 'Intellectual property law', catSlug: 'ip-law', org: 'Laurent IP' },
];

// --- build the in-memory tables ---------------------------------------------
const members: Member[] = SRC.map((s) => ({
  id: s.id, auth_user_id: null, salutation: s.sal, first_name: s.first, last_name: s.last,
  maiden_name: null, date_of_birth: s.dob, date_of_death: null, gender: s.gender,
  email: s.email, phone: s.phone, website: null, photo_url: null, bio: s.bio, trivia: null,
  member_since: null, entry_semester: 'WS 2018/19', fencing_bouts: 0,
  status: 'active', consented: true,
  role: s.id === 'm1' ? 'admin' : s.id === 'm4' ? 'officer' : 'member',
  visibility: 'members', show_email: true, show_address: true, show_family: true,
  created_at: now, updated_at: now,
}));
// A deceased member with memorial trivia (Verstorbene tab).
members.push({
  id: 'd1', auth_user_id: null, salutation: 'Prof. Dr.', first_name: 'Wilhelm', last_name: 'Stark',
  maiden_name: null, date_of_birth: '1921-05-04', date_of_death: '1998-11-12', gender: 'male',
  email: 'wilhelm.stark@example.org', phone: null, website: null, photo_url: null,
  bio: null, trivia: 'Mitbegründer des Nachkriegs-Convents; verfasste die Mensurchronik und sammelte über 300 Studentenlieder.',
  member_since: null, entry_semester: 'WS 1946/47', fencing_bouts: 4, status: 'deceased', consented: false, role: 'member',
  visibility: 'members', show_email: false, show_address: false, show_family: false,
  created_at: now, updated_at: now,
});

const addresses: Address[] = SRC.map((s) => ({
  id: 'a-' + s.id, member_id: s.id, label: 'home', is_primary: true, street: s.street,
  house_number: null, address_line2: null, postal_code: s.postal, city: s.city, region: s.region,
  country_code: s.cc, geo: `POINT(${s.lon} ${s.lat})`, created_at: now, updated_at: now,
}));

let catSeq = 0;
const categories: ProfessionCategory[] = SRC.map((s) => ({
  id: s.catSlug, parent_id: null, name: s.catName, slug: s.catSlug, created_at: now,
})).filter((c, i, arr) => arr.findIndex((x) => x.slug === c.slug) === i);
void catSeq;

const professions: MemberProfession[] = SRC.map((s) => ({
  id: 'p-' + s.id, member_id: s.id, category_id: s.catSlug, title: s.profTitle,
  organization: s.org, is_primary: true, created_at: now, updated_at: now,
}));
professions.push({ id: 'p-d1', member_id: 'd1', category_id: null, title: 'Rechtshistoriker', organization: null, is_primary: true, created_at: now, updated_at: now });

// Fechtpartien counts + Chargen history (demo).
for (const [id, n] of [['m1', 3], ['m4', 5], ['m2', 2], ['d1', 4]] as [string, number][]) {
  const m = members.find((x) => x.id === id); if (m) m.fencing_bouts = n;
}
interface DemoCharge { id: string; member_id: string; office_code: 'sprecher' | 'fechtwart' | 'schriftwart'; semester: string | null; created_at: string; }
const officeHistory: DemoCharge[] = [
  { id: uid(), member_id: 'm1', office_code: 'sprecher', semester: 'WS 2019/20', created_at: now },
  { id: uid(), member_id: 'm1', office_code: 'schriftwart', semester: 'SS 2018', created_at: now },
  { id: uid(), member_id: 'm4', office_code: 'fechtwart', semester: 'WS 2020/21', created_at: now },
  { id: uid(), member_id: 'm2', office_code: 'schriftwart', semester: 'SS 2021', created_at: now },
];
const abbr = (c: string) => (c === 'sprecher' ? 'x' : c === 'fechtwart' ? 'xx' : c === 'schriftwart' ? 'xxx' : c);

const relatives: Relative[] = [
  rel('m1', 'spouse', 'Karl', 'Berger', 'male', '1979-02-14', 'Hauptstrasse 5', '10115', 'Berlin', 'DE'),
  rel('m1', 'child', 'Lena', 'Berger', 'female', '2012-08-30', 'Hauptstrasse 5', '10115', 'Berlin', 'DE'),
  rel('m2', 'spouse', 'Maria', 'Klein', 'female', '1983-06-09', 'Leopoldstrasse 12', '80802', 'Munich', 'DE'),
  rel('m4', 'spouse', 'Nina', 'Vogel', 'female', '1981-11-25', 'Bahnhofstrasse 3', '8001', 'Zurich', 'CH'),
  rel('m4', 'child', 'Jonas', 'Vogel', 'male', '2010-03-17', 'Bahnhofstrasse 3', '8001', 'Zurich', 'CH'),
  rel('m4', 'child', 'Mia', 'Vogel', 'female', '2014-07-02', 'Bahnhofstrasse 3', '8001', 'Zurich', 'CH'),
  rel('m6', 'spouse', 'Rachel', 'Cohen', 'female', '1976-09-19', '5th Avenue 700', '10019', 'New York', 'US'),
  rel('m9', 'child', 'Paul', 'Hoffmann', 'male', '2008-01-05', 'Domkloster 4', '50667', 'Cologne', 'DE'),
];
function rel(
  member_id: string, relationship: Relative['relationship'], first: string, last: string,
  gender: Relative['gender'], dob: string, street: string, postal: string, city: string, cc: string,
): Relative {
  return {
    id: uid(), member_id, relationship, first_name: first, last_name: last, date_of_birth: dob,
    gender, email: null, street, house_number: null, postal_code: postal, city, region: null,
    country_code: cc, geo: null, related_member_id: null, created_at: now, updated_at: now,
  };
}

interface GatSeed {
  title: string; description: string; category: Gathering['category']; semester?: string | null;
  venue: string; street: string | null; city: string; cc: string; lat: number; lon: number;
  starts: string; rule: string | null; host: string;
}
const gatherings: Gathering[] = [
  gat({ title: 'Tübinger Stammtisch', description: 'Wöchentlicher Stammtisch, donnerstags.', category: 'stammtisch', venue: 'Weinstube Forelle', street: 'Kronenstraße 8', city: 'Tübingen', cc: 'DE', lat: 48.5216, lon: 9.0576, starts: '2026-07-02T18:00:00Z', rule: 'FREQ=WEEKLY;BYDAY=TH', host: 'm4' }),
  gat({ title: 'Berliner Stammtisch', description: 'Erster Freitag im Monat.', category: 'stammtisch', venue: 'Restaurant Lutter', street: null, city: 'Berlin', cc: 'DE', lat: 52.52, lon: 13.405, starts: '2026-07-03T17:00:00Z', rule: 'FREQ=MONTHLY;BYDAY=1FR', host: 'm1' }),
  gat({ title: 'Semesterantrittskommers', description: 'Feierlicher Auftakt ins Wintersemester.', category: 'semesterprogramm', semester: 'WS 2026/27', venue: 'Haus Germania', street: 'Gartenstraße 3', city: 'Tübingen', cc: 'DE', lat: 48.5216, lon: 9.0576, starts: '2026-10-24T17:00:00Z', rule: null, host: 'm1' }),
  gat({ title: 'Vortragsabend', description: 'Gastvortrag mit anschließendem Umtrunk.', category: 'semesterprogramm', semester: 'WS 2026/27', venue: 'Haus Germania', street: 'Gartenstraße 3', city: 'Tübingen', cc: 'DE', lat: 48.5216, lon: 9.0576, starts: '2026-11-14T18:30:00Z', rule: null, host: 'm4' }),
  gat({ title: 'Pauktag', description: 'Bestimmungsmensuren am Vormittag.', category: 'pauktag', venue: 'Fechtboden', street: null, city: 'Tübingen', cc: 'DE', lat: 48.5216, lon: 9.0576, starts: '2026-11-07T08:00:00Z', rule: null, host: 'm4' }),
];
function gat(g: GatSeed): Gathering {
  return {
    id: uid(), title: g.title, description: g.description, category: g.category,
    semester: g.semester ?? null, venue_name: g.venue, street: g.street, city: g.city,
    region: null, country_code: g.cc, geo: `POINT(${g.lon} ${g.lat})`, starts_at: g.starts,
    ends_at: null, timezone: null, recurrence_rule: g.rule, host_member_id: g.host,
    visibility: 'members', created_at: now, updated_at: now,
  };
}

// The "logged-in" demo member.
const ME = 'm1';
function geoOf(memberId: string) {
  return addresses.find((a) => a.member_id === memberId && a.is_primary)?.geo ?? null;
}
function latLon(geo: string | null): { lat: number | null; lon: number | null } {
  const m = geo?.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : { lat: null, lon: null };
}
function directoryFor(m: Member): DirectoryEntry {
  const a = addresses.find((x) => x.member_id === m.id && x.is_primary);
  const p = professions.find((x) => x.member_id === m.id && x.is_primary);
  const c = categories.find((x) => x.id === p?.category_id);
  const ll = latLon(a?.geo ?? null);
  return {
    id: m.id, salutation: m.salutation, first_name: m.first_name, last_name: m.last_name,
    email: m.email, phone: m.phone, photo_url: m.photo_url, status: m.status,
    visibility: m.visibility, show_email: m.show_email, date_of_birth: m.date_of_birth,
    age: ageFromDob(m.date_of_birth), entry_semester: m.entry_semester,
    fencing_bouts: m.fencing_bouts,
    charges: officeHistory.filter((h) => h.member_id === m.id)
      .map((h) => `${abbr(h.office_code)} ${h.semester ?? ''}`.trim()).join(', ') || null,
    profession: p?.title ?? null,
    profession_category: c?.name ?? null, street: a?.street ?? null, house_number: null,
    postal_code: a?.postal_code ?? null, city: a?.city ?? null, region: a?.region ?? null,
    country_code: a?.country_code ?? null, geo: a?.geo ?? null, latitude: ll.lat, longitude: ll.lon,
  };
}
function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 100) / 100;
}
const wait = <T>(v: T): Promise<T> => Promise.resolve(v);

// =============================================================================
// API surface (mirrors queries.ts)
// =============================================================================
// auth — always "signed in" as the demo member
export const hasSession = () => wait(true);
export const onAuthChange = (_cb: (s: boolean) => void) => () => {};
export const signOut = async () => { toast('Demo-Modus — Abmelden deaktiviert'); };
export const signInWithMagicLink = async () => { toast('Demo-Modus — bereits angemeldet'); };
export const signInWithPassword = async () => { toast('Demo-Modus — bereits angemeldet'); };
export const signUpWithPassword = async () => { toast('Demo-Modus — bereits angemeldet'); };
export const sendPasswordReset = async () => { toast('Demo-Modus'); };

// profile
export const getMyMember = () => wait(members.find((m) => m.id === ME) ?? null);
export const createMyMember = async (input: Partial<Member>) => {
  Object.assign(members.find((m) => m.id === ME)!, input);
  return members.find((m) => m.id === ME)!;
};
export const updateMyMember = async (patch: Partial<Member>) => {
  Object.assign(members.find((m) => m.id === ME)!, patch, { updated_at: new Date().toISOString() });
  return members.find((m) => m.id === ME)!;
};
export const uploadMyPhoto = async (file: File) => {
  const url = URL.createObjectURL(file);
  members.find((m) => m.id === ME)!.photo_url = url;
  return url;
};

// professions
export const listProfessionCategories = () => wait([...categories].sort((a, b) => a.name.localeCompare(b.name)));
export const listMyProfessions = (memberId: string) => wait(professions.filter((p) => p.member_id === memberId));
export const addMyProfession = async (input: { member_id: string; title: string; category_id?: string | null; organization?: string | null; is_primary?: boolean }) => {
  const p: MemberProfession = { id: uid(), member_id: input.member_id, category_id: input.category_id ?? null, title: input.title, organization: input.organization ?? null, is_primary: input.is_primary ?? true, created_at: now, updated_at: now };
  professions.push(p); return p;
};
export const deleteMyProfession = async (id: string) => { remove(professions, id); };

// addresses
export const listMyAddresses = (memberId: string) => wait(addresses.filter((a) => a.member_id === memberId));
export const upsertMyAddress = async (input: any) => {
  const a: Address = { id: uid(), member_id: input.member_id, label: input.label ?? 'home', is_primary: input.is_primary ?? true, street: input.street ?? null, house_number: input.house_number ?? null, address_line2: null, postal_code: input.postal_code ?? null, city: input.city ?? null, region: input.region ?? null, country_code: input.country_code ?? null, geo: input.lat != null && input.lon != null ? `POINT(${input.lon} ${input.lat})` : null, created_at: now, updated_at: now };
  addresses.push(a); return a;
};
export const deleteAddress = async (id: string) => { remove(addresses, id); };

// relatives
export const listMyRelatives = (memberId: string): Promise<RelativeDetail[]> =>
  wait(relatives.filter((r) => r.member_id === memberId).map((r) => ({
    ...r, age: ageFromDob(r.date_of_birth),
    full_address: [r.street, [r.postal_code, r.city].filter(Boolean).join(' '), r.country_code].filter(Boolean).join(', ') || null,
  })));
export const addRelative = async (input: any) => {
  const r: Relative = { id: uid(), member_id: input.member_id, relationship: input.relationship, first_name: input.first_name, last_name: input.last_name ?? null, date_of_birth: input.date_of_birth ?? null, gender: input.gender ?? null, email: input.email ?? null, street: input.street ?? null, house_number: null, postal_code: input.postal_code ?? null, city: input.city ?? null, region: input.region ?? null, country_code: input.country_code ?? null, geo: null, related_member_id: null, created_at: now, updated_at: now };
  relatives.push(r); return r;
};
export const deleteRelative = async (id: string) => { remove(relatives, id); };

// directory & search
const visible = (m: Member) => m.consented && m.status === 'active';
export const getDirectory = () => wait(members.filter(visible).map(directoryFor).sort((a, b) => a.last_name.localeCompare(b.last_name)));
export const getMapMarkers = () => wait(members.filter(visible).map(directoryFor).filter((d) => d.latitude != null));
export const listDeceased = (): Promise<DeceasedEntry[]> =>
  wait(members.filter((m) => m.status === 'deceased').map((m) => {
    const p = professions.find((x) => x.member_id === m.id && x.is_primary);
    const yr = (d: string | null) => (d ? new Date(d).getFullYear() : null);
    return {
      id: m.id, salutation: m.salutation, first_name: m.first_name, last_name: m.last_name,
      maiden_name: m.maiden_name, date_of_birth: m.date_of_birth, date_of_death: m.date_of_death,
      photo_url: m.photo_url, trivia: m.trivia, birth_year: yr(m.date_of_birth),
      death_year: yr(m.date_of_death), profession: p?.title ?? null,
    };
  }));
export const membersByProfession = (q: string): Promise<ProfessionMatch[]> => {
  const t = q.toLowerCase();
  return wait(professions.filter((p) => {
    const m = members.find((x) => x.id === p.member_id);
    if (!m || !visible(m)) return false;
    const c = categories.find((x) => x.id === p.category_id);
    return p.title.toLowerCase().includes(t) || (c?.name.toLowerCase().includes(t) ?? false);
  }).map((p) => {
    const m = members.find((x) => x.id === p.member_id)!;
    const a = addresses.find((x) => x.member_id === p.member_id && x.is_primary);
    return { member_id: m.id, full_name: `${m.first_name} ${m.last_name}`, email: m.email, profession: p.title, organization: p.organization, city: a?.city ?? null, country_code: a?.country_code ?? null };
  }));
};
export const claimMyMember = () => wait(ME);
export const listMyOfficeHistory = (memberId: string) => wait(officeHistory.filter((h) => h.member_id === memberId));
export const addOfficeHistory = async (input: { member_id: string; office_code: DemoCharge['office_code']; semester?: string | null }) => {
  const h: DemoCharge = { id: uid(), member_id: input.member_id, office_code: input.office_code, semester: input.semester ?? null, created_at: now };
  officeHistory.push(h); return h;
};
export const deleteOfficeHistory = async (id: string) => { remove(officeHistory, id); };
export const membersNear = (lat: number, lon: number, radiusKm = 50): Promise<NearbyMember[]> => {
  const rows: NearbyMember[] = [];
  for (const m of members) {
    if (!visible(m)) continue;
    const ll = latLon(geoOf(m.id));
    if (ll.lat == null || ll.lon == null) continue;
    const d = haversine(lat, lon, ll.lat, ll.lon);
    if (d <= radiusKm) {
      const p = professions.find((x) => x.member_id === m.id && x.is_primary);
      const a = addresses.find((x) => x.member_id === m.id && x.is_primary);
      rows.push({ member_id: m.id, full_name: `${m.first_name} ${m.last_name}`, email: m.email, profession: p?.title ?? null, city: a?.city ?? null, country_code: a?.country_code ?? null, distance_km: d });
    }
  }
  return wait(rows.sort((a, b) => a.distance_km - b.distance_km));
};

// gatherings
export const listGatherings = (opts: { from?: string; category?: Gathering['category'] } = {}) =>
  wait([...gatherings]
    .filter((g) => !opts.category || g.category === opts.category)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)));
export const createGathering = async (input: any) => {
  const g: Gathering = {
    id: uid(), created_at: now, updated_at: now, visibility: 'members',
    category: 'other', semester: null, ...input,
  };
  gatherings.push(g); return g;
};
export const rsvpToGathering = async (gathering_id: string, member_id: string, rsvp: Rsvp, guests = 0): Promise<GatheringAttendance> =>
  wait({ gathering_id, member_id, rsvp, guests, created_at: now });

// export
export const exportContacts = async (ids: string[]) =>
  wait(members.filter((m) => ids.includes(m.id)).map((m) => {
    const a = addresses.find((x) => x.member_id === m.id && x.is_primary);
    return { member_id: m.id, salutation: m.salutation, first_name: m.first_name, last_name: m.last_name, email: m.show_email ? m.email : null, postal_address: a ? [a.street, [a.postal_code, a.city].filter(Boolean).join(' '), a.country_code].filter(Boolean).join(', ') : null };
  }));
export const exportContactsCsv = async (ids: string[], filename = 'contacts.csv') => {
  downloadCsv(filename, toCsv(await exportContacts(ids)));
};

// offices / Ämter
interface DemoOffice { id: string; code: 'sprecher' | 'fechtwart' | 'schriftwart'; title: string; current_holder_id: string | null; term_semester: string | null; updated_at: string; }
const offices: DemoOffice[] = [
  { id: 'off-sprecher', code: 'sprecher', title: 'Sprecher (x)', current_holder_id: 'm1', term_semester: 'WS 2026/27', updated_at: now },
  { id: 'off-fechtwart', code: 'fechtwart', title: 'Fechtwart (xx)', current_holder_id: 'm4', term_semester: 'WS 2026/27', updated_at: now },
  { id: 'off-schriftwart', code: 'schriftwart', title: 'Schriftwart (xxx)', current_holder_id: 'm2', term_semester: 'WS 2026/27', updated_at: now },
];
// office holders are admins in the demo
for (const o of offices) { const m = members.find((x) => x.id === o.current_holder_id); if (m) m.role = 'admin'; }
interface DemoTransfer { id: string; office_id: string; from_member_id: string | null; to_member_id: string; initiated_by: string; status: 'pending' | 'accepted' | 'declined' | 'cancelled'; created_at: string; resolved_at: string | null; }
const transfers: DemoTransfer[] = [];
const nameOf = (id: string | null) => { const m = members.find((x) => x.id === id); return m ? `${m.first_name} ${m.last_name}` : null; };

export const listOffices = () => wait(offices.map((o) => ({ ...o, holder_name: nameOf(o.current_holder_id) })));
export const listMyOfficeTransfers = (memberId: string) =>
  wait(transfers.filter((t) => t.status === 'pending' && (t.from_member_id === memberId || t.to_member_id === memberId)));
export const initiateOfficeTransfer = async (officeId: string, toMemberId?: string) => {
  const o = offices.find((x) => x.id === officeId); if (!o) throw new Error('Amt nicht gefunden');
  if (!o.current_holder_id) { o.current_holder_id = toMemberId ?? ME; const m = members.find((x) => x.id === o.current_holder_id); if (m) m.role = 'admin'; return; }
  const from = o.current_holder_id;
  const to = ME === o.current_holder_id ? toMemberId : ME;
  if (!to) throw new Error('Bitte Nachfolger:in wählen');
  if (from === to) throw new Error('Ungültige Übergabe');
  transfers.filter((t) => t.office_id === officeId && t.status === 'pending').forEach((t) => { t.status = 'cancelled'; });
  transfers.push({ id: uid(), office_id: officeId, from_member_id: from, to_member_id: to, initiated_by: ME, status: 'pending', created_at: now, resolved_at: null });
};
export const respondOfficeTransfer = async (transferId: string, accept: boolean) => {
  const t = transfers.find((x) => x.id === transferId); if (!t || t.status !== 'pending') throw new Error('Kein offener Antrag');
  if (!accept) { t.status = 'declined'; t.resolved_at = now(); return; }
  const o = offices.find((x) => x.id === t.office_id)!;
  o.current_holder_id = t.to_member_id;
  const nm = members.find((x) => x.id === t.to_member_id); if (nm) nm.role = 'admin';
  if (t.from_member_id && !offices.some((x) => x.current_holder_id === t.from_member_id)) {
    const om = members.find((x) => x.id === t.from_member_id); if (om) om.role = 'member';
  }
  t.status = 'accepted'; t.resolved_at = now();
};
export const reclaimOffice = async (officeId: string, semester: string) => {
  const o = offices.find((x) => x.id === officeId); if (o) o.term_semester = semester;
};

// admin
export const getMyRole = () => wait(members.find((m) => m.id === ME)!.role);
export const isAdmin = () => wait(members.find((m) => m.id === ME)!.role === 'admin');
export const isStaff = () => wait(['admin', 'officer'].includes(members.find((m) => m.id === ME)!.role));
export const listAllMembers = () => wait([...members].sort((a, b) => a.last_name.localeCompare(b.last_name)));
export const setMemberRole = async (target: string, role: Role) => {
  const m = members.find((x) => x.id === target);
  if (m) m.role = role;
};
export const deleteMember = async (id: string) => { remove(members, id); };
export const addProfessionCategory = async (name: string, slug: string, parentId: string | null = null) => {
  const c: ProfessionCategory = { id: slug || uid(), parent_id: parentId, name, slug, created_at: now };
  categories.push(c); return c;
};
export const deleteProfessionCategory = async (id: string) => { remove(categories, id); };

// stocherkahn
let season: StocherkahnSeason = {
  id: 'season-2026', name: 'Season 2026', water_date: '2026-04-01', withdraw_date: '2026-10-31',
  latitude: 48.5216, longitude: 9.0576, is_active: true, created_at: now, updated_at: now,
};
const bookings: StocherkahnBooking[] = [];

export const getActiveSeason = () => wait(season);
export const saveSeason = async (input: any) => {
  season = { ...season, ...input, updated_at: new Date().toISOString() };
  return season;
};
export const listBookings = (seasonId: string) =>
  wait(bookings.filter((b) => b.season_id === seasonId && b.status !== 'cancelled'));
export const listMyBookings = (memberId: string) =>
  wait(bookings.filter((b) => b.member_id === memberId));
export const createBooking = async (
  memberId: string, date: string, startsAt: Date | string, endsAt: Date | string,
): Promise<StocherkahnBooking> => {
  const s = new Date(startsAt), e = new Date(endsAt);
  const overlap = bookings.some(
    (b) => b.status !== 'cancelled' && +new Date(b.starts_at) < +e && +s < +new Date(b.ends_at),
  );
  if (overlap) throw new Error('Dieser Zeitraum ist bereits belegt.');
  const hours = Math.max(1, Math.round((+e - +s) / 3_600_000));
  const b: StocherkahnBooking = {
    id: uid(), season_id: season.id, member_id: memberId, booking_date: date,
    starts_at: s.toISOString(), ends_at: e.toISOString(),
    status: 'pending', fee_cents: hours * 100, currency: 'eur', payment_status: 'unpaid',
    stripe_session_id: null, stripe_payment_intent_id: null, created_at: now, updated_at: now,
  };
  bookings.push(b); return b;
};
export const startCheckout = async (bookingId: string): Promise<string> => {
  // Demo: no real Stripe — simulate a successful €1 payment.
  const b = bookings.find((x) => x.id === bookingId);
  if (b) { b.payment_status = 'paid'; b.status = 'confirmed'; }
  toast('Demo: 1 € bezahlt (keine echte Zahlung)');
  return location.href;
};
export const cancelBooking = async (id: string) => {
  const b = bookings.find((x) => x.id === id);
  if (b) b.status = 'cancelled';
};

// ganzen ("Ganzen vor!")
interface DemoGanzen { id: string; from_member_id: string; to_member_id: string; message: string | null; before_photo_url: string | null; after_photo_url: string | null; reply_to: string | null; status: 'open' | 'acknowledged' | 'reciprocated' | 'declined'; acknowledged_at: string | null; email_sent_at: string | null; created_at: string; }
const ganzen: DemoGanzen[] = [
  { id: uid(), from_member_id: 'm4', to_member_id: 'm1', message: 'Lieber Bundesbruder Anna, ich trinke Dir einen Ganzen zuvor! Dein Bundesbruder Markus!', before_photo_url: null, after_photo_url: null, reply_to: null, status: 'open', acknowledged_at: null, email_sent_at: null, created_at: now },
  { id: uid(), from_member_id: 'm1', to_member_id: 'm2', message: 'Lieber Bundesbruder Thomas, ich trinke Dir einen Ganzen zuvor! Dein Bundesbruder Anna!', before_photo_url: null, after_photo_url: null, reply_to: null, status: 'acknowledged', acknowledged_at: now, email_sent_at: null, created_at: now },
  { id: uid(), from_member_id: 'm4', to_member_id: 'm1', message: 'Lieber Bundesbruder Anna, ich trinke Dir einen Ganzen zuvor! Dein Bundesbruder Markus!', before_photo_url: null, after_photo_url: null, reply_to: null, status: 'reciprocated', acknowledged_at: now, email_sent_at: null, created_at: now },
];
export const uploadGanzePhoto = async (file: File) => URL.createObjectURL(file);
export const sendGanzen = async (input: any): Promise<DemoGanzen> => {
  const g: DemoGanzen = { id: uid(), from_member_id: input.from_member_id, to_member_id: input.to_member_id, message: input.message ?? null, before_photo_url: input.before_photo_url ?? null, after_photo_url: input.after_photo_url ?? null, reply_to: input.reply_to ?? null, status: 'open', acknowledged_at: null, email_sent_at: null, created_at: new Date().toISOString() };
  ganzen.push(g); return g;
};
export const listGanzeFeed = (limit = 50) =>
  wait([...ganzen].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, limit).map((g) => ({
    id: g.id, created_at: g.created_at, message: g.message, before_photo_url: g.before_photo_url,
    after_photo_url: g.after_photo_url, status: g.status, from_member_id: g.from_member_id,
    from_name: nameOf(g.from_member_id) ?? '—', to_member_id: g.to_member_id, to_name: nameOf(g.to_member_id) ?? '—',
  })));
export const ganzeHighscore = (limit = 25) => {
  const counts = new Map<string, number>();
  for (const g of ganzen) counts.set(g.from_member_id, (counts.get(g.from_member_id) ?? 0) + 1);
  return wait([...counts.entries()]
    .map(([member_id, ganze]) => ({ member_id, name: nameOf(member_id) ?? '—', ganze }))
    .sort((a, b) => b.ganze - a.ganze).slice(0, limit));
};
export const myGanzePartners = (memberId: string) => {
  const counts = new Map<string, number>();
  for (const g of ganzen) {
    if (g.from_member_id !== memberId && g.to_member_id !== memberId) continue;
    const other = g.from_member_id === memberId ? g.to_member_id : g.from_member_id;
    counts.set(other, (counts.get(other) ?? 0) + 1);
  }
  return wait([...counts.entries()]
    .map(([partner_id, together]) => ({ partner_id, partner_name: nameOf(partner_id) ?? '—', together }))
    .sort((a, b) => b.together - a.together));
};
export const listMyGanzenInbox = (memberId: string) =>
  wait(ganzen.filter((g) => g.to_member_id === memberId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)));
export const acknowledgeGanzen = async (id: string) => { const g = ganzen.find((x) => x.id === id); if (g) { g.status = 'acknowledged'; g.acknowledged_at = now; } };
export const declineGanzen = async (id: string) => { const g = ganzen.find((x) => x.id === id); if (g) { g.status = 'declined'; g.acknowledged_at = now; } };

function remove<T extends { id: string }>(arr: T[], id: string): void {
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
}
