"""Same-origin fallback for public OpenFreeMap vector tiles within the India viewport."""
import gzip
import json
import math
import re
import time
from functools import lru_cache
from threading import BoundedSemaphore
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

ROOT = "https://tiles.openfreemap.org/planet"
SLOTS = BoundedSemaphore(6)

def get_bytes(url, size):
    with urlopen(Request(url, headers={"User-Agent": "CareFinder educational India map"}), timeout=3) as resp:
        data = resp.read(size + 1)
        if len(data) > size:
            raise ValueError("Oversized tile")
        return data

@lru_cache(maxsize=2)
def tile_template(hour):
    url = json.loads(get_bytes(ROOT, 250000))["tiles"][0]
    if not re.fullmatch(re.escape(ROOT) + r"/[\w-]+/\{z\}/\{x\}/\{y\}\.pbf", url):
        raise ValueError("Unexpected catalog")
    return url

@lru_cache(maxsize=48)
def fetch_tile(z,x,y,hour):
    data = get_bytes(tile_template(hour).format(z=z,x=x,y=y), 1_500_000)
    if data.startswith(b"\x1f\x8b"):
        import io
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as file:
            data=file.read(2_000_001)
    if not data.startswith(b"\x1a") or len(data)>2_000_000:
        raise ValueError("Invalid tile")
    return data

def serve_street_tile(handler):
    match=re.fullmatch(r"/api/streets/(\d{1,2})/(\d{1,5})/(\d{1,5})\.pbf",urlsplit(handler.path).path)
    if not match:
        handler.send_error(404);return True
    z,x,y=map(int,match.groups())
    n=2**z
    lat=lambda v:math.degrees(math.atan(math.sinh(math.pi*(1-2*v/n))))
    if not (8<=z<=14 and 0<=x<n and 0<=y<n and x/n*360-180<99.75 and (x+1)/n*360-180>65.9 and lat(y)>5 and lat(y+1)<38.8):
        handler.send_error(404);return True
    if not SLOTS.acquire(timeout=.15):
        handler.send_error(503);return True
    try:
        data=fetch_tile(z,x,y,int(time.time()//3600))
        handler.send_bytes(200,"application/vnd.mapbox-vector-tile",data)
    except Exception:
        handler.send_error(503)
    finally:
        SLOTS.release()
    return True
