export interface Task {
  id: string;
  title: string;
  time: string; // HH:mm
  icon: string;
  voiceUrl?: string;
  completed: boolean;
  lastNotified?: string;
}

export interface FamilyContact {
  id: string;
  name: string;
  relationship?: string; // e.g. Daughter, Son, Spouse, Caregiver (optional for backward compat)
  photoUrl: string;
  phone: string;
}

export interface MeetingStep {
  id: string;
  text: string;
  icon: string;
}

export type MeetingStatus = 'not-started' | 'in-progress' | 'completed' | 'missed';

export interface Meeting {
  id: string;
  personName: string;
  personPhotoUrl: string;
  date?: string; // YYYY-MM-DD (optional for backward compatibility with legacy meetings)
  time: string; // HH:mm
  location: string;
  lat?: number;
  lng?: number;
  steps: MeetingStep[];
  status: MeetingStatus;
  lastNotified?: string;
}

export interface Settings {
  reassuringMessage: string;
  caregiverEmail: string;
}

export interface SafeZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
}

export interface UserStatus {
  isSafe: boolean;
  detailedStatus: 'Safe' | 'Outside (Monitoring)' | 'Outside Safe Location';
  lastUpdated: string;
  exitTimestamp?: string;
  currentLocationName?: string;
  lat: number;
  lng: number;
  distanceToSafe?: number;
}

export interface WanderingAlert {
  id: string;
  timestamp: string;
  exitTimestamp: string;
  lat: number;
  lng: number;
  locationName: string;
  status: 'active' | 'resolved';
  notifiedCaregiver: boolean;
  isSimulated?: boolean;
}

export interface CaregiverProfile {
  name: string;
  email: string;
  inviteCode: string;
  createdAt: string;
}

export interface PatientProfile {
  name: string;
  email: string;
  linkedCaregiverId: string;
  createdAt: string;
}

export interface InviteCode {
  caregiverId: string;
}

export type UserRole = 'caregiver' | 'patient';

export interface UserContextType {
  uid: string;
  role: UserRole;
  caregiverId: string;
}
