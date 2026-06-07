import type {
  UserRole,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  ShiftStatus,
  PatrolStatus,
  MediaType,
} from './enums'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  tax_id: string | null
  plan: 'free' | 'pro' | 'enterprise'
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string
  role: UserRole
  first_name: string
  last_name: string
  avatar_url: string | null
  phone: string | null
  badge_number: string | null
  id_document: string | null
  address: string | null
  emergency_contact: Record<string, string> | null
  is_active: boolean
  last_seen_at: string | null
  fcm_token: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Site {
  id: string
  organization_id: string
  client_id: string | null
  name: string
  address: string
  lat: number | null
  lng: number | null
  geofence_radius: number
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  consignas: string | null
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Checkpoint {
  id: string
  site_id: string
  organization_id: string
  name: string
  description: string | null
  qr_code: string
  lat: number | null
  lng: number | null
  order_index: number
  is_active: boolean
  created_at: string
}

export interface Shift {
  id: string
  organization_id: string
  site_id: string
  guard_id: string
  supervisor_id: string | null
  scheduled_start: string
  scheduled_end: string
  actual_start: string | null
  actual_end: string | null
  status: ShiftStatus
  start_lat: number | null
  start_lng: number | null
  end_lat: number | null
  end_lng: number | null
  start_selfie_url: string | null
  end_selfie_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Relations
  site?: Site
  guard?: Profile
  supervisor?: Profile
}

export interface GuardLocation {
  id: string
  guard_id: string
  shift_id: string | null
  lat: number
  lng: number
  accuracy: number | null
  battery: number | null
  is_online: boolean
  recorded_at: string
}

export interface GuardLog {
  id: string
  shift_id: string
  guard_id: string
  site_id: string
  organization_id: string
  content: string
  ai_enhanced: string | null
  lat: number | null
  lng: number | null
  is_synced: boolean
  recorded_at: string
  created_at: string
  // Relations
  guard?: Profile
  site?: Site
}

export interface Incident {
  id: string
  organization_id: string
  site_id: string
  reported_by: string
  assigned_to: string | null
  category: IncidentCategory
  severity: IncidentSeverity
  status: IncidentStatus
  title: string
  description: string
  ai_description: string | null
  lat: number | null
  lng: number | null
  is_panic: boolean
  shift_id: string | null
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
  // Relations
  site?: Site
  reporter?: Profile
  assignee?: Profile
  media?: Media[]
  updates?: IncidentUpdate[]
}

export interface IncidentUpdate {
  id: string
  incident_id: string
  author_id: string
  content: string
  status_change: IncidentStatus | null
  created_at: string
  // Relations
  author?: Profile
}

export interface Media {
  id: string
  organization_id: string
  uploaded_by: string
  incident_id: string | null
  guard_log_id: string | null
  patrol_point_id: string | null
  type: MediaType
  storage_path: string
  file_name: string | null
  file_size: number | null
  duration: number | null
  thumbnail_path: string | null
  lat: number | null
  lng: number | null
  is_evidence: boolean
  created_at: string
}

export interface PatrolSession {
  id: string
  organization_id: string
  site_id: string
  guard_id: string
  shift_id: string | null
  status: PatrolStatus
  started_at: string
  completed_at: string | null
  total_checkpoints: number
  visited_checkpoints: number
  notes: string | null
  // Relations
  site?: Site
  guard?: Profile
  points?: PatrolPoint[]
}

export interface PatrolPoint {
  id: string
  patrol_session_id: string
  checkpoint_id: string
  guard_id: string
  lat: number | null
  lng: number | null
  notes: string | null
  scanned_at: string
  // Relations
  checkpoint?: Checkpoint
}

export interface Notification {
  id: string
  organization_id: string
  user_id: string
  title: string
  body: string
  type: string
  reference_id: string | null
  reference_type: string | null
  is_read: boolean
  created_at: string
}
