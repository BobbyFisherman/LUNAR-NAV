/* Optional user-paced guided judge demo. Makes no scientific certification claims. */
'use strict';
const TOUR_STAGES=[
 {page:1,label:'01 / Select your lunar landing site',copy:'Click the NASA-imagery Moon, select a coordinate, and see the Sun and Earth positions shift with mission time. The landing ellipse and hazards are demonstration layers, not NASA safety certification.'},
 {page:2,label:'02 / Plan an orbital transfer',copy:'Use the launch-date slider, select a departure site, and press Optimize. The dotted arc illustrates the transfer; gold marks the best departure in the demonstrator, not a certified trajectory.'},
 {page:3,label:'03 / Manage spacecraft power',copy:'Every spacecraft brings different power hardware. Scrub its mission timeline to inspect simulated generation, equipment loads, and stored battery charge.'},
 {page:4,label:'04 / Check Earth communications',copy:'Near-side landers generally have direct Earth visibility. Far-side destinations can lose it; two proposed relay nodes are shown conceptually until real orbits are supplied.'},
 {page:5,label:'05 / Find a surface exploration route',copy:'Click the terrain grid to set a science destination. A* recalculates an obstacle-aware path, distance, and modeled energy use on an explicitly synthetic local map.'},
 {page:6,label:'06 / Compare mission opportunities',copy:'Select a week and compare candidate sites using date-dependent Sun and Earth elevation. The rankings are geometric visibility opportunities—not final terrain-aware landing recommendations.'}
];
let tourStep=-1;
function renderTour(){const d=document.getElementById('tourOverlay');if(!d)return;if(tourStep<0){d.hidden=true;document.body.classList.remove('tour-open');return;}const x=TOUR_STAGES[tourStep];showPage(x.page);if(x.page===1){state.selectedSite='shackleton';state.lat=namedSites.shackleton.lat;state.lon=namedSites.shackleton.lon;moonRenderer?.center(state.lat,state.lon);sampleTerrainAtLocation();refreshAll();}
if(x.page===2){state.ship='custom';document.getElementById('shipSelect').value='custom';refreshPage(2)}
if(x.page===4){state.lat=namedSites.farside.lat;state.lon=namedSites.farside.lon;state.selectedSite='farside';refreshPage(4)}
if(x.page===6){refreshPage(6)}
 document.getElementById('tourIndex').textContent=String(tourStep+1).padStart(2,'0')+' / 06';document.getElementById('tourName').textContent=x.label;document.getElementById('tourCopy').textContent=x.copy;document.getElementById('tourProgress').style.width=((tourStep+1)/TOUR_STAGES.length*100)+'%';document.getElementById('tourPrev').disabled=tourStep===0;document.getElementById('tourNext').textContent=tourStep===TOUR_STAGES.length-1?'Finish tour ✓':'Next module →';d.hidden=false;document.body.classList.add('tour-open')}
function closeTour(){tourStep=-1;renderTour()}
function initTour(){const btn=document.getElementById('tourButton');if(!btn)return;btn.onclick=()=>{tourStep=0;renderTour()};document.getElementById('tourClose').onclick=closeTour;document.getElementById('tourPrev').onclick=()=>{if(tourStep>0){tourStep--;renderTour()}};document.getElementById('tourNext').onclick=()=>{if(tourStep>=TOUR_STAGES.length-1)closeTour();else{tourStep++;renderTour()}};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tourStep>=0)closeTour()})}
document.addEventListener('DOMContentLoaded',initTour);
