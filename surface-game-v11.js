/* LUNAR / NAV Surface Expedition v11 — original local-only WebGL terrain game.
   Lunar g = 1.62 m/s² (NASA Moon Fact Sheet).
   Geometry and vehicle parameters are an educational model, NOT surveyed NASA terrain or certified rover dynamics.
   No external rendering library, remote requests, telemetry, or storage are required. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const siteState=()=>typeof state!=='undefined'&&state?state:(window.state||{});
const canvas = $('roverGame'), minimap = $('roverMinimap');
if (!canvas || !minimap) return;
const gl = canvas.getContext('webgl2', {antialias:true,alpha:false,depth:true,preserveDrawingBuffer:false});
if (!gl) {
  // Preserve a fully playable compatibility mode on systems where WebGL 2 is disabled.
  window.__surfaceGameCompatibilityMode = true;
  const fallback=document.createElement('script');fallback.src='surface-game-v9.js';document.body.appendChild(fallback);
  const label=document.querySelector('#roverGravityTag');if(label)label.textContent='2D COMPATIBILITY MODE · g = 1.62 m/s²';
  return;
}
const mini = minimap.getContext('2d');
const PI=Math.PI, TAU=2*PI, G=1.62;
const clamp=(a,l,h)=>Math.max(l,Math.min(h,a));
const smooth=(a,b,t)=>a+(b-a)*clamp(t,0,1);
const ease=t=>t*t*(3-2*t);
const vec=(x=0,y=0,z=0)=>[x,y,z], plus=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],scale=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],normal=a=>{const l=Math.hypot(...a)||1;return scale(a,1/l)};
// Column-major WebGL matrices.
const I=()=>[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mul(a,b){let o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
const trans=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const rotY=t=>{let c=Math.cos(t),s=Math.sin(t);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];};
const rotX=t=>{let c=Math.cos(t),s=Math.sin(t);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];};
const rotZ=t=>{let c=Math.cos(t),s=Math.sin(t);return [c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];};
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];}
function lookAt(e,t,up=[0,1,0]){const z=normal(sub(e,t)),x=normal(cross(up,z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1];}
const model=(p=[0,0,0],ry=0,rx=0,rz=0)=>mul(trans(...p),mul(rotY(ry),mul(rotX(rx),rotZ(rz))));
const VS=`#version 300 es
precision highp float;
in vec3 position;in vec3 normal;in vec3 color;in float material;
uniform mat4 viewProjection;uniform mat4 world;
out vec3 vNorm;out vec3 vWorld;out vec3 vCol;flat out int vMat;
void main(){vec4 w=world*vec4(position,1.);vWorld=w.xyz;vNorm=mat3(world)*normal;vCol=color;vMat=int(material+.5);gl_Position=viewProjection*w;}`;
const FS=`#version 300 es
precision highp float;
in vec3 vNorm;in vec3 vWorld;in vec3 vCol;flat in int vMat;
uniform vec3 sunDirection;uniform vec3 eye;uniform float time;out vec4 frag;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=hash(i),b=hash(i+vec3(1,0,0)),c=hash(i+vec3(0,1,0)),d=hash(i+vec3(1,1,0)),e=hash(i+vec3(0,0,1)),ff=hash(i+vec3(1,0,1)),g=hash(i+vec3(0,1,1)),h=hash(i+vec3(1,1,1));return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,ff,f.x),mix(g,h,f.x),f.y),f.z);}
void main(){vec3 n=normalize(vNorm);vec3 L=normalize(sunDirection);float diffuse=max(dot(n,L),0.);float back=max(dot(n,-L),0.);float ao=1.;
 float grain=noise(vWorld*.62)*.50+noise(vWorld*3.4)*.25+noise(vWorld*12.)*.25;
 vec3 base=vCol;
 if(vMat==0){base*=mix(.67,1.18,grain);n=normalize(n+vec3((noise(vWorld*2.4)-.5)*.10,0.,(noise(vWorld.zxy*2.3)-.5)*.10));diffuse=max(dot(n,L),0.);}
 if(vMat==1)base*=mix(.68,1.19,grain);
 float light=.18+1.17*pow(diffuse,1.12)+.09*back;
 if(vMat==0)light=.18+1.17*diffuse;
 vec3 rgb=base*light;
 if(vMat>=2){vec3 H=normalize(L+normalize(eye-vWorld));float spec=pow(max(dot(n,H),0.),vMat==4?26.:76.)*(vMat==4?.14:.29);rgb+=vec3(spec);}
 float dist=length(eye-vWorld);float fade=1.-exp(-dist*.0025);rgb=mix(rgb,vec3(.22,.23,.25),fade*.27);
 rgb=pow(max(rgb,0.),vec3(.87));frag=vec4(rgb,1.);
}`;
function shader(type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VS));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
const loc={pos:gl.getAttribLocation(prog,'position'),normal:gl.getAttribLocation(prog,'normal'),color:gl.getAttribLocation(prog,'color'),mat:gl.getAttribLocation(prog,'material'),vp:gl.getUniformLocation(prog,'viewProjection'),world:gl.getUniformLocation(prog,'world'),sun:gl.getUniformLocation(prog,'sunDirection'),eye:gl.getUniformLocation(prog,'eye'),time:gl.getUniformLocation(prog,'time')};
gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(.013,.018,.027,1);
class Mesh{
 constructor(data,mode=gl.TRIANGLES){this.count=data.length/10;this.mode=mode;this.vao=gl.createVertexArray();this.buf=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
 for(const [i,size,offset] of [[loc.pos,3,0],[loc.normal,3,12],[loc.color,3,24],[loc.mat,1,36]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,40,offset);}gl.bindVertexArray(null);}
 draw(m=I()){gl.uniformMatrix4fv(loc.world,false,new Float32Array(m));gl.bindVertexArray(this.vao);gl.drawArrays(this.mode,0,this.count);}
 destroy(){gl.deleteBuffer(this.buf);gl.deleteVertexArray(this.vao);}
}
function vert(out,p,n,c,mat){out.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],mat);}
function face(out,a,b,c,col,mat=2){let n=normal(cross(sub(b,a),sub(c,a)));if(n[1]<-.9&&mat===0)n=scale(n,-1);vert(out,a,n,col,mat);vert(out,b,n,col,mat);vert(out,c,n,col,mat);}
function quad(out,a,b,c,d,col,mat=2){face(out,a,b,c,col,mat);face(out,a,c,d,col,mat);}
function box(w,h,l,col,mat=2){const d=[],x=w/2,y=h/2,z=l/2,v=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];for(const [a,b,c,e] of [[4,5,6,7],[1,0,3,2],[0,4,7,3],[5,1,2,6],[7,6,2,3],[0,1,5,4]])quad(d,v[a],v[b],v[c],v[e],col,mat);return new Mesh(d);}
function cylinder(rad,length,sides,col,mat=2,axis='y'){let d=[];const orient=(x,y,z)=>axis==='x'?[y,x,z]:[x,y,z];for(let k=0;k<sides;k++){let t=k*TAU/sides,u=(k+1)*TAU/sides,a=orient(rad*Math.cos(t),-length/2,rad*Math.sin(t)),b=orient(rad*Math.cos(u),-length/2,rad*Math.sin(u)),c=orient(rad*Math.cos(u),length/2,rad*Math.sin(u)),e=orient(rad*Math.cos(t),length/2,rad*Math.sin(t));quad(d,a,b,c,e,col,mat);face(d,orient(0,length/2,0),c,e,col,mat);face(d,orient(0,-length/2,0),a,b,col,mat);}return new Mesh(d);}
function ball(radius,sides,rings,col,mat=1,seedOffset=0){let d=[];const point=(t,p)=>{const irregular=1+.085*Math.sin(t*5+seedOffset)*Math.sin(p*4+seedOffset)+.05*Math.cos(t*11-p*7);return [radius*irregular*Math.sin(p)*Math.cos(t),radius*irregular*Math.cos(p),radius*irregular*Math.sin(p)*Math.sin(t)];};for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){let a=point(TAU*i/sides,PI*j/rings),b=point(TAU*(i+1)/sides,PI*j/rings),c=point(TAU*(i+1)/sides,PI*(j+1)/rings),e=point(TAU*i/sides,PI*(j+1)/rings);face(d,a,b,c,col,mat);face(d,a,c,e,col,mat);}return new Mesh(d);}
const colors={dust:[.51,.51,.48],rock:[.51,.52,.51],wheel:[.095,.105,.123],hub:[.57,.63,.66],frame:[.45,.53,.57],white:[.79,.82,.79],window:[.12,.30,.39],gold:[.69,.51,.24],solar:[.055,.19,.35],green:[.27,.85,.66],black:[.06,.08,.11]};
const roverMeshes={
 chassis:box(2.55,.58,3.8,colors.white),bottom:box(2.76,.23,3.9,colors.frame),cab:box(1.90,.65,2.2,colors.window,4),
 hood:box(2.4,.23,2.0,colors.frame),panel:box(3.0,.12,2.1,colors.solar,4),bar:box(.10,.10,2.8,colors.hub,3),
 wheel:cylinder(.49,.42,28,colors.wheel,4,'x'),hub:cylinder(.28,.48,24,colors.hub,3,'x'),rim:cylinder(.36,.50,22,colors.frame,3,'x'),
 lug:box(.46,.095,.19,[.17,.18,.20],4),axle:cylinder(.105,3.0,10,colors.frame,3,'x'),light:ball(.18,10,7,[.76,.88,.78],3),
 suspension:cylinder(.068,1,12,colors.hub,3,'y'),shock:cylinder(.125,1,12,[.29,.38,.42],3,'y'),
 camera:box(.25,.20,.32,colors.black,3),antenna:cylinder(.045,2.0,10,colors.hub,3,'y')};
const stationMeshes={
 building:box(10,3.4,8,colors.white),window:box(3.4,1.55,.13,colors.window,4),roof:box(11.2,.27,8.8,colors.frame),
 door:box(1.8,2.65,.20,[.16,.30,.31],4),solar:box(6.5,.14,3.0,colors.solar,4),strut:cylinder(.09,3.5,10,colors.hub,3),
 dome:ball(3.2,26,12,colors.white),beacon:ball(.39,12,9,colors.green,3),pad:cylinder(9,.20,44,[.27,.30,.32],1),
 scanner:box(1.7,1.28,1.5,[.27,.34,.37],3),screen:box(1.30,.61,.10,[.06,.52,.59],4),
 dish:cylinder(1.35,.15,24,[.59,.65,.66],3),rail:box(.12,1.05,6,colors.gold,3),crate:box(1.7,1.2,1.4,[.44,.46,.43],1),
 flag:box(.95,.45,.10,colors.green,3)};
const landerMeshes={core:cylinder(2.4,4.6,12,[.67,.68,.66],3),top:cylinder(2.0,1.8,12,[.78,.74,.66],3),leg:cylinder(.12,5.3,10,[.60,.64,.64],3),foot:cylinder(.48,.18,16,[.54,.55,.52],3),window:box(1.0,1.1,.12,colors.window,4)};
const catalog=[];let terrainMesh=null;let seed=271828,obstacles=[],craters=[],mountains=[],rocks=[],base={x:118,z:99},cave={x:46,z:91},sample={x:46,z:94},scanner={x:116,z:91.9},caveWalls=[],pos={x:0,z:0},yaw=.37,speed=0,bodyY=0,vy=0,pitch=0,roll=0,steerVisual=0,wheelSpin=0,battery=80,startBattery=80,damage=0,elapsed=0,maxSpeed=12,difficulty=1,hitCooldown=0,stage='preview',stageTime=0,missionEnded=false,hasSample=false,grounded=false,airTime=0,airStartY=0,highestAirY=0,impactInfo='',wheelState=[];
let win=false,lost=false,raf=0,prevTs=0,frameTime=0,camYaw=.3,orbitOffset=0,orbitPitch=.21,camDist=13,camPos=[0,8,-16],camTarget=[0,1,0],cameraEye=camPos,viewProj=I();const held=new Set(),touch=new Set();let audioCtx=null,notes=[],musicOn=false;
function seeded(){let x=seed|0;return ()=>{x=(Math.imul(x,1664525)+1013904223)|0;return (x>>>0)/4294967296;};}
function rand2(x,z){let n=Math.sin(x*127.1+z*311.7+seed*1.7)*43758.5453;return n-Math.floor(n);}
function n2(x,z){let ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz;u=ease(u);v=ease(v);return smooth(smooth(rand2(ix,iz),rand2(ix+1,iz),u),smooth(rand2(ix,iz+1),rand2(ix+1,iz+1),u),v);}
function fbm(x,z){let a=0,f=.036,amp=1,tot=0;for(let i=0;i<4;i++){a+=(n2(x*f,z*f)-.5)*amp;tot+=amp;f*=2.09;amp*=.49;}return a/tot;}
const gauss=(v,w)=>Math.exp(-(v*v)/(w*w));
function height(x,z){
 let yy=.25*Math.sin(x*.17+z*.09)+.20*Math.cos(z*.19-x*.17)+fbm(x*1.7,z*1.7)*2.35;
 const corridor=Math.exp(-Math.pow((x-z*1.14)/26,2));yy*=1-.70*corridor;
 for(const m of mountains){let dx=(x-m.x),dz=(z-m.z),angle=m.a,xx=(dx*Math.cos(angle)+dz*Math.sin(angle))/m.w,zz=(-dx*Math.sin(angle)+dz*Math.cos(angle))/m.l;let q=Math.sqrt(xx*xx+zz*zz);yy+=m.h*Math.pow(Math.max(0,1-q),1.8)*(1+.23*Math.sin((xx+zz)*8+m.a));}
 for(const c of craters){let dx=x-c.x,dz=z-c.z,q=Math.atan2(dz,dx),dist=Math.hypot(dx,dz);let r=c.r*(1+.065*Math.sin(q*5+c.a)+.035*Math.sin(q*9+c.a*2)),u=dist/r;if(u>2.3)continue;let dep=-c.depth*gauss(u,.68)*(1-.24*u),rim=c.rim*gauss(u-1.12,.20);yy+=dep+rim*(1+.12*Math.cos(q*7+c.a));}
 // Mission pads are leveled to provide readable start and finish conditions.
 const startFlat=1-clamp((Math.hypot(x,z)-5.0)/7,0,1);yy*=1-startFlat*.94;
 const endFlat=1-clamp((Math.hypot(x-base.x,z-base.z)-10)/9,0,1);yy*=1-endFlat*.92;
 return yy;
}
function slope(x,z){return Math.hypot((height(x+.7,z)-height(x-.7,z))/1.4,(height(x,z+.7)-height(x,z-.7))/1.4);}
function currentSeed(){const s=siteState();return Math.floor((s.lat??-89.5)*301+(s.lon??43.2)*171+(s.a??100)*3+(s.orientation??30))|0;}
function rebuildWorld(){
 seed=currentSeed();const s=siteState();
 const random=seeded();craters=[];mountains=[];rocks=[];obstacles=[];caveWalls=[];
 // Elongated highlands, scarps and gentle hills: different shape/size per site.
 for(let k=0;k<19+difficulty*4;k++){
   let x=(random()-.48)*570,z=(random()-.44)*530;
   if(Math.hypot(x,z)<26||Math.hypot(x-base.x,z-base.z)<27||Math.hypot(x-cave.x,z-cave.z)<24)continue;
   mountains.push({x,z,h:4+random()*19,w:16+random()*42,l:14+random()*78,a:random()*TAU});
 }
 for(let k=0;k<31+difficulty*11;k++){
   let a=TAU*random(),r=Math.sqrt(random())*1.28,major=(s.a||100),minor=(s.b||75),ori=(s.orientation||30)*PI/180;
   let u=r*major*Math.cos(a),v=r*minor*Math.sin(a);
   let x=u*Math.cos(ori)-v*Math.sin(ori),z=u*Math.sin(ori)+v*Math.cos(ori);
   if(k>14){x=(random()-.40)*345;z=(random()-.26)*340;}
   if(Math.hypot(x,z)<17||Math.hypot(x-base.x,z-base.z)<26||Math.hypot(x-cave.x,z-cave.z)<25)continue;
   let rad=4+random()*18;
   craters.push({x,z,r:rad,depth:1.2+random()*rad*.42,rim:.65+random()*rad*.24,a:random()*TAU});
   obstacles.push({type:'crater',x,z,r:rad});
 }
 for(let k=0;k<85+difficulty*38;k++){
   let x=(random()-.45)*385,z=(random()-.34)*420;
   if(Math.hypot(x,z)<15||Math.hypot(x-base.x,z-base.z)<26||Math.hypot(x-cave.x,z-cave.z)<25)continue;
   let r=.55+Math.pow(random(),2.5)*3.8;
   obstacles.push({type:'rock',x,z,r});
   rocks.push({x,z,r,angle:random()*TAU,offset:random()*22,color:.40+random()*.21});
 }
 // A distinctive horseshoe-shaped lava-tube cave: an open southern entrance, rough walls, and an enclosed rock sample.
 // Colliders use the same wall/rock positions as the visible geometry.
 for(let i=0;i<25;i++){
   const t=i/24*TAU;
   if(Math.cos(t)<-.76 && Math.abs(Math.sin(t))<.70)continue; // broad entrance facing the landing site
   const radius=12.3+1.5*Math.sin(i*2.41),x=cave.x+Math.sin(t)*radius,z=cave.z+Math.cos(t)*radius;
   caveWalls.push({x,z,r:2.7+1.1*(i%3)/2,h:3.4+(i%5)*.68});
 }
 if(terrainMesh)terrainMesh.destroy();
 const vertices=[];
 const ext=270,step=3.5,rows=Math.round(2*ext/step),side=rows+1;
 const points=new Array(side*side),colorsGrid=new Array(side*side),normalsGrid=new Array(side*side);
 const id=(i,j)=>j*side+i;
 // Cache heights/normals once per vertex (rather than six times per triangle).
 for(let j=0;j<side;j++)for(let i=0;i<side;i++){
   const x=-ext+i*step,z=-ext+j*step,y=height(x,z);points[id(i,j)]=[x,y,z];
 }
 for(let j=0;j<side;j++)for(let i=0;i<side;i++){
   const x=-ext+i*step,z=-ext+j*step,at=(a,b)=>points[id(clamp(a,0,rows),clamp(b,0,rows))][1];
   normalsGrid[id(i,j)]=normal([at(i-1,j)-at(i+1,j),2*step,at(i,j-1)-at(i,j+1)]);
   const tex=n2(x*.7,z*.7),slopeColor=clamp(normalsGrid[id(i,j)][1],0,1);
   const inCrater=craters.some(c=>Math.hypot(c.x-x,c.z-z)<c.r*.75);
   const gray=(.37+.15*tex+.09*slopeColor)*(inCrater?.76:1);
   colorsGrid[id(i,j)]=[gray*1.02,gray*1.01,gray];
 }
 function put(v){vert(vertices,points[v],normalsGrid[v],colorsGrid[v],0);}
 for(let j=0;j<rows;j++)for(let i=0;i<rows;i++){
   const a=id(i,j),b=id(i+1,j),c=id(i+1,j+1),d=id(i,j+1);
   put(a);put(d);put(c);put(a);put(c);put(b);
 }
 terrainMesh=new Mesh(vertices);
 if(rockMeshCache.length)rockMeshCache.forEach(m=>m.destroy());rockMeshCache=[];
 for(let i=0;i<10;i++)rockMeshCache.push(ball(1,9+i%5,6+i%3,[.32+i*.023,.32+i*.023,.32+i*.021],1,i*.9));
}
let rockMeshCache=[];
function reset(overlay=true){
 rebuildWorld();pos={x:0,z:0};yaw=.37;speed=0;bodyY=height(0,0)+3.5;vy=0;
 pitch=0;roll=0;steerVisual=0;wheelSpin=0;damage=0;elapsed=0;hitCooldown=0;
 stage='preview';stageTime=0;win=false;lost=false;missionEnded=false;hasSample=false;
 grounded=false;airTime=0;airStartY=bodyY;highestAirY=bodyY;impactInfo='';
 held.clear();touch.clear();wheelState=[];
 startBattery=Number($('roverBatterySet').value);battery=startBattery;
 camPos=[-6,7,-14];camTarget=[0,1,0];camYaw=yaw;
 $('roverStartOverlay').hidden=!overlay;$('roverWinOverlay').hidden=true;$('roverFailOverlay').hidden=true;
 $('roverInteraction').hidden=true;$('roverFade').classList.remove('black');$('roverScenePhase').hidden=true;$('roverCockpit').hidden=true;
 updateHUD();drawScene();paintMinimap();
}
function start(){reset(false);stage='landing';stageTime=0;$('roverScenePhase').hidden=false;$('roverCockpit').hidden=false;canvas.focus({preventScroll:true});ensureLoop();}
const key=k=>held.has(k)||touch.has(k);
// Camera-forward is +Z, so negative world yaw is right on screen. The v10 steering sign was reversed visually.
function controls(){return {throttle:(key('KeyW')||key('ArrowUp')||key('forward')?1:0)-(key('KeyS')||key('ArrowDown')||key('back')?1:0),steer:(key('KeyA')||key('ArrowLeft')||key('left')?1:0)-(key('KeyD')||key('ArrowRight')||key('right')?1:0),brake:key('Space')||key('brake')};}
function end(success,reason=''){
 stage=success?'completed':'failed';missionEnded=true;win=success;lost=!success;
 if(success){$('roverWinReport').textContent=`Lunar sample secured, transported, and uploaded to the research scanner. Traverse time ${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}; remaining drive energy ${Math.round(battery/startBattery*100)}%; hull integrity ${Math.round(100-damage)}%. The simulated sample record is queued for transmission to Earth.`;$('roverWinOverlay').hidden=false;}
 else{$('roverFailReport').textContent=reason||'Critical rover system failure. Reconfigure and retry.';$('roverFailOverlay').hidden=false;}
 $('roverInteraction').hidden=true;
}
let eva={x:0,z:0,yaw:.3},scanProgress=0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function setPrompt(message){const p=$('roverInteraction');p.hidden=false;p.innerHTML=message;}
function enterEVA(where){
 eva={x:pos.x+Math.cos(yaw)*1.8,z:pos.z-Math.sin(yaw)*1.8,yaw:yaw};
 stage=where==='cave'?'evaCave':'evaBase';stageTime=0;
 setPrompt(where==='cave'?'EVA: Follow the cave entrance and locate the highlighted mineral sample. Use WASD to walk; press <b>E</b> near the rock.':'EVA: Take the collected sample to the illuminated scanner at the research outpost. Press <b>E</b> to upload.');
}
function interaction(){
 if(stage==='parkCave'){enterEVA('cave');return;}
 if(stage==='evaCave'&&distance(eva,sample)<3.4){hasSample=true;stage='evaReturn';setPrompt('SAMPLE ACQUIRED ✓ · Return to your rover and press <b>E</b> beside it to reboard.');return;}
 if(stage==='evaReturn'&&distance(eva,pos)<3.5){stage='driveBase';setPrompt('Sample secured in rover. Drive to the research outpost and stop at its parking pad.');return;}
 if(stage==='parkBase'&&hasSample){enterEVA('base');return;}
 if(stage==='evaBase'&&hasSample&&distance(eva,scanner)<3.0){stage='scan';scanProgress=0;setPrompt('UPLOADING ROCK SAMPLE · Spectrometer analyzing lunar mineral composition…');return;}
}
function applyCollision(p,radius,vehicle){
 let impact=false,hitType='';
 const original={...p};
 const disks=[...rocks.map(o=>({x:o.x,z:o.z,r:o.r*.88,kind:'boulder'})),...caveWalls.map(o=>({...o,kind:'cave wall'})),{x:base.x+12,z:base.z+2.1,r:3.35,kind:'habitat'},...[-1,1].map(side=>({x:cave.x+side*5.8,z:cave.z-11.2,r:1.95,kind:'cave arch'}))];
 for(const o of disks){const dx=p.x-o.x,dz=p.z-o.z,dist=Math.hypot(dx,dz),min=radius+o.r;
   if(dist<min){const n=dist>.0001?{x:dx/dist,z:dz/dist}:{x:1,z:0};p.x=o.x+n.x*min;p.z=o.z+n.z*min;impact=true;hitType=o.kind;}
 }
 const boxes=[{x:base.x,z:base.z,halfX:5.1,halfZ:4.15,kind:'research building'},
   ...[-13,13].map(dx=>({x:base.x+dx,z:base.z-6,halfX:3.4,halfZ:1.65,kind:'solar array'})),
   {x:scanner.x,z:scanner.z,halfX:1,halfZ:1,kind:'scanner'},...[-5,5].map(dx=>({x:base.x+dx,z:base.z-9,halfX:.20,halfZ:3.05,kind:'outpost railing'}))];
 for(const o of boxes){const cx=clamp(p.x,o.x-o.halfX,o.x+o.halfX),cz=clamp(p.z,o.z-o.halfZ,o.z+o.halfZ);
   const dx=p.x-cx,dz=p.z-cz,dd=Math.hypot(dx,dz);
   if(dd<radius){if(dd<.0001){const left=Math.abs(p.x-(o.x-o.halfX)),right=Math.abs(p.x-(o.x+o.halfX)),front=Math.abs(p.z-(o.z-o.halfZ)),back=Math.abs(p.z-(o.z+o.halfZ));const m=Math.min(left,right,front,back);if(m===left)p.x=o.x-o.halfX-radius;else if(m===right)p.x=o.x+o.halfX+radius;else if(m===front)p.z=o.z-o.halfZ-radius;else p.z=o.z+o.halfZ+radius;}else{p.x+=dx/dd*(radius-dd);p.z+=dz/dd*(radius-dd);}impact=true;hitType=o.kind;}
 }
 if(vehicle&&impact){if(hitCooldown<=0&&Math.abs(speed)>.55){damage+=clamp((Math.abs(speed)-.3)*5+3,2,24);hitCooldown=.65;impactInfo=`COLLISION · ${hitType.toUpperCase()}`;}speed*=-.10;}
 return impact;
}
function wheelSamples(){
 const samples=[];
 for(const dz of [-1.52,1.52])for(const dx of [-1.36,1.36]){
  const x=pos.x+dx*Math.cos(yaw)+dz*Math.sin(yaw),z=pos.z-dx*Math.sin(yaw)+dz*Math.cos(yaw),ground=height(x,z);
  const mountY=bodyY-.22,groundWheelY=ground+.49;
  const contacting=mountY-groundWheelY<=2.0; // maximum arm extension is exactly 2m
  const centerY=Math.max(groundWheelY,mountY-2.0);
  samples.push({dx,dz,x,z,ground,centerY,contacting,extension:clamp(mountY-centerY,0,2)});
 }
 return samples;
}
function roverDynamics(dt,i){
 hitCooldown-=dt;
 const slopeV=slope(pos.x,pos.z);
 const traction=clamp(.80-.12*difficulty-.25*slopeV,.22,.8);
 const maxA=traction*G;
 const drive=i.throttle*(grounded?maxA:maxA*.12);
 const resistance=.045*(speed?Math.sign(speed):0);
 speed+=dt*(drive-resistance-(i.brake?Math.sign(speed)*Math.min(3*G,Math.abs(speed)/dt):0));
 speed=clamp(speed,-maxSpeed/3.6*.42,maxSpeed/3.6);
 if(!i.throttle&&Math.abs(speed)<.02)speed=0;
 const steering=Math.atan(i.steer*.59),wantedTurn=(speed/3.25)*Math.tan(steering);
 const gripLimit=maxA/Math.max(.42,Math.abs(speed));
 yaw+=clamp(wantedTurn,-gripLimit,gripLimit)*dt*(grounded?1:.10);
 steerVisual=smooth(steerVisual,steering,clamp(dt*7,0,1));
 wheelSpin+=speed*dt/.49;
 const old={...pos};pos.x=clamp(pos.x+Math.sin(yaw)*speed*dt,-220,230);pos.z=clamp(pos.z+Math.cos(yaw)*speed*dt,-220,230);
 applyCollision(pos,1.33,true);
 const wh=wheelSamples(),contacts=wh.filter(w=>w.contacting);
 let front=0,back=0,left=0,right=0;
 for(const w of wh){if(w.dz>0)front+=w.ground;else back+=w.ground;if(w.dx>0)right+=w.ground;else left+=w.ground;}
 pitch=smooth(pitch,clamp(Math.atan2(front-back,6),-.26,.26),clamp(dt*4.3,0,1));
 roll=smooth(roll,clamp(Math.atan2(left-right,5.5),-.20,.20)-steerVisual*speed*.006,clamp(dt*4.3,0,1));
 // First ground contact after airborne motion causes impact damage from velocity plus accumulated drop.
 const nowGrounded=contacts.length>0;
 if(!nowGrounded){if(grounded){airStartY=bodyY;highestAirY=bodyY;airTime=0;}
    airTime+=dt;highestAirY=Math.max(highestAirY,bodyY);
 }else if(!grounded && airTime>.12){
    const impactSpeed=Math.max(0,-vy),fallDistance=Math.max(0,highestAirY-bodyY);
    if(impactSpeed>2.5 || fallDistance>2.3){
      const impactDamage=clamp((Math.max(0,impactSpeed-2.4)**2)*3.8+Math.max(0,fallDistance-2.3)*1.9,0,88);
      damage+=impactDamage;impactInfo=`HARD LANDING · ${fallDistance.toFixed(1)}m DROP · ${impactSpeed.toFixed(1)}m/s`;hitCooldown=Math.max(hitCooldown,1.5);
    }else if(fallDistance>1.0)impactInfo=`SUSPENSION ABSORBED · ${fallDistance.toFixed(1)}m DROP`;
    airTime=0;
 }
 grounded=nowGrounded;
 let spring=0;
 for(const w of contacts){const targetY=w.ground+1.56;spring+=(targetY-bodyY)*6.6 -vy*1.8;}
 // Each contact carries one quarter of the vehicle; spring force is limited to prevent launches.
 spring=clamp(spring,-G*.4,15);
 vy+=((contacts.length?spring:0)-G)*dt;
 bodyY+=vy*dt;
 const mid=height(pos.x,pos.z);
 if(bodyY<mid+.76){const impactSpeed=Math.max(0,-vy);if(impactSpeed>3.2){damage+=clamp((impactSpeed-3.0)**2*5,0,80);impactInfo='CHASSIS IMPACT · LOWER DRIVE SPEED';}bodyY=mid+.76;vy=Math.max(0,-vy*.10);}
 wheelState=wheelSamples();
 const load=145+450*(Math.abs(speed)/(maxSpeed/3.6))+(i.throttle?130:0)+clamp(slopeV*150,0,145);
 battery=Math.max(0,battery-load*dt/3600);
 if(battery<=0)end(false,'The rover ran out of electrical energy. Increase the drive reserve or reduce speed.');
 if(damage>=100)end(false,'Impacts caused critical rover damage. Slow down for rocks, crater rims and large drops.');
}
function update(dt){dt=Math.min(.035,dt);const i=controls();stageTime+=dt;frameTime+=dt;
 if(stage==='landing'){
   const remaining=Math.max(0,20*(1-ease(Math.min(stageTime/5.8,1))));$('roverScenePhase').textContent=`LANDER CAM 01 / ALTITUDE ${remaining.toFixed(1)} m / RATE -${(remaining/5.8).toFixed(1)} m/s`;
   if(stageTime>4.45)$('roverFade').classList.add('black');
   if(stageTime>5.7){stage='blackout';stageTime=0;$('roverCockpit').hidden=true;$('roverScenePhase').textContent='TOUCHDOWN CONFIRMED · PREPARING ROVER';}
 }else if(stage==='blackout'){
   if(stageTime>1.1){stage='driveCave';stageTime=0;bodyY=height(0,0)+3.34;vy=0;grounded=false;airTime=0;highestAirY=bodyY;
    $('roverFade').classList.remove('black');setTimeout(()=>{$('roverScenePhase').hidden=true;},850);}
 }else if(['driveCave','parkCave','driveBase','parkBase'].includes(stage)){
   elapsed+=dt;roverDynamics(dt,i);
   if(stage==='driveCave'&&distance(pos,{x:cave.x,z:cave.z-19})<8&&Math.abs(speed)<.54){stage='parkCave';speed=0;setPrompt('CAVE APPROACH SECURED · Press <b>E</b> to exit rover. Enter the cave and collect the highlighted rock sample.');}
   if(stage==='parkCave'&&distance(pos,{x:cave.x,z:cave.z-19})>10){stage='driveCave';$('roverInteraction').hidden=true;}
   if(stage==='driveBase'&&distance(pos,{x:base.x-3,z:base.z-13})<8&&Math.abs(speed)<.54){stage='parkBase';speed=0;setPrompt('OUTPOST PARKED · Sample aboard. Press <b>E</b> to disembark and deliver it to the illuminated scanner.');}
   if(stage==='parkBase'&&distance(pos,{x:base.x-3,z:base.z-13})>11){stage='driveBase';$('roverInteraction').hidden=true;}
 }else if(['evaCave','evaReturn','evaBase'].includes(stage)){
   elapsed+=dt;
   eva.yaw+=i.steer*dt*1.8;
   const walk=i.throttle*2.15*dt;
   const next={x:clamp(eva.x+Math.sin(eva.yaw)*walk,-240,240),z:clamp(eva.z+Math.cos(eva.yaw)*walk,-240,240)};
   applyCollision(next,.42,false);eva.x=next.x;eva.z=next.z;
   if(stage==='evaCave'){const d=distance(eva,sample);setPrompt(d<3.4?'MINERAL SAMPLE IN RANGE · Press <b>E</b> to collect the rock.':`CAVE EVA · Follow the lit sample marker (${Math.round(d)} m). WASD / arrows to walk.`);}
   if(stage==='evaReturn'){const d=distance(eva,pos);setPrompt(d<3.5?'ROVER REACHED · Press <b>E</b> to board, then drive to the base.':`SAMPLE SECURED ✓ · Return to your rover (${Math.round(d)} m).`);}
   if(stage==='evaBase'){const d=distance(eva,scanner);setPrompt(d<3?'SCANNER REACHED · Press <b>E</b> to upload your collected sample.':`OUTPOST EVA · Walk to the illuminated scanner (${Math.round(d)} m).`);}
 }else if(stage==='scan'){
   scanProgress+=dt;$('roverInteraction').textContent=`MINERAL ANALYSIS AND DATA UPLOAD · ${Math.round(clamp(scanProgress/3.5,0,1)*100)}% complete`;
   if(scanProgress>=3.5)end(true);
 }
 updateHUD();
}
function updateHUD(){
 $('gameSpeed').innerHTML=`${(Math.abs(speed)*3.6).toFixed(1)} <em>km/h</em>`;
 $('gameBattery').innerHTML=`${Math.max(0,Math.round(100*battery/Math.max(1,startBattery)))}<em>%</em>`;
 $('gameHull').innerHTML=`${Math.max(0,Math.round(100-damage))}<em>%</em>`;
 $('gameTimer').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;
 const p=stage.startsWith('eva')||stage==='scan'?eva:pos;
 const target=missionTarget(),d=distance(p,target),toward=Math.atan2(target.x-p.x,target.z-p.z),angle=((toward-(stage.startsWith('eva')?eva.yaw:yaw))*180/PI+540)%360-180;
 $('roverGpsDist').textContent=`${Math.round(d)} m`;
 $('roverGpsBearing').textContent=Math.abs(angle)<8?'STRAIGHT AHEAD':`${angle<0?'LEFT':'RIGHT'} ${Math.abs(angle).toFixed(0)}°`;
 if($('roverGpsTarget'))$('roverGpsTarget').textContent=missionTargetName();
 if($('roverObjective'))$('roverObjective').textContent=missionObjective();
 if($('roverSampleTag')){$('roverSampleTag').textContent=hasSample?'ROCK SAMPLE: SECURED':'ROCK SAMPLE: NOT COLLECTED';$('roverSampleTag').classList.toggle('collected',hasSample);}
 if($('roverImpactInfo')){$('roverImpactInfo').textContent=impactInfo;}
}
function missionTarget(){
 if(['preview','landing','blackout','driveCave','parkCave'].includes(stage))return {x:cave.x,z:cave.z-19};
 if(stage==='evaCave')return sample;
 if(stage==='evaReturn')return pos;
 if(stage==='driveBase'||stage==='parkBase')return {x:base.x-3,z:base.z-13};
 return scanner;
}
function missionTargetName(){
 if(['preview','landing','blackout','driveCave','parkCave'].includes(stage))return 'CAVE ENTRANCE';
 if(stage==='evaCave')return 'MINERAL SAMPLE';
 if(stage==='evaReturn')return 'RETURN TO ROVER';
 if(stage==='driveBase'||stage==='parkBase')return 'RESEARCH OUTPOST';
 return 'SAMPLE SCANNER';
}
function missionObjective(){
 const names={preview:'01 / APPROACH CAVE',landing:'DESCENT · PREPARE FOR TOUCHDOWN',blackout:'TOUCHDOWN · SYSTEM CHECK',driveCave:'01 / DRIVE TO CAVE',parkCave:'02 / EXIT ROVER AT CAVE',evaCave:'03 / COLLECT A ROCK SAMPLE',evaReturn:'04 / RETURN TO ROVER',driveBase:'05 / DRIVE TO RESEARCH BASE',parkBase:'06 / EXIT ROVER AT BASE',evaBase:'07 / UPLOAD SAMPLE AT SCANNER',scan:'DATA UPLOAD IN PROGRESS',completed:'MISSION COMPLETE',failed:'MISSION FAILED'};
 return names[stage]||'FOLLOW MISSION GPS';
}
function paintMinimap(){
 const w=204,h=146;mini.clearRect(0,0,w,h);mini.fillStyle='#09151c';mini.fillRect(0,0,w,h);
 const origin=[49,118],sc=.56,P=(x,z)=>[origin[0]+x*sc,origin[1]-z*sc];
 mini.strokeStyle='#8cdac327';for(let k=-4;k<6;k++){mini.beginPath();mini.moveTo(k*30,0);mini.lineTo(k*30,146);mini.stroke();}
 const s=siteState(),a=s.a||100,b=s.b||75,orient=(s.orientation||30)*PI/180;
 mini.beginPath();for(let i=0;i<=70;i++){const t=i/70*TAU,u=a*Math.cos(t),v=b*Math.sin(t),pt=P(u*Math.cos(orient)-v*Math.sin(orient),u*Math.sin(orient)+v*Math.cos(orient));i?mini.lineTo(...pt):mini.moveTo(...pt);}mini.setLineDash([4,3]);mini.strokeStyle='#83ddbe6b';mini.stroke();mini.setLineDash([]);
 for(const ob of obstacles){const [x,y]=P(ob.x,ob.z);if(x<-5||x>209||y<-5||y>151)continue;mini.fillStyle=ob.type==='crater'?'#9a796a':'#a8aba9';mini.beginPath();mini.arc(x,y,clamp(ob.r*.3,.8,4),0,TAU);mini.fill();}
 for(const ob of caveWalls){const [x,y]=P(ob.x,ob.z);mini.fillStyle='#a18574';mini.beginPath();mini.arc(x,y,2.1,0,TAU);mini.fill();}
 const [cx,cy]=P(cave.x,cave.z),[bx,by]=P(base.x,base.z),[sx,sy]=P(sample.x,sample.z);
 mini.fillStyle='#ffbc70';mini.fillRect(cx-3,cy-3,6,6);mini.fillStyle='#8cebd1';mini.fillRect(bx-4,by-4,8,8);
 if(!hasSample){mini.fillStyle='#ffda8d';mini.beginPath();mini.arc(sx,sy,2,0,TAU);mini.fill();}
 const t=missionTarget(),[tx,ty]=P(t.x,t.z);mini.strokeStyle='#f8da87';mini.lineWidth=2;mini.beginPath();mini.arc(tx,ty,7,0,TAU);mini.stroke();mini.lineWidth=1;
 const p=stage.startsWith('eva')||stage==='scan'?eva:pos,[px,py]=P(p.x,p.z);mini.save();mini.translate(px,py);mini.rotate(stage.startsWith('eva')?eva.yaw:yaw);mini.fillStyle='#fff';mini.beginPath();mini.moveTo(0,-8);mini.lineTo(-5,6);mini.lineTo(5,6);mini.closePath();mini.fill();mini.restore();
}
const surfaceDraw=[0,0,0];
const caveMeshes={wall:ball(1.0,13,9,[.26,.255,.24],1,8),detail:ball(1,10,8,[.37,.35,.32],1,3),sample:ball(.66,12,9,[.94,.68,.32],3,2),accent:cylinder(.10,1.2,12,colors.gold,3),roof:ball(1,13,9,[.29,.29,.27],1,5)};
function drawStatic(){
 terrainMesh?.draw(I());
 for(let k=0;k<rocks.length;k++){
   const r=rocks[k];if(Math.hypot(r.x-pos.x,r.z-pos.z)>145)continue;
   const mesh=rockMeshCache[k%rockMeshCache.length],p=[r.x,height(r.x,r.z)+r.r*.27,r.z],m=mul(trans(...p),mul(rotY(r.angle),mul(rotX(.19*Math.sin(r.offset)),rotZ(.14*Math.cos(r.angle)))));
   mesh.draw(mul(m,[r.r,0,0,0,0,r.r*.76,0,0,0,0,r.r*.96,0,0,0,0,1]));
 }
 for(let k=0;k<caveWalls.length;k++){
   const o=caveWalls[k],g=height(o.x,o.z),m=mul(trans(o.x,g+o.h*.40,o.z),rotY(k*.71));
   caveMeshes.wall.draw(mul(m,[o.r*1.0,0,0,0,0,o.h*.72,0,0,0,0,o.r*.86,0,0,0,0,1]));
   if(k%3===0)caveMeshes.detail.draw(mul(trans(o.x+.7,g+o.h*.91,o.z-.6),[o.r*.68,0,0,0,0,o.h*.28,0,0,0,0,o.r*.54,0,0,0,0,1]));
 }
 // Arch around cave mouth; the raised crosspiece helps identify the entrance.
 const y=height(cave.x,cave.z-12);
 for(const side of [-1,1])caveMeshes.wall.draw(mul(trans(cave.x+side*5.8,y+3.1,cave.z-11.2),[1.9,0,0,0,0,3.1,0,0,0,0,2.4,0,0,0,0,1]));
 caveMeshes.roof.draw(mul(trans(cave.x,y+7.2,cave.z-11.2),[7.0,0,0,0,0,1.8,0,0,0,0,2.5,0,0,0,0,1]));
 if(!hasSample){const sy=height(sample.x,sample.z);const bob=.12*Math.sin(frameTime*2.4);
   part(caveMeshes.sample,[sample.x,sy+.85+bob,sample.z],frameTime*.42);
   part(caveMeshes.accent,[sample.x,sy+.22,sample.z]);
 }
}
function part(mesh,p,ry=0,rx=0,rz=0){mesh.draw(model(p,ry,rx,rz));}
function drawVerticalRod(mesh,a,b,baseLength=1){
 const len=clamp(Math.abs(a[1]-b[1]),.03,2.0),center=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
 mesh.draw(mul(trans(...center),[1,0,0,0,0,len/baseLength,0,0,0,0,1,0,0,0,0,1]));
}
function drawRover(){
 const center=[pos.x,bodyY,pos.z],bodyM=model(center,yaw,pitch,roll);
 const bodyPart=(mesh,local)=>mesh.draw(mul(bodyM,trans(...local)));
 bodyPart(roverMeshes.bottom,[0,-.48,0]);bodyPart(roverMeshes.chassis,[0,-.17,0]);bodyPart(roverMeshes.cab,[0,.52,-.15]);bodyPart(roverMeshes.hood,[0,.68,1.22]);bodyPart(roverMeshes.panel,[0,1.12,-.38]);
 bodyPart(roverMeshes.bar,[-.97,.41,0]);bodyPart(roverMeshes.bar,[.97,.41,0]);
 bodyPart(roverMeshes.antenna,[.84,1.8,-1.03]);bodyPart(roverMeshes.camera,[0,1.44,1.05]);
 const wheels=wheelSamples();
 for(const w of wheels){
   const wx=w.x,wz=w.z,wy=w.centerY,steer=w.dz>0?steerVisual:0;
   const wm=mul(trans(wx,wy,wz),mul(rotY(yaw+steer),rotX(wheelSpin)));
   roverMeshes.wheel.draw(wm);roverMeshes.rim.draw(wm);roverMeshes.hub.draw(wm);
   // Twelve tread lugs around the axle; animated by the actual rolling angle.
   for(let n=0;n<12;n++){const t=n*TAU/12,r=.50,local=mul(trans(0,r*Math.cos(t),r*Math.sin(t)),rotX(-t));roverMeshes.lug.draw(mul(wm,local));}
   const mount={x:pos.x+w.dx*Math.cos(yaw)+w.dz*Math.sin(yaw),z:pos.z-w.dx*Math.sin(yaw)+w.dz*Math.cos(yaw)};
   const pivot=[mount.x,bodyY-.22,mount.z],hub=[wx,wy,wz];
   // If airborne, the wheel hangs at most 2m below the chassis mount. It never stretches to distant terrain.
   drawVerticalRod(roverMeshes.suspension,pivot,hub,1);
   const shockEnd=[wx,Math.min(pivot[1]-.1,wy+.48),wz];drawVerticalRod(roverMeshes.shock,pivot,shockEnd,1);
 }
 bodyPart(roverMeshes.light,[-.86,.44,1.85]);bodyPart(roverMeshes.light,[.86,.44,1.85]);
}
function drawOutpost(){
 const y=height(base.x,base.z);
 part(stationMeshes.pad,[base.x,y-.16,base.z]);part(stationMeshes.building,[base.x,y+2.0,base.z]);part(stationMeshes.roof,[base.x,y+3.8,base.z]);
 part(stationMeshes.door,[base.x-2,y+1.46,base.z-4.03]);part(stationMeshes.window,[base.x+1.8,y+2.1,base.z-4.08]);
 part(stationMeshes.dome,[base.x+12,y+2.0,base.z+2.1]);
 for(const dx of [-13,13]){
   part(stationMeshes.solar,[base.x+dx,y+1.8,base.z-6],.12,PI/5);part(stationMeshes.strut,[base.x+dx,y+.6,base.z-6]);
   part(stationMeshes.crate,[base.x+dx*.45,y+.7,base.z+7]);
 }
 part(stationMeshes.strut,[base.x+2,y+5.4,base.z+2]);part(stationMeshes.beacon,[base.x+2,y+7.1,base.z+2]);
 // Scanner and radio dish: separate, visibly actionable equipment outside the building.
 const sy=height(scanner.x,scanner.z);
 part(stationMeshes.scanner,[scanner.x,sy+.67,scanner.z]);part(stationMeshes.screen,[scanner.x,sy+1.25,scanner.z-.81]);
 if(hasSample)part(stationMeshes.beacon,[scanner.x,sy+1.82,scanner.z]);
 const dy=height(base.x+9,base.z+8);
 part(stationMeshes.strut,[base.x+9,dy+1.75,base.z+8]);part(stationMeshes.dish,[base.x+9,dy+3.55,base.z+8],.35,PI/4);
 for(let i=0;i<2;i++)part(stationMeshes.rail,[base.x-5+i*10,y+.58,base.z-9]);
 part(stationMeshes.flag,[base.x-2,y+4.2,base.z-4.1]);
}
function drawLander(){const x=-12,z=-20,y=height(x,z);part(landerMeshes.core,[x,y+4.5,z]);part(landerMeshes.top,[x,y+8,z]);part(landerMeshes.window,[x,y+5.0,z-2.39]);
 for(const dx of [-3.1,3.1])for(const dz of [-3.1,3.1]){part(landerMeshes.leg,[x+dx*.73,y+2.1,z+dz*.73],Math.atan2(dx,dz),.44);part(landerMeshes.foot,[x+dx,y+.15,z+dz]);}
}
function drawScene(){
 const width=canvas.clientWidth,heightPx=canvas.clientHeight,dpr=Math.min(1.5,window.devicePixelRatio||1),nw=Math.round(width*dpr),nh=Math.round(heightPx*dpr);
 if(canvas.width!==nw||canvas.height!==nh){canvas.width=nw;canvas.height=nh;}gl.viewport(0,0,nw,nh);
 const fov=1.06;
 let target,desired;
 if(stage==='landing'||stage==='blackout'){
   const t=clamp(stage==='blackout'?1:stageTime/5.8,0,1),alt=20*(1-ease(t))+2.6;
   const x=-12,z=-20;
   desired=[x+.26*Math.sin(t*12),height(x,z)+alt,z];target=[x+Math.sin(.62)*65,height(x,z)+1.4,z+Math.cos(.62)*65];
 }else if(stage.startsWith('eva')||stage==='scan'){
   const objective=missionTarget();const t=stage==='scan'?Math.atan2(objective.x-eva.x,objective.z-eva.z):eva.yaw;
   const ground=height(eva.x,eva.z);desired=[eva.x,ground+1.71+.025*Math.sin(elapsed*8),eva.z];target=[eva.x+Math.sin(t)*20,ground+1.68,eva.z+Math.cos(t)*20];
 }else{
   camYaw+=Math.atan2(Math.sin(yaw+orbitOffset-camYaw),Math.cos(yaw+orbitOffset-camYaw))*clamp(frameTime*.06,.035,.12);
   const dir=[Math.sin(camYaw),Math.cos(camYaw)];
   desired=[pos.x-dir[0]*camDist+Math.cos(camYaw)*steerVisual*.4,bodyY+3.1+camDist*Math.sin(orbitPitch)*.40,pos.z-dir[1]*camDist-Math.sin(camYaw)*steerVisual*.4];
   target=[pos.x+Math.sin(yaw)*4,bodyY+.30,pos.z+Math.cos(yaw)*4];
 }
 const blend=(stage==='landing'||stage==='blackout'||stage.startsWith('eva')||stage==='scan')?.24:clamp(frameTime*.11,.045,.16);
 camPos=plus(scale(camPos,1-blend),scale(desired,blend));camTarget=plus(scale(camTarget,1-blend),scale(target,blend));cameraEye=camPos;
 viewProj=mul(perspective(fov,nw/nh,.15,1150),lookAt(camPos,camTarget));
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(prog);gl.uniformMatrix4fv(loc.vp,false,new Float32Array(viewProj));gl.uniform3f(loc.sun,-.78,.32,-.47);gl.uniform3f(loc.eye,...cameraEye);gl.uniform1f(loc.time,frameTime);
 drawStatic();drawOutpost();drawLander();if(stage!=='landing'&&stage!=='blackout')drawRover();
}
function frame(ts){let dt=prevTs?Math.min(.034,(ts-prevTs)/1000):.016;prevTs=ts;
 if(document.hidden){raf=requestAnimationFrame(frame);return;}
 const visible=document.querySelector('#page5.page.active');
 if(!visible){raf=0;prevTs=0;return;}
 if(!['preview','completed','failed'].includes(stage))update(dt);
 drawScene();paintMinimap();raf=requestAnimationFrame(frame);
}
function ensureLoop(){if(!raf){prevTs=0;raf=requestAnimationFrame(frame)}}
function startAudio(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();notes=[];for(let f of [73.42,110,164.81,220]){let o=audioCtx.createOscillator(),gn=audioCtx.createGain();o.type='sine';o.frequency.value=f;gn.gain.value=.0024;o.connect(gn).connect(audioCtx.destination);o.start();notes.push(o);}musicOn=true;}catch{musicOn=false;}}
function stopAudio(){notes.forEach(o=>{try{o.stop();o.disconnect()}catch{}});notes=[];musicOn=false;}
function toggleAudio(){musicOn?stopAudio():startAudio();$('roverMusic').textContent='♫ Ambient audio: '+(musicOn?'ON':'OFF');}
function bind(){
 $('roverStart').onclick=start;$('roverRestart').onclick=start;$('roverRetry').onclick=start;$('roverReset').onclick=()=>reset(true);
 $('roverMusic').onclick=toggleAudio;$('roverWinMusic').onclick=toggleAudio;
 if($('roverTouchInteract'))$('roverTouchInteract').onclick=interaction;
 $('roverMaxSpeed').oninput=e=>{maxSpeed=+e.target.value;$('roverMaxSpeedRead').textContent=maxSpeed+' km/h';};
 $('roverBatterySet').oninput=e=>{$('roverBatteryRead').textContent=e.target.value+' Wh';if(stage==='preview')reset(true);};
 $('roverDifficulty').oninput=e=>{difficulty=+e.target.value;$('roverDifficultyRead').textContent=['Survey mode','Mission standard','Hazard challenge'][difficulty];if(stage==='preview')reset(true);};
 document.addEventListener('keydown',e=>{
   if(!document.querySelector('#page5.page.active'))return;
   if(['KeyW','KeyS','KeyA','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','KeyR','KeyC'].includes(e.code)){
      if((stage.startsWith('drive')||stage.startsWith('park')||stage.startsWith('eva'))&&e.code!=='KeyE')e.preventDefault();held.add(e.code);
      if(e.code==='KeyE'&&!e.repeat)interaction();
      if(e.code==='KeyR'&&!e.repeat)reset(true);
      if(e.code==='KeyC'&&!e.repeat)orbitOffset=0;
   }
 });
 document.addEventListener('keyup',e=>held.delete(e.code));window.addEventListener('blur',()=>{held.clear();touch.clear();});
 document.querySelectorAll('[data-drive]').forEach(b=>{let k=b.dataset.drive;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(k);});['pointerup','pointercancel','lostpointercapture'].forEach(t=>b.addEventListener(t,()=>touch.delete(k)));});
 // Camera can orbit independently: drag to look around, wheel to dolly in/out.
 let pointer=null;
 canvas.addEventListener('pointerdown',e=>{if(stage==='landing')return;pointer={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;orbitOffset=clamp(orbitOffset+(e.clientX-pointer.x)*.004,-1.5,1.5);orbitPitch=clamp(orbitPitch+(e.clientY-pointer.y)*.003,-.08,.85);pointer.x=e.clientX;pointer.y=e.clientY;});
 ['pointerup','pointercancel','lostpointercapture'].forEach(t=>canvas.addEventListener(t,()=>{pointer=null}));
 canvas.addEventListener('wheel',e=>{if(!document.querySelector('#page5.page.active'))return;e.preventDefault();camDist=clamp(camDist+Math.sign(e.deltaY)*1.2,6.5,26);},{passive:false});
 $('roverWinMusic').onclick=toggleAudio;
 const observe=new MutationObserver(()=>{if(document.querySelector('#page5.page.active')){if(seed!==currentSeed())reset(true);ensureLoop();}});observe.observe($('page5'),{attributes:true,attributeFilter:['class']});
 window.__surfaceGameV11={start,reset,interaction,getState:()=>({stage,pos:{...pos},yaw,speed,bodyY,vy,battery,hull:100-damage,elapsed,grounded,airTime,impactInfo,hasSample,cave:{...cave},base:{...base},sample:{...sample},scanner:{...scanner},wheelState:wheelSamples().map(w=>({extension:w.extension,contacting:w.contacting,centerY:w.centerY})),craters:craters.length,rocks:rocks.length,caveWalls:caveWalls.length,win,lost}),getGravity:()=>G,
   // These test hooks intentionally never send information outside the browser.
   testDrop:(metres=6)=>{bodyY=height(pos.x,pos.z)+1.56+metres;vy=0;grounded=false;airStartY=bodyY;highestAirY=bodyY;airTime=.15;ensureLoop();},
   testTeleport:(x,z)=>{pos={x,z};speed=0;bodyY=height(x,z)+1.55;vy=0;grounded=true;ensureLoop();},
   testWalk:(x,z)=>{eva.x=x;eva.z=z;ensureLoop();},
   testStage:(name)=>{if(['driveCave','parkCave','evaCave','evaReturn','driveBase','parkBase','evaBase'].includes(name)){stage=name;ensureLoop();}},
   testCollect:()=>{hasSample=true;stage='evaReturn';ensureLoop();},
   testRockPositions:()=>rocks.slice(0,8).map(r=>({x:r.x,z:r.z,r:r.r})),
   testCollision:(x,z,r=1.33)=>{const p={x,z};return {blocked:applyCollision(p,r,false),resolved:p};}
 };
 reset(true);if(document.querySelector('#page5.page.active'))ensureLoop();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
