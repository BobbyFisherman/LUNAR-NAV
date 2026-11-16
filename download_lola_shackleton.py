#!/usr/bin/env python3
"""Download NASA's 5 m/pixel LOLA Shackleton-rim DEM, then build a local
horizon/terrain patch for LUNAR/NAV.

Usage:
  python3 -m pip install numpy scipy rasterio pyproj
  python3 download_lola_shackleton.py --lat -89.53 --lon 43.27

NASA PGDA source: https://pgda.gsfc.nasa.gov/products/78
Direct source: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif

Important: the selected coordinate MUST lie within the Shackleton-rim DEM tile.
If it is outside, the converter explains the mismatch rather than inventing
surrounding terrain. Do not assume this 5 m grid maps all boulders or mountains
beyond the tile; a skyline includes only measured DEM coverage.
"""
import argparse
import subprocess
import sys
from pathlib import Path
from urllib.request import Request, urlopen

NASA_URL='https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif'
ROOT=Path(__file__).resolve().parent

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lat',type=float,default=-89.53)
    parser.add_argument('--lon',type=float,default=43.27)
    parser.add_argument('--horizon-km',type=int,default=10)
    parser.add_argument('--output',default='nasa_site_patch.json')
    options=parser.parse_args()
    dest=ROOT/'Site04_final_adj_5mpp_surf.tif'
    if not dest.exists():
        print('Downloading original NASA LOLA GeoTIFF. File size may be substantial.')
        try:
            req=Request(NASA_URL,headers={'User-Agent':'LUNAR/NAV education research; NASA Space Apps'} )
            with urlopen(req,timeout=70) as response, open(dest.with_suffix('.download'),'wb') as output:
                total=0
                while chunk:=response.read(1024*1024):
                    output.write(chunk);total+=len(chunk)
                    if total%(20*1024*1024)<1024*1024: print(f'  Downloaded {total/1048576:.1f} MiB',flush=True)
            dest.with_suffix('.download').rename(dest)
        except Exception as exc:
            dest.with_suffix('.download').unlink(missing_ok=True)
            raise SystemExit(f'NASA DEM download unavailable: {exc}\nYou can manually download {NASA_URL} and save the TIFF beside this script.')
    command=[sys.executable,str(ROOT/'preprocess_lola.py'),str(dest),'--lat',str(options.lat),'--lon',str(options.lon),'--horizon-km',str(options.horizon_km),'--output',str(ROOT/options.output)]
    print('Preprocessing the selected lunar location:',options.lat,options.lon)
    try: subprocess.run(command,check=True)
    except subprocess.CalledProcessError:
        raise SystemExit('Terrain preprocessing stopped. Check whether the selected coordinate is within the source DEM tile. Use the coordinates or files available on NASA PGDA.')
    print(f'Generated {ROOT/options.output}. Refresh the local website. The site and horizon modules will use these measurements automatically.')

if __name__=='__main__':main()
