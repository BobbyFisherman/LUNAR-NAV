/* LUNAR/NAV v7 — top-down system view + NASA LRO model viewer.
 * Images and model are NASA-origin when fetched. Geometric drawings remain intentionally NOT to scale.
 */
'use strict';
(function(){
  const $7=id=>document.getElementById(id);
  const LRO_GLB='https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/Moon_NASA_LRO_8k_Topo_Small.glb';
  const LRO_LIGHT='https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/moon_small.glb';
  const NASA_SUN='https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg';
  const NASA_MOON_DISK='https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Moon_nearside_LRO_color_mosaic.png/2048px-Moon_nearside_LRO_color_mosaic.png';
  let mode3d=false;
  const starfield=(w,h,n)=>Array.from({length:n},(_,i)=>{let x=(i*131.17+63.1)%w,y=(i*71.27+i*i*.47+93)%h;return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(.35+(i%5)*.17).toFixed(1)}" fill="#dbeaf1" opacity="${(.17+(i%9)*.06).toFixed(2)}"/>`}).join('');
  function safe(s){return safeHTML(String(s))}
  function fgPlanet(which,x,y,r,lat,lon,key){
    const surface=texturedGlobe(which,lat,lon),fallback=which==='earth'?'earth_texture.jpg':'moon_texture.jpg';
    const remote=which==='earth'?NASA_EARTH_PHOTO:NASA_MOON_DISK;
    const edge=which==='earth'?'#9dd6f6':'#c3d7e3';
    return `<defs><clipPath id="v7${key}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><radialGradient id="v7${key}shade" cx=".68" cy=".36" r=".88"><stop stop-color="#fff" stop-opacity=".12"/><stop offset=".55" stop-color="#050912" stop-opacity=".06"/><stop offset="1" stop-color="#02050b" stop-opacity=".82"/></radialGradient></defs>
      <g><circle cx="${x}" cy="${y}" r="${r+4}" fill="${edge}" opacity=".08"/><image href="${fallback}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" clip-path="url(#v7${key})" preserveAspectRatio="xMidYMid slice"/>
      <image href="${remote}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" clip-path="url(#v7${key})" preserveAspectRatio="xMidYMid slice" opacity="${surface?0:.94}"/>
      ${surface?`<image href="${surface}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" clip-path="url(#v7${key})"/>`:''}
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(#v7${key}shade)"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${edge}" stroke-opacity=".46"/></g>`;
  }
  function star(x,y,r,key){return `<defs><clipPath id="v7Sun${key}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><radialGradient id="v7SunGlow${key}"><stop stop-color="#ffd28b" stop-opacity=".47"/><stop offset=".36" stop-color="#e38c3f" stop-opacity=".14"/><stop offset="1" stop-color="#d68236" stop-opacity="0"/></radialGradient><radialGradient id="v7SunDisk${key}"><stop stop-color="#ffe4a9"/><stop offset=".73" stop-color="#ffb75b"/><stop offset="1" stop-color="#e57e33"/></radialGradient></defs>
  <circle cx="${x}" cy="${y}" r="${r*2.65}" fill="url(#v7SunGlow${key})" class="sun-flare"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#v7SunDisk${key})"/><image href="solar_fallback.png" x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" clip-path="url(#v7Sun${key})"/><image href="solar_nasa.jpg" x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" clip-path="url(#v7Sun${key})"/><image href="${NASA_SUN}" x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" clip-path="url(#v7Sun${key})" preserveAspectRatio="xMidYMid slice"/><circle cx="${x}" cy="${y}" r="${r}" stroke="#ffd195" stroke-opacity=".48" fill="none"/>`}
  function orbitAngle(time){ // Conceptual Earth–Moon plane, phase-locked to date: New Moon near Sun on the left.
    let p=getMoonPhase(time);return Math.PI+Math.PI*2*p;
  }
  function sceneTime(){return window.__missionNow?window.__missionNow():dateAdd(timeStamp(state.launchDate,state.launchMinute),state.flight*transferDays)}
  const simpleBezier=(a,b,c,d,t)=>({x:(1-t)**3*a.x+3*(1-t)**2*t*b.x+3*(1-t)*t*t*c.x+t**3*d.x,y:(1-t)**3*a.y+3*(1-t)**2*t*b.y+3*(1-t)*t*t*c.y+t**3*d.y});
  // Overrides the earlier perspective: this is a SINGLE top-down Earth–Moon orbital-plane scene.
  drawTransfer=function(){
    const svg=$7('orbitSvg');if(!svg)return;
    const now=sceneTime(),p=clamp(state.flight,0,1),ln=launchSites[state.launchSite];
    const E={x:429,y:270,r:71},S={x:84,y:272,r:69};
    const at=ang=>({x:E.x+211*Math.cos(ang),y:E.y+169*Math.sin(ang)});
    const moonCenter=at(orbitAngle(now));
    const eta=dateAdd(timeStamp(state.launchDate,state.launchMinute),transferDays),aim=at(orbitAngle(eta));
    const M={...moonCenter,r:44},focus=clamp(ln.lat-3,-55,55),camLon=ln.lon-18+(now.getTime()/86400000%1)*12;
    const launch=projectPoint(ln.lat,ln.lon,focus,camLon);
    const dep={x:E.x+E.r*launch.x,y:E.y-E.r*launch.y};
    const mark=projectPoint(state.lat,state.lon,0,0),land={x:moonCenter.x+M.r*(mark.z>0?mark.x:Math.sign(mark.x||1)*.91),y:moonCenter.y-M.r*mark.y};
    const target={x:aim.x,y:aim.y},unit={x:(target.x-E.x)/Math.hypot(target.x-E.x,target.y-E.y),y:(target.y-E.y)/Math.hypot(target.x-E.x,target.y-E.y)};
    const a={x:dep.x+unit.x*72,y:dep.y+unit.y*72-23},b={x:target.x-unit.x*70,y:target.y-unit.y*70-25};
    const dot=simpleBezier(dep,a,b,target,p), gold=state.optimizedMinute!=null&&state.launchMinute===state.optimizedMinute,accent=gold?'#ffda85':'#8ce7d6';
    const path=`M ${dep.x.toFixed(2)} ${dep.y.toFixed(2)} C ${a.x.toFixed(2)} ${a.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)} ${target.x.toFixed(2)} ${target.y.toFixed(2)}`;
    svg.setAttribute('viewBox','0 0 940 540');
    svg.innerHTML=`<defs><radialGradient id="v7Void"><stop stop-color="#11253a"/><stop offset=".55" stop-color="#080f1a"/><stop offset="1" stop-color="#02050c"/></radialGradient><filter id="v7Halo"><feGaussianBlur stdDeviation="6"/></filter><linearGradient id="v7SunLine"><stop stop-color="#f9c381" stop-opacity=".32"/><stop offset="1" stop-color="#f9c381" stop-opacity="0"/></linearGradient></defs>
    <rect width="940" height="540" fill="url(#v7Void)"/>${starfield(940,540,185)}
    <g class="v7-orbit-plane"><ellipse cx="${E.x}" cy="${E.y}" rx="211" ry="169" fill="none" stroke="#87a6b3" stroke-width="1.1" stroke-dasharray="3 8" stroke-opacity=".45"/><line x1="${S.x+S.r}" y1="${S.y}" x2="${E.x-E.r}" y2="${E.y}" stroke="url(#v7SunLine)" stroke-width="24" opacity=".3"/><path d="M 180 70 L 870 70 M 180 470 L 870 470" stroke="#b5d9e3" opacity=".06"/></g>
    ${star(S.x,S.y,S.r,'Transfer')}
    ${fgPlanet('earth',E.x,E.y,E.r,focus,camLon,'TransferEarth')}
    ${fgPlanet('moon',M.x,M.y,M.r,0,0,'TransferMoon')}
    <circle cx="${aim.x}" cy="${aim.y}" r="51" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="5 10" opacity=".48"/>
    <path d="${path}" stroke="${accent}" stroke-width="12" fill="none" filter="url(#v7Halo)" opacity=".16"/>
    <path d="${path}" stroke="${accent}" stroke-width="2.65" fill="none" stroke-dasharray="3.5 9.5" stroke-linecap="round" class="v7-transfer-path"/>
    <circle cx="${dep.x}" cy="${dep.y}" r="4.4" fill="white" stroke="#a0ffec" stroke-width="2"/><circle cx="${dep.x}" cy="${dep.y}" r="11" fill="none" stroke="#7ee4d5" stroke-opacity=".54"/>
    <circle class="flight-tracker" cx="${dot.x}" cy="${dot.y}" r="12" fill="${accent}" opacity=".2"/><circle class="flight-tracker" cx="${dot.x}" cy="${dot.y}" r="4.8" fill="#fff" stroke="${accent}" stroke-width="2"/>
    ${mark.z>0?`<circle cx="${land.x}" cy="${land.y}" r="5.2" fill="none" stroke="#80efc4" stroke-width="2"/><circle cx="${land.x}" cy="${land.y}" r="2" fill="#80efc4"/>`:''}
    <g fill="#e0f0f2" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="2"><text x="${S.x}" y="${S.y+S.r+25}">SUN</text><text x="${E.x}" y="${E.y+E.r+25}">EARTH</text><text x="${M.x}" y="${M.y+M.r+21}">MOON</text></g>
    <rect x="20" y="87" width="248" height="65" rx="12" fill="#091824e8" stroke="#49616c"/><text x="35" y="109" fill="#9fdbcd" font-size="10" letter-spacing="1.4" font-weight="800">DEPARTURE · ${safe(ln.name.toUpperCase())}</text><text x="35" y="130" fill="white" font-size="12">${safe(coordinateLabel(ln.lat,ln.lon))}</text>
    <rect x="672" y="440" width="244" height="70" rx="12" fill="#091824e8" stroke="#49616c"/><text x="687" y="462" fill="#a2dcd1" font-size="10" letter-spacing="1.3" font-weight="800">SELECTED LUNAR TARGET</text><text x="687" y="484" fill="white" font-size="12">${safe(coordinateLabel(state.lat,state.lon))}</text><text x="687" y="499" fill="#adc6ce" font-size="10">${safe(now.toISOString().slice(0,16).replace('T',' '))} UTC</text>
    <text x="20" y="514" fill="#91aabd" font-size="10">TOP-DOWN ORBITAL-PLANE VIEW · SUN/EARTH/MOON SIZES AND DISTANCES NOT TO SCALE</text><text x="916" y="36" fill="${accent}" text-anchor="end" font-size="11" letter-spacing="1">${gold?'✦ BEST IN DEMO WINDOW':'MOVING MOON · SHARED CLOCK'}</text>`;
    if($7('trajectoryTargetStatus'))$7('trajectoryTargetStatus').textContent=`Top-down Sun–Earth–Moon geometry at ${now.toISOString().slice(0,16).replace('T',' ')} UTC. Dotted transfer is an explanatory path, NOT a solved spacecraft orbit.`;
    if($7('trajectoryAssetStatus'))$7('trajectoryAssetStatus').textContent=transferTextures.earth&&transferTextures.moon?'NASA LRO + BLUE MARBLE TEXTURES':'NASA VISUAL SOURCES · FALLBACK WHEN OFFLINE';
  };
  commSvgGraphic=function(elevation,direct){
    const svg=$7('commSvg');if(!svg)return;const now=sceneTime(),phase=orbitAngle(now),E={x:322,y:236,r:73},S={x:84,y:236,r:56},M={x:649+22*Math.cos(phase),y:231+35*Math.sin(phase),r:83};
    const unit=projectPoint(state.lat,state.lon,0,0),far=unit.z<=0,spot={x:M.x+(far?M.r*.97:unit.x*M.r),y:M.y-unit.y*M.r};
    const relay1={x:M.x+119,y:M.y-105},relay2={x:M.x+122,y:M.y+95},start={x:E.x+E.r*.94,y:E.y};
    const color=direct?'#8ff2d4':'#f3a19a';
    svg.setAttribute('viewBox','0 0 940 465');
    svg.innerHTML=`<defs><radialGradient id="v7ComBg"><stop stop-color="#12243a"/><stop offset="1" stop-color="#030812"/></radialGradient><filter id="v7ComGlow"><feGaussianBlur stdDeviation="5"/></filter></defs><rect width="940" height="465" fill="url(#v7ComBg)"/>${starfield(940,465,145)}
    ${star(S.x,S.y,S.r,'Comms')}
    <path d="M ${S.x+S.r} ${S.y} L ${E.x-E.r} ${E.y}" stroke="#e6b47b" stroke-opacity=".10" stroke-width="34"/>
    ${fgPlanet('earth',E.x,E.y,E.r,0,-20,'CommEarth')}
    ${fgPlanet('moon',M.x,M.y,M.r,0,0,'CommMoon')}
    <path d="M ${start.x} ${start.y} L ${direct?spot.x:M.x-M.r} ${direct?spot.y:M.y}" stroke="${color}" stroke-opacity=".25" stroke-width="12" filter="url(#v7ComGlow)"/>
    <path d="M ${start.x} ${start.y} L ${direct?spot.x:M.x-M.r} ${direct?spot.y:M.y}" fill="none" stroke="${color}" stroke-width="2.7" stroke-dasharray="5 10" class="signal-dash"/>
    ${direct?`<circle class="signal-pulse" cx="${(start.x+spot.x)/2}" cy="${(start.y+spot.y)/2}" r="5.2" fill="#c4ffeb"/>`:`<g stroke="#f5c98f" fill="none" stroke-width="1.8" stroke-dasharray="5 8" opacity=".95"><path d="M ${spot.x} ${spot.y} L ${relay1.x} ${relay1.y} L ${start.x} ${start.y}"/><path d="M ${spot.x} ${spot.y} L ${relay2.x} ${relay2.y} L ${start.x} ${start.y}"/></g><circle cx="${relay1.x}" cy="${relay1.y}" r="6" fill="#f7d18b"/><circle cx="${relay2.x}" cy="${relay2.y}" r="6" fill="#f7d18b"/><text x="${relay1.x+10}" y="${relay1.y-7}" font-size="10" fill="#f7d18b">RELAY A*</text><text x="${relay2.x+10}" y="${relay2.y+17}" font-size="10" fill="#f7d18b">RELAY B*</text>`}
    <circle cx="${spot.x}" cy="${spot.y}" r="5" fill="${color}" stroke="#fff" stroke-width="1.4"/>
    <g fill="#f2f8fc" font-size="12" font-weight="800" text-anchor="middle" letter-spacing="2"><text x="${S.x}" y="${S.y+S.r+24}">SUN</text><text x="${E.x}" y="${E.y+E.r+23}">EARTH</text><text x="${M.x}" y="${M.y+M.r+22}">MOON</text></g>
    <rect x="18" y="83" width="332" height="62" rx="12" fill="#091824e8" stroke="#46616d"/><text x="34" y="106" font-size="11" fill="#a4dbd2" font-weight="800" letter-spacing="1.2">${direct?'DIRECT EARTH CONNECTION':'DIRECT EARTH PATH BLOCKED'}</text><text x="34" y="126" font-size="12" fill="#f2f8fb">Earth elevation: ${fmt(elevation,1)}° · ${safe(now.toISOString().slice(0,16))} UTC</text>
    <text x="18" y="438" fill="#98b3c1" font-size="10">SAME NASA PLANETARY IMAGERY AS TRANSFER · GEOMETRY NOT TO SCALE · ${far?'FAR-SIDE TARGET HIDDEN FROM EARTH':'SITE FACING EARTH'} </text>
    ${direct?'':`<text x="905" y="437" text-anchor="end" fill="#f7cca0" font-size="10">* RELAYS PROPOSED · COVERAGE NOT VERIFIED</text>`}`;
    if($7('commSceneTime'))$7('commSceneTime').textContent=now.toISOString().slice(0,16).replace('T',' ')+' UTC';
  };
  function updateSiteSky(){
    if(!$7('siteSunElev'))return;
    const t=sceneTime(),sun=sunAltitude(state.lat,state.lon,t),earth=earthAltitude(state.lat,state.lon,t);
    const fmtE=v=>`${v>=0?'+':''}${v.toFixed(1)}°`;
    $7('siteSunElev').textContent=fmtE(sun);$7('siteEarthElev').textContent=fmtE(earth);
    $7('siteSunBadge').classList.toggle('below-horizon',sun<0);
    $7('siteEarthBadge').classList.toggle('below-horizon',earth<0);
  }
  const originalSciencePanel=updateSciencePanel;
  updateSciencePanel=function(...args){const v=originalSciencePanel(...args);updateSiteSky();return v};
  function initNASA3D(){
    const btn=$7('nasaModelToggle'),shell=$7('nasaModelShell'),mv=$7('nasaMoonModel'),source=$7('moonSourceBadge');if(!btn||!shell||!mv)return;
    let ready=false,pending=false;const dir='moon_lro_3d.glb';
    async function startLoad(){
      if(pending||ready)return;
      pending=true;source.textContent='LOADING NASA LRO 3D…';
      const src=await fetch(dir,{method:'HEAD'}).then(r=>r.ok?dir:LRO_GLB).catch(()=>LRO_GLB);
      mv.setAttribute('src',src);
    }
    mv.addEventListener('load',()=>{ready=true;pending=false;source.textContent='NASA LRO 3D · LOADED';shell.classList.add('loaded')});
    mv.addEventListener('error',()=>{pending=false;ready=false;source.textContent='3D MODEL UNAVAILABLE · USE MAP';setModelMode(false)});
    mv.addEventListener('progress',ev=>{if(!ready&&pending&&ev.detail?.totalProgress!=null)source.textContent=`NASA MODEL · ${Math.round(ev.detail.totalProgress*100)}%`});
    function setModelMode(val){mode3d=val;shell.classList.toggle('active',val);shell.setAttribute('aria-hidden',String(!val));btn.setAttribute('aria-pressed',String(val));btn.textContent=val?'⌖ SELECT COORDINATES':'◈ NASA 3D MODEL';$7('moonCanvas').classList.toggle('model-covered',val);$7('moonOverlay').classList.toggle('model-covered',val);const controls=document.querySelector('.globe-controls');if(controls)controls.style.visibility=val?'hidden':'';}
    btn.addEventListener('click',()=>{if(!mode3d&&!customElements.get('model-viewer')){source.textContent='ONLINE 3D RENDERER REQUIRED';setTimeout(()=>{if(!mode3d)source.textContent='SITE MAP · COORDINATES ACTIVE'},4500);return;}setModelMode(!mode3d);if(mode3d)startLoad();});
    // Keep 2D coordinate selection available until a real NASA model has actually loaded.
    setModelMode(false);updateSiteSky();
    window.__lunarNASAmodel={src:LRO_GLB,smallSrc:LRO_LIGHT};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initNASA3D);else initNASA3D();
})();
