/* Lab-only global time dock visibility; no changes to the shared clock calculations. */
'use strict';
(function(){
 const lab=document.getElementById('mission-lab');
 function update(){if(!lab)return;
   const reached=lab.getBoundingClientRect().top < window.innerHeight*.79;
   document.body.classList.toggle('mission-lab-visible',reached);
 }
 let queued=false;
 const onScroll=()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;update()})}};
 window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onScroll,{passive:true});
 document.addEventListener('DOMContentLoaded',update);
 // Keyboard and assistive tools can jump directly into the lab.
 document.querySelectorAll('[data-lab-page], #beginMission, #quickExplore').forEach(b=>b.addEventListener('click',()=>setTimeout(update,420)));
 update();
})();

/* Linked communications illustration: same NASA visual sources as the Transfer scene. */
(function(){
  if(typeof commSvgGraphic==='undefined'||!window.__lunarPlanetSVG)return;
  const planet=window.__lunarPlanetSVG,sun=window.__lunarSunDisk;
  commSvgGraphic=function(elevation,direct){
    const svg=document.getElementById('commSvg');if(!svg)return;
    const date=typeof __missionNow==='function'?__missionNow():new Date();
    const E={x:315,y:236,r:73},M={x:674,y:233,r:83},S={x:90,y:230,r:47};
    const site=projectPoint(state.lat,state.lon,0,0),far=site.z<=0;
    // The destination is the exact selected lunar coordinate projected on the visible disk.
    const onMoon={x:M.x+(far?.94:site.x)*M.r,y:M.y-site.y*M.r};
    const launch=launchSites[state.launchSite];
    const station=projectPoint(launch.lat,launch.lon,launch.lat-7,launch.lon-15);
    const fromEarth={x:E.x+E.r*station.x,y:E.y-E.r*station.y};
    const relayA={x:812,y:105},relayB={x:839,y:352};
    const callout=`${Math.abs(state.lat).toFixed(2)}° ${state.lat<0?'S':'N'}, ${Math.abs(state.lon).toFixed(2)}° ${state.lon<0?'W':'E'}`;
    const starfield=Array.from({length:90},(_,i)=>`<circle cx="${(i*i*7.67+i*61.31)%940}" cy="${(i*93.9+i*i*.33)%465}" r="${.4+(i%4)*.2}" fill="#d1e8f2" opacity="${.14+(i%5)*.08}"/>`).join('');
    let rays=direct?`<path d="M ${fromEarth.x} ${fromEarth.y} L ${onMoon.x} ${onMoon.y}" fill="none" stroke="#8bf1dc" stroke-width="2.8" stroke-dasharray="6 9" class="signal-dash"/><circle cx="${(fromEarth.x+onMoon.x)/2}" cy="${(fromEarth.y+onMoon.y)/2}" r="5" fill="#b3ffe7" class="signal-pulse"/>`:
    `<path d="M ${fromEarth.x} ${fromEarth.y} L ${M.x-M.r} ${M.y}" stroke="#ee9b8f" stroke-width="2.5" stroke-dasharray="6 8" fill="none"/><path d="M ${M.x-M.r-15} ${M.y-11} l 15 22 m 0 -22 l -15 22" stroke="#f4a69c" stroke-width="2.8"/>`;
    if(!direct)rays+=`<g fill="none" stroke="#f0cc85" stroke-width="2.2" stroke-dasharray="5 8" opacity=".92"><path d="M ${onMoon.x} ${onMoon.y} L ${relayA.x} ${relayA.y} L ${fromEarth.x} ${fromEarth.y}"/><path d="M ${onMoon.x} ${onMoon.y} L ${relayB.x} ${relayB.y} L ${fromEarth.x} ${fromEarth.y}"/></g><circle cx="${relayA.x}" cy="${relayA.y}" r="6" fill="#f8ce8a"/><circle cx="${relayB.x}" cy="${relayB.y}" r="6" fill="#f8ce8a"/><text x="${relayA.x+10}" y="${relayA.y-7}" fill="#f2d399" font-size="10">PROPOSED RELAY A</text><text x="${relayB.x+10}" y="${relayB.y+17}" fill="#f2d399" font-size="10">PROPOSED RELAY B</text>`;
    svg.setAttribute('viewBox','0 0 940 465');
    svg.innerHTML=`<defs><radialGradient id="commNewBg"><stop stop-color="#142839"/><stop offset=".65" stop-color="#080f1a"/><stop offset="1" stop-color="#03070e"/></radialGradient></defs><rect width="940" height="465" fill="url(#commNewBg)"/>${starfield}
      ${sun(S.x,S.y,S.r,'commSharedSun')}
      ${planet('earth',E.x,E.y,E.r,launch.lat-7,launch.lon-15,'commSharedEarth')}
      ${planet('moon',M.x,M.y,M.r,0,0,'commSharedMoon')}
      ${rays}<circle cx="${fromEarth.x}" cy="${fromEarth.y}" r="5.7" fill="#d0ffeb" stroke="#fff" stroke-width="1.5"/><circle cx="${onMoon.x}" cy="${onMoon.y}" r="6" fill="${direct?'#9ff6cf':'#f8bb94'}" stroke="#fff" stroke-width="1.5"/>
      <g fill="#e8f4f4" font-size="12" font-weight="800" letter-spacing="2" text-anchor="middle"><text x="${S.x}" y="${S.y+S.r+24}">SUN</text><text x="${E.x}" y="${E.y+E.r+24}">EARTH</text><text x="${M.x}" y="${M.y+M.r+22}">MOON</text></g>
      <rect x="20" y="55" width="335" height="66" rx="12" fill="#0a1a25e9" stroke="#536f77"/><text x="37" y="81" fill="#96e1cc" font-size="11" font-weight="800" letter-spacing="1.1">${direct?'DIRECT EARTH LINK':'EARTH BLOCKED · RELAYS PROPOSED'}</text><text x="37" y="101" fill="#d5e6eb" font-size="11">Earth elevation ${elevation.toFixed(1)}° · ${date.toISOString().slice(0,16).replace('T',' ')} UTC</text>
      <rect x="673" y="390" width="251" height="51" rx="10" fill="#0a1a25e9" stroke="#536f77"/><text x="687" y="409" fill="#9edccb" font-size="10" font-weight="800">SELECTED LUNAR SITE</text><text x="687" y="426" fill="#f1f7f8" font-size="11">${callout}</text><text x="20" y="450" fill="#a5bac2" font-size="10">TRANSFER-MATCHED NASA IMAGERY · PLANET SIZES EXAGGERATED · RELAY COVERAGE NOT VERIFIED</text>`;
  };
})();
