export type UserRole = 'super_admin' | 'admin' | 'supervisor' | 'guard' | 'client'

export type IncidentCategory =
  | 'intrusion'
  | 'theft'
  | 'damage'
  | 'medical_emergency'
  | 'fire'
  | 'accident'
  | 'operational'
  | 'other'

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'absent'
export type PatrolStatus = 'in_progress' | 'completed' | 'incomplete'
export type MediaType = 'photo' | 'video' | 'audio' | 'document'

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  intrusion: 'Intrusión',
  theft: 'Robo',
  damage: 'Daños',
  medical_emergency: 'Emergencia Médica',
  fire: 'Incendio',
  accident: 'Accidente',
  operational: 'Novedad Operativa',
  other: 'Otro',
}

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
}

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Abierto',
  in_progress: 'En Proceso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  scheduled: 'Programado',
  active: 'Activo',
  completed: 'Completado',
  absent: 'Ausente',
}
