"""Download authentic NASA global Earth and Moon imagery into the local project.

Run with internet access:
    python3 get_nasa_trajectory_textures.py
The website automatically uses these once downloaded. See source URLs below.
These are photographic satellite mosaics intended for VISUALIZATION, not validated
trajectory or meter-scale terrain measurements.
"""
from pathlib import Path
from urllib.request import Request, urlopen

SOURCES = {
    'earth_texture_nasa.jpg': 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg',
    'moon_texture_nasa.jpg': 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg',
}
for filename,url in SOURCES.items():
    target=Path(__file__).parent / filename
    if target.exists() and target.stat().st_size > 200000:
        print(f'Already downloaded: {target.name}')
        continue
    try:
        with urlopen(Request(url, headers={'User-Agent':'Mozilla/5.0 StudentSpaceApps'}), timeout=60) as r:
            data=r.read()
        if len(data)<100000 or not data.startswith(b'\xff\xd8'):
            raise ValueError('Response was not a valid NASA JPEG')
        target.write_bytes(data)
        print(f'Downloaded {target.name}: {len(data):,} bytes')
    except Exception as e:
        print(f'Could not fetch {filename}: {e}\nDownload manually: {url}')
print('Refresh your local browser tab after the images are downloaded.')
