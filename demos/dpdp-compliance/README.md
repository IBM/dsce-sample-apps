# DPDP Act 2023 Interactive Demo

An interactive storytelling application demonstrating the complete journey of Personal Data under India's DPDP Act 2023, featuring live, functional demonstrations of IBM products for compliance.

## 🎯 Overview

This is NOT a traditional enterprise dashboard. It's a **storytelling application** designed like an Apple keynote or IBM Think demo, where each stage combines narrative with fully functional, interactive demonstrations using realistic dummy data.

## 🚀 Quick Start (Local)

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## ☁️ Deploy on IBM Code Engine

### From the Code Engine UI (recommended)

1. Go to [IBM Cloud Code Engine](https://cloud.ibm.com/codeengine)
2. Create a new **Project** (or select existing)
3. Click **"Create Application"**
4. Choose **"Source code"** as the source
5. Paste your GitHub repo URL:
   ```
   https://github.ibm.com/Sagar-Padwal/DSCE_2.0-DPDP-Compliance-demo
   ```
6. Set **Branch** to `main`
7. Code Engine auto-detects the `Dockerfile` — no extra config needed
8. Set **Listening port** to `8080`
9. Click **"Create"** — Code Engine builds and deploys automatically

### Health Check

The app exposes a `/health` endpoint that returns `200 OK` — use this for Code Engine's liveness/readiness probe.

### Local Docker test (optional, before deploying)

```bash
docker build -t dpdp-demo .
docker run -p 8080:8080 dpdp-demo
```

Open [http://localhost:8080](http://localhost:8080)

## 📋 Features

### Interactive Stages

#### **Stage 1: Consent Management** 🔐
- **IBM Verify** integration
- Functional consent form with checkboxes for:
  - KYC Verification
  - Credit Scoring
  - Marketing Communications
- Real-time consent capture and revocation
- Animated data flow visualization
- Consent status tracking

**Try it:** Check/uncheck consent boxes, submit, and revoke to see real-time state changes.

---

#### **Stage 2: Data Discovery & DSAR** 🔍
- **IBM Guardium DSPM** dashboard
- Live database scanning simulator
- Progress tracking across 7 databases
- DSAR request submission and processing
- Downloadable compliance reports
- Real-time discovery of 2.3M records across 34 sensitive fields

**Try it:** Submit a DSAR request, start discovery scan, and download the generated report.

---

#### **Stage 3: Dynamic Data Masking** 🛡️
- **IBM Guardium Data Protection** interface
- Live data table with real Indian customer data
- Role-based access control (Analyst/Admin/DPO)
- Toggle masking on/off to see real-time transformations
- Aadhaar masking: `XXXX XXXX 1234`
- PAN masking: `ABXXX1234C`
- SQL query visualization showing masking functions

**Try it:** Switch between roles, toggle masking, and watch data transform in real-time.

---

#### **Stage 4: Encryption & Key Management** 🔑
- **IBM Vault** key management
- Live encryption/decryption simulator
- Enter any text and encrypt with AES-256
- Key rotation simulator with progress tracking
- 90-day rotation cycle timeline
- Audit log viewer

**Try it:** Type sensitive data, encrypt it, decrypt it, and simulate key rotation.

---

#### **Stage 5: Breach Detection & Response** 🚨
- **IBM QRadar SIEM** monitoring
- Simulate unauthorized data export (48,234 records)
- Real-time threat detection (847x above baseline)
- Automated response timeline:
  - Session termination
  - Access revocation
  - Endpoint isolation
  - DPO notification
- 72-hour breach notification countdown
- DPDP Act §8(6) compliance tracking

**Try it:** Click to simulate breach and watch automated response unfold in real-time.

---

#### **Stage 6: Governance & Compliance** ✅
- **IBM OpenPages GRC** dashboard
- Overall compliance score: 92%
- Interactive metrics for:
  - Consent Controls (98%)
  - Protection Controls (95%)
  - Encryption Status (100%)
  - Breach Response (92%)
  - Rights Requests (94%)
- Live audit log viewer with filtering
- Consent withdrawal statistics
- Data lifecycle management metrics
- Downloadable board-level compliance reports

**Try it:** Click on metrics, view audit logs, and generate compliance reports.

---

## 🎨 Design Philosophy

- **Clean & Modern:** IBM color palette with smooth animations
- **Card-Based Layout:** Maximum 3 cards visible at once
- **No Tables/Sidebars:** Everything flows like a presentation
- **Framer Motion:** Smooth transitions between stages
- **Interactive Elements:** Every button, toggle, and form is functional
- **Realistic Data:** Indian names, Aadhaar format, PAN format

## 🛠️ Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Vite** - Build tool

## 📊 Dummy Data

All data is generated using realistic Indian formats:
- Names: Priya Sharma, Arjun Mehta, Kavitha Iyer, Ravi Kumar
- Aadhaar: `1234 5678 9012` format
- PAN: `ABCDE1234F` format
- Phone: `+91 98765 43210` format
- 7 databases with 2.3M total records

## 🎯 Use Cases

Perfect for:
- Customer demos and presentations
- IBM Think conference demonstrations
- Financial services compliance training
- DPDP Act awareness sessions
- Sales enablement
- Executive briefings

## 🎬 Demo Flow

1. **Start at Stage 1** - Grant consent in the banking app
2. **Move to Stage 2** - Run discovery scan and submit DSAR
3. **Proceed to Stage 3** - Toggle data masking for different roles
4. **Continue to Stage 4** - Encrypt data and rotate keys
5. **Experience Stage 5** - Simulate and contain a breach
6. **Finish at Stage 6** - Review compliance dashboard and generate report

## 🔐 DPDP Act Compliance

Each stage demonstrates compliance with specific DPDP Act sections:
- **§6** - Consent Requirements
- **§8** - Security Safeguards
- **§8(6)** - Breach Notification
- **§11** - Rights of Data Principal

## 📄 License

IBM Internal Use Only

---