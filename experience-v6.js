/* LUNAR/NAV v6 visualization layer. NASA photographic image URLs are used when the browser can load them.
 * The positions/paths are explanatory schematics, not propagated spacecraft trajectories.
 */
'use strict';
(() => {
  const esc=s=>safeHTML(String(s));
  const planetImg=(which,lat,lon)=>texturedGlobe(which,lat,lon)||(which==='earth'?NASA_EARTH_PHOTO:NASA_MOON_PHOTO);
  const nasaSun='https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg';
  const stars=(w,h,n=115)=>Array.from({length:n},(_,i)=>{const x=(i*193.329+43)%w,y=((i*312.114+i*i*.43)+39)%h;return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(.35+(i%5)*.19).toFixed(1)}" fill="#d9e7ff" opacity="${(.12+(i%7)*.07).toFixed(2)}"/>`}).join('');
  const solarPhoto=(x,y,r,clip='sv6Sun')=>`<defs><clipPath id="${clip}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><radialGradient id="${clip}Glow"><stop stop-color="#ffd4a1" stop-opacity=".48"/><stop offset=".55" stop-color="#ff9840" stop-opacity=".16"/><stop offset="1" stop-color="#eb7730" stop-opacity="0"/></radialGradient></defs><circle cx="${x}" cy="${y}" r="${r*2.45}" fill="url(#${clip}Glow)" class="solar-limb"/><circle cx="${x}" cy="${y}" r="${r}" fill="#ffb85b"/><image href="${nasaSun}" x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/><circle cx="${x}" cy="${y}" r="${r}" stroke="#e9ac62" stroke-opacity=".66" fill="none"/>`;
  function renderPlanet(which,x,y,r,camLat,camLon,clip){
    const photo=planetImg(which,camLat,camLon),backup=which==='earth'?'earth_texture.jpg':'moon_texture.jpg';
    return `<defs><clipPath id="${clip}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><radialGradient id="${clip}Shadow" fx=".34" fy=".24"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".57" stop-color="#000" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".68"/></radialGradient></defs><image href="${backup}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" clip-path="url(#${clip})"/><image href="${photo}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${clip}Shadow)"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${which==='earth'?'#91c7ec':'#bcc7d2'}" stroke-opacity=".54" stroke-width="1.2"/>`;
  }
  function curve(p0,p1,p2,t){return{x:(1-t)**2*p0.x+2*(1-t)*t*p1.x+t*t*p2.x,y:(1-t)**2*p0.y+2*(1-t)*t*p1.y+t*t*p2.y}}
  drawTransfer=function(){
    const svg=document.getElementById('orbitSvg');if(!svg)return;
    const now=window.__missionNow?window.__missionNow():dateAdd(timeStamp(state.launchDate,state.launchMinute),state.flight*transferDays);
    const p=clamp(state.flight,0,1),ln=launchSites[state.launchSite],earth={x:176,y:317,r:91};
    const camLat=clamp(ln.lat-4,-54,54),camLon=ln.lon-20;
    const point=projectPoint(ln.lat,ln.lon,camLat,camLon);
    const departure={x:earth.x+earth.r*point.x,y:earth.y-earth.r*point.y};
    const lunarAng=lunarOrbitAngle(now),moon={x:675+45*Math.cos(lunarAng),y:320+52*Math.sin(lunarAng),r:74};
    const future=dateAdd(now,(1-p)*transferDays),futureAngle=lunarOrbitAngle(future),arrival={x:675+45*Math.cos(futureAngle),y:320+52*Math.sin(futureAngle)};
    const camMoonLat=clamp(state.lat*.40,-60,60),camMoonLon=Math.abs(state.lon)>110?state.lon:0;
    const lp=projectPoint(state.lat,state.lon,camMoonLat,camMoonLon);
    const landing={x:moon.x+lp.x*moon.r,y:moon.y-lp.y*moon.r},target={x:arrival.x+lp.x*moon.r,y:arrival.y-lp.y*moon.r};
    const control={x:410+23*Math.cos(lunarAng*.8),y:159-25*Math.sin(lunarAng)},dot=curve(departure,control,target,p);
    const phase=getMoonPhase(now)*Math.PI*2,sun={x:684+44*Math.sin(phase),y:96+17*Math.cos(phase),r:45};
    const gold=state.optimizedMinute!==null&&state.launchMinute===state.optimizedMinute;
    const accent=gold?'#f8ce80':'#88ddea',arrow=gold?'#ecd099':'#b9faff';
    const path=`M ${departure.x.toFixed(2)} ${departure.y.toFixed(2)} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${target.x.toFixed(2)} ${target.y.toFixed(2)}`;
    svg.setAttribute('viewBox','0 0 900 520');
    svg.innerHTML=`<defs><radialGradient id="stVignette"><stop stop-color="#1b2942"/><stop offset=".8" stop-color="#07101b"/><stop offset="1" stop-color="#030609"/></radialGradient><linearGradient id="sunRay" x1=".0" y1=".0" x2="1" y2="1"><stop stop-color="#e2b17d" stop-opacity=".45"/><stop offset="1" stop-color="#e2b17d" stop-opacity="0"/></linearGradient><filter id="stGlow"><feGaussianBlur stdDeviation="5"/></filter></defs>
      <rect width="900" height="520" fill="url(#stVignette)"/>${stars(900,520,145)}
      <g stroke="#51627a" stroke-opacity=".18" fill="none"><path d="M 43 417 Q 400 135 852 405" stroke-dasharray="4 10"/><path d="M 27 460 Q 401 108 887 448" stroke-dasharray="3 13"/><path d="M 128 441 Q 406 209 790 436" stroke-dasharray="3 12"/></g>
      <g>${solarPhoto(sun.x,sun.y,sun.r,'transferSun')}</g>
      <g stroke="#f7d0a1" stroke-opacity=".15" stroke-width="1.2"><path d="M ${sun.x-18} ${sun.y+42} L 263 207"/><path d="M ${sun.x-8} ${sun.y+48} L 617 238"/><path d="M ${sun.x+2} ${sun.y+44} L 729 219"/></g>
      <circle cx="${earth.x}" cy="${earth.y}" r="${earth.r+9}" fill="none" stroke="#87b8d8" stroke-opacity=".12" stroke-width="11"/>
      ${renderPlanet('earth',earth.x,earth.y,earth.r,camLat,camLon,'traEarth')}
      <circle cx="${moon.x}" cy="${moon.y}" r="${moon.r+5}" fill="none" stroke="#cad8e5" stroke-opacity=".17" stroke-width="8"/>
      ${renderPlanet('moon',moon.x,moon.y,moon.r,camMoonLat,camMoonLon,'traMoon')}
      <path d="${path}" fill="none" stroke="${accent}" stroke-opacity=".14" stroke-width="10" filter="url(#stGlow)"/>
      <path d="${path}" fill="none" stroke="${accent}" stroke-width="2.9" stroke-dasharray="3 11" stroke-linecap="round"/>
      <circle cx="${departure.x}" cy="${departure.y}" r="5.5" fill="#0b1e29" stroke="#b5f2ff" stroke-width="2"/>
      <circle cx="${departure.x}" cy="${departure.y}" r="14" fill="none" stroke="#b5f2ff" stroke-opacity=".42"/>
      ${lp.z>0?`<circle cx="${landing.x}" cy="${landing.y}" r="6" fill="none" stroke="#80eecb" stroke-width="2"/><circle cx="${landing.x}" cy="${landing.y}" r="2" fill="#c5fff4"/>`:''}
      <circle class="flight-tracker" cx="${dot.x}" cy="${dot.y}" r="12" fill="${accent}" fill-opacity=".13" stroke="${accent}" stroke-opacity=".35"/>
      <circle class="flight-tracker" cx="${dot.x}" cy="${dot.y}" r="4.8" fill="white" stroke="${arrow}" stroke-width="2"/>
      <g fill="#d5e4e5" font-family="Arial,sans-serif"><text x="${sun.x}" y="${sun.y+71}" text-anchor="middle" font-size="12" font-weight="700" letter-spacing="2">SUN</text><text x="${earth.x}" y="${earth.y+116}" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="2">EARTH</text><text x="${moon.x}" y="${moon.y+104}" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="2">MOON</text></g>
      <path d="M ${departure.x} ${departure.y} L 140 126" stroke="#b4e9f5" stroke-opacity=".55" stroke-width="1"/>
      <rect x="20" y="72" width="243" height="64" rx="10" fill="#06131edb" stroke="#44616c"/>
      <text x="35" y="94" font-size="10" fill="#a7dbd9" letter-spacing="1.5" font-weight="700">LAUNCH POINT · ${esc(ln.name.toUpperCase())}</text><text x="35" y="115" font-size="12" fill="white">${esc(coordinateLabel(ln.lat,ln.lon))}</text>
      <rect x="575" y="400" width="300" height="75" rx="10" fill="#06131edb" stroke="#47616c"/>
      <text x="591" y="423" font-size="10" fill="#9ebec7" font-weight="700" letter-spacing="1.1">LUNAR DESTINATION · SELECTED SITE</text><text x="591" y="447" font-size="14" fill="white">${esc(coordinateLabel(state.lat,state.lon))}</text><text x="591" y="462" font-size="10" fill="#a1c2c7">${esc(now.toISOString().slice(0,16).replace('T',' '))} UTC</text>
      <rect x="305" y="35" width="208" height="43" rx="10" fill="#081622dc" stroke="#354c59"/>
      <text x="322" y="53" font-size="10" fill="#b4d1d8" font-weight="700" letter-spacing="1.1">MISSION ELAPSED</text><text x="322" y="69" font-size="11" fill="#e4eff3">${fmt(p*transferDays,2)} days · ${esc(phaseName(p))}</text>
      <text x="22" y="504" fill="#9babb9" font-size="10">NASA imagery when available · three-body orientation schematic · not to distance scale</text>
      <text x="878" y="504" fill="${accent}" text-anchor="end" font-size="10">${gold?'✦ BEST ALIGNMENT PROXY':'SIMULATED TRANSFER'}</text>`;
    document.getElementById('trajectoryAssetStatus').textContent=transferTextures.earth&&transferTextures.moon?'NASA SURFACE MOSAICS · LIVE VIEW':'NASA IMAGERY ONLINE · FALLBACK OFFLINE';
    document.getElementById('trajectoryTargetStatus').textContent=`Moon and Sun reflect ${now.toISOString().slice(0,16).replace('T',' ')} UTC · the illustrated transfer is not a numerically propagated flight`;
  };
  // Better visual communication geometry, using the identical globe rendering source as Page 2.
  commSvgGraphic=function(elevation,direct){
    const svg=document.getElementById('commSvg');if(!svg)return;
    const now=window.__missionNow?window.__missionNow():timeStamp(state.commDate,state.commMinute);
    const earth={x:172,y:240,r:89},moon={x:630,y:238,r:95},clat=clamp(state.lat*.40,-60,60),clon=Math.abs(state.lon)>105?state.lon:0;
    const site=projectPoint(state.lat,state.lon,clat,clon);
    const spot={x:moon.x+site.x*moon.r,y:moon.y-site.y*moon.r};
    const sun={x:690+30*Math.sin(getMoonPhase(now)*Math.PI*2),y:64,r:39};
    svg.innerHTML=`<defs><radialGradient id="commBg"><stop stop-color="#152435"/><stop offset="1" stop-color="#040911"/></radialGradient><filter id="commGlow"><feGaussianBlur stdDeviation="6"/></filter></defs><rect width="820" height="430" fill="url(#commBg)"/>${stars(820,430,120)}
      ${solarPhoto(sun.x,sun.y,sun.r,'commsSun')}
      <path d="M ${sun.x-32} ${sun.y+28} L 562 177" stroke="#f5ca91" stroke-opacity=".24"/><path d="M ${sun.x-22} ${sun.y+40} L 236 177" stroke="#f5ca91" stroke-opacity=".16"/>
      ${renderPlanet('earth',earth.x,earth.y,earth.r,0,-20,'commEarth')}
      ${renderPlanet('moon',moon.x,moon.y,moon.r,clat,clon,'commMoon')}
      <path d="M ${earth.x+earth.r} ${earth.y} L ${spot.x} ${spot.y}" stroke="${direct?'#7adfc9':'#ed8a86'}" stroke-opacity=".12" stroke-width="10" filter="url(#commGlow)"/>
      <path class="signal-dash" d="M ${earth.x+earth.r} ${earth.y} L ${spot.x} ${spot.y}" fill="none" stroke="${direct?'#81e6d3':'#e8978e'}" stroke-width="2.6" stroke-dasharray="6 11"/>
      ${direct?`<circle class="signal-pulse" cx="${(earth.x+earth.r+spot.x)/2}" cy="${(earth.y+spot.y)/2}" r="5" fill="#bdfbee"/>`:`<g><path d="M ${spot.x} ${spot.y} Q 639 80 565 70 L ${earth.x+earth.r} ${earth.y}" fill="none" stroke="#edbf80" stroke-dasharray="5 8" stroke-width="2.2" stroke-opacity=".84"/><path d="M ${spot.x} ${spot.y} Q 735 108 742 135 L ${earth.x+earth.r} ${earth.y}" fill="none" stroke="#edbf80" stroke-dasharray="4 10" stroke-width="1.5" stroke-opacity=".55"/><circle cx="565" cy="70" r="7" fill="#f8d190"/><circle cx="742" cy="135" r="6" fill="#f8d190"/></g>`}
      <circle cx="${spot.x}" cy="${spot.y}" r="7" fill="${direct?'#66e8b8':'#ffb38c'}" stroke="white" stroke-width="2"/>
      <circle cx="${spot.x}" cy="${spot.y}" r="15" fill="none" stroke="${direct?'#68e1c4':'#f9aa90'}" stroke-opacity=".6"/>
      <g font-family="Arial,sans-serif" fill="#e6f0f4"><text x="172" y="354" text-anchor="middle" font-size="14" letter-spacing="2" font-weight="700">EARTH</text><text x="630" y="361" text-anchor="middle" font-size="14" letter-spacing="2" font-weight="700">MOON</text></g>
      <rect x="270" y="57" width="258" height="58" rx="10" fill="#071725ee" stroke="#365969"/>
      <text x="290" y="79" fill="${direct?'#a8ecda':'#f0b8ae'}" font-size="12" font-weight="750">${direct?'DIRECT EARTH LINE OF SIGHT':'DIRECT EARTH PATH BLOCKED'}</text>
      <text x="290" y="100" fill="#a8c6d2" font-size="11">Elevation ${fmt(elevation,1)}° · ${esc(now.toISOString().slice(0,10))} UTC</text>
      <text x="24" y="411" fill="#91afba" font-size="11">NASA Earth/Moon mosaics when available · schematic spacing</text>
      <text x="798" y="411" text-anchor="end" fill="#91afba" font-size="10">${direct?'DIRECT PATH GEOMETRY':'TWO PROPOSED RELAYS · COVERAGE NOT VERIFIED'}</text>`;
  };
  // Energy chart: eclipse bands, luminous lines, live time cursor, hover inspection.
  energyChart=function(rows){const svg=document.getElementById('energyChart');if(!svg)return;
    const x0=56,y0=41,w=740,h=261,m=rows.length-1,maxKW=Math.max(1.4,...rows.map(r=>Math.max(r.kw,r.generated)))*1.13;
    const x=i=>x0+w*i/m,yp=v=>y0+h-clamp(v/maxKW,0,1)*h,yb=v=>y0+h-clamp(v/100,0,1)*h;
    const path=(f,yf)=>rows.map((r,i)=>`${i?'L':'M'} ${x(i).toFixed(2)} ${yf(f(r)).toFixed(2)}`).join(' ');
    const gen=path(r=>r.generated,yp),used=path(r=>r.kw,yp),battery=path(r=>r.percent,yb);
    let eclipse='',start=-1;
    for(let i=0;i<=m+1;i++){let shadow=i<=m&&rows[i].shadow;if(shadow&&start<0)start=i;if(!shadow&&start>=0){let xx=x(start),ww=x(Math.min(i,m))-xx;eclipse+=`<rect x="${xx}" y="${y0}" width="${ww}" height="${h}" fill="#e6b27d" opacity=".08"/><line x1="${xx}" x2="${xx}" y1="${y0}" y2="${y0+h}" stroke="#d9a979" opacity=".45" stroke-dasharray="3 5"/>`;if(ww>45)eclipse+=`<text x="${xx+ww/2}" y="${y0+18}" fill="#deb789" text-anchor="middle" font-size="10" font-weight="800" letter-spacing="1.5">SHADOW</text>`;start=-1}}
    const cursorIdx=Math.round(state.energyFlight*m),v=rows[cursorIdx],cx=x(cursorIdx),marker=(val,color,yy)=>`<circle cx="${cx}" cy="${yy}" r="6" fill="#071321" stroke="${color}" stroke-width="2.5"/><circle cx="${cx}" cy="${yy}" r="2.5" fill="${color}"/>`;
    svg.innerHTML=`<defs><linearGradient id="egreen" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#76f1c9" stop-opacity=".22"/><stop offset="1" stop-color="#76f1c9" stop-opacity="0"/></linearGradient><linearGradient id="eblue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8fd9ff" stop-opacity=".17"/><stop offset="1" stop-color="#8fd9ff" stop-opacity="0"/></linearGradient></defs>
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="10" fill="#0a1827"/>
      ${[0,.25,.5,.75,1].map(p=>`<line x1="${x0}" y1="${y0+p*h}" x2="${x0+w}" y2="${y0+p*h}" stroke="#446075" stroke-opacity=".38" stroke-dasharray="2 7"/><text x="${x0-10}" y="${y0+p*h+4}" fill="#a9becb" text-anchor="end" font-size="11">${fmt((1-p)*maxKW,1)}</text>`).join('')}
      ${Array.from({length:7},(_,i)=>`<line x1="${x0+i*w/6}" y1="${y0}" x2="${x0+i*w/6}" y2="${y0+h}" stroke="#456274" stroke-opacity=".16"/><text x="${x0+i*w/6}" y="${y0+h+27}" text-anchor="middle" fill="#9eb2c2" font-size="11">D${i}</text>`).join('')}
      ${eclipse}
      <path d="${battery} L ${x0+w} ${y0+h} L ${x0} ${y0+h} Z" fill="url(#eblue)"/>
      <path d="${gen} L ${x0+w} ${y0+h} L ${x0} ${y0+h} Z" fill="url(#egreen)"/>
      <path d="${gen}" class="main-energy-line" stroke="#8cefc8" stroke-width="2.9" fill="none" stroke-linejoin="round"/>
      <path d="${used}" class="main-energy-line" stroke="#f2a28d" stroke-width="2.9" fill="none" stroke-linejoin="round"/>
      <path d="${battery}" class="main-energy-line" stroke="#8bccff" stroke-width="3.1" fill="none" stroke-linejoin="round"/>
      <line class="chart-cursor" x1="${cx}" y1="${y0}" x2="${cx}" y2="${y0+h}" stroke="#dcebf3" stroke-opacity=".75" stroke-width="1.3" stroke-dasharray="4 5"/>
      ${marker(v.generated,'#8cefc8',yp(v.generated))}${marker(v.kw,'#f2a28d',yp(v.kw))}${marker(v.percent,'#8bccff',yb(v.percent))}
      <text x="12" y="19" fill="#b4cad5" font-size="10">POWER (kW)</text><text x="${x0+w+9}" y="${y0+7}" fill="#a0bfce" font-size="10">100% BATTERY</text><text x="${x0+w+9}" y="${y0+h}" fill="#a0bfce" font-size="10">0%</text>
      <g class="energy-tooltip" id="energyTooltip" visibility="hidden"><rect width="204" height="78" rx="9" fill="#102536" stroke="#527489"/><text x="10" y="17" fill="#f3f8fa" font-size="11" font-weight="700" id="energyHoverTime">—</text><text x="10" y="37" fill="#8cefc8" font-size="11" id="energyHoverGen">—</text><text x="10" y="53" fill="#f2a28d" font-size="11" id="energyHoverUsed">—</text><text x="10" y="69" fill="#8bccff" font-size="11" id="energyHoverBattery">—</text></g>
      <rect id="energyHit" x="${x0}" y="${y0}" width="${w}" height="${h}" fill="transparent" style="cursor:crosshair"/>`;
    const hit=svg.querySelector('#energyHit'),tip=svg.querySelector('#energyTooltip');
    hit.addEventListener('pointermove',ev=>{const pos=svg.createSVGPoint();pos.x=ev.clientX;pos.y=ev.clientY;const ctm=svg.getScreenCTM();if(!ctm)return;const v=pos.matrixTransform(ctm.inverse()),idx=clamp(Math.round((v.x-x0)/w*m),0,m),r=rows[idx];tip.setAttribute('visibility','visible');tip.setAttribute('transform',`translate(${clamp(x(idx)-107,0,640)} ${y0+12})`);svg.querySelector('#energyHoverTime').textContent=r.time.toISOString().slice(0,16).replace('T',' ')+' UTC';svg.querySelector('#energyHoverGen').textContent=`Generated  ${fmt(r.generated,2)} kW`;svg.querySelector('#energyHoverUsed').textContent=`Used         ${fmt(r.kw,2)} kW`;svg.querySelector('#energyHoverBattery').textContent=`Battery      ${fmt(r.percent,1)}%`});
    hit.addEventListener('pointerleave',()=>tip.setAttribute('visibility','hidden'));
    hit.addEventListener('click',ev=>{const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const ctm=svg.getScreenCTM();if(!ctm)return;const v=pt.matrixTransform(ctm.inverse());const idx=clamp(Math.round((v.x-x0)/w*m),0,m);window.__setMissionNow?.(rows[idx].time.getTime())});
  };
  const oldEnergy=updateEnergy;
  function outsidePowerWindow(){
    const current=window.__missionNow?.().getTime()??Date.now(),start=timeStamp(state.launchDate,state.launchMinute).getTime();
    return current<start||current>start+(transferDays+2)*86400000;
  }
  updateEnergy=function(...a){let result=oldEnergy(...a);
    if(outsidePowerWindow()){
      const ship=selectedShip(),current=window.__missionNow?.()??new Date(),sunElev=sunAltitude(state.lat,state.lon,current),cosine=Math.max(0,Math.sin(sunElev*RAD));
      const gen=ship.power==='solar'?ship.solarKW*cosine:ship.power==='battery'?0:ship.solarKW;
      document.getElementById('energyGenerated').textContent=fmt(gen,2)+' kW (instantaneous)';
      document.getElementById('energyConsumed').textContent=fmt(ship.loadKW*1.12,2)+' kW (modeled)';
      document.getElementById('batteryLevel').textContent='Not modeled';
      document.getElementById('energyPhase').textContent='Date is beyond the power budget window';
      document.getElementById('sunStatus').textContent=sunElev<=0?'SUN BELOW HORIZON':'IN SUNLIGHT';
    }
    drawSunScene();return result;
  };
  function drawSunScene(){const svg=document.getElementById('solarScene');if(!svg)return;
    const series=energySeries(),r={...series[Math.round(state.energyFlight*(series.length-1))]};
    const current=window.__missionNow?.();
    if(current){r.time=current;
      if(outsidePowerWindow()){const solarElevation=sunAltitude(state.lat,state.lon,current);r.sunAngle=clamp(90-solarElevation,0,180);r.shadow=solarElevation<=0;}
    }
    const shadow=r.shadow,ang=r.sunAngle;
    const sceneMoon={x:235,y:shadow?95:191,r:shadow?51:37},ship={x:500,y:133};
    const moonImg=planetImg('moon',clamp(state.lat*.3,-55,55),0);
    svg.innerHTML=`<defs><radialGradient id="solBg"><stop stop-color="#24212c"/><stop offset="1" stop-color="#06101b"/></radialGradient><linearGradient id="beamGrad"><stop stop-color="#ffd99b" stop-opacity=".52"/><stop offset="1" stop-color="#f6e8ca" stop-opacity=".04"/></linearGradient><clipPath id="solarMoonClip"><circle cx="${sceneMoon.x}" cy="${sceneMoon.y}" r="${sceneMoon.r}"/></clipPath></defs>
     <rect width="660" height="270" fill="url(#solBg)"/>${stars(660,270,70)}
     <g>${solarPhoto(98,106,51,'energySun')}</g>
     ${Array.from({length:7},(_,i)=>{const y=70+i*12;return `<path class="solar-ray" d="M 143 ${y} L ${ship.x-43} ${ship.y-42+i*15}" stroke="#f8d59e" stroke-opacity="${shadow?.09:.40}" stroke-width="${(i===3?2:1)}" stroke-dasharray="5 8"/>`}).join('')}
     <image href="moon_texture.jpg" x="${sceneMoon.x-sceneMoon.r}" y="${sceneMoon.y-sceneMoon.r}" width="${sceneMoon.r*2}" height="${sceneMoon.r*2}" clip-path="url(#solarMoonClip)"/>
     <image href="${moonImg}" x="${sceneMoon.x-sceneMoon.r}" y="${sceneMoon.y-sceneMoon.r}" width="${sceneMoon.r*2}" height="${sceneMoon.r*2}" clip-path="url(#solarMoonClip)"/>
     <circle cx="${sceneMoon.x}" cy="${sceneMoon.y}" r="${sceneMoon.r}" fill="none" stroke="#95b2c5" stroke-opacity=".55"/>
     <path d="M ${ship.x-8} ${ship.y-24} L ${ship.x-8} ${ship.y+27} M ${ship.x-30} ${ship.y} L ${ship.x+32} ${ship.y}" stroke="#dae7f3" stroke-width="3"/>
     <g transform="rotate(${Math.min(80,Math.max(-80,ang-45))} ${ship.x} ${ship.y})"><rect x="${ship.x-89}" y="${ship.y-18}" width="70" height="36" rx="3" fill="#143951" stroke="#7bc3e4" stroke-width="2"/><rect x="${ship.x+20}" y="${ship.y-18}" width="70" height="36" rx="3" fill="#143951" stroke="#7bc3e4" stroke-width="2"/>${[-69,-53,-37,35,51,67].map(xx=>`<line x1="${ship.x+xx}" x2="${ship.x+xx}" y1="${ship.y-17}" y2="${ship.y+17}" stroke="#579dbd" stroke-opacity=".7"/>`).join('')}</g>
     <rect x="${ship.x-16}" y="${ship.y-19}" width="32" height="38" rx="5" fill="#c8d6db" stroke="#fff" stroke-width="1.5"/>
     ${shadow?`<rect x="310" y="25" width="207" height="45" rx="10" fill="#3d2c29e0" stroke="#c57f61"/><text x="325" y="44" fill="#ffd2ad" font-size="12" font-weight="800">ECLIPSE / SHADOW</text><text x="325" y="59" fill="#edd5c7" font-size="10">Direct solar generation unavailable</text>`:`<rect x="312" y="25" width="203" height="45" rx="10" fill="#19372edd" stroke="#7bcbb7"/><text x="327" y="44" fill="#c5ffeb" font-size="12" font-weight="800">DIRECT SUNLIGHT</text><text x="327" y="59" fill="#b7e8d9" font-size="10">Incidence ${fmt(ang,1)}° · geometric model</text>`}
     <text x="104" y="205" text-anchor="middle" fill="#ffdfa9" font-size="12" font-weight="800" letter-spacing="1.6">SUN</text><text x="${sceneMoon.x}" y="${sceneMoon.y+sceneMoon.r+21}" text-anchor="middle" fill="#b9c9d5" font-size="11">MOON</text><text x="${ship.x}" y="203" text-anchor="middle" fill="#c9dfe9" font-size="11">SPACECRAFT SOLAR ARRAY</text>
     <text x="18" y="251" fill="#93a6b8" font-size="10">Illustrative attitude / eclipse until spacecraft ephemerides are imported</text>`;
    const m=document.getElementById('solarSceneMode'),t=document.getElementById('solarSceneClock');
    if(m)m.textContent=shadow?'SHADOW OCCULTATION · MODEL':'SOLAR FLUX · MODEL';if(t)t.textContent=r.time.toISOString().slice(0,16).replace('T',' ')+' UTC';
  }
})();
