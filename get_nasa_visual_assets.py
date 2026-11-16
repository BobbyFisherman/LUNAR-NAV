#!/usr/bin/env python3
"""Optional: cache public NASA photo/3D model assets for the local LUNAR/NAV demo.
Run once with internet access from this website directory. Keep NASA credits in site.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

ROOT = Path(__file__).resolve().parent
ASSETS = [
    ('moon_lro_3d.glb', 'https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/Moon_NASA_LRO_8k_Topo_Small.glb'),
    ('moon_texture_nasa.jpg','https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg'),
    ('moon_nearside_nasa.jpg','https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005001/moon_mosaic_print.jpg'),
    ('moon_farside_nasa.jpg','https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/l/lro_farside.jpg?fit=contain&w=1600'),
    ('earth_texture_nasa.jpg','https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg'),
    ('solar_nasa.jpg','https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg'),
    ('model-viewer.min.js','https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js'),
]
for name, url in ASSETS:
    target=ROOT/name
    if target.exists() and target.stat().st_size>5000:
        print('Already cached:',name);continue
    print('Downloading',name,flush=True)
    tmp=target.with_suffix(target.suffix+'.partial')
    try:
        req=Request(url,headers={'User-Agent':'LunarNAV-Educational-Prototype/1.0'})
        with urlopen(req,timeout=60) as resp, tmp.open('wb') as out:
            while True:
                chunk=resp.read(1024*1024)
                if not chunk:break
                out.write(chunk)
        if tmp.stat().st_size<5000:raise ValueError('Downloaded asset was unexpectedly small')
        tmp.replace(target)
        print('Saved',name, f'{target.stat().st_size/1024/1024:.1f} MB')
    except (URLError,OSError,ValueError) as e:
        print('Skipped',name,'—',e)
        tmp.unlink(missing_ok=True)
print('NASA original model and images are visualization assets, not ground-truth 100 m terrain measurements.')
