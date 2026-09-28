# A2-D2 — Aerial Analysis & Drone Detection

A real-time drone detection and threat analysis platform. Monitor airspace, assess risks with AI-powered scoring, and receive tiered alerts — all from a single browser window.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Docker](#-run-with-docker)
- [Configuration](#-configuration)
- [UI Guide](#-ui-guide)
- [Architecture](#-architecture)

---

## 🎯 Overview

A2-D2 provides real-time airspace awareness over a configurable protected zone. Drones are tracked live on an interactive map, each assigned an AI-generated threat score based on proximity, speed, heading, and payload status. Escalating alerts are delivered via browser voice synthesis, SMS, and email as drones approach restricted airspace.

The platform ships as a **zero-dependency offline demo** out of the box — no external API credentials required. Just clone, install, and run.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Leaflet Maps, SCSS Modules |
| Backend | Node.js, Express, WebSocket (ws) |
| AI Threat Scoring | IBM WatsonX.ai (Granite) |
| Database | MongoDB (optional; in-memory demo data available) |
| Alerts | Browser Speech API, Twilio SMS, SendGrid Email |
| Container | Docker (multi-stage, `linux/amd64`) |

---

## ✨ Features

### Real-Time Drone Tracking
- Live position updates streamed via WebSocket
- Trail visualisation (last 5 positions)
- Drone icons rotate with heading
- Sensor field-of-view polygons

### AI-Powered Threat Assessment
- Risk score 0–100 with colour-coded level (Green / Yellow / Red / Critical)
- Factors: proximity to protected zone, speed, payload, heading trajectory
- Powered by IBM WatsonX.ai

### Tiered Alert System
| Zone | Radius | Alerts Triggered |
|---|---|---|
| Blue | > 5 km | None |
| Green | 2–5 km | Voice only |
| Yellow | 500 m – 2 km | Voice + SMS |
| Red | < 500 m | Voice + SMS + Email |

### Progressive Radar Detection (Demo Mode)
- 8 demo drones appear one-by-one over 38 seconds, simulating real radar discovery
- Staggered arrivals from outer Florida regions inward toward Miami
- Voice announcement on each new detection

### Audio Mute Toggle
- One-click mute/unmute button in the live feed header
- Suppresses all browser speech synthesis without disabling other alerts

### Drone Visual Panel
- Hardware image for each drone model (with and without payload variants)
- Rendered automatically when a drone is selected

### Inactive Drone Tracking
- Drones that go offline appear in a separate **Inactive** list
- Zero-risk scoring — no spurious alerts for grounded hardware

### Security Notification Banner
- Displayed in the Risk Assessment panel whenever threat score > 30 or payload is detected
- Confirms automated SMS / Email dispatch status on screen

---

## 🚀 Quick Start

**Requirements:** Node.js 18+

```bash
# 1. Clone and enter the project
git clone <repository-url>
cd Available-DroneDetection

# 2. Start the backend (Terminal 1)
cd backend
npm install
node index.js
# → http://localhost:4000

# 3. Start the frontend (Terminal 2)
cd frontend
npm install
npm start
# → http://localhost:3000
```

Open **http://localhost:3000** and watch drones appear on the Florida map over the first 40 seconds.

---

## 🐳 Run with Docker

Build and run the full stack as a single container (no Node.js required on the host):

```bash
cd Available-DroneDetection

# Build
docker build -t a2d2-demo .

# Run
docker run -p 4000:4000 a2d2-demo
```

Open **http://localhost:4000**.

---

## ⚙️ Configuration

The demo runs with **zero configuration**. For a live deployment connected to real drone feeds and AI services, create `backend/.env`:

```bash
# Server
PORT=4000
NODE_ENV=production

# MongoDB (optional — demo runs without it)
MONGODB_URI=mongodb://user:pass@host/dbname

# IBM WatsonX.ai (optional)
WATSONX_API_KEY=your_api_key
WATSONX_PROJECT_ID=your_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-13b-chat-v2

# Live drone feed (optional — demo uses built-in CSV data)
API_HOST=https://your-sensor-api.com
WS_API_HOST=wss://your-sensor-websocket.com
SENSOR_USERNAME=your_username
SENSOR_PASSWORD=your_password

# SMS alerts via Twilio (optional)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_MESSAGING_SERVICE_SID=your_messaging_sid
ALERT_SMS_TO=+1234567890

# Email alerts via SendGrid (optional)
SENDGRID_API_KEY=your_api_key
ALERT_EMAIL_FROM=alerts@yourdomain.com
ALERT_EMAIL_TO=recipient@example.com
```

---

## 🖥️ UI Guide

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  A2-D2   Aerial Analysis & Drone Detection          [🔊 Mute]  │
├───────────────────────────────┬─────────────────────────────────┤
│                               │  Active | Inactive              │
│         Map View              │  ─────────────────────────────  │
│    (Leaflet + satellite)      │  Drone list cards               │
│                               │                                 │
├───────────────────────────────┴─────────────────────────────────┤
│  Risk Assessment (left)           Telemetry Panel (right)       │
└─────────────────────────────────────────────────────────────────┘
```

### Drone Detail Tabs

| Tab | Contents |
|---|---|
| **Flight** | Live telemetry — altitude, speed, heading, distance to zone |
| **Profile** | Drone model, sensor type, operator, payload status |
| **Incidents** | Detection events and zone-breach history |
| **Visual** | Hardware image (payload variant shown when applicable) |

### Map Interactions

- **Click a drone marker** — selects the drone and loads all detail panels
- **Zoom** — mouse wheel or `+` / `-` controls
- **Reset** — double-click map background

---

## 🔍 Architecture

```
Demo CSV / Live WebSocket feed
         ↓
   Backend (Node.js / Express)
   ├── WebSocket server  →  broadcasts to all connected clients
   ├── Threat assessment  →  WatsonX.ai
   ├── Alert dispatcher  →  SMS (Twilio) / Email (SendGrid)
   └── REST API  →  flight history, assessments, inactive drones
         ↓
   Frontend (React)
   ├── DataContext  →  centralised WebSocket state
   ├── LiveActivity  →  map, staggered arrivals, voice alerts
   ├── DisplayData  →  drone detail tabs
   └── RiskAssessment  →  threat panel + notification banner
```

### Demo Data (built-in)

Eight drone tracks are distributed across Florida airspace — from Gainesville in the north down to Downtown Miami — with progressively higher threat scores as drones approach the protected zone center at `25.772876, -80.192041` (Miami, FL).

| Drone ID | Model | Region | Threat |
|---|---|---|---|
| A2D2-3A8C | Mavic Pro | North Florida / Gainesville | 🟢 12 |
| A2D2-F3A1 | Mavic 3 | Tampa Bay | 🟢 18 |
| A2D2-C9B2 | Mavic 2 | Cape Canaveral | 🟢 24 |
| A2D2-7E4D | Mavic Air 2 | Lake Okeechobee | 🟡 48 |
| A2D2-B2F6 | Mini 3 *(payload)* | Naples / SW Gulf Coast | 🟡 65 |
| A2D2-E5B7 | Mavic 2 *(payload)* | Everglades Approach | 🔴 82 |
| A2D2-9D1E | Mavic Air 2S *(payload)* | Key Largo | 🔴 88 |
| A2D2-4F2A | M300 RTK *(payload)* | Downtown Miami | 🚨 96 |

---

## 📚 Resources

- [Leaflet Maps](https://leafletjs.com/)
- [IBM WatsonX.ai](https://www.ibm.com/watsonx)
- [Twilio SMS](https://www.twilio.com/docs/sms)
- [SendGrid Email](https://docs.sendgrid.com/)
