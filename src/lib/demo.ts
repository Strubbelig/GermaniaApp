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
  Gathering, GatheringAttendance, DirectoryEntry, NearbyMember, ProfessionMatch, Rsvp,
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
  maiden_name: null, date_of_birth: s.dob, gender: s.gender, email: s.email, phone: s.phone,
  website: null, photo_url: null, bio: s.bio, member_since: null, status: 'active',
  visibility: 'members', show_email: true, show_address: true, show_family: true,
  created_at: now, updated_at: now,
}));

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

const gatherings: Gathering[] = [
  gat('Berlin Monthly Stammtisch', 'Casual dinner, first Friday each month.', 'Restaurant Lutter', 'Berlin', 'DE', '2026-07-03T19:00:00Z', 'FREQ=MONTHLY;BYDAY=1FR', 'm1'),
  gat('Zurich Weekly Lunch', 'Members lunch every Wednesday.', 'Café Sprüngli', 'Zurich', 'CH', '2026-07-01T12:30:00Z', 'FREQ=WEEKLY;BYDAY=WE', 'm4'),
  gat('New York Quarterly Gala', 'Black-tie networking evening.', 'The Plaza', 'New York', 'US', '2026-09-19T18:30:00Z', 'FREQ=MONTHLY;INTERVAL=3;BYDAY=3SA', 'm6'),
  gat('London Members Dinner', 'Quarterly dinner in the City.', 'The Ivy', 'London', 'GB', '2026-07-17T19:30:00Z', 'FREQ=MONTHLY;INTERVAL=3;BYDAY=3FR', 'm7'),
];
function gat(
  title: string, description: string, venue: string, city: string, cc: string,
  starts: string, rule: string, host: string,
): Gathering {
  const s = SRC.find((x) => x.id === host)!;
  return {
    id: uid(), title, description, venue_name: venue, street: null, city, region: null,
    country_code: cc, geo: `POINT(${s.lon} ${s.lat})`, starts_at: starts, ends_at: null,
    timezone: null, recurrence_rule: rule, host_member_id: host, visibility: 'members',
    created_at: now, updated_at: now,
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
    age: ageFromDob(m.date_of_birth), profession: p?.title ?? null,
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
export const signOut = async () => { toast('Demo mode — sign-out is disabled'); };
export const signInWithMagicLink = async () => { toast('Demo mode — already signed in'); };
export const signInWithPassword = async () => { toast('Demo mode — already signed in'); };
export const signUpWithPassword = async () => { toast('Demo mode — already signed in'); };
export const sendPasswordReset = async () => { toast('Demo mode'); };

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
export const getDirectory = () => wait(members.map(directoryFor).sort((a, b) => a.last_name.localeCompare(b.last_name)));
export const getMapMarkers = () => wait(members.map(directoryFor).filter((d) => d.latitude != null));
export const membersByProfession = (q: string): Promise<ProfessionMatch[]> => {
  const t = q.toLowerCase();
  return wait(professions.filter((p) => {
    const c = categories.find((x) => x.id === p.category_id);
    return p.title.toLowerCase().includes(t) || (c?.name.toLowerCase().includes(t) ?? false);
  }).map((p) => {
    const m = members.find((x) => x.id === p.member_id)!;
    const a = addresses.find((x) => x.member_id === p.member_id && x.is_primary);
    return { member_id: m.id, full_name: `${m.first_name} ${m.last_name}`, email: m.email, profession: p.title, organization: p.organization, city: a?.city ?? null, country_code: a?.country_code ?? null };
  }));
};
export const membersNear = (lat: number, lon: number, radiusKm = 50): Promise<NearbyMember[]> => {
  const rows: NearbyMember[] = [];
  for (const m of members) {
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
export const listGatherings = () => wait([...gatherings].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)));
export const createGathering = async (input: any) => {
  const g: Gathering = { id: uid(), created_at: now, updated_at: now, visibility: 'members', ...input };
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

function remove<T extends { id: string }>(arr: T[], id: string): void {
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
}
