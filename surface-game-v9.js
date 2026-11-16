/* LUNAR/NAV — interactive third-person surface driving demonstration.
   Physical dimensions are in meters; acceleration is limited by friction and lunar g = 1.62 m/s².
   DEM, craters and boulders are synthetic, not NASA surveyed. Engine is offline canvas software 3-D.
   NASA lunar gravity reference: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html */
'use strict';
(function(){
  const q=id=>document.getElementById(id), G=1.62, PI=Math.PI;
  const canvas=q('roverGame'), map=q('roverMinimap');if(!canvas||!map)return;
  const g=canvas.getContext('2d',{alpha:false}), mg=map.getContext('2d');
  let seed=7,obstacles=[],stars=[],clock=0,prev=0,raf=0,run=false,win=false,lost=false,shake=0;
  let pos={x:0,z:0},yaw=.3,speed=0,bodyY=3,vy=0,bob=0,battery=80,startBattery=80,damage=0,elapsed=0;
  let maxSpeed=12,difficulty=1,base={x:116,z:92},hitCooldown=0,keys=new Set(), touch=new Set();
  let audioContext=null,oscillators=[],musicEnabled=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hash=(x)=>{x=Math.sin(x*127.1+seed*56.7)*43758.5453;return x-Math.floor(x)};
  function worldSeed(){return Math.round((state?.lat??-89.5)*117+(state?.lon??43.2)*89+(state?.a??100)*3)}
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;}
  function resetTerrain(){
    seed=worldSeed()|0;obstacles=[];
    let a=Math.max(50,Math.min(135,state?.a||100)),b=Math.max(35,Math.min(105,state?.b||75)),ang=(state?.orientation||30)*PI/180;
    for(let j=0;j<22+difficulty*12;j++){
      const t=rand()*PI*2,r=Math.sqrt(rand())*.95;
      const u=r*Math.cos(t)*a,v=r*Math.sin(t)*b;
      const x=u*Math.cos(ang)-v*Math.sin(ang),z=u*Math.sin(ang)+v*Math.cos(ang);
      if(Math.hypot(x,z)<11)continue;
      obstacles.push({x,z,r:1.4+rand()*3.6,type:rand()<.36?'crater':'rock',scale:rand()});
    }
    for(let j=0;j<12+difficulty*10;j++){
      const x=(rand()-.36)*180,z=rand()*160-15;
      if(Math.hypot(x,z)<12||Math.hypot(x-base.x,z-base.z)<13)continue;
      obstacles.push({x,z,r:1.7+rand()*3.3,type:rand()<.41?'crater':'rock',scale:rand()});
    }
    // Clear a small landing patch and a small destination pad.
    obstacles=obstacles.filter(o=>Math.hypot(o.x,o.z)>9&&Math.hypot(o.x-base.x,o.z-base.z)>13);
    stars=Array.from({length:90},()=>({x:rand(),y:rand()*.58,s:rand()*1.3+.35}));
  }
  function h(x,z){
    let y=.26*Math.sin(x*.089+z*.017)+.30*Math.cos(z*.055-x*.021)+.17*Math.sin(x*.17+z*.16);
    for(const ob of obstacles){if(ob.type!=='crater')continue;const d=Math.hypot(x-ob.x,z-ob.z);if(d>ob.r*2.6)continue;let u=d/(ob.r*.95);
      y-=ob.r*.63*Math.exp(-u*u*1.45);
      y+=ob.r*.29*Math.exp(-(((d-ob.r*1.16)/(ob.r*.35))**2));
    }return y;
  }
  function reset(overlay=true){
    resetTerrain();pos={x:0,z:0};yaw=.36;speed=0;elapsed=0;damage=0;clock=0;hitCooldown=0;
    startBattery=+q('roverBatterySet').value;battery=startBattery;
    bodyY=h(0,0)+1.28+1.7;vy=0;bob=0;win=false;lost=false;run=false;keys.clear();touch.clear();
    q('roverStartOverlay').hidden=!overlay;q('roverWinOverlay').hidden=true;q('roverFailOverlay').hidden=true;
    showStats();render();
  }
  function start(){reset(false);run=true; canvas.focus({preventScroll:true}); if(!raf)raf=requestAnimationFrame(frame); }
  const pressed=k=>keys.has(k)||touch.has(k);
  function input(){return {acc:(pressed('KeyW')||pressed('ArrowUp')||pressed('forward')?1:0)-(pressed('KeyS')||pressed('ArrowDown')||pressed('back')?1:0),steer:(pressed('KeyD')||pressed('ArrowRight')||pressed('right')?1:0)-(pressed('KeyA')||pressed('ArrowLeft')||pressed('left')?1:0),brake:pressed('Space')||pressed('brake')};}
  function update(dt){
    if(!run)return;
    dt=Math.min(.035,dt);elapsed+=dt;hitCooldown-=dt;
    const i=input(),ground=h(pos.x,pos.z),normalSlope=(h(pos.x+1,pos.z)-h(pos.x-1,pos.z))/2;
    // Reduced traction is deliberate: moon g means lower maximum tire-ground friction acceleration.
    const traction=clamp(.84-.18*difficulty-.075*Math.abs(normalSlope),.30,.82),aMax=traction*G;
    const throttle=i.acc*aMax,rolling=.10*(speed===0?0:Math.sign(speed));
    speed+= (throttle-rolling-(i.brake?Math.sign(speed)*Math.min(3*G,Math.abs(speed)/dt):0))*dt;
    speed=clamp(speed,-maxSpeed/3.6*.40,maxSpeed/3.6);
    if(!i.acc&&!i.brake&&Math.abs(speed)<.035)speed=0;
    // Bicycle steering with centripetal acceleration capped by regolith grip.
    let desiredYaw=(speed/2.9)*Math.tan(i.steer*.49);
    const allowedYaw=Math.max(.09,aMax/Math.max(.5,Math.abs(speed)));
    yaw+=clamp(desiredYaw,-allowedYaw,allowedYaw)*dt;
    const prevPos={...pos};
    pos.x+=Math.sin(yaw)*speed*dt;pos.z+=Math.cos(yaw)*speed*dt;
    pos.x=clamp(pos.x,-165,175);pos.z=clamp(pos.z,-95,193);
    // Four contact samples drive a simplified sprung chassis. g = 1.62 m/s².
    let hs=0;
    for(const dx of [-.95,.95])for(const dz of [-1.45,1.45]){
      let x=pos.x+dx*Math.cos(yaw)+dz*Math.sin(yaw),z=pos.z-dx*Math.sin(yaw)+dz*Math.cos(yaw);hs+=h(x,z);
    }hs/=4;
    const clearance=bodyY-hs,rest=1.32;
    let spring=clearance<rest+.65?Math.max(0,(rest-clearance)*19-vy*5.2):0;
    vy+=(spring-G)*dt;bodyY+=vy*dt;
    if(bodyY<hs+.72){bodyY=hs+.72;vy=Math.max(0,-vy*.20);}
    // Rock contacts or crater slopes reduce speed and consume vehicle health.
    for(const ob of obstacles){const d=Math.hypot(pos.x-ob.x,pos.z-ob.z);
      if(ob.type==='rock'&&d<ob.r+1.05){
        const nx=(pos.x-ob.x)/(d||1),nz=(pos.z-ob.z)/(d||1);
        pos.x=ob.x+nx*(ob.r+1.08);pos.z=ob.z+nz*(ob.r+1.08);
        if(hitCooldown<=0&&Math.abs(speed)>.65){damage+=Math.min(22,4+Math.abs(speed)*4.2);hitCooldown=.4;shake=.65;}
        speed*=-.23;
      }
      if(ob.type==='crater'&&d<ob.r*.87){speed*=Math.pow(.25,dt);if(hitCooldown<=0&&Math.abs(speed)>.6){damage+=2.5;hitCooldown=.75;}}
    }
    shake*=Math.exp(-8*dt);
    // P = standby + drive load + motion-dependent load; total energy in Wh.
    const P=150 + (Math.abs(speed)/Math.max(1,maxSpeed/3.6))*410 + (i.acc?140:0) + (i.brake?45:0);
    battery=Math.max(0,battery-P*dt/3600);
    if(Math.hypot(pos.x-base.x,pos.z-base.z)<9&&Math.abs(speed)<3.8){finish(true);}
    else if(battery<=0||damage>=100){finish(false);}
    showStats();
  }
  function finish(success){run=false;if(success){win=true;q('roverWinReport').textContent=`Traversed ${Math.round(Math.hypot(pos.x,pos.z))} m in ${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}, with ${Math.round(battery/startBattery*100)}% energy reserve and ${Math.round(100-damage)}% hull integrity. Science team is ready to begin.`;q('roverWinOverlay').hidden=false;}else{lost=true;q('roverFailReport').textContent=battery<=0?'Drive reserve depleted. Try a larger energy budget or a shorter path.':'Rover sustained too many obstacle impacts. Steer around boulders and crater rims.';q('roverFailOverlay').hidden=false;} }
  function showStats(){
    q('gameSpeed').innerHTML=`${(Math.abs(speed)*3.6).toFixed(1)} <em>km/h</em>`;
    q('gameBattery').innerHTML=`${Math.max(0,Math.floor(battery/startBattery*100))}<em>%</em>`;
    q('gameHull').innerHTML=`${Math.max(0,Math.round(100-damage))}<em>%</em>`;
    q('gameTimer').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
    const distance=Math.max(0,Math.hypot(pos.x-base.x,pos.z-base.z)-8);
    q('roverGpsDist').textContent=Math.round(distance)+' m';
    const bearing=Math.atan2(base.x-pos.x,base.z-pos.z);
    let degrees=((bearing-yaw)*180/PI+360)%360;
    q('roverGpsBearing').textContent='TURN '+(degrees>180?'LEFT':'RIGHT')+' '+Math.round(Math.min(degrees,360-degrees))+'°';
  }
  function frame(ts){let dt=prev?Math.min(.04,(ts-prev)/1000):.016;prev=ts;if(document.hidden){raf=requestAnimationFrame(frame);return;}
    if(run)update(dt);
    const visible=!!document.querySelector('#page5.page.active');
    if(visible){render();renderMap();raf=requestAnimationFrame(frame)}else{raf=0;prev=0;}
  }
  // ----- Offline software-3D camera and world renderer -----
  let cam,sw=1220,sh=680;
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=v=>{let l=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/l,y:v.y/l,z:v.z/l}};
  function setCam(){
    const sx=Math.sin(yaw),cz=Math.cos(yaw);
    const ground=h(pos.x,pos.z);
    const camera={x:pos.x-sx*14,y:ground+5.8+shake*Math.sin(clock*27),z:pos.z-cz*14};
    const target={x:pos.x+sx*8,y:ground+2.0,z:pos.z+cz*8};
    const f=norm({x:target.x-camera.x,y:target.y-camera.y,z:target.z-camera.z});
    const right=norm({x:f.z,y:0,z:-f.x});
    const up=cross(f,right);cam={at:camera,f,right,up,focal:sw*.88};
  }
  function project(x,y,z){const v={x:x-cam.at.x,y:y-cam.at.y,z:z-cam.at.z};const depth=dot(v,cam.f);
    if(depth<.18)return null;let s=cam.focal/depth;
    return {x:sw*.5+dot(v,cam.right)*s,y:sh*.5-dot(v,cam.up)*s,d:depth,s};}
  function polygon(points,color,outline=null,width=1){const pp=points.map(p=>project(...p));if(pp.some(p=>!p))return;g.fillStyle=color;g.beginPath();g.moveTo(pp[0].x,pp[0].y);for(const p of pp.slice(1))g.lineTo(p.x,p.y);g.closePath();g.fill();if(outline){g.lineWidth=width;g.strokeStyle=outline;g.stroke();}}
  function line3(points,col,width=1,dash=[]){const pp=points.map(p=>project(...p)).filter(Boolean);if(pp.length<2)return;g.beginPath();g.moveTo(pp[0].x,pp[0].y);for(let i=1;i<pp.length;i++)g.lineTo(pp[i].x,pp[i].y);g.strokeStyle=col;g.lineWidth=width;g.setLineDash(dash);g.stroke();g.setLineDash([]);}
  function cube(x,y,z,w,hh,ll,angle,col){
    const s=Math.sin(angle),c=Math.cos(angle),R=(dx,dz)=>[x+dx*c+dz*s,z-dx*s+dz*c];
    const [a,az]=R(-w/2,-ll/2),[b,bz]=R(w/2,-ll/2),[cc,cz]=R(w/2,ll/2),[d,dz]=R(-w/2,ll/2);
    const v=[[a,y,az],[b,y,bz],[cc,y,cz],[d,y,dz]],u=v.map(p=>[p[0],p[1]+hh,p[2]]);
    polygon([v[0],v[1],u[1],u[0]],col[0]);polygon([v[1],v[2],u[2],u[1]],col[1]);polygon([v[2],v[3],u[3],u[2]],col[2]);polygon([v[3],v[0],u[0],u[3]],col[3]);polygon([u[0],u[1],u[2],u[3]],col[4]||col[0],'#d9f7f535',.7);
  }
  function drawSky(){
    const bg=g.createLinearGradient(0,0,0,sh);bg.addColorStop(0,'#020914');bg.addColorStop(.42,'#101c2b');bg.addColorStop(.7,'#37434b');bg.addColorStop(1,'#4b4a45');g.fillStyle=bg;g.fillRect(0,0,sw,sh);
    for(const p of stars){g.fillStyle=`rgba(221,238,250,${.15+p.s*.25})`;g.fillRect(p.x*sw,p.y*sh,p.s,p.s);}
    // Distant NASA-inspired Earth over lunar horizon, visually illustrative.
    const ox=sw*.81+60*Math.sin(yaw*.7),oy=sh*.21+25*Math.cos(yaw*.7),r=24;
    const e=g.createRadialGradient(ox-6,oy-7,1,ox,oy,r);e.addColorStop(0,'#a2d7f0');e.addColorStop(.42,'#4d94c4');e.addColorStop(.68,'#1e4470');e.addColorStop(1,'#08152a');g.fillStyle=e;g.beginPath();g.arc(ox,oy,r,0,2*PI);g.fill();g.strokeStyle='#b1dcee6f';g.stroke();
    const vignette=g.createRadialGradient(sw/2,sh/2,sh*.2,sw/2,sh/2,sh*.9);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#0006');g.fillStyle=vignette;g.fillRect(0,0,sw,sh);
  }
  function renderTerrain(){
    const right={x:Math.cos(yaw),z:-Math.sin(yaw)},front={x:Math.sin(yaw),z:Math.cos(yaw)};
    const step=8;let polys=[];
    for(let iz=-6;iz<26;iz++)for(let ix=-19;ix<19;ix++){
      const pt=(u,v)=>{let x=pos.x+right.x*u+front.x*v,z=pos.z+right.z*u+front.z*v;return [x,h(x,z),z]};
      const a=pt(ix*step,iz*step),b=pt((ix+1)*step,iz*step),c=pt((ix+1)*step,(iz+1)*step),d=pt(ix*step,(iz+1)*step);
      const middle=[(a[0]+c[0])*.5,(a[1]+c[1])*.5,(a[2]+c[2])*.5];const pp=project(...middle);if(!pp)continue;
      let slope=(c[1]-a[1])*.19,noise=(Math.sin(ix*16.13+iz*11.27+seed*.01)+Math.sin(ix*.8+iz*2.9))*.5;
      const brightness=clamp(51+noise*6-slope*14+(iz<0?5:0),33,69),fog=clamp(pp.d/185,0,.55);
      let base=Math.round(brightness+fog*11);polys.push({d:pp.d,pts:[a,b,c,d],col:`rgb(${base+8},${base+7},${base+5})`});
    }
    polys.sort((a,b)=>b.d-a.d);
    for(const p of polys)polygon(p.pts,p.col);
    const tone=g.createLinearGradient(0,sh*.55,0,sh);tone.addColorStop(0,'#5b657100');tone.addColorStop(1,'#090e142b');g.fillStyle=tone;g.fillRect(0,sh*.55,sw,sh*.45);
  }
  function ellipseDraw(){
    const a=state?.a||100,b=state?.b||75,o=(state?.orientation||30)*PI/180;
    const points=[];for(let j=0;j<=90;j++){const t=j/90*2*PI,u=a*Math.cos(t),v=b*Math.sin(t),x=u*Math.cos(o)-v*Math.sin(o),z=u*Math.sin(o)+v*Math.cos(o);points.push([x,h(x,z)+.18,z]);}
    line3(points,'#a8e6c888',1.65,[6,5]);
  }
  function rock(ob){let r=ob.r,y=h(ob.x,ob.z),n=8,hh=r*(.58+.3*ob.scale),p=[];
    for(let j=0;j<n;j++){const t=j*PI*2/n;p.push([ob.x+r*Math.cos(t),y+.2+r*.13*Math.sin(2*t),ob.z+r*Math.sin(t)]);}
    const peak=[ob.x-r*.16,y+hh,ob.z+r*.07];
    for(let j=0;j<n;j++){const col=['#a7a6a1','#666c6d','#7a7c7c','#929391','#5e6466','#8e918d','#727673','#9ea2a0'][j];polygon([p[j],p[(j+1)%n],peak],col,'#e9e1d10b');}
  }
  function crater(ob){let rings=[];for(let j=0;j<=34;j++){const t=j*2*PI/34,x=ob.x+ob.r*1.18*Math.cos(t),z=ob.z+ob.r*1.18*Math.sin(t);rings.push([x,h(x,z)+.05,z]);}line3(rings,'#c1bab18a',1.8);
    const core=[];for(let j=0;j<=34;j++){const t=j*2*PI/34,x=ob.x+ob.r*.56*Math.cos(t),z=ob.z+ob.r*.56*Math.sin(t);core.push([x,h(x,z)+.05,z]);}line3(core,'#252729cc',1.5);
  }
  function antenna(x,y,z){line3([[x,y,z],[x,y+4,z]],'#dcebef',2);const p=project(x,y+4,z);if(p){g.fillStyle='#9ceecb';g.beginPath();g.arc(p.x,p.y,Math.max(2,Math.min(7,p.s*.12)),0,PI*2);g.fill()}}
  function researchBase(){const x=base.x,z=base.z,y=h(x,z);
    const low=['#bac9c9','#687b84','#87979c','#7e8d94','#d1dbda'];cube(x,y,z,12,4.5,9,.25,low);
    cube(x-8,y+.3,z+3,7,.22,5,.25,['#4d7f91','#244d70','#2f6682','#396b7d','#7db5d1']);
    cube(x+9,y+.3,z+3,7,.22,5,.25,['#4d7f91','#244d70','#2f6682','#396b7d','#7db5d1']);
    const target=project(x,y+9,z);if(target){g.save();g.shadowColor='#a5f3cd';g.shadowBlur=16;g.fillStyle='#aefed4';g.beginPath();g.arc(target.x,target.y,5,0,PI*2);g.fill();g.restore();g.fillStyle='#d9ffef';g.font='700 13px system-ui';g.textAlign='center';g.fillText('RESEARCH BASE',target.x,target.y-16);}
    antenna(x+3,y+4.5,z+1);
  }
  function lander(){const x=-12,z=-20,y=h(x,z);
    const body=['#ccc9bd','#79828a','#88929a','#b8c7c5','#e7e0cd'];cube(x,y+2.3,z,3.2,3.4,3.2,.2,body);
    for(const dx of [-2.6,2.6])for(const dz of [-2.2,2.2]){let xx=x+dx,zz=z+dz;line3([[x+dx*.42,y+2.5,z+dz*.45],[xx,y+.18,zz]],'#bac3c4',2.3);}
    cube(x,y+5.7,z,1.3,1.6,1.5,.1,['#eee4ca','#959ba1','#a0a8ae','#b9bebc','#f5ebd4']);antenna(x+.5,y+7.3,z);
  }
  function roverVehicle(){
    const y=bodyY,ang=yaw,x=pos.x,z=pos.z;
    // Moving 4-wheel suspension independently samples the local terrain.
    for(const dx of [-1.12,1.12])for(const dz of [-1.35,1.35]){
      const wx=x+dx*Math.cos(ang)+dz*Math.sin(ang),wz=z-dx*Math.sin(ang)+dz*Math.cos(ang);
      const wy=h(wx,wz)+.25;
      line3([[wx,wy+.38,wz],[wx,y-.10,wz]],'#d6ece9',2.4);
      cube(wx,wy,wz,.62,.68,1.05,ang,['#202a2d','#121b1e','#303b40','#242e32','#49565c']);
      line3([[wx,wy+.28,wz],[wx,wy+.8,wz]],'#aecac6',1.2);
    }
    cube(x,y-.38,z,2.35,.76,3.45,ang,['#c3d2cd','#4b6973','#7c9299','#9db0b5','#d6e0dd']);
    cube(x,y+.42,z,1.8,.60,2.02,ang,['#3b6a77','#214250','#407482','#557984','#7eb0b7']);
    cube(x,y+1.14,z,2.75,.16,3.1,ang,['#487d97','#1e405d','#376e8b','#2a5975','#7ab8d1']);
    const headX=x+.52*Math.sin(ang),headZ=z+.52*Math.cos(ang);
    line3([[x,y+1.2,z],[x,y+2.3,z]],'#d7e0e1',2);
    const p=project(x,y+2.32,z);if(p){g.fillStyle='#dce9ee';g.beginPath();g.arc(p.x,p.y,3,0,PI*2);g.fill();}
  }
  function dustAndEffects(){if(Math.abs(speed)<1||!run)return;
    const px=project(pos.x,bodyY-.6,pos.z);if(!px)return;
    g.fillStyle='rgba(224,214,190,.045)';for(let j=0;j<8;j++){let t=(clock*.9+j*.19)%1;g.beginPath();g.ellipse(px.x+(j-4)*7*t,px.y+30+t*15,7+18*t,2+8*t,0,0,PI*2);g.fill();}
  }
  function render(){
    if(!canvas.isConnected)return;
    clock+=1/60;
    setCam();drawSky();renderTerrain();ellipseDraw();
    let objects=obstacles.filter(o=>Math.hypot(o.x-pos.x,o.z-pos.z)<175).map(ob=>({kind:'hazard',ob,x:ob.x,z:ob.z}));
    objects.push({kind:'base',x:base.x,z:base.z},{kind:'lander',x:0,z:-8},{kind:'rover',x:pos.x,z:pos.z});
    objects.sort((a,b)=>{let da=project(a.x,h(a.x,a.z)+.1,a.z)?.d??0,db=project(b.x,h(b.x,b.z)+.1,b.z)?.d??0;return db-da});
    for(const item of objects){if(item.kind==='hazard')item.ob.type==='rock'?rock(item.ob):crater(item.ob);else if(item.kind==='base')researchBase();else if(item.kind==='lander')lander();else roverVehicle();}
    dustAndEffects();
    if(run&&Math.abs(speed)>2.5){g.fillStyle='rgba(255,255,255,.016)';g.fillRect(0,0,sw,sh);}
  }
  function renderMap(){
    const w=204,hg=146;mg.clearRect(0,0,w,hg);mg.fillStyle='#13232b';mg.fillRect(0,0,w,hg);
    const sz=.50, cx=79,cy=101,P=(x,z)=>({x:cx+x*sz,y:cy-z*sz});
    mg.strokeStyle='#94bba930';mg.lineWidth=.75;for(let k=-3;k<=3;k++){mg.beginPath();mg.moveTo(cx+k*25,0);mg.lineTo(cx+k*25,hg);mg.stroke();}
    let a=state?.a||100,b=state?.b||75,o=(state?.orientation||30)*PI/180;
    mg.strokeStyle='#a0edc7aa';mg.setLineDash([3,4]);mg.beginPath();for(let i=0;i<=70;i++){const t=i/70*2*PI,u=a*Math.cos(t),v=b*Math.sin(t),p=P(u*Math.cos(o)-v*Math.sin(o),u*Math.sin(o)+v*Math.cos(o));i?mg.lineTo(p.x,p.y):mg.moveTo(p.x,p.y);}mg.stroke();mg.setLineDash([]);
    for(const ob of obstacles){const p=P(ob.x,ob.z);if(p.x<0||p.x>w||p.y<0||p.y>hg)continue;mg.fillStyle=ob.type==='rock'?'#f2b98f':'#9b7d7b';mg.beginPath();mg.arc(p.x,p.y,Math.max(1.5,ob.r*.48),0,PI*2);mg.fill();}
    const bp=P(base.x,base.z);mg.fillStyle='#abffd5';mg.shadowBlur=13;mg.shadowColor='#6ce8aa';mg.fillRect(bp.x-5,bp.y-5,10,10);mg.shadowBlur=0;
    const me=P(pos.x,pos.z);mg.save();mg.translate(me.x,me.y);mg.rotate(yaw);mg.fillStyle='#fff';mg.beginPath();mg.moveTo(0,-8);mg.lineTo(-5,6);mg.lineTo(5,6);mg.closePath();mg.fill();mg.restore();
  }
  function music(on){
    if(!on){for(const o of oscillators)try{o.stop();o.disconnect()}catch{}oscillators=[];musicEnabled=false;return;}
    try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const notes=[110,164.81,220,261.63];for(const f of notes){const o=audioContext.createOscillator(),gain=audioContext.createGain();o.type='sine';o.frequency.value=f;gain.gain.value=.0030;o.connect(gain).connect(audioContext.destination);o.start();oscillators.push(o);}musicEnabled=true;}catch(err){musicEnabled=false;}
  }
  function toggleMusic(){music(!musicEnabled);q('roverMusic').textContent='♫ Ambient audio: '+(musicEnabled?'ON':'OFF');}
  function init(){
    q('roverStart').onclick=start;q('roverRestart').onclick=start;q('roverRetry').onclick=start;q('roverReset').onclick=()=>reset(true);
    q('roverMusic').onclick=toggleMusic;q('roverWinMusic').onclick=toggleMusic;
    q('roverMaxSpeed').oninput=e=>{maxSpeed=+e.target.value;q('roverMaxSpeedRead').textContent=maxSpeed+' km/h';};
    q('roverBatterySet').oninput=e=>{q('roverBatteryRead').textContent=e.target.value+' Wh';if(!run)reset(true);};
    q('roverDifficulty').oninput=e=>{difficulty=+e.target.value;q('roverDifficultyRead').textContent=['Survey mode','Mission standard','Hazard challenge'][difficulty];if(!run)reset(true);};
    document.addEventListener('keydown',e=>{if(!document.querySelector('#page5.page.active'))return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)&&run){e.preventDefault();keys.add(e.code);}
      if(e.code==='KeyR'&&!e.repeat)reset(true);
    });
    document.addEventListener('keyup',e=>keys.delete(e.code));
    window.addEventListener('blur',()=>{keys.clear();touch.clear()});
    q('roverMobileControls');document.querySelectorAll('[data-drive]').forEach(btn=>{const k=btn.dataset.drive;
      btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);touch.add(k)});
      for(const typ of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(typ,()=>touch.delete(k));
    });
    reset(true);
    const watcher=new MutationObserver(()=>{if(document.querySelector('#page5.page.active')&&!raf){prev=0;raf=requestAnimationFrame(frame)}});
    watcher.observe(q('page5'),{attributes:true,attributeFilter:['class']});
    if(document.querySelector('#page5.page.active'))raf=requestAnimationFrame(frame);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.__surfaceGameV9={start,reset,stop:()=>{run=false},getState:()=>({pos:{...pos},yaw,speed,bodyY,vy,battery,health:100-damage,elapsed,win,lost,obstacles:obstacles.length}),getGravity:()=>G};
})();
