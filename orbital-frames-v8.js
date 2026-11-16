/* LUNAR/NAV v8 — alternate orbital reference frames.
 * Heliocentric Earth/Moon barycentre coordinates use JPL SSD approximate elements
 * (1800–2050). Moon position uses the existing bundled lunar-phase ephemeris
 * to establish its direction relative to the Sun. The lunar separation and all
 * body radii are enlarged on screen; spacecraft transfer is illustrative.
 * References: https://ssd.jpl.nasa.gov/planets/approx_pos.html
 * NASA LROC composite: https://svs.gsfc.nasa.gov/4720/
 * NASA LRO NAC Moon mosaic: https://svs.gsfc.nasa.gov/5001/
 */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const PI=Math.PI, AU=149597870.7;
  let active='helio';
  const imgMoon='https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005001/moon_mosaic_print.jpg';
  const imgSun='https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg';
  const imgEarth='https://assets.science.nasa.gov/dynamicimage/assets/science/esd/climate/2023/12/ImageWall5_1920x1200-80.jpg?fit=contain&w=1400';
  const stars=(w,h,n)=>Array.from({length:n},(_,i)=>{const x=(i*149.227+i*i*.19+61)%w,y=(i*57.17+i*i*.4+89)%h;return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(.35+(i%4)*.22).toFixed(1)}" fill="#d9e8f1" opacity="${(.13+(i%8)*.07).toFixed(2)}"/>`}).join('');
  function svgPlanet(which,x,y,r,lat,lon,id){
    let bitmap=null;
    try{bitmap=texturedGlobe(which,lat,lon)}catch(err){/* Fallback below */}
    const local=which==='earth'?'earth_texture.jpg':'moon_texture.jpg';
    const actual=which==='earth'?imgEarth:imgMoon;
    const src=bitmap||actual;
    return `<defs><clipPath id="${id}-clip"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>
      <radialGradient id="${id}-shade" cx=".32" cy=".23" r=".92"><stop stop-color="#ffffff" stop-opacity=".08"/><stop offset=".60" stop-color="#0b1824" stop-opacity=".12"/><stop offset="1" stop-color="#02050a" stop-opacity=".72"/></radialGradient>
      <radialGradient id="${id}-glow"><stop stop-color="${which==='earth'?'#70a5d5':'#c2c8c9'}" stop-opacity=".36"/><stop offset="1" stop-color="#213045" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-body" cx=".40" cy=".30"><stop stop-color="${which==='earth'?'#90cbec':'#d7d7d3'}"/><stop offset=".6" stop-color="${which==='earth'?'#286795':'#8d949b'}"/><stop offset="1" stop-color="${which==='earth'?'#0a2747':'#424a53'}"/></radialGradient></defs>
      <circle cx="${x}" cy="${y}" r="${r+9}" fill="url(#${id}-glow)"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id}-body)"/>
      <image href="${local}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" clip-path="url(#${id}-clip)" preserveAspectRatio="xMidYMid slice"/>
      <image href="${src}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" clip-path="url(#${id}-clip)" preserveAspectRatio="xMidYMid slice"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id}-shade)"/><circle cx="${x}" cy="${y}" r="${r}" stroke="${which==='earth'?'#72b8e5':'#c5c8d2'}" stroke-opacity=".42" fill="none"/>`;
  }
  function sunDisk(x,y,r,id){return `<defs><clipPath id="${id}-clip"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>
    <radialGradient id="${id}-aura"><stop stop-color="#ffdb91" stop-opacity=".34"/><stop offset=".35" stop-color="#ff9c3f" stop-opacity=".12"/><stop offset="1" stop-color="#d4802a" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}-base"><stop stop-color="#ffe2a4"/><stop offset=".75" stop-color="#ffb957"/><stop offset="1" stop-color="#d47931"/></radialGradient></defs>
    <circle cx="${x}" cy="${y}" r="${r*2.15}" fill="url(#${id}-aura)" class="v8-sun-pulse"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id}-base)"/>
    <image href="solar_fallback.png" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" clip-path="url(#${id}-clip)"/>
    <image href="solar_nasa.jpg" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" clip-path="url(#${id}-clip)"/>
    <image href="${imgSun}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" clip-path="url(#${id}-clip)"/>
    <circle cx="${x}" cy="${y}" r="${r}" stroke="#f9c481" stroke-opacity=".54" fill="none"/>`}
  const RAD=PI/180;
  function earthHeliocentric(time){
    // JPL SSD EM Bary orbital elements for 1800-2050; T=Julian centuries since J2000.
    const jd=time.getTime()/86400000+2440587.5,T=(jd-2451545)/36525;
    const a=1.00000261+.00000562*T,e=.01671123-.00004392*T;
    const M=((100.46457166+35999.37244981*T)-(102.93768193+.32327364*T))*RAD;
    const omega=(102.93768193+.32327364*T)*RAD;
    let E=M;
    for(let k=0;k<10;k++){let f=E-e*Math.sin(E)-M;let f1=1-e*Math.cos(E);E-=f/f1;if(Math.abs(f)<1e-11)break;}
    let xp=a*(Math.cos(E)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(E);
    return {x:xp*Math.cos(omega)-yp*Math.sin(omega),y:xp*Math.sin(omega)+yp*Math.cos(omega),r:Math.hypot(xp,yp),angle:Math.atan2(yp,xp)+omega};
  }
  function moonRelative(time,earthPoint,px=53){
    const phase=getMoonPhase(time); // 0 at new Moon, 0.5 at full Moon.
    const sunBearing=Math.atan2(-earthPoint.y,-earthPoint.x);
    const moonBearing=sunBearing+2*PI*phase;
    return {x:px*Math.cos(moonBearing),y:px*Math.sin(moonBearing),phase};
  }
  const pointAt=(center,earth,scale)=>({x:center.x+earth.x*scale,y:center.y-earth.y*scale});
  const curve=(from,to,flip=1)=>{
    const dx=to.x-from.x,dy=to.y-from.y,L=Math.hypot(dx,dy)||1,
      cx=(from.x+to.x)*.5-dy/L*Math.min(35,L*.18)*flip,
      cy=(from.y+to.y)*.5+dx/L*Math.min(35,L*.18)*flip;
    return {cx,cy,d:`M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`};
  };
  const interpolate=(a,b,c,t)=>({x:(1-t)*(1-t)*a.x+2*(1-t)*t*b.x+t*t*c.x,y:(1-t)*(1-t)*a.y+2*(1-t)*t*b.y+t*t*c.y});
  function background(){return `<defs><radialGradient id="v8back"><stop stop-color="#12263b"/><stop offset=".62" stop-color="#07111e"/><stop offset="1" stop-color="#03070f"/></radialGradient><filter id="v8glow"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="940" height="540" fill="url(#v8back)"/>${stars(940,540,180)}`;}
  const caption=(x,y,label,sub)=>`<text x="${x}" y="${y}" fill="#ecf5f7" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="12" font-weight="780" letter-spacing="1.5">${label}</text>${sub?`<text x="${x}" y="${y+16}" text-anchor="middle" fill="#a9c5d0" font-size="10">${sub}</text>`:''}`;
  const tracker=(point,color)=>`<circle class="v8-track-halo" cx="${point.x}" cy="${point.y}" r="14" fill="${color}" opacity=".20"/><circle cx="${point.x}" cy="${point.y}" r="5" fill="#fff" stroke="${color}" stroke-width="2.3"/>`;
  function helioSVG(now,p){
    const sun={x:470,y:276,r:66},orbitScale=142;
    const dep=timeStamp(state.launchDate,state.launchMinute),arr=dateAdd(dep,transferDays);
    const ea=earthHeliocentric(now),earth=pointAt(sun,ea,orbitScale);
    const ear=earthHeliocentric(arr),arrivalEarth=pointAt(sun,ear,orbitScale);
    const moonVec=moonRelative(now,ea,77),arrVec=moonRelative(arr,ear,77);
    const M={x:earth.x+moonVec.x,y:earth.y-moonVec.y};
    const moonMagnitude=Math.hypot(moonVec.x,moonVec.y)||1;
    const moonLabel={x:M.x+moonVec.x/moonMagnitude*26,y:M.y-moonVec.y/moonMagnitude*26};
    const insetCenter={x:783,y:296};const insetVec=moonRelative(now,ea,49);
    const insetMoon={x:insetCenter.x+insetVec.x,y:insetCenter.y-insetVec.y};
    const arrivalMoon={x:arrivalEarth.x+arrVec.x,y:arrivalEarth.y-arrVec.y};
    const dE=earthHeliocentric(dep),dEP=pointAt(sun,dE,orbitScale);
    const launch=launchSites[state.launchSite];
    const stationAngle=((dep.getTime()/86400000)*360.985647 + launch.lon)*RAD;
    const stationDepth=Math.cos(launch.lat*RAD);
    const from={x:dEP.x+27*.83*stationDepth*Math.cos(stationAngle),y:dEP.y-27*.83*(Math.sin(launch.lat*RAD)*.45+stationDepth*.6*Math.sin(stationAngle))};
    const site=projectPoint(state.lat,state.lon,0,0);
    const targetSite={x:arrivalMoon.x+site.x*17,y:arrivalMoon.y-site.y*17};
    const hereSite={x:M.x+site.x*17,y:M.y-site.y*17};
    const flight=curve(from,targetSite,1),loc=interpolate(from,{x:flight.cx,y:flight.cy},targetSite,p),gold=state.optimizedMinute!=null&&state.optimizedMinute===state.launchMinute,accent=gold?'#f5d38d':'#7ad9cd';
    const sampleOrbit=[];
    const a=ea.r||1,e=.0167,w=(102.93768193+.32327364*((now.getTime()/86400000+2440587.5-2451545)/36525))*RAD;
    for(let k=0;k<=140;k++){let f=k/140*2*PI,r=a*(1-e*e)/(1+e*Math.cos(f)),x=sun.x+orbitScale*r*Math.cos(w+f),y=sun.y-orbitScale*r*Math.sin(w+f);sampleOrbit.push((k?'L':'M')+x.toFixed(2)+' '+y.toFixed(2));}
    const launchName=(launch.name||'Selected launch site').replace(/[&<>]/g,'');
    const goDay=now.toISOString().slice(0,16).replace('T',' ');
    return background()+`<path d="${sampleOrbit.join(' ')}" fill="none" stroke="#89bac9" stroke-opacity=".40" stroke-width="1.4" stroke-dasharray="5 8"/>
      <circle cx="${sun.x}" cy="${sun.y}" r="90" stroke="#f4ba64" stroke-opacity=".12" fill="none"/>
      ${sunDisk(sun.x,sun.y,sun.r,'v8HelioSun')}
      <path d="M ${earth.x} ${earth.y} L ${M.x} ${M.y}" stroke="#98b8c5" stroke-opacity=".57" stroke-width="1.4" stroke-dasharray="2 6"/>
      <circle cx="${earth.x}" cy="${earth.y}" r="44" stroke="#8dd9ea" stroke-dasharray="5 9" fill="none" stroke-opacity=".22"/>
      ${svgPlanet('earth',earth.x,earth.y,28,0,launch.lon,'v8HelioEarth')}
      ${svgPlanet('moon',M.x,M.y,19,0,0,'v8HelioMoon')}
      <circle cx="${arrivalMoon.x}" cy="${arrivalMoon.y}" r="23" stroke="${accent}" stroke-opacity=".60" stroke-dasharray="4 5" fill="none"/><circle cx="${hereSite.x}" cy="${hereSite.y}" r="3.1" fill="#b4ffcc"/><circle cx="${targetSite.x}" cy="${targetSite.y}" r="5.5" fill="none" stroke="#d7ffc8" stroke-width="2"/><text x="${targetSite.x+10}" y="${targetSite.y-12}" font-size="10" fill="#d7ffc8">TARGET AT ARRIVAL</text>
      <path d="${flight.d}" stroke="${accent}" stroke-width="11" opacity=".09" fill="none" filter="url(#v8glow)"/>
      <path d="${flight.d}" stroke="${accent}" stroke-width="2.3" stroke-dasharray="3 9" stroke-linecap="round" fill="none" class="v7-transfer-path"/>
      <circle cx="${from.x}" cy="${from.y}" r="4.7" fill="white" stroke="#75ead4" stroke-width="1.8"/>
      ${tracker(loc,accent)}
      ${caption(sun.x,sun.y+100,'SUN','1 AU orbital reference')}
      ${caption(earth.x,earth.y+47,'EARTH',`${ea.r.toFixed(3)} AU from Sun`)}
      ${caption(moonLabel.x,moonLabel.y,'MOON',null)}
      <rect x="687" y="91" width="231" height="74" rx="12" fill="#091922e8" stroke="#4c6572"/>
      <text x="703" y="115" fill="#a4e2d4" font-size="10" font-weight="800" letter-spacing="1">HELIOCENTRIC · JPL ELEMENTS</text>
      <text x="703" y="135" fill="#e4eff2" font-size="10">${goDay} UTC</text>
      <text x="703" y="151" fill="#a9c8d3" font-size="10">Earth–Sun distance ${ea.r.toFixed(3)} AU</text>
      <rect x="687" y="195" width="231" height="176" rx="12" fill="#081623e8" stroke="#506976" stroke-opacity=".76"/>
      <text x="704" y="217" fill="#a6ddd4" font-size="10" font-weight="800" letter-spacing="1">EARTH–MOON DETAIL / ZOOM</text>
      <circle cx="${insetCenter.x}" cy="${insetCenter.y}" r="49" fill="none" stroke="#91aebc" stroke-opacity=".36" stroke-dasharray="3 6"/>
      ${svgPlanet('earth',insetCenter.x,insetCenter.y,23,0,launch.lon,'v8InsetEarth')}
      ${svgPlanet('moon',insetMoon.x,insetMoon.y,13,0,0,'v8InsetMoon')}
      <path d="M ${insetCenter.x} ${insetCenter.y} L ${insetMoon.x} ${insetMoon.y}" stroke="#b5d4df" stroke-width="1" stroke-opacity=".5" stroke-dasharray="2 5"/>
      <text x="704" y="356" fill="#9fb8c5" font-size="10">Zoomed geometry; not to scale</text>
      <text x="20" y="520" fill="#a8bbc9" font-size="10">SUN-CENTERED · EARTH–MOON GAP AND PLANET SIZES ENLARGED · TRANSFER PATH SCHEMATIC</text>`;
  }
  function earthCenteredSVG(now,p){
    const ln=launchSites[state.launchSite],E={x:431,y:269,r:68},S={x:82,y:269,r:63};
    const angle=t=>PI+2*PI*getMoonPhase(t);
    const pos=t=>({x:E.x+204*Math.cos(angle(t)),y:E.y+124*Math.sin(angle(t))});
    const M=pos(now),dep=timeStamp(state.launchDate,state.launchMinute),arr=dateAdd(dep,transferDays),target=pos(arr);
    const globeCenterLat=Math.max(-50,Math.min(50,ln.lat)),globeCenterLon=ln.lon;
    const projected=projectPoint(ln.lat,ln.lon,globeCenterLat,globeCenterLon);
    const stationAngle=((dep.getTime()/86400000)*360.985647+ln.lon)*RAD;
    const cp=Math.cos(ln.lat*RAD),sp=Math.sin(ln.lat*RAD);
    const from={x:E.x+E.r*.83*cp*Math.cos(stationAngle),y:E.y-E.r*.83*(sp*.45+cp*.6*Math.sin(stationAngle))};
    const site=projectPoint(state.lat,state.lon,0,0);
    const landingTarget={x:target.x+site.x*41,y:target.y-site.y*41};
    const bez=curve(from,landingTarget,-1),move=interpolate(from,{x:bez.cx,y:bez.cy},landingTarget,p);
    const gold=state.optimizedMinute!=null&&state.launchMinute===state.optimizedMinute,accent=gold?'#f5d38d':'#7ad9cd';
    const point=projectPoint(state.lat,state.lon,0,0);
    const lon=ln.lon;
    return background()+`<ellipse cx="${E.x}" cy="${E.y}" rx="204" ry="124" stroke="#9aafc0" stroke-width="1.35" stroke-opacity=".4" stroke-dasharray="6 10" fill="none"/>
      <path d="M ${S.x+S.r} ${S.y} L ${E.x-E.r} ${E.y}" stroke="#f7b55d" opacity=".18" stroke-width="29"/>
      ${sunDisk(S.x,S.y,S.r,'v8GeoSun')}
      ${svgPlanet('earth',E.x,E.y,E.r,globeCenterLat,globeCenterLon,'v8GeoEarth')}
      ${svgPlanet('moon',M.x,M.y,43,0,0,'v8GeoMoon')}
      <path d="${bez.d}" fill="none" stroke="${accent}" stroke-width="2.8" stroke-dasharray="4 10" stroke-linecap="round" class="v7-transfer-path"/>
      <circle cx="${target.x}" cy="${target.y}" r="49" stroke="${accent}" fill="none" stroke-opacity=".55" stroke-dasharray="5 9"/><circle cx="${landingTarget.x}" cy="${landingTarget.y}" r="6" fill="none" stroke="#acffcf" stroke-width="2"/><text x="${landingTarget.x+8}" y="${landingTarget.y-10}" fill="#c7ffe7" font-size="10">TARGET AT ARRIVAL</text>
      <circle cx="${from.x}" cy="${from.y}" r="5" fill="white" stroke="#9bffde" stroke-width="2"/>
      <circle cx="${M.x+point.x*43}" cy="${M.y-point.y*43}" r="4" fill="none" stroke="#a9f7cb" stroke-width="1.8"/>
      ${tracker(move,accent)}
      ${caption(S.x,S.y+S.r+23,'SUN',null)}${caption(E.x,E.y+E.r+24,'EARTH',null)}${caption(M.x,M.y+62,'MOON','position at selected UTC')}
      <rect x="687" y="92" width="233" height="54" rx="12" fill="#091922e8" stroke="#4c6572"/><text x="704" y="115" fill="#a1e0d3" font-size="10" font-weight="800" letter-spacing="1">EARTH-CENTERED REFERENCE</text><text x="704" y="133" fill="#e5f0f6" font-size="10">Moon moves with mission clock</text>
      <text x="19" y="518" fill="#a8bbc9" font-size="10">EARTH–MOON VIEW · MOON ORBIT INCLINATION OMITTED · DISTANCES & SIZES EXAGGERATED</text>`;
  }
  drawTransfer=function(){
    const svg=$('orbitSvg');if(!svg)return;
    const now=typeof window.__missionNow==='function'?window.__missionNow():dateAdd(timeStamp(state.launchDate,state.launchMinute),state.flight*transferDays);
    const progress=Math.min(1,Math.max(0,state.flight));
    svg.setAttribute('viewBox','0 0 940 540');
    svg.innerHTML=active==='helio'?helioSVG(now,progress):earthCenteredSVG(now,progress);
    const note=$('trajectoryTargetStatus');
    if(note)note.textContent=active==='helio'?'Heliocentric mode uses JPL approximate Earth–Moon barycenter elements (valid 1800–2050); the Moon’s distance and all globe sizes are enlarged to remain visible. Spacecraft transfer is a conceptual overlay, not an optimized heliocentric path.':'Earth-centered mode shows changing Moon phase and a conceptual lunar transfer. The departure marker follows the selected launch location; the dashed path is not a validated orbit.';
    const label=$('trajectoryAssetStatus');if(label)label.textContent=active==='helio'?'JPL ELEMENTS · NASA MOON/BLUE MARBLE IMAGERY':'NASA MOON/BLUE MARBLE IMAGERY';
  };
  function updateButtons(){
    for(let [key,id] of [['helio','orbitModeHelio'],['geo','orbitModeGeo']]){
      const b=$(id);if(!b)continue;b.classList.toggle('selected',active===key);b.setAttribute('aria-pressed',String(active===key));
    }
  }
  function init(){
    $('orbitModeHelio')?.addEventListener('click',()=>{active='helio';updateButtons();drawTransfer()});
    $('orbitModeGeo')?.addEventListener('click',()=>{active='geo';updateButtons();drawTransfer()});
    updateButtons();drawTransfer();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.__lunarPlanetSVG=svgPlanet;window.__lunarSunDisk=sunDisk;
  window.__lunarOrbitFrames={select(mode){if(mode!=='geo'&&mode!=='helio')return;active=mode;updateButtons();drawTransfer()},earthAt:earthHeliocentric,get mode(){return active}};
})();
