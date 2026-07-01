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
export const claimMyMember = impl.claimMyMember;
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

// office history (Chargen)
export const listMyOfficeHistory = impl.listMyOfficeHistory;
export const addOfficeHistory = impl.addOfficeHistory;
export const deleteOfficeHistory = impl.deleteOfficeHistory;

// relatives
export const listMyRelatives = impl.listMyRelatives;
export const addRelative = impl.addRelative;
export const deleteRelative = impl.deleteRelative;

// directory & search
export const getDirectory = impl.getDirectory;
export const getMapMarkers = impl.getMapMarkers;
export const listDeceased = impl.listDeceased;
export const membersByProfession = impl.membersByProfession;
export const membersNear = impl.membersNear;

// gatherings
export const listGatherings = impl.listGatherings;
export const createGathering = impl.createGathering;
export const rsvpToGathering = impl.rsvpToGathering;

// export
export const exportContacts = impl.exportContacts;
export const exportContactsCsv = impl.exportContactsCsv;

// stocherkahn
export const getActiveSeason = impl.getActiveSeason;
export const saveSeason = impl.saveSeason;
export const listBookings = impl.listBookings;
export const listMyBookings = impl.listMyBookings;
export const createBooking = impl.createBooking;
export const startCheckout = impl.startCheckout;
export const cancelBooking = impl.cancelBooking;

// offices / Ämter
export const listOffices = impl.listOffices;
export const listMyOfficeTransfers = impl.listMyOfficeTransfers;
export const initiateOfficeTransfer = impl.initiateOfficeTransfer;
export const respondOfficeTransfer = impl.respondOfficeTransfer;
export const reclaimOffice = impl.reclaimOffice;

// ganzen ("Ganzen vor!")
export const uploadGanzePhoto = impl.uploadGanzePhoto;
export const sendGanzen = impl.sendGanzen;
export const listGanzeFeed = impl.listGanzeFeed;
export const ganzeHighscore = impl.ganzeHighscore;
export const myGanzePartners = impl.myGanzePartners;
export const listMyGanzenInbox = impl.listMyGanzenInbox;
export const acknowledgeGanzen = impl.acknowledgeGanzen;
export const declineGanzen = impl.declineGanzen;

// admin
export const getMyRole = impl.getMyRole;
export const isAdmin = impl.isAdmin;
export const isStaff = impl.isStaff;
export const listAllMembers = impl.listAllMembers;
export const setMemberRole = impl.setMemberRole;
export const deleteMember = impl.deleteMember;
export const addProfessionCategory = impl.addProfessionCategory;
export const deleteProfessionCategory = impl.deleteProfessionCategory;

// pure helpers — always the real implementations (no backend needed)
export const mailtoFor = real.mailtoFor;
export const toCsv = real.toCsv;
export const downloadCsv = real.downloadCsv;
export const ageFromDob = real.ageFromDob;
