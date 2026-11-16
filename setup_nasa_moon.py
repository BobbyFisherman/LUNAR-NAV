#!/usr/bin/env python3
"""Download genuine NASA LROC 2025 lunar global mosaic for LUNAR/NAV's *georeferenced* globe.
The website cannot map remote cross-origin pixels when NASA disallows canvas CORS.
Run this once with internet access; no account, API key, or external package required.
"""
from urllib.request import Request,urlopen
from pathlib import Path
root=Path(__file__).resolve().parent
url="https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg"
path=root/'moon_texture_nasa.jpg'
try:
    req=Request(url,headers={'User-Agent':'Mozilla/5.0 (educational NASA visualizations)'})
    with urlopen(req,timeout=35) as r:
        content=r.read(4_000_000)
    if not content.startswith(b'\xff\xd8') or len(content)<100_000:raise ValueError('NASA did not return JPEG imagery')
    path.write_bytes(content)
    print(f'Saved NASA LROC color mosaic: {path} ({len(content):,} bytes). Refresh the site.')
except Exception as exc:
    print('NASA asset download failed:',exc)
    print('Open '+url+' in a browser and save it to moon_texture_nasa.jpg beside index.html')
