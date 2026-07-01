// =============================================================================
// GermaniaApp — Data layer
// Typed, app-facing functions over Supabase. UI code imports only from here, so
// the rest of the app never touches raw table names, RLS quirks, or PostGIS WKT.
//
// Convention: every function returns the data and THROWS on error, so callers
// use plain try/catch (or React Query / Svelte's await blocks).
// =============================================================================
import { supabase } from './supabase';
import type {
  Member,
  Address,
  ProfessionCategory,
  MemberProfession,
  Relative,
  RelativeDetail,
  Gathering,
  GatheringAttendance,
  DirectoryEntry,
  DeceasedEntry,
  ContactExportRow,
  NearbyMember,
  ProfessionMatch,
  Rsvp,
  Role,
  StocherkahnSeason,
  StocherkahnBooking,
  Office,
  OfficeTransfer,
  OfficeHistory,
  Ganzen,
  GanzeHighscore,
  GanzeFeed,
  GanzePartner,
} from './database.types';
import { civilDawnDusk } from './suntimes';

// --- small helpers -----------------------------------------------------------
function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Build PostGIS EWKT that PostgREST casts straight into a geography column. */
function toPoint(lat: number, lon: number): string {
  return `SRID=4326;POINT(${lon} ${lat})`;
}

// =============================================================================
// AUTH / SESSION
// =============================================================================
/** The app's own URL incl. path (e.g. https://user.github.io/GermaniaApp/). */
const appUrl = () => window.location.origin + window.location.pathname;

/** Passwordless sign-in: emails a one-time magic link (most secure default). */
export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: appUrl() },
  });
  if (error) throw new Error(error.message);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

/** Sign-up with email confirmation (Supabase sends the verification email). */
export async function signUpWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl() },
  });
  if (error) throw new Error(error.message);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl(),
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/** Subscribe to sign-in / sign-out; returns an unsubscribe function. */
export function onAuthChange(cb: (signedIn: boolean) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(!!session));
  return () => data.subscription.unsubscribe();
}

// =============================================================================
// MY PROFILE  (the logged-in member's own entry)
// =============================================================================
export async function getMyMember(): Promise<Member | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const res = await supabase.from('member').select('*').eq('auth_user_id', uid).maybeSingle();
  return unwrap(res);
}

/** Link the signed-in user to a prefilled (imported) row by verified phone. */
export async function claimMyMember(): Promise<string | null> {
  const { data, error } = await supabase.rpc('claim_my_member');
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** Deceased members (memorial), shown regardless of consent. */
export async function listDeceased(): Promise<DeceasedEntry[]> {
  const res = await supabase
    .from('deceased_directory')
    .select('*')
    .order('last_name');
  return unwrap(res) ?? [];
}

/** Create the member row on first login, linking it to the auth user. */
export async function createMyMember(
  input: Omit<Member, 'id' | 'auth_user_id' | 'created_at' | 'updated_at' | 'status' | 'visibility' | 'show_email' | 'show_address' | 'show_family'> &
    Partial<Pick<Member, 'status' | 'visibility' | 'show_email' | 'show_address' | 'show_family'>>,
): Promise<Member> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Nicht angemeldet.');
  const res = await supabase
    .from('member')
    .insert({ ...input, auth_user_id: uid, consented: true })
    .select('*')
    .single();
  return unwrap(res);
}

/** Update own profile. RLS guarantees you can only touch your own row. */
export async function updateMyMember(patch: Partial<Member>): Promise<Member> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Nicht angemeldet.');
  const res = await supabase
    .from('member')
    .update(patch)
    .eq('auth_user_id', uid)
    .select('*')
    .single();
  return unwrap(res);
}

export async function uploadMyPhoto(file: File): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Nicht angemeldet.');
  const path = `${uid}/${Date.now()}-${file.name}`;
  const up = await supabase.storage.from('member-photos').upload(path, file, { upsert: true });
  if (up.error) throw new Error(up.error.message);
  const { data } = supabase.storage.from('member-photos').getPublicUrl(path);
  await updateMyMember({ photo_url: data.publicUrl });
  return data.publicUrl;
}

// =============================================================================
// ADDRESSES  (own; geocoded so the map + proximity search work)
// =============================================================================
export async function listMyAddresses(memberId: string): Promise<Address[]> {
  const res = await supabase.from('address').select('*').eq('member_id', memberId);
  return unwrap(res) ?? [];
}

export interface AddressInput {
  member_id: string;
  label?: Address['label'];
  is_primary?: boolean;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  region?: string;
  country_code?: string;
  /** If lat/lon are omitted, geocodeAddress() is called to fill them. */
  lat?: number;
  lon?: number;
}

/** Geocode an address via the `geocode` Edge Function (keeps the API key server-side). */
export async function geocodeAddress(parts: {
  street?: string;
  postal_code?: string;
  city?: string;
  country_code?: string;
}): Promise<{ lat: number; lon: number } | null> {
  const { data, error } = await supabase.functions.invoke('geocode', { body: parts });
  if (error) throw new Error(error.message);
  return (data as { lat: number; lon: number } | null) ?? null;
}

export async function upsertMyAddress(input: AddressInput): Promise<Address> {
  let { lat, lon } = input;
  if (lat == null || lon == null) {
    const geo = await geocodeAddress(input);
    if (geo) ({ lat, lon } = geo);
  }
  const row = {
    member_id: input.member_id,
    label: input.label ?? 'home',
    is_primary: input.is_primary ?? true,
    street: input.street ?? null,
    house_number: input.house_number ?? null,
    postal_code: input.postal_code ?? null,
    city: input.city ?? null,
    region: input.region ?? null,
    country_code: input.country_code ?? null,
    geo: lat != null && lon != null ? toPoint(lat, lon) : null,
  };
  const res = await supabase.from('address').insert(row).select('*').single();
  return unwrap(res);
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from('address').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// =============================================================================
// PROFESSIONS  (precise free-text title + optional taxonomy)
// =============================================================================
export async function listProfessionCategories(): Promise<ProfessionCategory[]> {
  const res = await supabase.from('profession_category').select('*').order('name');
  return unwrap(res) ?? [];
}

export async function listMyProfessions(memberId: string): Promise<MemberProfession[]> {
  const res = await supabase
    .from('member_profession')
    .select('*')
    .eq('member_id', memberId)
    .order('is_primary', { ascending: false });
  return unwrap(res) ?? [];
}

export async function addMyProfession(input: {
  member_id: string;
  title: string;
  category_id?: string | null;
  organization?: string | null;
  is_primary?: boolean;
}): Promise<MemberProfession> {
  const res = await supabase
    .from('member_profession')
    .insert({
      member_id: input.member_id,
      title: input.title,
      category_id: input.category_id ?? null,
      organization: input.organization ?? null,
      is_primary: input.is_primary ?? true,
    })
    .select('*')
    .single();
  return unwrap(res);
}

export async function updateMyProfession(
  id: string,
  patch: Partial<Pick<MemberProfession, 'title' | 'category_id' | 'organization' | 'is_primary'>>,
): Promise<MemberProfession> {
  const res = await supabase.from('member_profession').update(patch).eq('id', id).select('*').single();
  return unwrap(res);
}

export async function deleteMyProfession(id: string): Promise<void> {
  const { error } = await supabase.from('member_profession').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// =============================================================================
// OFFICE HISTORY / CHARGEN  (a member's past x / xx / xxx terms)
// =============================================================================
export async function listMyOfficeHistory(memberId: string): Promise<OfficeHistory[]> {
  const res = await supabase
    .from('office_history')
    .select('*')
    .eq('member_id', memberId)
    .order('semester', { ascending: false });
  return unwrap(res) ?? [];
}

export async function addOfficeHistory(input: {
  member_id: string;
  office_code: OfficeHistory['office_code'];
  semester?: string | null;
}): Promise<OfficeHistory> {
  const res = await supabase.from('office_history').insert(input).select('*').single();
  return unwrap(res);
}

export async function deleteOfficeHistory(id: string): Promise<void> {
  const { error } = await supabase.from('office_history').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// =============================================================================
// RELATIVES  (spouses & children)
// =============================================================================
/** Relatives of a member, each with derived age + assembled address. */
export async function listMyRelatives(memberId: string): Promise<RelativeDetail[]> {
  const res = await supabase.from('relative_detail').select('*').eq('member_id', memberId);
  return unwrap(res) ?? [];
}

export interface RelativeInput {
  member_id: string;
  relationship: Relative['relationship'];
  first_name: string;
  last_name?: string | null;
  date_of_birth?: string | null;
  gender?: Relative['gender'];
  email?: string | null;
  // Own address (optional). Geocoded if lat/lon not supplied.
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
  lat?: number;
  lon?: number;
}

export async function addRelative(input: RelativeInput): Promise<Relative> {
  let { lat, lon } = input;
  const hasAddress = input.street || input.city || input.postal_code;
  if (hasAddress && (lat == null || lon == null)) {
    const geo = await geocodeAddress({
      street: input.street ?? undefined,
      postal_code: input.postal_code ?? undefined,
      city: input.city ?? undefined,
      country_code: input.country_code ?? undefined,
    }).catch(() => null);
    if (geo) ({ lat, lon } = geo);
  }
  const { lat: _la, lon: _lo, ...rest } = input;
  const res = await supabase
    .from('relative')
    .insert({ ...rest, geo: lat != null && lon != null ? toPoint(lat, lon) : null })
    .select('*')
    .single();
  return unwrap(res);
}

/** Whole-year age from an ISO date string (client-side display helper). */
export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export async function updateRelative(id: string, patch: Partial<Relative>): Promise<Relative> {
  const res = await supabase.from('relative').update(patch).eq('id', id).select('*').single();
  return unwrap(res);
}

export async function deleteRelative(id: string): Promise<void> {
  const { error } = await supabase.from('relative').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// =============================================================================
// DIRECTORY & SEARCH
// =============================================================================
export interface DirectoryFilter {
  city?: string;
  countryCode?: string;
  limit?: number;
  offset?: number;
}

export async function getDirectory(filter: DirectoryFilter = {}): Promise<DirectoryEntry[]> {
  let q = supabase.from('member_directory').select('*').eq('status', 'active');
  if (filter.city) q = q.eq('city', filter.city);
  if (filter.countryCode) q = q.eq('country_code', filter.countryCode);
  q = q
    .order('last_name')
    .range(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 100) - 1);
  return unwrap(await q) ?? [];
}

/** Members with a geocoded primary address, for the map. */
export async function getMapMarkers(): Promise<DirectoryEntry[]> {
  const res = await supabase
    .from('member_directory')
    .select('*')
    .not('latitude', 'is', null);
  return unwrap(res) ?? [];
}

export async function membersNear(
  lat: number,
  lon: number,
  radiusKm = 50,
): Promise<NearbyMember[]> {
  const res = await supabase.rpc('members_near', { lat, lon, radius_km: radiusKm });
  return unwrap(res) ?? [];
}

export async function membersByProfession(query: string): Promise<ProfessionMatch[]> {
  const res = await supabase.rpc('members_by_profession', { q: query });
  return unwrap(res) ?? [];
}

// =============================================================================
// GATHERINGS
// =============================================================================
export async function listGatherings(
  opts: { from?: string; category?: Gathering['category'] } = {},
): Promise<Gathering[]> {
  let q = supabase.from('gathering').select('*');
  if (opts.from) q = q.gte('starts_at', opts.from);
  if (opts.category) q = q.eq('category', opts.category);
  return unwrap(await q.order('starts_at')) ?? [];
}

export async function createGathering(
  input: Omit<Gathering, 'id' | 'created_at' | 'updated_at' | 'visibility' | 'category' | 'semester'> &
    Partial<Pick<Gathering, 'visibility' | 'category' | 'semester'>>,
): Promise<Gathering> {
  const res = await supabase.from('gathering').insert(input).select('*').single();
  return unwrap(res);
}

export async function rsvpToGathering(
  gatheringId: string,
  memberId: string,
  rsvp: Rsvp,
  guests = 0,
): Promise<GatheringAttendance> {
  const res = await supabase
    .from('gathering_attendance')
    .upsert({ gathering_id: gatheringId, member_id: memberId, rsvp, guests })
    .select('*')
    .single();
  return unwrap(res);
}

// =============================================================================
// STOCHERKAHN (the society boat) — season + bookings + Stripe checkout
// =============================================================================
export async function getActiveSeason(): Promise<StocherkahnSeason | null> {
  const res = await supabase
    .from('stocherkahn_season')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();
  return unwrap(res);
}

/** Admin: create or update the active season (dates + location). */
export async function saveSeason(input: {
  name?: string | null;
  water_date: string;
  withdraw_date: string;
  latitude?: number;
  longitude?: number;
}): Promise<StocherkahnSeason> {
  const existing = await getActiveSeason();
  if (existing) {
    const res = await supabase
      .from('stocherkahn_season')
      .update(input)
      .eq('id', existing.id)
      .select('*')
      .single();
    return unwrap(res);
  }
  const res = await supabase
    .from('stocherkahn_season')
    .insert({ ...input, is_active: true })
    .select('*')
    .single();
  return unwrap(res);
}

export async function listBookings(seasonId: string): Promise<StocherkahnBooking[]> {
  const res = await supabase
    .from('stocherkahn_booking')
    .select('*')
    .eq('season_id', seasonId)
    .neq('status', 'cancelled')
    .order('booking_date');
  return unwrap(res) ?? [];
}

export async function listMyBookings(memberId: string): Promise<StocherkahnBooking[]> {
  const res = await supabase
    .from('stocherkahn_booking')
    .select('*')
    .eq('member_id', memberId)
    .order('booking_date');
  return unwrap(res) ?? [];
}

/**
 * Book the boat for an HOURLY window on a given date. The window must lie within
 * that date's dawn–dusk (computed from the season location). Fee = €1 per hour.
 * Overlapping bookings are rejected by the database (no_booking_overlap).
 */
export async function createBooking(
  memberId: string,
  date: string,
  startsAt: Date | string,
  endsAt: Date | string,
): Promise<StocherkahnBooking> {
  const season = await getActiveSeason();
  if (!season) throw new Error('Der Stocherkahn ist derzeit nicht im Wasser (keine aktive Saison).');
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (e <= s) throw new Error('Die Endzeit muss nach der Startzeit liegen.');
  const { dawn, dusk } = civilDawnDusk(date, season.latitude, season.longitude);
  if (!dawn || !dusk) throw new Error('An diesem Tag gibt es kein Tageslichtfenster.');
  if (s < dawn || e > dusk) {
    throw new Error('Die Buchung muss zwischen Morgen- und Abenddämmerung liegen.');
  }
  const hours = Math.max(1, Math.round((+e - +s) / 3_600_000));
  const res = await supabase
    .from('stocherkahn_booking')
    .insert({
      season_id: season.id,
      member_id: memberId,
      booking_date: date,
      starts_at: s.toISOString(),
      ends_at: e.toISOString(),
      fee_cents: hours * 100,
    })
    .select('*')
    .single();
  if (res.error && /overlap|exclu/i.test(res.error.message)) {
    throw new Error('Dieser Zeitraum ist bereits belegt.');
  }
  return unwrap(res);
}

/** Start Stripe checkout for a booking's €1 fee; returns the URL to redirect to. */
export async function startCheckout(bookingId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { booking_id: bookingId, success_url: location.href, cancel_url: location.href },
  });
  if (error) throw new Error(error.message);
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error('Bezahlung konnte nicht gestartet werden.');
  return url;
}

export async function cancelBooking(id: string): Promise<void> {
  const { error } = await supabase.from('stocherkahn_booking').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw new Error(error.message);
}

// =============================================================================
// OFFICES / ÄMTER  (Sprecher, Fechtwart, Schriftwart) + two-party handover
// =============================================================================
export async function listOffices(): Promise<Office[]> {
  const res = await supabase.from('office_directory').select('*').order('code');
  return unwrap(res) ?? [];
}

/** Pending transfers that involve me (either as outgoing or incoming). */
export async function listMyOfficeTransfers(memberId: string): Promise<OfficeTransfer[]> {
  const res = await supabase
    .from('office_transfer')
    .select('*')
    .eq('status', 'pending')
    .or(`from_member_id.eq.${memberId},to_member_id.eq.${memberId}`);
  return unwrap(res) ?? [];
}

/** Start a handover: as holder pass to `toMemberId`, or as member claim (omit it). */
export async function initiateOfficeTransfer(officeId: string, toMemberId?: string): Promise<void> {
  const { error } = await supabase.rpc('initiate_office_transfer', {
    p_office: officeId, p_to: toMemberId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function respondOfficeTransfer(transferId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_office_transfer', {
    p_transfer: transferId, p_accept: accept,
  });
  if (error) throw new Error(error.message);
}

export async function reclaimOffice(officeId: string, semester: string): Promise<void> {
  const { error } = await supabase.rpc('reclaim_office', { p_office: officeId, p_semester: semester });
  if (error) throw new Error(error.message);
}

// =============================================================================
// GANZEN  ("Ganzen vor!") — social beer-toast gamification
// =============================================================================
export async function uploadGanzePhoto(file: File, kind: 'before' | 'after'): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Nicht angemeldet.');
  const path = `${uid}/${Date.now()}-${kind}-${file.name}`;
  const up = await supabase.storage.from('ganze-photos').upload(path, file, { upsert: true });
  if (up.error) throw new Error(up.error.message);
  return supabase.storage.from('ganze-photos').getPublicUrl(path).data.publicUrl;
}

export async function sendGanzen(input: {
  from_member_id: string;
  to_member_id: string;
  message: string;
  before_photo_url?: string | null;
  after_photo_url?: string | null;
  reply_to?: string | null;
}): Promise<Ganzen> {
  const res = await supabase.from('ganzen').insert(input).select('*').single();
  return unwrap(res);
}

export async function listGanzeFeed(limit = 50): Promise<GanzeFeed[]> {
  const res = await supabase.from('ganze_feed').select('*').limit(limit);
  return unwrap(res) ?? [];
}

export async function ganzeHighscore(limit = 25): Promise<GanzeHighscore[]> {
  const res = await supabase.from('ganze_highscore').select('*').limit(limit);
  return unwrap(res) ?? [];
}

export async function myGanzePartners(memberId: string): Promise<GanzePartner[]> {
  const res = await supabase.rpc('ganze_partners', { p_member: memberId });
  return unwrap(res) ?? [];
}

export async function listMyGanzenInbox(memberId: string): Promise<Ganzen[]> {
  const res = await supabase
    .from('ganzen')
    .select('*')
    .eq('to_member_id', memberId)
    .order('created_at', { ascending: false });
  return unwrap(res) ?? [];
}

export async function acknowledgeGanzen(id: string): Promise<void> {
  const { error } = await supabase
    .from('ganzen')
    .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function declineGanzen(id: string): Promise<void> {
  const { error } = await supabase
    .from('ganzen')
    .update({ status: 'declined', acknowledged_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// =============================================================================
// ADMIN  (gated by RLS — these only succeed for staff/admin members)
// =============================================================================
export async function getMyRole(): Promise<Role> {
  const m = await getMyMember();
  return m?.role ?? 'member';
}
export async function isAdmin(): Promise<boolean> {
  return (await getMyRole()) === 'admin';
}
export async function isStaff(): Promise<boolean> {
  return ['admin', 'officer'].includes(await getMyRole());
}

/** All members (admin view) with role, for the admin screen. */
export async function listAllMembers(): Promise<Member[]> {
  const res = await supabase.from('member').select('*').order('last_name');
  return unwrap(res) ?? [];
}

export async function setMemberRole(target: string, role: Role): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', { target, new_role: role });
  if (error) throw new Error(error.message);
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('member').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addProfessionCategory(
  name: string,
  slug: string,
  parentId: string | null = null,
): Promise<ProfessionCategory> {
  const res = await supabase
    .from('profession_category')
    .insert({ name, slug, parent_id: parentId })
    .select('*')
    .single();
  return unwrap(res);
}

export async function deleteProfessionCategory(id: string): Promise<void> {
  const { error } = await supabase.from('profession_category').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// =============================================================================
// CONTACT & EXPORT
// =============================================================================
/** Build a mailto: link for one or many members (BCC for group privacy). */
export function mailtoFor(
  emails: string[],
  opts: { subject?: string; body?: string; group?: boolean } = {},
): string {
  const clean = emails.filter(Boolean);
  const params = new URLSearchParams();
  // Group mail → put everyone in BCC so addresses aren't exposed to each other.
  if (opts.group) params.set('bcc', clean.join(','));
  if (opts.subject) params.set('subject', opts.subject);
  if (opts.body) params.set('body', opts.body);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return opts.group ? `mailto:${qs}` : `mailto:${clean.join(',')}${qs}`;
}

/** Turn rows into a CSV string (RFC-4180 quoting). */
export function toCsv<T extends Record<string, unknown>>(rows: T[], columns?: (keyof T)[]): string {
  if (rows.length === 0) return '';
  const cols = (columns ?? (Object.keys(rows[0]) as (keyof T)[]));
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.map((c) => esc(String(c))).join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
  return `${head}\n${body}`;
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export a privacy-filtered contact list (emails + postal addresses) for the
 * given members. Reads member_contact_export, which already honours each
 * member's show_email / show_address settings.
 */
export async function exportContacts(memberIds: string[]): Promise<ContactExportRow[]> {
  if (memberIds.length === 0) return [];
  const res = await supabase
    .from('member_contact_export')
    .select('*')
    .in('member_id', memberIds);
  return unwrap(res) ?? [];
}

/** Convenience: search result -> downloaded CSV in one call. */
export async function exportContactsCsv(memberIds: string[], filename = 'contacts.csv'): Promise<void> {
  const rows = await exportContacts(memberIds);
  downloadCsv(filename, toCsv(rows));
}
