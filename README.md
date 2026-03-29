<div align="center">
<img width="800" alt="Memory Lane Companion Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Memory Lane Companion
*Your Memory Reconstruction AI Assistant*
</div>

## 📖 Overview

**Memory Lane Companion** is an innovative AI-powered web application designed specifically to assist individuals living with dementia and cognitive decline, while empowering their caregivers. The platform features two customized interfaces:

- **Patient Interface**: A simplified, highly accessible, and tablet-optimized view providing interactive schedules, conversational AI memories, gentle reminders, and location safety.
- **Caregiver Dashboard**: A comprehensive management hub designed with a modern bento-box UI. It allows caregivers to effortlessly monitor patient status, update daily routines, define geographical "safe zones", and track real-time locations during a wandering event.

## ✨ Features

### For Patients
- **Simplified UI**: Clean, responsive layout with large touch targets and intuitive design catered towards dementia patients.
- **AI Memory Assistant**: Integrated conversational AI (powered by Google Gemini) to help recall memories, answer contextual questions, and provide cognitive stimulation.
- **Daily Schedule & Meetings**: View today's itinerary, medication reminders, and automatically transition designated meetings to "in-progress" based on geolocation.
- **Familiar Contacts**: Quick access to loved ones with photos and contact details.

### For Caregivers
- **Dashboard Hub**: Organize and update the patient's daily routine, meetings, and emergency contacts.
- **Safe Zone Geofencing**: Define secure geographical boundaries using interactive maps.
- **Wandering Alerts & Live Tracking**: Immediate caregiver notifications if the patient leaves a designated Safe Zone. Includes a dedicated live tracking interface to ensure swift intervention.
- **Location-Aware Meetings**: Wandering alerts are intelligently suppressed if the patient is within a 50-meter radius of a scheduled, active meeting location.

## 🛠️ Tech Stack

- **Frontend Core**: React 19, TypeScript, Vite
- **Styling & UI**: Tailwind CSS v4, Framer Motion, Lucide React (Icons), Sonner (Toasts)
- **Maps & Location**: Leaflet, React-Leaflet
- **Backend & State**: Firebase (Authentication, Firestore Database for real-time syncing)
- **AI Integration**: Google GenAI SDK (`@google/genai`) - Gemini API

## 🚀 Installation Steps

**Prerequisites:** Node.js (v18+) and a Firebase project.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/BALAJIK1910/memory-lane-companion.git
   cd memory-lane-companion
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory and add your API keys:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_message_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

## 💻 Usage Instructions

1. **Sign in**: Users must authenticate using Google Sign-In via Firebase Auth.
2. **Patient Mode**: Upon login, the default view is the Patient Interface (`/`). The dashboard will adapt responsively to provide information safely.
3. **Caregiver Mode**: Click the **Caregiver** settings icon at the top right to access the Caregiver Dashboard (`/caregiver`). From here, you can:
   - Add new meetings and tasks.
   - Adjust Geofencing parameters for safe zones.
   - Monitor the patient status.
4. **Live Tracking**: When a Wandering Alert triggers, caregivers are directed to `/track/:patientId` to view the patient's real-time movement on a map.

## 📁 Project Structure

```text
📂 memory-lane-companion
 ┣ 📂 src
 ┃ ┣ 📂 components
 ┃ ┃ ┣ 📜 CaregiverDashboard.tsx  # Admin dashboard & settings
 ┃ ┃ ┣ 📜 LiveTrackingPage.tsx    # Map for wandering alerts
 ┃ ┃ ┣ 📜 LocationTracker.tsx      # GPS & Geofencing background logic
 ┃ ┃ ┗ 📜 PatientInterface.tsx     # Main patient-facing view
 ┃ ┣ 📂 lib
 ┃ ┃ ┗ 📜 firebase.ts             # Firebase Auth & Firestore setup
 ┃ ┣ 📜 App.tsx                   # Main routing map & auth state handling
 ┃ ┣ 📜 index.css                 # Global styling & Tailwind implementation
 ┃ ┣ 📜 main.tsx                  # React Entry point
 ┃ ┗ 📜 types.ts                  # Shared TypeScript interfaces
 ┣ 📜 package.json                # Project dependencies and scripts
 ┣ 📜 vite.config.ts              # Vite configuration
 ┗ 📜 README.md                   # Project documentation
```

## 🌐 API & Data Flow

- **Firebase Firestore**: We use Firestore to listen to real-time events. Patient configurations, schedules, and active locations are synced synchronously across devices.
- **Gemini API**: The patient chatbot accesses context (from the schedule and known contacts) passing it via strict system prompts to generate comforting, memory-reconstructing responses.
- **Browser Geolocation API**: Powers the user position capturing inside `LocationTracker.tsx` simulating real-world patient tracking.

## 🤝 Contributors

- [BALAJIK1910](https://github.com/BALAJIK1910) - Lead Developer & Architect
- *Open to community contributions!*
