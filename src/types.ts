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
