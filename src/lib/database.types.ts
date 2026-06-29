// =============================================================================
// GermaniaApp — Database types
// Hand-written to match schema.sql. Once the schema is live you can regenerate
// this file with:  supabase gen types typescript --project-id <id> > database.types.ts
// The shape below matches what `supabase gen types` produces, so swapping is clean.
// =============================================================================

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
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['gathering']['Row'], 'id'>>;
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
    };
    Views: {
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
export type DirectoryEntry = Database['public']['Views']['member_directory']['Row'];
export type ContactExportRow = Database['public']['Views']['member_contact_export']['Row'];
export type NearbyMember = Database['public']['Functions']['members_near']['Returns'][number];
export type ProfessionMatch = Database['public']['Functions']['members_by_profession']['Returns'][number];
