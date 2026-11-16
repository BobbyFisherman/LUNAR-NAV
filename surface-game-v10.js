/* LUNAR / NAV Surface Expedition v10 — original local-only WebGL terrain game.
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
function cylinder(rad,length,sides,col,mat=2,axis='y'){let d=[];const orient=(x,y,z)=>axis==='x'?[z,x,y]:[x,y,z];for(let k=0;k<sides;k++){let t=k*TAU/sides,u=(k+1)*TAU/sides,a=orient(rad*Math.cos(t),-length/2,rad*Math.sin(t)),b=orient(rad*Math.cos(u),-length/2,rad*Math.sin(u)),c=orient(rad*Math.cos(u),length/2,rad*Math.sin(u)),e=orient(rad*Math.cos(t),length/2,rad*Math.sin(t));quad(d,a,b,c,e,col,mat);face(d,orient(0,length/2,0),c,e,col,mat);face(d,orient(0,-length/2,0),a,b,col,mat);}return new Mesh(d);}
function ball(radius,sides,rings,col,mat=1,seedOffset=0){let d=[];const point=(t,p)=>{const irregular=1+.085*Math.sin(t*5+seedOffset)*Math.sin(p*4+seedOffset)+.05*Math.cos(t*11-p*7);return [radius*irregular*Math.sin(p)*Math.cos(t),radius*irregular*Math.cos(p),radius*irregular*Math.sin(p)*Math.sin(t)];};for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){let a=point(TAU*i/sides,PI*j/rings),b=point(TAU*(i+1)/sides,PI*j/rings),c=point(TAU*(i+1)/sides,PI*(j+1)/rings),e=point(TAU*i/sides,PI*(j+1)/rings);face(d,a,b,c,col,mat);face(d,a,c,e,col,mat);}return new Mesh(d);}
const colors={dust:[.51,.51,.48],rock:[.51,.52,.51],wheel:[.095,.105,.123],hub:[.57,.63,.66],frame:[.45,.53,.57],white:[.79,.82,.79],window:[.12,.30,.39],gold:[.69,.51,.24],solar:[.055,.19,.35],green:[.27,.85,.66],black:[.06,.08,.11]};
const roverMeshes={chassis:box(2.55,.58,3.8,colors.white),bottom:box(2.76,.23,3.9,colors.frame),cab:box(1.90,.65,2.2,colors.window,4),hood:box(2.4,.23,2.0,colors.frame),panel:box(3.0,.12,2.1,colors.solar,4),bar:box(.10,.10,2.8,colors.hub,3),wheel:cylinder(.49,.40,24,colors.wheel,4,'x'),hub:cylinder(.28,.44,16,colors.hub,3,'x'),axle:cylinder(.105,3.0,10,colors.frame,3,'x'),light:ball(.18,10,7,[.76,.88,.78],3)};
const stationMeshes={building:box(10,3.4,8,colors.white),window:box(3.4,1.55,.13,colors.window,4),roof:box(11.2,.27,8.8,colors.frame),door:box(1.8,2.65,.20,[.16,.30,.31],4),solar:box(6.5,.14,3.0,colors.solar,4),strut:cylinder(.09,3.5,10,colors.hub,3),dome:ball(3.2,26,12,colors.white),beacon:ball(.39,12,9,colors.green,3),pad:cylinder(9,.20,44,[.27,.30,.32],1)};
const landerMeshes={core:cylinder(2.4,4.6,12,[.67,.68,.66],3),top:cylinder(2.0,1.8,12,[.78,.74,.66],3),leg:cylinder(.12,5.3,10,[.60,.64,.64],3),foot:cylinder(.48,.18,16,[.54,.55,.52],3),window:box(1.0,1.1,.12,colors.window,4)};
const catalog=[];let terrainMesh=null;let seed=271828,obstacles=[],craters=[],mountains=[],rocks=[],base={x:118,z:99},pos={x:0,z:0},yaw=.37,speed=0,bodyY=0,vy=0,pitch=0,roll=0,steerVisual=0,wheelSpin=0,battery=80,startBattery=80,damage=0,elapsed=0,maxSpeed=12,difficulty=1,hitCooldown=0,stage='preview',stageTime=0,missionEnded=false;
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
 const random=seeded();craters=[];mountains=[];rocks=[];obstacles=[];
 // Elongated highlands, scarps and gentle hills: different shape/size per site.
 for(let k=0;k<19+difficulty*4;k++){
   let x=(random()-.48)*570,z=(random()-.44)*530;
   if(Math.hypot(x,z)<26||Math.hypot(x-base.x,z-base.z)<25)continue;
   mountains.push({x,z,h:4+random()*19,w:16+random()*42,l:14+random()*78,a:random()*TAU});
 }
 for(let k=0;k<31+difficulty*11;k++){
   let a=TAU*random(),r=Math.sqrt(random())*1.28,major=(s.a||100),minor=(s.b||75),ori=(s.orientation||30)*PI/180;
   let u=r*major*Math.cos(a),v=r*minor*Math.sin(a);
   let x=u*Math.cos(ori)-v*Math.sin(ori),z=u*Math.sin(ori)+v*Math.cos(ori);
   if(k>14){x=(random()-.40)*345;z=(random()-.26)*340;}
   if(Math.hypot(x,z)<17||Math.hypot(x-base.x,z-base.z)<22)continue;
   let rad=4+random()*18;
   craters.push({x,z,r:rad,depth:1.2+random()*rad*.42,rim:.65+random()*rad*.24,a:random()*TAU});
   obstacles.push({type:'crater',x,z,r:rad});
 }
 for(let k=0;k<85+difficulty*38;k++){
   let x=(random()-.45)*385,z=(random()-.34)*420;
   if(Math.hypot(x,z)<15||Math.hypot(x-base.x,z-base.z)<20)continue;
   let r=.55+Math.pow(random(),2.5)*3.8;
   if(r>.95)obstacles.push({type:'rock',x,z,r});
   rocks.push({x,z,r,angle:random()*TAU,offset:random()*22,color:.40+random()*.21});
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
function reset(overlay=true){rebuildWorld();pos={x:0,z:0};yaw=.37;speed=0;bodyY=height(0,0)+3.5;vy=0;pitch=0;roll=0;steerVisual=0;wheelSpin=0;damage=0;elapsed=0;hitCooldown=0;stage='preview';stageTime=0;win=false;lost=false;missionEnded=false;held.clear();touch.clear();
 startBattery=Number($('roverBatterySet').value);battery=startBattery;
 camPos=[-6,7,-14];camTarget=[0,1,0];camYaw=yaw;
 $('roverStartOverlay').hidden=!overlay;$('roverWinOverlay').hidden=true;$('roverFailOverlay').hidden=true;
 $('roverInteraction').hidden=true;$('roverFade').classList.remove('black');$('roverScenePhase').hidden=true;$('roverCockpit').hidden=true;
 updateHUD();drawScene();paintMinimap();
}
function start(){reset(false);stage='landing';stageTime=0;$('roverScenePhase').hidden=false;$('roverCockpit').hidden=false;canvas.focus({preventScroll:true});ensureLoop();}
const key=k=>held.has(k)||touch.has(k);
function controls(){return {throttle:(key('KeyW')||key('ArrowUp')||key('forward')?1:0)-(key('KeyS')||key('ArrowDown')||key('back')?1:0),steer:(key('KeyD')||key('ArrowRight')||key('right')?1:0)-(key('KeyA')||key('ArrowLeft')||key('left')?1:0),brake:key('Space')||key('brake')};}
function end(success,reason=''){
 stage=success?'completed':'failed';missionEnded=true;win=success;lost=!success;
 if(success){$('roverWinReport').textContent=`Traverse complete. Research sample archived in ${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')} with ${Math.round(battery/startBattery*100)}% remaining drive energy and ${Math.round(100-damage)}% hull integrity. The data is queued for transmission to Earth.`;$('roverWinOverlay').hidden=false;}
 else{$('roverFailReport').textContent=reason||'Critical rover system failure. Reconfigure and retry.';$('roverFailOverlay').hidden=false;}
 $('roverInteraction').hidden=true;
}
let eva={x:0,z:0,yaw:.3},scanProgress=0;
function enterEVA(){stage='eva';stageTime=0;eva={x:pos.x+1.9,z:pos.z,yaw:yaw};$('roverInteraction').hidden=false;$('roverInteraction').innerHTML='EVA ACTIVE · Walk to the research station using WASD / arrows. Press <b>E</b> at the terminal to analyze the sample.';}
function interaction(){if(stage==='parked')enterEVA();else if(stage==='eva'&&Math.hypot(eva.x-(base.x-2),eva.z-(base.z-5.6))<4){stage='scan';scanProgress=0;$('roverInteraction').innerHTML='SCIENCE ANALYSIS · Spectrometer collecting surface composition data…';}}
function update(dt){dt=Math.min(.035,dt);const i=controls();stageTime+=dt;frameTime+=dt;
 if(stage==='landing'){
   const remaining=Math.max(0,20*(1-ease(Math.min(stageTime/5.8,1))));$('roverScenePhase').textContent=`LANDER CAM 01  /  ALTITUDE ${remaining.toFixed(1)} m  /  RATE -${(remaining/5.8).toFixed(1)} m/s`;
   if(stageTime>4.45)$('roverFade').classList.add('black');
   if(stageTime>5.7){stage='blackout';stageTime=0;$('roverCockpit').hidden=true;$('roverScenePhase').textContent='TOUCHDOWN CONFIRMED · INITIALIZING SURFACE SYSTEMS';}
 }else if(stage==='blackout'){
   if(stageTime>1.1){stage='drive';stageTime=0;bodyY=height(0,0)+3.40;vy=0;$('roverFade').classList.remove('black');setTimeout(()=>{$('roverScenePhase').hidden=true;},850);}
 }else if(stage==='drive'||stage==='parked'){
   elapsed+=dt;hitCooldown-=dt;
   const slopeV=slope(pos.x,pos.z);
   const traction=clamp(.76-.13*difficulty-.24*slopeV,.22,.76);
   const maxA=traction*G;
   const drive=i.throttle*maxA;
   const rollDrag=.045*(speed?Math.sign(speed):0);
   speed+=dt*(drive-rollDrag-(i.brake?Math.sign(speed)*Math.min(3*G,Math.abs(speed)/dt):0));
   speed=clamp(speed,-maxSpeed/3.6*.42,maxSpeed/3.6);
   if(!i.throttle&&Math.abs(speed)<.02)speed=0;
   const steering=Math.atan(i.steer*.59),wantedTurn=(speed/3.25)*Math.tan(steering);
   const gripLimit=maxA/Math.max(0.42,Math.abs(speed));
   yaw+=clamp(wantedTurn,-gripLimit,gripLimit)*dt;
   steerVisual=smooth(steerVisual,steering,Math.min(1,dt*5));
   wheelSpin+=speed*dt/.49;
   pos.x=clamp(pos.x+Math.sin(yaw)*speed*dt,-220,230);pos.z=clamp(pos.z+Math.cos(yaw)*speed*dt,-220,230);
   // Four individually sampled tire contacts, pitch/roll from elevation differences, spring/damper vertical response.
   let wh=[],front=0,back=0,left=0,right=0;
   for(const z of [-1.5,1.5])for(const x of [-1.38,1.38]){
     const wx=pos.x+x*Math.cos(yaw)+z*Math.sin(yaw),wz=pos.z-x*Math.sin(yaw)+z*Math.cos(yaw),hh=height(wx,wz);wh.push(hh);
     if(z>0)front+=hh;else back+=hh;if(x>0)right+=hh;else left+=hh;
   }
   pitch=smooth(pitch,clamp(Math.atan2(front-back,6),-.24,.24),dt*4.8);
   roll=smooth(roll,clamp(Math.atan2(left-right,5.5),-.19,.19)-steerVisual*speed*.006,dt*4.8);
   const avg=wh.reduce((a,b)=>a+b,0)/4,rest=1.56;
   const spring=Math.max(0,(avg+rest-bodyY)*22-vy*6.7);
   vy+=(spring-G)*dt;bodyY+=vy*dt;
   if(bodyY<avg+.78){bodyY=avg+.78;vy=Math.max(0,-vy*.14);}
   for(const r of rocks)if(r.r>1.05){const d=Math.hypot(pos.x-r.x,pos.z-r.z),min=r.r*.87+1.23;
     if(d<min){const nx=(pos.x-r.x)/(d||1),nz=(pos.z-r.z)/(d||1);pos.x=r.x+nx*min;pos.z=r.z+nz*min;
       if(hitCooldown<=0&&Math.abs(speed)>.55){damage+=clamp(3+Math.abs(speed)*5,4,28);hitCooldown=.6;}
       speed*=-.16;}
   }
   // Losses increase with roughness and throttle: illustrative rover electrical load, not NASA vehicle specifications.
   const load=145+450*(Math.abs(speed)/(maxSpeed/3.6))+(i.throttle?130:0)+clamp(slopeV*150,0,145);
   battery=Math.max(0,battery-load*dt/3600);
   if(battery<=0){end(false,'Electrical drive reserve depleted before reaching the outpost. Increase the power budget or use a safer route.');}
   if(damage>=100){end(false,'Multiple boulder impacts damaged the rover. Try avoiding hazardous terrain and reducing speed.');}
   if(Math.hypot(pos.x-base.x,pos.z-base.z)<11&&Math.abs(speed)<.60){stage='parked';speed=0;$('roverInteraction').hidden=false;$('roverInteraction').innerHTML='RESEARCH BASE REACHED · Press <b>E</b> to exit the rover and begin EVA science collection.';}
   if(stage==='parked'&&i.throttle!==0&&Math.hypot(pos.x-base.x,pos.z-base.z)>11){stage='drive';$('roverInteraction').hidden=true;}
 }else if(stage==='eva'){
   elapsed+=dt;
   // Walking mode intentionally uses the same keys, with reduced Moon gravity affecting vertical gait, not joystick response.
   eva.yaw+=i.steer*dt*1.5;
   const walk=i.throttle*1.35*dt;
   eva.x=clamp(eva.x+Math.sin(eva.yaw)*walk,-240,240);eva.z=clamp(eva.z+Math.cos(eva.yaw)*walk,-240,240);
   const dist=Math.hypot(eva.x-(base.x-2),eva.z-(base.z-5.6));
   $('roverInteraction').innerHTML=dist<4?'AT SCIENCE TERMINAL · Press <b>E</b> to scan and collect your research sample.':`EVA · Walk toward the terminal (${Math.round(dist)} m). WASD / arrows to move.`;
 }else if(stage==='scan'){scanProgress+=dt;$('roverInteraction').textContent=`MINERAL ANALYSIS · ${Math.round(clamp(scanProgress/3.5,0,1)*100)}% complete`;
   if(scanProgress>=3.5)end(true);
 }
 updateHUD();
}
function updateHUD(){
 $('gameSpeed').innerHTML=`${(Math.abs(speed)*3.6).toFixed(1)} <em>km/h</em>`;
 $('gameBattery').innerHTML=`${Math.max(0,Math.round(100*battery/Math.max(1,startBattery)))}<em>%</em>`;
 $('gameHull').innerHTML=`${Math.max(0,Math.round(100-damage))}<em>%</em>`;
 $('gameTimer').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;
 let p=stage==='eva'?eva:pos;
 const d=Math.hypot(p.x-base.x,p.z-base.z);
 $('roverGpsDist').textContent=`${Math.round(d)} m`;
 const toward=Math.atan2(base.x-p.x,base.z-p.z),angle=((toward-(stage==='eva'?eva.yaw:yaw))*180/PI+540)%360-180;
 $('roverGpsBearing').textContent=Math.abs(angle)<8?'STRAIGHT AHEAD':`${angle<0?'LEFT':'RIGHT'} ${Math.abs(angle).toFixed(0)}°`;
}
function paintMinimap(){let w=204,h=146;mini.clearRect(0,0,w,h);mini.fillStyle='#09151c';mini.fillRect(0,0,w,h);
 const origin=[65,113],scale=.54,P=(x,z)=>[origin[0]+x*scale,origin[1]-z*scale];
 mini.strokeStyle='#8cdac327';for(let k=-4;k<6;k++){mini.beginPath();mini.moveTo(k*30,0);mini.lineTo(k*30,146);mini.stroke();}
 const s=siteState(),a=s.a||100,b=s.b||75,orient=(s.orientation||30)*PI/180;mini.beginPath();for(let i=0;i<=70;i++){const t=i/70*TAU,u=a*Math.cos(t),v=b*Math.sin(t),pt=P(u*Math.cos(orient)-v*Math.sin(orient),u*Math.sin(orient)+v*Math.cos(orient));i?mini.lineTo(...pt):mini.moveTo(...pt);}mini.setLineDash([4,3]);mini.strokeStyle='#83ddbe6b';mini.stroke();mini.setLineDash([]);
 for(const ob of obstacles){let [x,y]=P(ob.x,ob.z);if(x<-4||x>208||y<-4||y>150)continue;mini.fillStyle=ob.type==='crater'?'#a88a77':'#d5af80';mini.beginPath();mini.arc(x,y,clamp(ob.r*.37,1.1,5),0,TAU);mini.fill();}
 const bp=P(base.x,base.z);mini.shadowColor='#b8ffc8';mini.shadowBlur=12;mini.fillStyle='#78efbe';mini.fillRect(bp[0]-4,bp[1]-4,8,8);mini.shadowBlur=0;
 const p=stage==='eva'?eva:pos,pt=P(p.x,p.z);mini.save();mini.translate(...pt);mini.rotate(stage==='eva'?eva.yaw:yaw);mini.fillStyle='#fff';mini.beginPath();mini.moveTo(0,-8);mini.lineTo(-5,6);mini.lineTo(5,6);mini.closePath();mini.fill();mini.restore();
}
const surfaceDraw=[0,0,0];
function drawStatic(){terrainMesh?.draw(I());
 for(let k=0;k<rocks.length;k++){const r=rocks[k];if(Math.hypot(r.x-pos.x,r.z-pos.z)>145)continue;
   const mesh=rockMeshCache[k%rockMeshCache.length];const p=[r.x,height(r.x,r.z)+r.r*.27,r.z],m=mul(trans(...p),mul(rotY(r.angle),mul(rotX(.19*Math.sin(r.offset)),rotZ(.14*Math.cos(r.angle)))));mesh.draw(mul(m,[r.r,0,0,0,0,r.r*.76,0,0,0,0,r.r*.96,0,0,0,0,1]));
 }
}
function part(mesh,p,ry=0,rx=0,rz=0){mesh.draw(model(p,ry,rx,rz));}
function drawRover(){
 const center=[pos.x,bodyY,pos.z],bodyM=model(center,yaw,pitch,roll);
 const bodyPart=(mesh,local)=>mesh.draw(mul(bodyM,trans(...local)));
 bodyPart(roverMeshes.bottom,[0,-.48,0]);bodyPart(roverMeshes.chassis,[0,-.17,0]);bodyPart(roverMeshes.cab,[0,.52,-.15]);bodyPart(roverMeshes.hood,[0,.68,1.22]);bodyPart(roverMeshes.panel,[0,1.12,-.38]);
 bodyPart(roverMeshes.bar,[-.97,.41,0]);bodyPart(roverMeshes.bar,[.97,.41,0]);
 for(const dz of [-1.52,1.52])for(const dx of [-1.36,1.36]){
   const wx=pos.x+dx*Math.cos(yaw)+dz*Math.sin(yaw),wz=pos.z-dx*Math.sin(yaw)+dz*Math.cos(yaw),wy=height(wx,wz)+.53;
   const steer=dz>0?steerVisual:0;
   const wm=mul(trans(wx,wy,wz),mul(rotY(yaw+steer),rotX(wheelSpin)));
   roverMeshes.wheel.draw(wm);roverMeshes.hub.draw(wm);
   const strutCenter=[wx,(wy+bodyY-.32)/2,wz];const strutH=Math.max(.3,Math.abs(wy-bodyY+.32));
   stationMeshes.strut.draw(mul(trans(...strutCenter),[1,0,0,0,0,strutH/3.5,0,0,0,0,1,0,0,0,0,1]));
 }
 bodyPart(roverMeshes.light,[-.86,.44,1.85]);bodyPart(roverMeshes.light,[.86,.44,1.85]);
}
function drawOutpost(){const y=height(base.x,base.z);part(stationMeshes.pad,[base.x,y-.16,base.z]);part(stationMeshes.building,[base.x,y+2.0,base.z]);part(stationMeshes.roof,[base.x,y+3.8,base.z]);part(stationMeshes.door,[base.x-2,y+1.46,base.z-4.03]);part(stationMeshes.window,[base.x+1.8,y+2.1,base.z-4.08]);
 part(stationMeshes.dome,[base.x+12,y+2.0,base.z+2.1]);
 for(const dx of [-13,13]){part(stationMeshes.solar,[base.x+dx,y+1.8,base.z-6],.12,Math.PI/5);part(stationMeshes.strut,[base.x+dx,y+.6,base.z-6]);}
 part(stationMeshes.strut,[base.x+2,y+5.4,base.z+2]);part(stationMeshes.beacon,[base.x+2,y+7.1,base.z+2]);
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
 }else if(stage==='eva'||stage==='scan'){
   const t=stage==='scan'?Math.atan2(base.x-eva.x,base.z-eva.z):eva.yaw;
   const ground=height(eva.x,eva.z);desired=[eva.x,ground+1.71+.025*Math.sin(elapsed*8),eva.z];target=[eva.x+Math.sin(t)*20,ground+1.68,eva.z+Math.cos(t)*20];
 }else{
   camYaw+=Math.atan2(Math.sin(yaw+orbitOffset-camYaw),Math.cos(yaw+orbitOffset-camYaw))*clamp(frameTime*.06,.035,.12);
   const dir=[Math.sin(camYaw),Math.cos(camYaw)];
   desired=[pos.x-dir[0]*camDist+Math.cos(camYaw)*steerVisual*.4,bodyY+3.1+camDist*Math.sin(orbitPitch)*.40,pos.z-dir[1]*camDist-Math.sin(camYaw)*steerVisual*.4];
   target=[pos.x+Math.sin(yaw)*4,bodyY+.30,pos.z+Math.cos(yaw)*4];
 }
 const blend=(stage==='landing'||stage==='blackout'||stage==='eva'||stage==='scan')?.24:clamp(frameTime*.11,.045,.16);
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
 $('roverMaxSpeed').oninput=e=>{maxSpeed=+e.target.value;$('roverMaxSpeedRead').textContent=maxSpeed+' km/h';};
 $('roverBatterySet').oninput=e=>{$('roverBatteryRead').textContent=e.target.value+' Wh';if(stage==='preview')reset(true);};
 $('roverDifficulty').oninput=e=>{difficulty=+e.target.value;$('roverDifficultyRead').textContent=['Survey mode','Mission standard','Hazard challenge'][difficulty];if(stage==='preview')reset(true);};
 document.addEventListener('keydown',e=>{
   if(!document.querySelector('#page5.page.active'))return;
   if(['KeyW','KeyS','KeyA','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','KeyR','KeyC'].includes(e.code)){
      if(['drive','parked','eva'].includes(stage)&&e.code!=='KeyE')e.preventDefault();held.add(e.code);
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
 window.__surfaceGameV10={start,reset,getState:()=>({stage,pos:{...pos},yaw,speed,bodyY,vy,battery,hull:100-damage,elapsed,craters:craters.length,rocks:rocks.length,win,lost}),getGravity:()=>G,forceToBase:()=>{pos={x:base.x-5,z:base.z-7};speed=0;stage='drive';ensureLoop();},forceEva:()=>{enterEVA();},forceComplete:()=>end(true)};
 reset(true);if(document.querySelector('#page5.page.active'))ensureLoop();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
