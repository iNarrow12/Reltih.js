import json, hashlib, math, statistics, time
from collections import defaultdict
from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# LAYER 1 — FEATURE VECTOR BUILDER
# ─────────────────────────────────────────────────────────────────────────────

class FeatureVectorBuilder:

    GPU_TIERS = {
        'rtx 4090':10,'rtx 4080':9,'rtx 4070':8,'rtx 3090':8,'rtx 3080':8,
        'rtx 3070':7,'rtx 3060':6,'gtx 1080':6,'gtx 1070':5,'gtx 1060':4,
        'rx 7900':9,'rx 6900':8,'rx 6800':7,'rx 6700':6,'rx 580':4,
        'intel arc':5,'iris xe':3,'uhd 630':2,'hd 520':2,'hd 4000':1,
        'swiftshader':0,'llvmpipe':0,'vmware':0,'virtualbox':0
    }

    def build(self, fp: dict) -> dict:
        audio_raw = self._safe(fp, "hardware.audio", {})
        audio_sig = audio_raw.get("hash","") if isinstance(audio_raw, dict) else str(audio_raw)

        return {
            "device_id":        self._stable_hash(fp),
            "session_ts":       fp.get("timestamp",""),
            "cpu_cores":        self._safe(fp,"hardware.cpu.cores",0),
            "ram_gb":           self._safe(fp,"hardware.memory",0),
            "gpu_tier":         self._gpu_tier(fp),
            "gpu_hash":         self._hash(str(self._safe(fp,"hardware.gpu",""))),
            "canvas_hash":      self._hash(str(self._safe(fp,"browser.canvas",""))),
            "webgl_hash":       self._hash(str(self._safe(fp,"hardware.webgl",""))),
            "font_hash":        self._hash(str(sorted(self._safe(fp,"browser.fonts",[])))),
            "audio_hash":       self._hash(audio_sig) if audio_sig else None,
            "audio_available":  bool(audio_sig),
            "screen_w":         self._safe(fp,"browser.screen.width",0),
            "screen_h":         self._safe(fp,"browser.screen.height",0),
            "pixel_ratio":      self._safe(fp,"browser.screen.pixelRatio",1),
            "color_depth":      self._safe(fp,"browser.screen.colorDepth",0),
            "timezone":         self._safe(fp,"browser.timezone",""),
            "tz_offset":        self._safe(fp,"browser.timezoneOffset",0),
            "language":         self._safe(fp,"browser.language",""),
            "platform":         self._safe(fp,"browser.platform",""),
            "os_version":       self._safe(fp,"os.highEntropy.osVersion",""),
            "os_arch":          self._safe(fp,"os.highEntropy.architecture",""),
            "browser_brand":    self._browser_brand(fp),
            "touch_points":     self._safe(fp,"os.basic.maxTouchPoints",0),
            "timer_res":        self._safe(fp,"os.timerRes.minDelta",0),
            "font_count":       len(self._safe(fp,"browser.fonts",[])),
            "os_font_count":    len(self._safe(fp,"os.fonts.detected.windows",[])),
            "probable_os":      self._safe(fp,"os.fonts.probableOS","unknown"),
            "is_mobile":        int(self._safe(fp,"os.highEntropy.mobile",False)),
            "vm_score":         self._safe(fp,"environment.vm.score",0),
            "bot_score":        self._safe(fp,"environment.bot.score",0),
            "sandbox_score":    self._safe(fp,"environment.sandbox.score",0),
            "is_brave":         self._is_brave(fp),
            "adblock":          int(self._safe(fp,"extensions.adblock",False)),
            "mouse_speed":      float(self._safe(fp,"behavioral.mouseSpeed",0) or 0),
            "click_count":      self._safe(fp,"behavioral.clickCount",0),
            "keystroke_dwell":  float(self._safe(fp,"behavioral.keystrokeDwell",0) or 0),
            "perm_camera":      self._perm_enc(fp,"camera"),
            "perm_mic":         self._perm_enc(fp,"microphone"),
            "perm_geo":         self._perm_enc(fp,"geolocation"),
            "webgpu_supported": int(self._safe(fp,"hardware.gpu.webgpu","unsupported")
                                    not in ["unsupported","blocked","error"]),
            "ip":               fp.get("ip",""),
        }

    def _safe(self, fp, path, default=None):
        keys = path.split(".")
        v    = fp
        for k in keys:
            if not isinstance(v, dict): return default
            v = v.get(k, default)
            if v is None: return default
        return v

    def _hash(self, s: str) -> str:
        return hashlib.sha256(s.encode()).hexdigest()[:16]

    def _stable_hash(self, fp: dict) -> str:
        audio_raw = self._safe(fp,"hardware.audio",{})
        audio_sig = audio_raw.get("hash","") if isinstance(audio_raw,dict) else ""
        parts = [
            str(self._safe(fp,"browser.canvas","")),
            str(self._safe(fp,"hardware.gpu","")),
            str(self._safe(fp,"hardware.webgl","")),
            str(sorted(self._safe(fp,"browser.fonts",[]))),
            str(self._safe(fp,"os.rendering","")),
            audio_sig,
        ]
        return hashlib.sha256("".join(parts).encode()).hexdigest()[:32]

    def _gpu_tier(self, fp: dict) -> int:
        renderer = str(self._safe(fp,"hardware.gpu.renderer","")).lower()
        for k,v in self.GPU_TIERS.items():
            if k in renderer: return v
        return 3

    def _browser_brand(self, fp: dict) -> str:
        brands = self._safe(fp,"os.highEntropy.fullVersionList",[]) or []
        for b in brands:
            if isinstance(b,dict):
                name = b.get("brand","").lower()
                if name not in ["not.a/brand","chromium"]: return name
        return self._safe(fp,"browser.userAgent","")[:20]

    def _is_brave(self, fp: dict) -> bool:
        brands = self._safe(fp,"os.highEntropy.fullVersionList",[]) or []
        return any(
            isinstance(b,dict) and b.get("brand","").lower() == "brave"
            for b in brands
        )

    def _perm_enc(self, fp: dict, name: str) -> int:
        v = self._safe(fp,f"permissions.permissions.{name}","unknown")
        return {"granted":2,"prompt":1,"denied":0}.get(v,-1)


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 2 — ANOMALY DETECTION
# ─────────────────────────────────────────────────────────────────────────────

class AnomalyDetector:

    RULES = [
        (lambda v: v["ram_gb"] == 4 and v["gpu_tier"] >= 8,
         "low_ram_high_end_gpu", 0.4),

        (lambda v: v["cpu_cores"] <= 2 and v["gpu_tier"] >= 6,
         "low_cpu_high_gpu", 0.3),

        (lambda v: v["probable_os"] == "windows" and v["os_font_count"] == 0,
         "windows_os_no_windows_fonts", 0.5),

        (lambda v: v["probable_os"] == "macos" and v["os_font_count"] > 0
                   and v["platform"] == "Win32",
         "mac_fonts_on_windows_platform", 0.7),

        (lambda v: v["timer_res"] > 1.0,
         "coarse_timer_resolution", 0.3),

        (lambda v: v["vm_score"] > 0.4,
         "vm_indicators_present", 0.4),

        # fix: bot_score from environment.js triggers on Brave — only flag if
        # NOT a known privacy browser AND bot score is high
        (lambda v: v["bot_score"] > 0.4 and not v.get("is_brave") and v["sandbox_score"] < 0.3,
         "bot_indicators_present", 0.6),

        (lambda v: v["touch_points"] > 0 and v["mouse_speed"] == 0.0,
         "touch_device_no_mouse_data", 0.2),

        (lambda v: v["font_count"] < 3,
         "suspiciously_few_fonts", 0.35),

        (lambda v: v["canvas_hash"] == v["webgl_hash"],
         "canvas_webgl_hash_identical", 0.5),

        (lambda v: v["ram_gb"] == 0,
         "ram_not_reported", 0.2),

        (lambda v: v["cpu_cores"] == 0,
         "cpu_cores_not_reported", 0.2),

        (lambda v: not v.get("audio_available") and v["sandbox_score"] < 0.3,
         "audio_blocked_non_sandbox", 0.25),
    ]

    EXPECTED_MISMATCHES = [
        ("en-US", ["Asia/","Europe/","Pacific/","Australia/","Africa/"]),
        ("en-GB", ["Asia/","America/","Pacific/","Australia/","Africa/"]),
    ]

    def analyze(self, fv: dict, history: list[dict] = None) -> dict:
        flags  = []
        score  = 0.0

        for rule_fn, flag, weight in self.RULES:
            try:
                if rule_fn(fv):
                    flags.append({"flag":flag,"weight":weight})
                    score += weight
            except: pass

        if history and len(history) >= 2:
            drift = self._cross_session(fv, history)
            flags.extend(drift["flags"])
            score += drift["score"]

        tz_flag, tz_weight = self._tz_language_mismatch(fv)
        if tz_flag:
            flags.append({"flag":tz_flag,"weight":tz_weight})
            score += tz_weight

        return {
            "anomaly_score": round(min(score,1.0),3),
            "anomaly_flags": flags
        }

    def _cross_session(self, current: dict, history: list[dict]) -> dict:
        flags = []
        score = 0.0
        prev  = history[-1]

        checks = [
            ("gpu_hash",   "gpu_hash_changed",    0.5),
            ("canvas_hash","canvas_hash_changed",  0.4),
            ("font_hash",  "font_hash_changed",    0.35),
            ("cpu_cores",  "cpu_cores_changed",    0.45),
            ("ram_gb",     "ram_changed",          0.3),
            ("os_version", "os_version_changed",   0.25),
            ("platform",   "platform_changed",     0.4),
        ]

        for key, flag, weight in checks:
            if current.get(key) != prev.get(key) and prev.get(key) not in [None,0,""]:
                flags.append({
                    "flag":flag,"weight":weight,
                    "prev":prev.get(key),"curr":current.get(key)
                })
                score += weight

        return {"flags":flags,"score":score}

    def _tz_language_mismatch(self, fv: dict) -> tuple:
        tz   = fv.get("timezone","")
        lang = fv.get("language","")

        for l_prefix, tz_whitelist in self.EXPECTED_MISMATCHES:
            if lang.startswith(l_prefix):
                if any(tz.startswith(p) for p in tz_whitelist):
                    return f"tz_lang_mismatch_{l_prefix}_expat", 0.05

        strict = [
            ("ja",    lambda t: t != "Asia/Tokyo",   0.4),
            ("ko",    lambda t: t != "Asia/Seoul",   0.4),
            ("zh-CN", lambda t: not t.startswith("Asia/"), 0.3),
            ("ru",    lambda t: not t.startswith("Europe/") and not t.startswith("Asia/"), 0.3),
        ]
        for l, check, w in strict:
            if lang.startswith(l) and check(tz):
                return f"tz_lang_mismatch_{l}", w

        return None, 0.0


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 3 — BEHAVIORAL BIOMETRICS ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class BehavioralEngine:

    def analyze(self, fp: dict) -> dict:
        beh    = fp.get("behavioral",{})
        clicks = beh.get("clicks",[])
        scroll = beh.get("scrollPattern",[])

        mouse_score  = self._mouse_score(beh)
        click_score  = self._click_score(clicks)
        scroll_score = self._scroll_score(scroll)
        entropy      = self._interaction_entropy(beh, clicks)

        combined = (
            mouse_score  * 0.35 +
            click_score  * 0.35 +
            scroll_score * 0.15 +
            entropy      * 0.15
        )

        data_window = self._estimate_window(beh, clicks)
        confidence  = min(data_window / 5.0, 1.0)

        label = (
            "bot_like" if combined < 0.25 else
            "mixed"    if combined < 0.60 else
            "human"
        )

        if confidence < 0.4 and label != "bot_like":
            label = "insufficient_data"

        return {
            "behavior_score":      round(combined,3),
            "behavior_label":      label,
            "data_confidence":     round(confidence,3),
            "collection_window_s": round(data_window,2),
            "components": {
                "mouse_smoothness":    round(mouse_score,3),
                "click_entropy":       round(click_score,3),
                "scroll_natural":      round(scroll_score,3),
                "interaction_entropy": round(entropy,3)
            }
        }

    def _estimate_window(self, beh: dict, clicks: list) -> float:
        times = []
        if clicks:
            times += [c["t"] for c in clicks if "t" in c]
        sp = beh.get("scrollPattern",[])
        if sp:
            times += [s["t"] for s in sp if "t" in s]
        if len(times) >= 2:
            return (max(times) - min(times)) / 1000.0
        return 0.0

    def _mouse_score(self, beh: dict) -> float:
        speed = float(beh.get("mouseSpeed",0) or 0)
        if speed == 0:    return 0.0
        if speed < 0.001: return 0.1
        if speed < 0.05:  return 0.4
        if speed < 0.5:   return 0.8
        if speed < 2.0:   return 1.0
        return 0.6

    def _click_score(self, clicks: list) -> float:
        if not clicks:       return 0.1
        if len(clicks) == 1: return 0.4

        times  = [c["t"] for c in clicks if "t" in c]
        if len(times) < 2: return 0.4

        deltas = [times[i+1]-times[i] for i in range(len(times)-1)]
        if len(deltas) < 2: return 0.5

        try:
            stdev = statistics.stdev(deltas)
            mean  = statistics.mean(deltas)
            cv    = stdev / mean if mean > 0 else 0
            if cv < 0.05:  return 0.1
            if cv < 0.2:   return 0.4
            if cv < 0.5:   return 0.9
            return 0.7
        except: return 0.5

    def _scroll_score(self, scroll: list) -> float:
        if not scroll:      return 0.3
        if len(scroll) < 3: return 0.5

        positions  = [s.get("y",0) for s in scroll]
        times      = [s.get("t",0) for s in scroll]
        deltas_y   = [abs(positions[i+1]-positions[i]) for i in range(len(positions)-1)]
        deltas_t   = [times[i+1]-times[i] for i in range(len(times)-1)]
        velocities = [dy/dt if dt > 0 else 0 for dy,dt in zip(deltas_y,deltas_t)]
        if not velocities: return 0.5

        try:
            accel      = [abs(velocities[i+1]-velocities[i]) for i in range(len(velocities)-1)]
            smoothness = 1 - min(statistics.mean(accel)/100,1)
            return round(smoothness,3)
        except: return 0.5

    def _interaction_entropy(self, beh: dict, clicks: list) -> float:
        signals, total = 0, 0
        checks = [
            float(beh.get("mouseSpeed",0) or 0) > 0,
            len(clicks) > 0,
            beh.get("clickCount",0) > 1,
            len(beh.get("scrollPattern",[])) > 0,
            float(beh.get("keystrokeDwell",0) or 0) > 0,
        ]
        for c in checks:
            total += 1
            if c: signals += 1
        return signals / total if total > 0 else 0


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 4 — NETWORK INTELLIGENCE
# ─────────────────────────────────────────────────────────────────────────────

class NetworkIntelligence:

    DC_PATTERNS = [
        "amazon","aws","google","microsoft","azure","digitalocean",
        "linode","vultr","hetzner","ovh","cloudflare","fastly",
        "akamai","leaseweb","choopa","psychz","quadranet","cogent",
        "he.net","hurricane electric","serverius","tzulo","m247"
    ]

    VPN_PATTERNS = [
        "nordvpn","expressvpn","mullvad","protonvpn","surfshark",
        "cyberghost","ipvanish","pia","private internet","windscribe",
        "tunnelbear","hidemyass","purevpn","hotspot shield"
    ]

    def analyze(self, fp: dict, ip_history: list[str] = None) -> dict:
        flags = []
        score = 0.0

        net   = fp.get("network",{})
        geoip = net.get("geoip",{})
        webrtc= net.get("webrtc",{})
        ip    = fp.get("ip","")

        isp_flags, isp_score = self._analyze_isp(geoip)
        flags.extend(isp_flags); score += isp_score

        rtc_flags, rtc_score = self._analyze_webrtc(webrtc, fp)
        flags.extend(rtc_flags); score += rtc_score

        if ip_history:
            stab_flags, stab_score = self._ip_stability(ip, ip_history)
            flags.extend(stab_flags); score += stab_score

        timing = net.get("timing",{})
        if timing.get("cloudflare") == "timeout" and timing.get("google") == "timeout":
            flags.append("all_timing_probes_blocked")
            score += 0.15

        tz_flag = self._geo_tz_mismatch(geoip, fp)
        if tz_flag:
            flags.append(tz_flag); score += 0.3

        return {
            "network_risk_score": round(min(score,1.0),3),
            "network_flags":      flags,
            "isp":     geoip.get("isp","unknown") if isinstance(geoip,dict) else "unknown",
            "asn":     geoip.get("asn","unknown") if isinstance(geoip,dict) else "unknown",
            "country": geoip.get("country","unknown") if isinstance(geoip,dict) else "unknown",
            "city":    geoip.get("city","unknown") if isinstance(geoip,dict) else "unknown",
        }

    def _analyze_isp(self, geoip) -> tuple:
        flags, score = [], 0.0
        if not isinstance(geoip,dict): return flags, score
        combined = ((geoip.get("isp","") or "") + " " + (geoip.get("asn","") or "")).lower()
        for p in self.DC_PATTERNS:
            if p in combined: flags.append(f"datacenter_asn_{p}"); score += 0.5; break
        for p in self.VPN_PATTERNS:
            if p in combined: flags.append(f"vpn_provider_{p}"); score += 0.6; break
        return flags, score

    def _analyze_webrtc(self, webrtc, fp: dict) -> tuple:
        flags, score = [], 0.0

        is_brave = any(
            isinstance(b,dict) and b.get("brand","").lower() == "brave"
            for b in (fp.get("os",{}).get("highEntropy",{}).get("fullVersionList",[]) or [])
        )

        if webrtc in ["timeout","blocked","error","failed"]:
            if is_brave:
                flags.append("webrtc_blocked_brave_expected")
                score += 0.05  # not suspicious for Brave
            else:
                flags.append("webrtc_blocked_possible_vpn")
                score += 0.25
            return flags, score

        if not isinstance(webrtc,dict): return flags, score

        ntype  = webrtc.get("networkType","")
        local  = webrtc.get("local",[])
        public = webrtc.get("public",[])

        if "corporate or vpn" in ntype:  flags.append("corporate_or_vpn_subnet");     score += 0.3
        if "vpn or container" in ntype:  flags.append("vpn_or_container_subnet");     score += 0.4
        if len(local) > 2:               flags.append("multiple_local_ips_vpn");      score += 0.3
        if public:                       flags.append("webrtc_public_ip_leaked");     score += 0.1

        return flags, score

    def _ip_stability(self, current_ip: str, history: list[str]) -> tuple:
        flags, score = [], 0.0
        unique = set(history + [current_ip])
        if len(unique) > 3:
            flags.append(f"ip_churn_{len(unique)}_unique_ips"); score += 0.3
        v4 = sum(1 for ip in unique if "." in ip)
        v6 = sum(1 for ip in unique if ":" in ip)
        if v4 > 0 and v6 > 0:
            flags.append("ipv4_ipv6_switching"); score += 0.2
        return flags, score

    def _geo_tz_mismatch(self, geoip, fp: dict) -> str | None:
        if not isinstance(geoip,dict): return None
        geo_tz = geoip.get("timezone","") or ""
        br_tz  = fp.get("browser",{}).get("timezone","") or ""
        if geo_tz and br_tz and geo_tz != br_tz:
            return f"geo_tz_mismatch_{geo_tz}_vs_{br_tz}"
        return None


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 5 — IDENTITY GRAPH
# ─────────────────────────────────────────────────────────────────────────────

class IdentityGraph:

    def __init__(self):
        self.nodes    = {}
        self.edges    = []
        self.clusters = {}

    def ingest(self, fv: dict, fp: dict) -> dict:
        dev_id  = fv["device_id"]
        sess_id = f"sess_{hashlib.sha256(fp.get('timestamp','').encode()).hexdigest()[:12]}"
        ip      = fv.get("ip","unknown")
        ip_node = f"ip_{hashlib.sha256(ip.encode()).hexdigest()[:12]}"

        self._add_node(dev_id,  "device",  {"stable_hash":dev_id})
        self._add_node(sess_id, "session", {"ts":fv["session_ts"]})
        self._add_node(ip_node, "ip",      {"ip":ip})

        self._add_edge(sess_id, dev_id,  "seen_on_device", 1.0)
        self._add_edge(sess_id, ip_node, "seen_from_ip",   1.0)
        self._add_edge(dev_id,  ip_node, "associated_ip",  0.8)

        cluster = self._assign_cluster(dev_id, fv)
        return {
            "device_node":  dev_id,
            "session_node": sess_id,
            "ip_node":      ip_node,
            "cluster_id":   cluster,
            "graph_size":   {"nodes":len(self.nodes),"edges":len(self.edges)}
        }

    def same_device_likely(self, fv_a: dict, fv_b: dict) -> dict:
        checks  = ["gpu_hash","canvas_hash","font_hash","audio_hash","webgl_hash"]
        matches = sum(1 for k in checks if fv_a.get(k) and fv_a.get(k)==fv_b.get(k))
        score   = matches / len(checks)
        return {"likely":score>=0.6,"score":round(score,3),"matches":matches}

    def export(self) -> dict:
        return {"nodes":list(self.nodes.values()),"edges":self.edges,"clusters":self.clusters}

    def _add_node(self, nid, ntype, data):
        if nid not in self.nodes:
            self.nodes[nid] = {"id":nid,"type":ntype,**data}

    def _add_edge(self, src, dst, relation, weight):
        for e in self.edges:
            if e["src"]==src and e["dst"]==dst and e["relation"]==relation: return
        self.edges.append({"src":src,"dst":dst,"relation":relation,"weight":weight})

    def _assign_cluster(self, dev_id: str, fv: dict) -> str:
        key = f"{fv.get('gpu_hash','')}_{fv.get('font_hash','')}"
        cid = hashlib.sha256(key.encode()).hexdigest()[:8]
        self.clusters[dev_id] = cid
        return cid


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 6 — UNIFIED SCORING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class ScoringEngine:

    WEIGHTS = {
        "fingerprint_stability": 0.30,
        "anomaly":               0.25,
        "behavior":              0.25,
        "network":               0.20,
    }

    def score(self, fv, anomaly, behavior, network, history=None) -> dict:
        fp_stability = self._fingerprint_stability(fv, history)
        anomaly_s    = 1 - anomaly.get("anomaly_score",0)
        behavior_s   = behavior.get("behavior_score",0.5)
        network_s    = 1 - network.get("network_risk_score",0)

        if behavior.get("behavior_label") == "insufficient_data":
            behavior_s = 0.5

        raw   = (
            fp_stability * self.WEIGHTS["fingerprint_stability"] +
            anomaly_s    * self.WEIGHTS["anomaly"]               +
            behavior_s   * self.WEIGHTS["behavior"]              +
            network_s    * self.WEIGHTS["network"]
        )

        trust      = round(raw * 100, 1)
        risk_level = "high" if trust < 35 else "medium" if trust < 65 else "low"

        return {
            "trust_score": trust,
            "risk_level":  risk_level,
            "components": {
                "fingerprint_stability": round(fp_stability,3),
                "anomaly_inverse":       round(anomaly_s,3),
                "behavior_score":        round(behavior_s,3),
                "network_inverse":       round(network_s,3),
            },
            "explanation": self._explain(trust, fp_stability, anomaly, behavior, network, fv)
        }

    def _fingerprint_stability(self, fv, history) -> float:
        if not history: return 0.6
        checks = ["gpu_hash","canvas_hash","font_hash","platform","os_version"]
        
        if fv.get("audio_available"): checks.append("audio_hash")
        prev   = history[-1]
        scores = [1.0 if fv.get(k)==prev.get(k) else 0.0 for k in checks]
        return statistics.mean(scores) if scores else 0.5

    def _explain(self, trust, fp_stab, anomaly, behavior, network, fv) -> list[str]:
        out = []
        if trust >= 70:   out.append("High trust: consistent hardware fingerprint.")
        elif trust >= 45: out.append("Medium trust: some inconsistencies detected.")
        else:             out.append("Low trust: significant anomalies or VM/bot signals.")

        if anomaly.get("anomaly_score",0) > 0.4:
            flags = [f["flag"] for f in anomaly.get("anomaly_flags",[]) if isinstance(f,dict)]
            out.append(f"Anomaly flags: {', '.join(flags[:3])}")

        bl = behavior.get("behavior_label")
        if bl == "bot_like":           out.append("Behavioral: automated interaction.")
        elif bl == "human":            out.append("Behavioral: consistent with human.")
        elif bl == "insufficient_data":out.append("Behavioral: insufficient data (short session).")

        if network.get("network_risk_score",0) > 0.4:
            out.append(f"Network risk: {', '.join(network.get('network_flags',[])[:2])}")

        if fv.get("is_brave"):         out.append("Browser: Brave (privacy browser confirmed).")
        elif fv.get("sandbox_score",0) > 0.3: out.append("Privacy-hardened browser detected.")
        if fv.get("vm_score",0) > 0.4: out.append("VM environment indicators present.")

        return out


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 7 — DRIFT DETECTION
# ─────────────────────────────────────────────────────────────────────────────

class DriftDetector:

    IMMUTABLE  = ["gpu_hash","canvas_hash","font_hash","platform"]
    SLOW_DRIFT = ["os_version","browser_brand","font_count","timer_res"]
    VOLATILE   = ["mouse_speed","click_count","ip","perm_camera"]

    def analyze(self, history: list[dict]) -> dict:
        if len(history) < 2:
            return {"drift_score":0.0,"drift_events":[],"explanation":"insufficient_history"}

        events, score = [], 0.0

        for i in range(1,len(history)):
            prev, curr = history[i-1], history[i]

            for k in self.IMMUTABLE:
                if prev.get(k) and curr.get(k) and prev[k] != curr[k]:
                    events.append({"type":"immutable_changed","field":k,
                                   "prev":prev[k],"curr":curr[k],
                                   "session":curr.get("session_ts",""),"severity":"high"})
                    score += 0.4

            for k in self.SLOW_DRIFT:
                if prev.get(k) and curr.get(k) and prev[k] != curr[k]:
                    events.append({"type":"gradual_drift","field":k,
                                   "prev":prev[k],"curr":curr[k],
                                   "session":curr.get("session_ts",""),"severity":"low"})
                    score += 0.1

            if (prev.get("audio_available") and curr.get("audio_available") and
                prev.get("audio_hash") != curr.get("audio_hash")):
                events.append({"type":"immutable_changed","field":"audio_hash",
                               "prev":prev["audio_hash"],"curr":curr["audio_hash"],
                               "session":curr.get("session_ts",""),"severity":"high"})
                score += 0.4

        immutable_changes = [e for e in events if e["type"]=="immutable_changed"]
        if len(immutable_changes) >= 2:
            events.append({"type":"spoofing_pattern",
                           "detail":f"{len(immutable_changes)} immutable fields changed",
                           "severity":"critical"})
            score += 0.3

        return {
            "drift_score":        round(min(score,1.0),3),
            "drift_events":       events,
            "sessions_analyzed":  len(history),
            "immutable_changes":  len(immutable_changes)
        }


# ─────────────────────────────────────────────────────────────────────────────
# ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────

class DeviceIntelligenceEngine:

    def __init__(self):
        self.fvb      = FeatureVectorBuilder()
        self.anomaly  = AnomalyDetector()
        self.behavior = BehavioralEngine()
        self.network  = NetworkIntelligence()
        self.graph    = IdentityGraph()
        self.scoring  = ScoringEngine()
        self.drift    = DriftDetector()
        self.store    = defaultdict(list)

    def process(self, fp: dict) -> dict:
        fv       = self.fvb.build(fp)
        dev_id   = fv["device_id"]
        history  = self.store[dev_id]

        anomaly_result  = self.anomaly.analyze(fv, history)
        behavior_result = self.behavior.analyze(fp)
        network_result  = self.network.analyze(fp, [h.get("ip","") for h in history])
        graph_result    = self.graph.ingest(fv, fp)
        score_result    = self.scoring.score(fv, anomaly_result, behavior_result, network_result, history)
        drift_result    = self.drift.analyze(history + [fv])

        self.store[dev_id].append(fv)

        return {
            "device_id":      dev_id,
            "feature_vector": fv,
            "anomaly":        anomaly_result,
            "behavior":       behavior_result,
            "network":        network_result,
            "graph":          graph_result,
            "scoring":        score_result,
            "drift":          drift_result,
        }


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    path   = sys.argv[1] if len(sys.argv) > 1 else "data.json"
    engine = DeviceIntelligenceEngine()

    with open(path) as f:
        sessions = json.load(f)

    results = []
    for fp in sessions:
        r = engine.process(fp)
        results.append(r)
        fv = r["feature_vector"]
        print(f"\n[{r['device_id'][:16]}]")
        print(f"  trust:    {r['scoring']['trust_score']} / 100  ({r['scoring']['risk_level']})")
        print(f"  anomaly:  {r['anomaly']['anomaly_score']}")
        print(f"  behavior: {r['behavior']['behavior_label']} "
              f"(score:{r['behavior']['behavior_score']} "
              f"conf:{r['behavior']['data_confidence']})")
        print(f"  network:  {r['network']['network_risk_score']} "
              f"| isp: {r['network']['isp']} | {r['network']['country']}")
        print(f"  drift:    {r['drift']['drift_score']}")
        print(f"  brave:    {fv.get('is_brave')}  "
              f"| audio_available: {fv.get('audio_available')}")
        for line in r["scoring"]["explanation"]:
            print(f"    -> {line}")

    with open("intelligence_output.json","w") as f:
        json.dump(results, f, indent=2)

    print(f"\n[+] wrote intelligence_output.json")
    print(f"[+] graph: {len(engine.graph.nodes)} nodes  {len(engine.graph.edges)} edges")
