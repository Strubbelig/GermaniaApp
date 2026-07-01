// =============================================================================
// GermaniaApp — Database types
// Hand-written to match schema.sql. Once the schema is live you can regenerate
// this file with:  supabase gen types typescript --project-id <id> > database.types.ts
// The shape below matches what `supabase gen types` produces, so swapping is clean.
// =============================================================================

export type Role = 'member' | 'officer' | 'admin';
export type GatheringCategory = 'stammtisch' | 'semesterprogramm' | 'pauktag' | 'other';
export type OfficeCode = 'sprecher' | 'fechtwart' | 'schriftwart';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type Visibility = 'members' | 'officers' | 'private';
export type Gender = 'female' | 'male' | 'other' | 'undisclosed';
export type MemberStatus = 'active' | 'inactive' | 'deceased' | 'pending';
export type AddressLabel = 'home' | 'work' | 'holiday' | 'other';
export type Relationship = 'spouse' | 'partner' | 'child' | 'other';
export type Rsvp = 'yes' | 'no' | 'maybe';
export type GatheringVisibility = 'members' | 'public' | 'private';

export interface Database {
  public: {
    Tables: {
      member: {
        Row: {
          id: string;
          auth_user_id: string | null;
          salutation: string | null;
          first_name: string;
          last_name: string;
          maiden_name: string | null;
          date_of_birth: string | null;
          gender: Gender | null;
          email: string;
          phone: string | null;
          website: string | null;
          photo_url: string | null;
          bio: string | null;
          member_since: string | null;
          status: MemberStatus;
          role: Role;
          visibility: Visibility;
          show_email: boolean;
          show_address: boolean;
          show_family: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['member']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['member']['Row'], 'id'>>;
        Update: Partial<Database['public']['Tables']['member']['Insert']>;
      };
      address: {
        Row: {
          id: string;
          member_id: string;
          label: AddressLabel;
          is_primary: boolean;
          street: string | null;
          house_number: string | null;
          address_line2: string | null;
          postal_code: string | null;
          city: string | null;
          region: string | null;
          country_code: string | null;
          geo: string | null; // WKB/EWKT as returned by PostGIS
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['address']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['address']['Row'], 'id'>>;
        Update: Partial<Database['public']['Tables']['address']['Insert']>;
      };
      profession_category: {
        Row: {
          id: string;
          parent_id: string | null;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profession_category']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['profession_category']['Insert']>;
      };
      member_profession: {
        Row: {
          id: string;
          member_id: string;
          category_id: string | null;
          title: string;
          organization: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['member_profession']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['member_profession']['Row'], 'id'>>;
        Update: Partial<Database['public']['Tables']['member_profession']['Insert']>;
      };
      relative: {
        Row: {
          id: string;
          member_id: string;
          relationship: Relationship;
          first_name: string;
          last_name: string | null;
          date_of_birth: string | null;
          gender: Gender | null;
          email: string | null;
          street: string | null;
          house_number: string | null;
          postal_code: string | null;
          city: string | null;
          region: string | null;
          country_code: string | null;
          geo: string | null;
          related_member_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['relative']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['relative']['Row'], 'id'>>;
        Update: Partial<Database['public']['Tables']['relative']['Insert']>;
      };
      gathering: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category: GatheringCategory;
          semester: string | null;
          venue_name: string | null;
          street: string | null;
          city: string | null;
          region: string | null;
          country_code: string | null;
          geo: string | null;
          starts_at: string;
          ends_at: string | null;
          timezone: string | null;
          recurrence_rule: string | null;
          host_member_id: string | null;
          visibility: GatheringVisibility;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['gathering']['Row'],
          'id' | 'created_at' | 'updated_at' | 'category' | 'semester' | 'visibility'
        > &
          Partial<Pick<Database['public']['Tables']['gathering']['Row'], 'id' | 'category' | 'semester' | 'visibility'>>;
        Update: Partial<Database['public']['Tables']['gathering']['Insert']>;
      };
      gathering_attendance: {
        Row: {
          gathering_id: string;
          member_id: string;
          rsvp: Rsvp;
          guests: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['gathering_attendance']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['gathering_attendance']['Insert']>;
      };
      stocherkahn_season: {
        Row: {
          id: string;
          name: string | null;
          water_date: string;
          withdraw_date: string;
          latitude: number;
          longitude: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stocherkahn_season']['Row'], 'id' | 'created_at' | 'updated_at'> &
          Partial<Pick<Database['public']['Tables']['stocherkahn_season']['Row'], 'id' | 'latitude' | 'longitude' | 'is_active'>>;
        Update: Partial<Database['public']['Tables']['stocherkahn_season']['Insert']>;
      };
      stocherkahn_booking: {
        Row: {
          id: string;
          season_id: string;
          member_id: string;
          booking_date: string;
          starts_at: string;
          ends_at: string;
          status: BookingStatus;
          fee_cents: number;
          currency: string;
          payment_status: PaymentStatus;
          stripe_session_id: string | null;
          stripe_payment_intent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stocherkahn_booking']['Row'], 'id' | 'created_at' | 'updated_at' | 'status' | 'fee_cents' | 'currency' | 'payment_status' | 'stripe_session_id' | 'stripe_payment_intent_id'> &
          Partial<Pick<Database['public']['Tables']['stocherkahn_booking']['Row'], 'id' | 'status' | 'fee_cents' | 'currency' | 'payment_status'>>;
        Update: Partial<Database['public']['Tables']['stocherkahn_booking']['Row']>;
      };
    };
      office: {
        Row: {
          id: string;
          code: OfficeCode;
          title: string;
          current_holder_id: string | null;
          term_semester: string | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['office']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['office']['Row']>;
      };
      office_transfer: {
        Row: {
          id: string;
          office_id: string;
          from_member_id: string | null;
          to_member_id: string;
          initiated_by: string;
          status: 'pending' | 'accepted' | 'declined' | 'cancelled';
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['office_transfer']['Row'], 'id' | 'created_at' | 'resolved_at' | 'status'> &
          Partial<Pick<Database['public']['Tables']['office_transfer']['Row'], 'status'>>;
        Update: Partial<Database['public']['Tables']['office_transfer']['Row']>;
      };
    };
    Views: {
      office_directory: {
        Row: {
          id: string;
          code: OfficeCode;
          title: string;
          current_holder_id: string | null;
          term_semester: string | null;
          updated_at: string;
          holder_name: string | null;
        };
      };
      member_directory: {
        Row: {
          id: string;
          salutation: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          photo_url: string | null;
          status: MemberStatus;
          visibility: Visibility;
          show_email: boolean;
          date_of_birth: string;
          age: number | null;
          profession: string | null;
          profession_category: string | null;
          street: string | null;
          house_number: string | null;
          postal_code: string | null;
          city: string | null;
          region: string | null;
          country_code: string | null;
          geo: string | null;
          latitude: number | null;
          longitude: number | null;
        };
      };
      member_contact_export: {
        Row: {
          member_id: string;
          salutation: string | null;
          first_name: string;
          last_name: string;
          email: string | null;
          postal_address: string | null;
        };
      };
      relative_detail: {
        Row: Database['public']['Tables']['relative']['Row'] & {
          age: number | null;
          full_address: string | null;
        };
      };
    };
    Functions: {
      members_near: {
        Args: { lat: number; lon: number; radius_km?: number };
        Returns: {
          member_id: string;
          full_name: string;
          email: string;
          profession: string | null;
          city: string | null;
          country_code: string | null;
          distance_km: number;
        }[];
      };
      members_by_profession: {
        Args: { q: string };
        Returns: {
          member_id: string;
          full_name: string;
          email: string;
          profession: string;
          organization: string | null;
          city: string | null;
          country_code: string | null;
        }[];
      };
      current_member_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      set_member_role: {
        Args: { target: string; new_role: Role };
        Returns: undefined;
      };
      initiate_office_transfer: {
        Args: { p_office: string; p_to: string | null };
        Returns: string | null;
      };
      respond_office_transfer: {
        Args: { p_transfer: string; p_accept: boolean };
        Returns: undefined;
      };
      reclaim_office: {
        Args: { p_office: string; p_semester: string };
        Returns: undefined;
      };
    };
  };
}

// Convenience row aliases used across the app -------------------------------
export type Member = Database['public']['Tables']['member']['Row'];
export type Address = Database['public']['Tables']['address']['Row'];
export type ProfessionCategory = Database['public']['Tables']['profession_category']['Row'];
export type MemberProfession = Database['public']['Tables']['member_profession']['Row'];
export type Relative = Database['public']['Tables']['relative']['Row'];
export type RelativeDetail = Database['public']['Views']['relative_detail']['Row'];
export type Gathering = Database['public']['Tables']['gathering']['Row'];
export type GatheringAttendance = Database['public']['Tables']['gathering_attendance']['Row'];
export type StocherkahnSeason = Database['public']['Tables']['stocherkahn_season']['Row'];
export type StocherkahnBooking = Database['public']['Tables']['stocherkahn_booking']['Row'];
export type Office = Database['public']['Views']['office_directory']['Row'];
export type OfficeTransfer = Database['public']['Tables']['office_transfer']['Row'];
export type DirectoryEntry = Database['public']['Views']['member_directory']['Row'];
export type ContactExportRow = Database['public']['Views']['member_contact_export']['Row'];
export type NearbyMember = Database['public']['Functions']['members_near']['Returns'][number];
export type ProfessionMatch = Database['public']['Functions']['members_by_profession']['Returns'][number];
