/* LUNAR / NAV v13 — data-aware lunar horizon panorama.
   Ephemeris is inherited from the existing mission clock (Moshier/IAU).
   Terrain angles are read ONLY from an imported NASA LOLA terrain patch.
   No mountain elevations are fabricated when the selected point lacks coverage.
*/
(()=>{'use strict';
 const el=id=>document.getElementById(id), PI=Math.PI, RAD=PI/180, DEG=180/PI;
 let lastKey='',lastSunsetKey='',lastSunset='—';
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 const safe=x=>String(x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
 const now=()=>typeof window.__missionNow==='function'?window.__missionNow():timeStamp(state.launchDate,state.launchMinute);
 function azimuth(lat,lon,subLat,subLon){
  const la=lat*RAD,dec=subLat*RAD,dLon=(subLon-lon)*RAD;
  const east=Math.cos(dec)*Math.sin(dLon);
  const north=Math.sin(dec)*Math.cos(la)-Math.cos(dec)*Math.sin(la)*Math.cos(dLon);
  return (Math.atan2(east,north)*DEG+360)%360;
 }
 function bodyAt(type,date,lat=state.lat,lon=state.lon){
  const a=astroAt(date),sun=type==='sun';
  const alt=sun?sunAltitude(lat,lon,date):earthAltitude(lat,lon,date);
  if(!a)return {alt,az:null};
  const sla=a[sun?1:3],slo=a[sun?0:2];
  return {alt,az:azimuth(lat,lon,sla,slo)};
 }
 function horizonAt(az){
  if(az===null || !withinDEM())return null;
  const vals=activeDEM?.horizonDegrees,step=activeDEM?.horizonAzimuthStepDegrees||5;
  if(!Array.isArray(vals)||vals.length<12)return null;
  const f=(az%360)/step,i=Math.floor(f)%vals.length,j=(i+1)%vals.length;
  if(!Number.isFinite(vals[i])||!Number.isFinite(vals[j]))return null;
  return vals[i]+(vals[j]-vals[i])*(f-Math.floor(f));
 }
 function info(body,date,lat=state.lat,lon=state.lon){const b=bodyAt(body,date,lat,lon),h=horizonAt(b.az);return {...b,terrain:h,clearance:h===null?null:b.alt-h,geometric:b.alt,visible:(b.alt-(h??0))>0};}
 const fmtAngle=x=>Number.isFinite(x)?`${x>=0?'+':''}${x.toFixed(1)}°`:'—';
 function formatElapsed(ms){const total=Math.floor(ms/60000),d=Math.floor(total/1440),h=Math.floor(total%1440/60),m=total%60;return d?`${d}d ${h}h`:h?`${h}h ${String(m).padStart(2,'0')}m`:`${m} min`}
 function nextSunset(time,lat,lon){
  const sample=t=>{let date=new Date(t);let b=bodyAt('sun',date,lat,lon),h=horizonAt(b.az);return b.alt-(h??0)};
  let start=time.getTime(),x0=sample(start);
  if(!Number.isFinite(x0))return 'Unavailable';
  if(x0<=0)return 'Sun below horizon';
  let t0=start,dt=2*3600000;
  const bound=Math.min(Date.parse('2029-12-31T23:59:59Z'),start+220*86400000);
  for(let t=start+dt;t<=bound;t+=dt){let y=sample(t);if(Number.isFinite(y)&&y<=0){let a=t0,b=t;for(let k=0;k<24;k++){let mid=(a+b)/2;if(sample(mid)>0)a=mid;else b=mid}return formatElapsed(b-start)}t0=t}
  return 'No set in available window';
 }
 function render(){const svg=el('horizonSvg');if(!svg||state.page!==5)return;
  const dt=now(),key=`${state.lat.toFixed(5)}:${state.lon.toFixed(5)}:${Math.round(dt.getTime()/30000)}:${activeDEM?.sourceFilename||'no-dem'}`;
  if(key===lastKey)return;lastKey=key;
  el('horizonCoords').textContent=coordinateLabel(state.lat,state.lon,4);
  el('horizonClock').textContent=dt.toISOString().slice(0,16).replace('T',' ')+' UTC';
  const sun=info('sun',dt),earth=info('earth',dt),isDEM=withinDEM()&&Array.isArray(activeDEM?.horizonDegrees);
  const bins=isDEM?activeDEM.horizonDegrees:null;
  const dataHeights=isDEM?bins.filter(Number.isFinite):[];
  const top=Math.max(22,...dataHeights.map(x=>x+8),sun.alt+5,earth.alt+5),bottom=Math.min(-22,sun.alt-7,earth.alt-7);
  const W=1000,H=375,L=55,R=944,T=32,B=331;
  const xp=az=>L+(az/360)*(R-L),yp=alt=>T+(top-alt)/(top-bottom)*(B-T);
  const base=yp(0);
  const terrain=isDEM?Array.from({length:361},(_,i)=>({az:i,val:horizonAt(i)})):Array.from({length:361},(_,i)=>({az:i,val:0}));
  // Break a skyline on missing DEM bins instead of inventing local ridges.
  let sections=[],segment=[];for(const p of terrain){if(p.val===null){if(segment.length)sections.push(segment);segment=[]}else segment.push(p)}if(segment.length)sections.push(segment);
  const line=sections.map(seg=>'M'+seg.map(p=>`${xp(p.az).toFixed(2)},${yp(p.val).toFixed(2)}`).join(' L')).join(' ');
  const fill=sections.map(seg=>`M${xp(seg[0].az).toFixed(1)},${B} L${seg.map(p=>`${xp(p.az).toFixed(1)},${yp(p.val).toFixed(1)}`).join(' L')} L${xp(seg[seg.length-1].az).toFixed(1)},${B} Z`).join(' ');
  const markers=[{type:'Sun',data:sun,color:'#ffd795',r:13},{type:'Earth',data:earth,color:'#79d7fa',r:12}].map(({type,data,color,r})=>{
   if(data.az===null)return '';
   const x=xp(data.az),y=yp(data.alt),visible=data.visible;
   const labelX=clamp(x+16,L+32,R-115),labelY=clamp(y+(type==='Sun'?-26:33),T+20,B-10);
   return `<line x1="${x}" y1="${base}" x2="${x}" y2="${y}" stroke="${color}" stroke-opacity=".6" stroke-dasharray="4 5"/>`+
    `<circle cx="${x}" cy="${y}" r="${r+8}" fill="${color}" opacity="${visible?'.14':'.04'}"/>`+
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${visible?color:'none'}" fill-opacity="${visible?'.92':'0'}" stroke="${color}" stroke-width="2.6"/>`+
    `<text x="${labelX}" y="${labelY}" font-size="15" fill="${color}" font-weight="800">${type.toUpperCase()}</text><text x="${labelX}" y="${labelY+14}" font-size="11" fill="#d9e5ec">${fmtAngle(data.alt)} · ${Math.round(data.az)}° AZ${visible?'':' · below skyline'}</text>`;
  }).join('');
  const stars=Array.from({length:88},(_,i)=>{const px=L+((i*131.31)% (R-L)),py=T+((i*97.63)%240);return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${i%7===0?'1.15':'.55'}" fill="#c1d6f0" opacity="${.14+(i%5)*.12}"/>`}).join('');
  svg.innerHTML=`<defs><linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#010812"/><stop offset="1" stop-color="#112738"/></linearGradient><linearGradient id="surfaceH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#465665"/><stop offset=".65" stop-color="#283949"/><stop offset="1" stop-color="#101f30"/></linearGradient><linearGradient id="sunGlowH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a78342" stop-opacity="0"/><stop offset=".5" stop-color="#cbac55" stop-opacity=".24"/><stop offset="1" stop-color="#a78342" stop-opacity="0"/></linearGradient></defs>
   <rect width="1000" height="375" fill="url(#skyNight)"/>${stars}
   ${sun.alt>0?`<ellipse cx="${xp(sun.az||180)}" cy="${yp(sun.alt)}" rx="180" ry="98" fill="url(#sunGlowH)"/>`:''}
   ${[-20,-10,0,10,20,30,45,60,75].filter(v=>v>bottom&&v<top).map(v=>`<line x1="${L}" x2="${R}" y1="${yp(v)}" y2="${yp(v)}" stroke="${v===0?'#f2f1d4':'#6e899f'}" stroke-opacity="${v===0?'.62':'.15'}" stroke-width="${v===0?2:1}" stroke-dasharray="${v===0?'0':'4 6'}"/><text x="${L-12}" y="${yp(v)+4}" text-anchor="end" fill="#a6bdc9" font-size="11">${v}°</text>`).join('')}
   <path d="${fill}" fill="url(#surfaceH)" stroke="none"/><path d="${line}" fill="none" stroke="${isDEM?'#b8c2bd':'#8297a9'}" stroke-width="${isDEM?2.6:1.4}"/>
   ${markers}
   ${['N','NE','E','SE','S','SW','W','NW'].map((name,i)=>`<text x="${xp(i*45)}" y="356" text-anchor="middle" fill="#acc5d1" font-size="12" font-weight="700">${name}</text>`).join('')}
   <text x="980" y="22" text-anchor="end" fill="#acc4d2" font-size="10">${isDEM?'NASA LOLA local terrain profile':'FLAT-HORIZON GEOMETRY · TERRAIN UNKNOWN'}</text>
  `;
  el('horizonSunElevation').textContent=fmtAngle(sun.alt);el('horizonEarthElevation').textContent=fmtAngle(earth.alt);
  el('horizonSunDetails').textContent=`${Math.round(sun.az??0)}° azimuth · ${sun.visible?'above':'below'} ${isDEM?'terrain skyline':'geometric horizon'}`;
  el('horizonEarthDetails').textContent=`${Math.round(earth.az??0)}° azimuth · ${earth.visible?'above':'below'} ${isDEM?'terrain skyline':'geometric horizon'}`;
  const margin=sun.clearance,earthMargin=earth.clearance;
  el('horizonClearance').textContent=isDEM?fmtAngle(Math.min(margin??Infinity,earthMargin??Infinity)):'Awaiting DEM';
  el('horizonClearanceInfo').textContent=isDEM?`Sun ${fmtAngle(margin)} · Earth ${fmtAngle(earthMargin)} above terrain`:'Peak height cannot be estimated from photographs alone';
  el('horizonData').textContent=isDEM?'NASA LOLA':'No terrain tile';
  el('horizonDataNote').textContent=isDEM?`${Math.round((activeDEM.validFraction||0)*100)}% local elevation coverage · ${activeDEM.gridMeters} m grid`:'Import a LOLA elevation tile on Site & Light';
  el('horizonAccuracy').textContent=isDEM?`Horizon bins computed from ${activeDEM.sourceFilename} up to ${activeDEM.horizonMaxDistanceKm||10} km. Missing bins and longer-distance peaks remain unknown; this is not full-skyline certification.`:'Sun/Earth elevations are date-dependent. Without a NASA elevation tile for this exact point, the horizon is shown flat; mountain obstruction and clearance are unknown.';
  const sunsetKey=`${state.lat.toFixed(4)}:${state.lon.toFixed(4)}:${Math.floor(dt.getTime()/900000)}:${activeDEM?.sourceFilename||'no-dem'}`;
  if(sunsetKey!==lastSunsetKey){lastSunsetKey=sunsetKey;lastSunset=nextSunset(dt,state.lat,state.lon)}
  el('horizonSunset').textContent=lastSunset;
  el('horizonSunset').title=isDEM?'Time until Sun drops below NASA-derived skyline':'Time to geometric sunset with a flat horizon; local mountains are not accounted for';
 }
 function setup(){
  if(!el('horizonSvg'))return;
  const selector=el('horizonSiteSelect');selector.addEventListener('change',()=>{
   const key=selector.value;
   if(key!=='selected' && namedSites[key]){
    const actual=el('siteSearch');actual.value=key;actual.dispatchEvent(new Event('change',{bubbles:true}));
   }
   lastKey='';render();
  });
  el('horizonGoToTerrain').addEventListener('click',()=>{showPage(1);setTimeout(()=>{el('demInput')?.closest('.dem-import')?.scrollIntoView({behavior:'smooth',block:'center'})},600)});
  el('resetToLaunch')?.addEventListener('click',()=>{
   const target=timeStamp(state.launchDate,state.launchMinute).getTime()-3600000;
   window.__setMissionNow?.(target);
   const btn=el('resetToLaunch');btn.classList.add('active');setTimeout(()=>btn.classList.remove('active'),550);
  });
  // Move map data/asset notice below the globe instead of blocking click events.
  const guide=el('nasaMoonImageGuide'), panel=el('moonCanvas')?.closest('.moon-panel');if(guide&&panel){panel.appendChild(guide);guide.style.pointerEvents='auto'}
  render();setInterval(render,420);
 }
 document.addEventListener('DOMContentLoaded',()=>setTimeout(setup,170));
})();
