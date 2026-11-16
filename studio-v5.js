/* LUNAR/NAV v6 — authoritative UTC mission time. Every module reads one clock. */
'use strict';
(function(){
 const $v=id=>document.getElementById(id);
 let ready=false, internal=false, lastPeripheral=0, lastComparison='', lastFlight=state.flight;
 let warpSpeed=0,warpFrame=0,warpLast=0,lastRender=0;
 const minEpoch=Date.parse('2026-01-01T00:00:00Z'),maxEpoch=Date.parse('2029-12-31T23:59:00Z');
 const departureEpoch=()=>timeStamp(state.launchDate,state.launchMinute).getTime();
 const fullDurationMs=()=> (transferDays+2)*86400000;
 state.globalEpochMs=departureEpoch()+state.flight*transferDays*86400000;
 const now=()=>new Date(state.globalEpochMs);
 window.__missionNow=now;
 const toLocalUtcInput=d=>d.toISOString().slice(0,16);
 const displayUtc=d=>d.toISOString().slice(0,16).replace('T',' ')+' UTC';
 const elapsedLabel=()=>{let delta=(state.globalEpochMs-departureEpoch())/60000;
   const sign=delta<0?'−':'+';const mins=Math.abs(Math.round(delta));return `T ${sign} ${Math.floor(mins/1440)}d ${String(Math.floor(mins%1440/60)).padStart(2,'0')}h ${String(mins%60).padStart(2,'0')}m`;
 };
 function propagateTime(force){
   if(!ready)return;
   let d=now(),iso=d.toISOString().slice(0,10),m=d.getUTCHours()*60+d.getUTCMinutes();
   skyState.date=iso;skyState.minute=m;state.commDate=iso;state.commMinute=m;state.compareDate=iso;
   state.energyFlight=clamp((state.globalEpochMs-departureEpoch())/fullDurationMs(),0,1);
   let t=performance.now();if(force||t-lastPeripheral>340){lastPeripheral=t;updateSciencePanel();updateComms();updateEnergy();if(force||iso!==lastComparison){lastComparison=iso;updateComparison()}}
 }
 function renderClock(force=false){if(!ready)return;
   $v('globalCurrentUtc').textContent=displayUtc(now());$v('globalClockLabel').textContent=elapsedLabel();
   $v('globalPlay').innerHTML=state.playing?'Ⅱ <span>Pause</span>':'▶ <span>Play</span>';
   if($v('heroCoordinate'))$v('heroCoordinate').textContent=coordinateLabel(state.lat,state.lon);
   if(document.activeElement!==$v('jumpDateTime'))$v('jumpDateTime').value=toLocalUtcInput(now());
   if($v('commSceneTime'))$v('commSceneTime').textContent=displayUtc(now());
   propagateTime(force);
 }
 window.__syncMissionClock=renderClock;
 function setEpoch(epoch,{force=true,redraw=true}={}){
   state.globalEpochMs=clamp(epoch,minEpoch,maxEpoch);
   const fraction=(state.globalEpochMs-departureEpoch())/fullDurationMs();
   state.missionElapsedFraction=clamp(fraction,0,1);
   state.flight=clamp((state.globalEpochMs-departureEpoch())/(transferDays*86400000),0,1);
   internal=true;
   try{if(redraw)updateTrajectory()}finally{internal=false;lastFlight=state.flight}
   renderClock(force);
 }
 window.__setMissionNow=(epoch)=>{stopFlight();haltWarp();setEpoch(Number(epoch))};
 const baseTrajectory=updateTrajectory;
 updateTrajectory=function(...args){
   if(!internal){
      const changed=Math.abs(state.flight-lastFlight)>1e-6;
      if(state.playing||changed){state.globalEpochMs=departureEpoch()+state.flight*transferDays*86400000;state.missionElapsedFraction=state.flight*transferDays/(transferDays+2)}
   }
   lastFlight=state.flight;
   let r=baseTrajectory(...args);renderClock(false);return r;
 };
 const baseSync=syncFlightButtons;
 syncFlightButtons=function(...args){let r=baseSync(...args);if(ready)$v('globalPlay').innerHTML=state.playing?'Ⅱ <span>Pause</span>':'▶ <span>Play</span>';return r};
 const baseShow=showPage;
 showPage=function(i){let r=baseShow(i);if(ready){document.querySelectorAll('.module-tab').forEach(x=>{const b=+x.dataset.labPage===i;x.classList.toggle('current',b);x.setAttribute('aria-current',b?'page':'false')});requestAnimationFrame(()=>{$v('mission-lab').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'})})}return r};
 const baseLanding=updateLanding;
 updateLanding=function(...a){let r=baseLanding(...a);if(ready)$v('heroCoordinate').textContent=coordinateLabel(state.lat,state.lon);return r};
 function chooseSite(site){let x=$v('siteSearch');if(!x)return;x.value=site;x.dispatchEvent(new Event('change',{bubbles:true}));$v('introSite').value=site;renderClock(true)}
 function jump(){let raw=$v('jumpDateTime').value;if(!raw)return;let time=Date.parse(raw+':00Z');if(!Number.isFinite(time))return;stopFlight();haltWarp();setEpoch(time);$v('jumpToTime').classList.add('jumped');setTimeout(()=>$v('jumpToTime').classList.remove('jumped'),500)}
 function warpUnits(v){let dps=Math.pow(Math.abs(v)/100,2.4)*40;
   return dps>=1?`${dps.toFixed(1)} days/s`:dps>=1/24?`${(dps*24).toFixed(1)} hours/s`:`${Math.max(1,(dps*1440)).toFixed(0)} min/s`;
 }
 function setWarp(v){warpSpeed=Number(v)||0;
   if(warpSpeed){stopFlight();document.body.classList.add('time-warping');$v('warpRate').textContent=(warpSpeed<0?'◀ −':'▶ +')+warpUnits(warpSpeed)}
   else{document.body.classList.remove('time-warping');$v('warpRate').textContent='● DRAG & HOLD'}
   if(warpSpeed&&!warpFrame){warpLast=0;warpFrame=requestAnimationFrame(tickWarp)}
 }
 function haltWarp(){warpSpeed=0;$v('globalScrub').value=0;document.body.classList.remove('time-warping');$v('warpRate').textContent='● DRAG & HOLD';if(warpFrame){cancelAnimationFrame(warpFrame);warpFrame=0}warpLast=0}
 function tickWarp(ts){if(!warpSpeed){warpFrame=0;return}if(!warpLast)warpLast=ts;const dt=Math.min(.1,(ts-warpLast)/1000);warpLast=ts;
   let dps=Math.sign(warpSpeed)*Math.pow(Math.abs(warpSpeed)/100,2.4)*40;
   state.globalEpochMs=clamp(state.globalEpochMs+dps*86400000*dt,minEpoch,maxEpoch);
   if(ts-lastRender>105){lastRender=ts;setEpoch(state.globalEpochMs,{force:true});}
   warpFrame=requestAnimationFrame(tickWarp)
 }
 function init(){ready=true;
   for(let b of document.querySelectorAll('.module-tab'))b.addEventListener('click',()=>showPage(+b.dataset.labPage));
   $v('introSite').value=state.selectedSite;
   $v('beginMission').addEventListener('click',()=>showPage(1));
   $v('quickExplore').addEventListener('click',()=>{chooseSite($v('introSite').value);showPage(1)});
   $v('jumpToTime').addEventListener('click',jump);
   $v('jumpDateTime').addEventListener('keydown',e=>{if(e.key==='Enter')jump()});
   const x=$v('globalScrub');x.value=0;
   x.addEventListener('input',e=>setWarp(e.target.value));
   for(const event of ['pointerup','pointercancel','keyup','blur','change'])x.addEventListener(event,haltWarp);
   document.addEventListener('pointerup',haltWarp);
   window.addEventListener('blur',haltWarp);
   $v('globalPlay').addEventListener('click',()=>{haltWarp();if(state.flight>=.9999){stopFlight();state.flight=0;state.globalEpochMs=departureEpoch()}$v('playFlight').click();renderClock(true)});
   $v('globalReplay').addEventListener('click',()=>{haltWarp();state.globalEpochMs=departureEpoch();$v('replayFlight').click();renderClock(true)});
   // The departure date belongs to the trajectory configuration, not the observation-time scrubber.
   for(const id of ['launchDate','launchTime'])$v(id)?.addEventListener('change',()=>{setTimeout(()=>{state.globalEpochMs=departureEpoch();state.flight=0;renderClock(true)},0)});
   for(const id of ['shipSelect','siteSearch','latInput','lonInput','optimizeBtn'])$v(id)?.addEventListener('change',()=>renderClock(true));
   $v('optimizeBtn')?.addEventListener('click',()=>setTimeout(()=>renderClock(true),40));
   document.querySelectorAll('[data-lab-page="1"]').forEach(x=>x.classList.add('current'));
   document.body.classList.add('studio-ready');renderClock(true);
 }
 document.addEventListener('DOMContentLoaded',()=>setTimeout(init,40));
})();
