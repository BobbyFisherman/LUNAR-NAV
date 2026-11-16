"""Optional NASA Moon Kit texture download for a fully local/offline project.
Source: NASA SVS CGI Moon Kit, LROC color mosaic (2025): https://svs.gsfc.nasa.gov/4720/
This is a visualization texture, not high-resolution 100 m landing site data.
"""
from pathlib import Path
from urllib.request import Request, urlopen

url = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg'
out = Path(__file__).with_name('moon_texture_nasa.jpg')
try:
    with urlopen(Request(url, headers={'User-Agent':'LunarNavStudentDemo/1.0'}), timeout=30) as response:
        content = response.read()
    if len(content) < 100000 or not content.startswith(b'\xff\xd8'):
        raise ValueError('Response was not an expected JPEG map')
    out.write_bytes(content)
    print(f'NASA LROC map saved: {out} ({len(content):,} bytes). Restart or refresh your local website.')
except Exception as exc:
    print(f'Unable to download NASA map: {exc}')
    print(f'You can also download "lroc_color_2k.jpg" from https://svs.gsfc.nasa.gov/4720/')
    print('Rename it moon_texture_nasa.jpg and put it beside index.html.')
