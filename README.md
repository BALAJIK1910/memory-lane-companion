# 🧠 Memory Lane Companion

A dementia-care web application that helps patients manage their daily life while keeping caregivers informed and in control — all in real time.

---

## 📋 Description

Memory Lane Companion connects **patients** and **caregivers** through a shared, role-based interface.

- The **caregiver** sets up tasks, contacts, meetings, and safe zones from a management dashboard.
- The **patient** sees a simple, large-text interface with voice reminders and one-tap family calling.
- If the patient wanders outside a safe zone, the caregiver gets an **instant alert** with a live map view.

---

## ✨ Features

- 🔑 **Role-based accounts** — Caregiver and Patient roles linked by a unique 6-character invite code
- 📋 **Daily routine manager** — Timed task reminders with voice announcements
- 📅 **Meeting scheduler** — Step-by-step meeting preparation guides for the patient
- 👨‍👩‍👧 **Family contacts** — Large photo buttons for one-tap calling
- 🛡️ **Safe zone tracking** — GPS-based zones with configurable radius
- 🚨 **Wandering alerts** — Real-time caregiver notification when patient leaves a safe zone
- 📍 **Live tracking map** — Caregiver sees the patient's location on an interactive map
- 💬 **Reassuring message** — Caregiver can set a calming message shown on the patient's screen

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Build Tool | Vite 6.2 |
| Backend / Auth | Firebase 12 (Firestore + Authentication) |
| Maps | Leaflet + React-Leaflet |
| Animations | Framer Motion |
| Icons | Lucide React |
| Notifications | Sonner (toasts) |
| Routing | React Router DOM v7 |

---

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/BALAJIK1910/memory-lane-companion.git
cd memory-lane-companion
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Firebase

Edit `firebase-applet-config.json` with your Firebase project credentials:

```json
{
  "projectId": "your-project-id",
  "appId": "your-app-id",
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "your-project.firebasestorage.app",
  "messagingSenderId": "your-sender-id"
}
```

### 4. Enable Firebase services

- Go to [Firebase Console](https://console.firebase.google.com) → **Authentication** → **Sign-in method**
- Enable **Email/Password**
- Then deploy auth and Firestore rules:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest deploy --only auth,firestore --project your-project-id
```

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Usage

### Create a Caregiver Account

1. Open `http://localhost:3000`
2. Select **Caregiver** → click **Register**
3. Fill in your name, email, and password → **Create Account**
4. Note the **invite code** shown at the top of your dashboard (e.g. `MHXTDG`)

### Create a Patient Account

1. Sign out from the caregiver account (top-right button)
2. Select **Patient** → click **Register**
3. Fill in the patient's name, email, password, and the **invite code** from above
4. Click **Create Account** — the patient is now linked to the caregiver ✅

### Sign In Later

Both roles use the **Sign In** tab with email + password. The app automatically shows the correct interface based on your role.

---

## 📁 Project Structure

```
memory-lane-companion/
├── src/
│   ├── components/
│   │   ├── CaregiverDashboard.tsx   # Caregiver panel
│   │   ├── PatientInterface.tsx     # Patient UI
│   │   ├── LocationTracker.tsx      # Background GPS (patient only)
│   │   ├── LiveTrackingPage.tsx     # Live map for caregivers
│   │   └── LoginPage.tsx            # Login & registration
│   ├── contexts/
│   │   └── UserContext.tsx          # Auth state + role resolution
│   ├── lib/
│   │   ├── firebase.ts              # Firebase setup & helpers
│   │   └── utils.ts                 # Geo utilities
│   ├── types.ts                     # TypeScript types
│   ├── App.tsx                      # Role-based routing
│   └── main.tsx                     # Entry point
├── firebase.json                    # Firebase CLI config
├── firestore.rules                  # Database security rules
├── AUTH_SETUP_GUIDE.md              # Detailed auth & debug guide
└── README.md                        # This file
```

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the project
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: describe your change"`
4. Push: `git push origin feature/your-feature`
5. Open a **Pull Request**

Please keep code typed (TypeScript strict mode) and styled with Tailwind CSS.

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| `auth/operation-not-allowed` | Enable Email/Password in Firebase Console, then run `firebase deploy --only auth` |
| `auth/email-already-in-use` | Use Sign In tab instead of Register |
| `Invalid invite code` | Double-check the 6-character code shown on the Caregiver Dashboard |
| Profile not found after login | Delete the broken user in Firebase Console → Authentication → Users, then re-register |

For a full debug guide, see [AUTH_SETUP_GUIDE.md](./AUTH_SETUP_GUIDE.md).


<div align="center">
Made with ❤️ for dementia patients and their families
</div>
