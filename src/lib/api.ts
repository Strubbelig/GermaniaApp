// =============================================================================
// GermaniaApp — API facade
// Screens import from here. It serves REAL Supabase queries when credentials are
// present, or the in-memory DEMO data otherwise (e.g. the GitHub Pages preview).
// Pure helpers (mailtoFor/toCsv/downloadCsv/ageFromDob) always come from queries.
// =============================================================================
import { supabaseConfigured } from './supabase';
import * as real from './queries';
import * as demo from './demo';

export const DEMO = !supabaseConfigured;
const impl = DEMO ? demo : real;

// auth
export const hasSession = impl.hasSession;
export const onAuthChange = impl.onAuthChange;
export const signOut = impl.signOut;
export const signInWithMagicLink = impl.signInWithMagicLink;
export const signInWithPassword = impl.signInWithPassword;
export const signUpWithPassword = impl.signUpWithPassword;
export const sendPasswordReset = impl.sendPasswordReset;

// profile
export const getMyMember = impl.getMyMember;
export const createMyMember = impl.createMyMember;
export const updateMyMember = impl.updateMyMember;
export const uploadMyPhoto = impl.uploadMyPhoto;

// professions
export const listProfessionCategories = impl.listProfessionCategories;
export const listMyProfessions = impl.listMyProfessions;
export const addMyProfession = impl.addMyProfession;
export const deleteMyProfession = impl.deleteMyProfession;

// addresses
export const listMyAddresses = impl.listMyAddresses;
export const upsertMyAddress = impl.upsertMyAddress;
export const deleteAddress = impl.deleteAddress;

// relatives
export const listMyRelatives = impl.listMyRelatives;
export const addRelative = impl.addRelative;
export const deleteRelative = impl.deleteRelative;

// directory & search
export const getDirectory = impl.getDirectory;
export const getMapMarkers = impl.getMapMarkers;
export const membersByProfession = impl.membersByProfession;
export const membersNear = impl.membersNear;

// gatherings
export const listGatherings = impl.listGatherings;
export const createGathering = impl.createGathering;
export const rsvpToGathering = impl.rsvpToGathering;

// export
export const exportContacts = impl.exportContacts;
export const exportContactsCsv = impl.exportContactsCsv;

// pure helpers — always the real implementations (no backend needed)
export const mailtoFor = real.mailtoFor;
export const toCsv = real.toCsv;
export const downloadCsv = real.downloadCsv;
export const ageFromDob = real.ageFromDob;
