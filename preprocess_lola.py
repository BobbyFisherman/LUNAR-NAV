"""Convert a NASA LOLA lunar south-pole elevation GeoTIFF to a LOCAL LUNAR/NAV patch.

Example:
  python preprocess_lola.py Site04_final_adj_5mpp_surf.tif \
      --lat -89.53 --lon 43.27 --output shackleton_patch.json

Crucial: This checks 5-m DEM height/slope only. It cannot detect small boulders,
soil bearing strength or safely certify a 100x75-m landing ellipse.
It uses NASA LOLA's south-polar stereographic projection and the Moon's mean
radius 1737400 m. It is not a substitute for LROC high-res stereomapping.
"""
import argparse,json,math
from pathlib import Path
import numpy as np
import rasterio
from rasterio.enums import Resampling
from pyproj import CRS, Transformer, Geod

RADIUS=1737400.0
LONLAT=CRS.from_proj4(f'+proj=longlat +a={RADIUS} +b={RADIUS} +no_defs')
POLAR=CRS.from_proj4(f'+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +a={RADIUS} +b={RADIUS} +units=m +no_defs')
GEOD=Geod(a=RADIUS,b=RADIUS)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('tiff',type=Path);ap.add_argument('--lat',type=float,required=True);ap.add_argument('--lon',type=float,required=True)
    ap.add_argument('--output',default='lola_site_patch.json');ap.add_argument('--grid-meter',type=int,default=5)
    ap.add_argument('--half-width',type=int,default=300);ap.add_argument('--horizon-km',type=int,default=10)
    args=ap.parse_args()
    lat,lon=args.lat,args.lon
    if not (-90<=lat<=-60):raise SystemExit('This adapter supports southern polar LOLA DEMs only (lat <= -60).')
    coords=[];half=args.half_width;step=args.grid_meter
    vals=np.arange(-half,half+1,step)
    # South-polar stereo map grid sampled in projected meters. Rows north-to-south.
    with rasterio.open(args.tiff) as ds:
        if ds.crs is None:
            raise SystemExit('The input DEM has no GeoTIFF CRS. Provide an original georeferenced NASA terrain product.')
        trans=Transformer.from_crs(LONLAT,ds.crs,always_xy=True)
        cx,cy=trans.transform(lon,lat)
        for y in vals[::-1]:
            for x in vals:coords.append((cx+x,cy+y))
        print('Raster',ds.width,ds.height,'CRS',ds.crs,'bounds',ds.bounds)
        if not (ds.bounds.left<=cx<=ds.bounds.right and ds.bounds.bottom<=cy<=ds.bounds.top):
            raise SystemExit('Selected coordinate outside DEM coverage. Choose a coordinate inside the actual site tile.')
        data=np.array([v[0] for v in ds.sample(coords,masked=True)],dtype=float).reshape(len(vals),len(vals))
        xinside=np.array([(ds.bounds.left <=x<= ds.bounds.right and ds.bounds.bottom<=y<=ds.bounds.top) for x,y in coords]).reshape(len(vals),len(vals))
        good=np.isfinite(data)&(data>-1e5)&(data<1e6)&xinside
        if ds.nodata is not None:good &= data!=ds.nodata
        if good.sum()<1000:raise SystemExit('Too few valid DEM pixels at this site.')
        data[~good]=np.nan
        # Simple gradient slope. Projected grid has low distortions near the lunar pole.
        dy,dx=np.gradient(data,step)
        slopes=np.degrees(np.arctan(np.hypot(dx,dy)))
        from scipy.ndimage import gaussian_filter
        filled=np.where(good,data,np.nanmedian(data))
        residual=filled-gaussian_filter(filled,sigma=3.0)
        # RMS short-scale deviation measured over local patch, not a bearing estimate.
        rms_rough_cm=round(float(np.nanstd(residual[good]))*100,1)
        max_slope=round(float(np.nanpercentile(slopes[np.isfinite(slopes)],95)),2)
        # Multi-azimuth topographic skyline; outside data bounds => null horizon.
        bins=[]
        for az in range(0,360,5):
            distances=np.arange(50,args.horizon_km*1000+1,100)
            lat2,lon2=[],[]
            for d in distances:
                lo,la,_=GEOD.fwd(lon,lat,az,float(d))
                lon2.append(lo);lat2.append(la)
            XX,YY=trans.transform(lon2,lat2)
            zs=np.array([v[0] for v in ds.sample(zip(XX,YY),masked=True)],dtype=float)
            valid=np.isfinite(zs)&(zs>-1e5)&(zs<1e6) & (XX>=ds.bounds.left) & (XX<=ds.bounds.right) & (YY>=ds.bounds.bottom) & (YY<=ds.bounds.top)
            if ds.nodata is not None:valid &= zs!=ds.nodata
            center=float(data[len(vals)//2,len(vals)//2])
            if not np.isfinite(center) or not valid.any():bins.append(None);continue
            # Local horizon angle corrected approximately for lunar curvature.
            relative=zs[valid]-center-distances[valid]**2/(2*RADIUS)
            bins.append(round(float(np.degrees(np.max(np.arctan2(relative,distances[valid])))),2))
        # Encoded heights (0.1 m), null where no input.
        grid=[[None if not np.isfinite(v) else round(float(v),1) for v in row] for row in data]
        out={'format':'lunarnav-lola-patch-v1','origin':'NASA LRO LOLA DEM, user-supplied unmodified GeoTIFF','sourceFilename':args.tiff.name,
             'lat':lat,'lon':lon,'gridMeters':step,'halfWidthMeters':half,'elevationMeters':grid,'validFraction':round(float(good.mean()),3),
             'slope95Deg':max_slope,'roughnessRmsCm':rms_rough_cm,'horizonAzimuthStepDegrees':5,'horizonDegrees':bins,
             'horizonMaxDistanceKm':args.horizon_km,'sourceCRS':str(ds.crs),'limitations':'Elevation-derived slope and roughness only. No individual boulder detection, no soil bearing capacity; null horizons indicate DEM coverage gaps; data does NOT certify landing safety.'}
    Path(args.output).write_text(json.dumps(out,separators=(',',':')))
    print('Exported',args.output,'valid',out['validFraction'],'slope95',max_slope,'roughnessCm',rms_rough_cm,'horizons',sum(v is not None for v in bins))
if __name__=='__main__':main()
