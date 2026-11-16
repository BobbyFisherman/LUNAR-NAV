from pathlib import Path
p=Path(__file__).parent
h=(p/'index.html').read_text()
needle='<div class="panel control-panel"><div class="panel-title-row"><div><div class="overline">TERRAIN CRITERIA</div>'
extra='''<div class="panel control-panel dem-import"><div class="panel-title-row"><div><div class="overline">NASA DATA / OPTIONAL</div><h3>Import a LOLA terrain patch</h3></div><span class="soft-label">5 m DEM</span></div><label class="field-label" for="demInput">Preprocessed NASA elevation JSON</label><input id="demInput" class="field" type="file" accept=".json,application/json"><p class="tiny-note">Use the included <code>preprocess_lola.py</code> with a NASA PGDA 5m lunar south-pole GeoTIFF. This replaces the illustrative elevation layer with actual local DEM heights where covered; rock and soil safety remain unknown.</p><p id="demStatus" class="terrain-reason">No verified terrain patch imported.</p></div>
  '''
assert needle in h
h=h.replace(needle,extra+needle,1)
(p/'index.html').write_text(h)
app=p/'app.js';s=app.read_text()
needle='function hazardElements()'
new='''let activeDEM=null;
function withinDEM(lat=state.lat,lon=state.lon){return activeDEM&&Math.abs(lat-activeDEM.lat)<.006&&Math.abs(lon-activeDEM.lon)<.006}
function demSlopeFromGrid(grid,x,y,step){const W=grid.length;let ix=clamp(Math.round(x/step+(W-1)/2),1,W-2),iy=clamp(Math.round((W-1)/2-y/step),1,W-2);let a=grid[iy][ix-1],b=grid[iy][ix+1],c=grid[iy-1][ix],d=grid[iy+1][ix];if([a,b,c,d].some(v=>v===null||!Number.isFinite(v)))return null;return Math.atan(Math.hypot((b-a)/(2*step),(c-d)/(2*step)))*DEG}
function demSlopeCoverage(){if(!withinDEM())return null;let pass=0,total=0;const N=86;for(let iy=0;iy<N;iy++)for(let ix=0;ix<N;ix++){const x=(ix+.5)/N*2-1,y=(iy+.5)/N*2-1;if(x*x+y*y>1)continue;const [wx,wy]=ellipseLocalToWorld(x,y),s=demSlopeFromGrid(activeDEM.elevationMeters,wx,wy,activeDEM.gridMeters);if(s===null)continue;total++;if(s<=10)pass++}return total?100*pass/total:null}
function demHorizon(lat,lon,date,body){if(!withinDEM(lat,lon))return null;const a=astroAt(date),bins=activeDEM?.horizonDegrees;if(!a||!Array.isArray(bins)||bins.length<12)return null;const sublat=a[body==='sun'?1:3],sublon=a[body==='sun'?0:2],la=lat*RAD,delta=(sublon-lon)*RAD,s=subLat=>subLat*RAD;const east=Math.cos(s(sublat))*Math.sin(delta),north=Math.sin(s(sublat))*Math.cos(la)-Math.cos(s(sublat))*Math.sin(la)*Math.cos(delta);const az=(Math.atan2(east,north)*DEG+360)%360;const step=activeDEM.horizonAzimuthStepDegrees||5,index=az/step,i=Math.floor(index)%bins.length,j=(i+1)%bins.length;if(bins[i]===null||bins[j]===null)return null;return bins[i]+(bins[j]-bins[i])*(index-Math.floor(index))}
function applyDEMToSliders(){if(!withinDEM())return;state.terrainParams[0]=clamp(Number(activeDEM.slope95Deg)||0,0,25);state.terrainParams[1]=clamp(Number(activeDEM.roughnessRmsCm)||0,0,100);const pct=demSlopeCoverage();if(pct!==null)state.terrainParams[5]=Math.round(pct);}
async function setupTerrainImport(){const input=$('demInput');if(!input)return;input.onchange=async()=>{if(!input.files?.length)return;try{const data=JSON.parse(await input.files[0].text());if(data.format!=='lunarnav-lola-patch-v1'||!Array.isArray(data.elevationMeters)||!Number.isFinite(data.lat)||!Number.isFinite(data.lon))throw Error('Invalid NASA terrain-patch format');activeDEM=data;state.lat=data.lat;state.lon=data.lon;state.selectedSite='custom';sampleTerrainAtLocation();applyDEMToSliders();moonRenderer?.center(state.lat,state.lon);$('demStatus').textContent=`Loaded ${data.sourceFilename} · ${fmt(data.gridMeters,0)}m pixels · ${fmt(data.validFraction*100,1)}% elevation-grid coverage. Slope and roughness measured; boulders and bearing strength unknown.`;refreshAll()}catch(e){$('demStatus').textContent='Import error: '+e.message;activeDEM=null}}}
'''
idx=s.index(needle);s=s[:idx]+new+s[idx:]
# update sampling to reset active dem if coordinate moved away; set synthetic then applyDEM when in DEM.
s=s.replace('state.terrainManuallyAdjusted=new Set();}', 'state.terrainManuallyAdjusted=new Set();if(withinDEM())applyDEMToSliders();}')
# Render map replacement before normal image drawing; use local grid projection if imported.
needle="const img=sharedMoonImage;if(img&&img.complete){"
new="""if(withinDEM()){
  const grid=activeDEM.elevationMeters,n=grid.length,valid=grid.flat().filter(v=>v!==null&&Number.isFinite(v)),min=Math.min(...valid),max=Math.max(...valid),range=Math.max(1,max-min),off=document.createElement('canvas');off.width=n;off.height=n;const ox=off.getContext('2d'),im=ox.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let v=grid[y][x],r=v===null?0:(v-min)/range,idx=(y*n+x)*4;im.data[idx]=v===null?29:Math.round(32+r*133);im.data[idx+1]=v===null?46:Math.round(50+r*131);im.data[idx+2]=v===null?59:Math.round(66+r*117);im.data[idx+3]=255;}ox.putImageData(im,0,0);const side=activeDEM.halfWidthMeters*2,pxPerMeter=Math.min(W/side,H/side),size=side*pxPerMeter;ctx.drawImage(off,(W-size)/2,(H-size)/2,size,size);ctx.fillStyle='#081e2860';ctx.fillRect(0,0,W,H);
 }else{const img=sharedMoonImage;if(img&&img.complete){"""
assert needle in s;s=s.replace(needle,new,1)
# after image fallback close 'else' extra before const cx
needle="else{ctx.fillStyle='#9aa5a520';ctx.fillRect(0,0,W,H)}\n const cx"
assert needle in s;s=s.replace(needle,"else{ctx.fillStyle='#9aa5a520';ctx.fillRect(0,0,W,H)}}\n const cx",1)
# no synthetic markers when DEM present, instead overlay grid slope high samples.
s=s.replace("ctx.save();ctx.translate(cx,cy);for(const h of data.hazards)","ctx.save();ctx.translate(cx,cy);for(const h of (withinDEM()?[]:data.hazards))")
s=s.replace("ctx.fillText('Surface colors = demonstration hazard overlays; not validated NASA measurements',15,H-12);", "ctx.fillText(withinDEM()?'NASA LOLA elevation mosaic; red hazard markers disabled (unmeasured)':'Surface colors = demonstration hazard overlays; not validated NASA measurements',15,H-12);")
# updated source badge & result wording
s=s.replace("$('hazardCount').textContent=t.count", "$('hazardCount').textContent=withinDEM()?'Unmapped':t.count")
s=s.replace("renderHazardMap(t);if($('skyDate'))updateSciencePanel()", "renderHazardMap(t);if($('skyDate'))updateSciencePanel()")
# update exact Page4 Earth and sun measured skyline
s=s.replace("let d=timeStamp(state.commDate,state.commMinute),e=earthAltitude(state.lat,state.lon,d),direct=e>0,route=", "let d=timeStamp(state.commDate,state.commMinute),e=earthAltitude(state.lat,state.lon,d),observed=demHorizon(state.lat,state.lon,d,'earth'),direct=e>(observed??0),route=")
s=s.replace("$('directVisibility').textContent=direct?'Above flat horizon':'Below flat horizon'", "$('directVisibility').textContent=direct?(observed!==null?'Above LOLA horizon':'Above flat horizon'):(observed!==null?'LOLA terrain blocks Earth':'Moon/horizon blocks Earth')")
# chart sky thresholds use local DEM horizon in status + textual explanation, but numeric graph baseline remains flat/hypothetical.
s=s.replace("if(obj('skySource'))obj('skySource').textContent=a?'EPHEMERIS / IAU ORIENTATION':'APPROXIMATE FALLBACK';", "if(obj('skySource'))obj('skySource').textContent=withinDEM()?'EPHEMERIS + LOLA LOCAL TERRAIN':a?'EPHEMERIS / IAU ORIENTATION':'APPROXIMATE FALLBACK';")
s=s.replace("sun>skyState.horizon?'VISIBLE':'BLOCKED'", "sun>(demHorizon(state.lat,state.lon,d,'sun')??skyState.horizon)?'VISIBLE':'BLOCKED'")
s=s.replace("earth>skyState.horizon?'VISIBLE':'BLOCKED'", "earth>(demHorizon(state.lat,state.lon,d,'earth')??skyState.horizon)?'VISIBLE':'BLOCKED'")
# Compare imported DEM if candidate matches and loaded; shared comparison samples.
s=s.replace("sun+=s>0?1:0;earth+=e>0?1:0;both+=s>0&&e>0?1:0;", "const sh=demHorizon(site.lat,site.lon,date,'sun')??0,eh=demHorizon(site.lat,site.lon,date,'earth')??0;sun+=s>sh?1:0;earth+=e>eh?1:0;both+=s>sh&&e>eh?1:0;")
# finish init
s=s.replace('setupSciencePanel();loadEphemeris();setupLanding();','setupSciencePanel();loadEphemeris();setupLanding();setupTerrainImport();')
app.write_text(s)
print('Import adapter connected')
