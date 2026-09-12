"""Refresh the six-course FA26 fallback, respecting Cornell's 1 request/sec limit."""
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
SUPPORTED = {'CS 3110','CS 2800','ECON 3030','ECON 3040','MATH 2940','MATH 2930'}
courses = []
for subject in ['CS', 'ECON', 'MATH']:
    url = f'https://classes.cornell.edu/api/2.0/search/classes.json?roster=FA26&subject={subject}'
    with urllib.request.urlopen(url, timeout=20) as response:
        payload = json.load(response)
    if payload.get('status') != 'success':
        raise RuntimeError('Cornell API request failed; existing snapshot retained')
    courses.extend(c for c in payload['data']['classes'] if f"{c['subject']} {c['catalogNbr']}" in SUPPORTED)
    time.sleep(1.1)
if {f"{c['subject']} {c['catalogNbr']}" for c in courses} != SUPPORTED:
    raise RuntimeError('Incomplete catalog; existing snapshot retained')
result = {'roster': 'FA26', 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'source': 'https://classes.cornell.edu/api/2.0/search/classes.json', 'courses': courses}
path = Path(__file__).resolve().parents[1] / 'dist/data/cornell-fa26.json'
temporary = path.with_suffix('.tmp')
temporary.write_text(json.dumps(result))
temporary.replace(path)
print(f'Refreshed {len(courses)} actual Cornell offerings')
