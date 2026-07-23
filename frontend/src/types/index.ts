// User Profile Types
export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  city: string | null;
  country: string | null;
  is_public: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Album Types
export interface Album {
  id: string;
  title: string;
  description: string | null;
  total_stickers: number;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Sticker Types
export interface Sticker {
  id: string;
  section_id: string;
  sticker_number: number;
  name: string;
  category_or_team: string | null;
  image_url: string | null;
  created_at: string;
}

export interface StickerDraft {
  sticker_number: number;
  name: string;
  category_or_team?: string | null;
}

export interface AlbumCreationInput {
  title: string;
  description: string;
  image_url: string;
  stickers: StickerDraft[];
}

// User Sticker Types
export interface UserSticker {
  id: string;
  user_id: string;
  sticker_id: string;
  quantity_owned: number;
  quantity_repeated: number;
  updated_at: string;
}

// User Album Types
export interface UserAlbum {
  id: string;
  user_id: string;
  album_id: string;
  activated_at: string;
}

// Private Group Types
export interface PrivateGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Group Member Types
export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  role: 'admin' | 'member';
}

// Auth Types
export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  user: AuthUser | null;
  access_token: string | null;
  refresh_token: string | null;
}

export interface DetectedStickerNumber {
  stickerNumber: number;
  count: number;
}

export interface ScanRepeatedResponse {
  detectedNumbers: DetectedStickerNumber[];
  rawText?: string;
  model?: string;
  missingByPrefix?: Array<{ prefix: string; numbers: number[] }>;
  repeatedByPrefix?: Array<{ prefix: string; numbers: number[] }>;
}

export interface AlbumSection {
  id: string;
  album_id: string;
  name: string;
  prefix: string;
  total_stickers: number;
}

export interface ExchangeNotification {
  id: string;
  from_user_id: string;
  to_user_id: string;
  album_id: string;
  sticker_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  read_at: string | null;
}

export interface ExchangePartner {
  user_id: string;
  username: string;
  city: string;
  repeated_count: number;
}

export interface ExchangeCommitment {
  id: string;
  created_by: string;
  counterparty_id: string;
  album_id: string;
  sticker_id: string;
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}
