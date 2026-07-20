(() => {
  "use strict";
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = 640, H = 960, FIXED = 1 / 120;
  const ui = {
    score: document.getElementById("score"), balls: document.getElementById("ballCount"), high: document.getElementById("highScore"),
    multi: document.getElementById("multiplier"), status: document.getElementById("statusText"), overlay: document.getElementById("gameOverlay"),
    title: document.getElementById("overlayTitle"), copy: document.getElementById("overlayCopy"), start: document.getElementById("startButton"),
    callout: document.getElementById("callout"), pause: document.getElementById("pauseButton"), sound: document.getElementById("soundButton")
  };
  let state = "ready", score = 0, balls = 3, multiplier = 1, high = +(localStorage.getItem("deadFlipHigh") || 0), combo = 0, comboClock = 0;
  let last = 0, accumulator = 0, shake = 0, tilt = 0, muted = false, audio, stuckClock = 0, searchPulses = 0, charging = false, charge = 0;
  const keys = { left: false, right: false };
  const ball = { x: 574, y: 824, vx: 0, vy: 0, r: 11, active: false, gated: false, trail: [] };
  const bumpers = [{x:185,y:285,r:42,color:"#e34f32",hit:0},{x:445,y:335,r:40,color:"#dfc456",hit:0},{x:300,y:500,r:45,color:"#d8ddd0",hit:0}];
  const posts = [{x:145,y:615,r:14},{x:495,y:615,r:14},{x:105,y:735,r:11},{x:535,y:735,r:11}];
  const lanes = [{x:182,lit:false},{x:320,lit:false},{x:458,lit:false}];
  const walls = [
    [55,105,55,690],[55,105,125,48],[125,48,510,48],[510,48,550,95],[550,220,550,790],
    [55,690,105,790],[105,790,155,830],[485,830,535,790],[535,790,550,690],
    [72,555,125,670],[125,670,165,715],[568,555,515,670],[515,670,475,715],
    [78,165,145,115],[495,115,540,180]
  ];
  const targets = [{x:105,y:405,w:9,h:70,hit:0},{x:525,y:405,w:9,h:70,hit:0}];
  const flippers = [
    {x:175,y:805,len:105,angle:.32,rest:.32,active:-.48,dir:1,down:false},
    {x:465,y:805,len:105,angle:Math.PI-.32,rest:Math.PI-.32,active:Math.PI+.48,dir:-1,down:false}
  ];
  ui.high.textContent = format(high);

  function format(n){ return Math.floor(n).toString().padStart(6,"0"); }
  function initAudio(){ if(!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if(audio.state === "suspended") audio.resume(); }
  function sound(freq=220,dur=.08,type="square",vol=.035){ if(muted) return; initAudio(); const o=audio.createOscillator(),g=audio.createGain(); o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.7),audio.currentTime+dur);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur); }
  function addScore(points,label){ const gained=points*multiplier;score+=gained;combo++;comboClock=2; if(combo>2) gained && callout(`${combo} HIT COMBO`); if(label) callout(label); if(score>high){high=score;localStorage.setItem("deadFlipHigh",high)} updateUI(); }
  function callout(text){ui.callout.textContent=text;ui.callout.classList.remove("pop");void ui.callout.offsetWidth;ui.callout.classList.add("pop")}
  function updateUI(){ui.score.textContent=format(score);ui.balls.textContent=balls;ui.high.textContent=format(high);ui.multi.textContent=`${multiplier}X`}
  function resetSearch(){stuckClock=0;searchPulses=0;document.getElementById("rescueButton").classList.remove("visible")}
  function resetBall(){ball.x=580;ball.y=842;ball.vx=0;ball.vy=0;ball.active=false;ball.gated=false;ball.trail=[];charging=false;charge=0;resetSearch();ui.status.textContent="HOLD SPACE TO CHARGE"}
  function rescueBall(){if(state!=="playing"||!ball.active)return;callout("BALL RESCUED");sound(310,.16,"sine",.04);resetBall()}
  function ballSearch(dt){
    const speed=Math.hypot(ball.vx,ball.vy);
    if(speed<70)stuckClock+=dt;else if(stuckClock>=4){resetSearch();ui.status.textContent="BALL IN PLAY"}else stuckClock=0;
    if(stuckClock>=4){
      ui.status.textContent="BALL SEARCH";document.getElementById("rescueButton").classList.add("visible");
      const due=stuckClock>=5.25?2:1;
      if(searchPulses<due){searchPulses=due;shake=7;bumpers.forEach(b=>b.hit=.2);flippers.forEach(f=>f.angle=f.active);ball.vx+=(Math.random()-.5)*180;ball.vy-=110;sound(185+due*55,.1,"square",.04);callout(`BALL SEARCH ${due}/2`)}
      if(stuckClock>=7)rescueBall();
    }
  }
  function startGame(){initAudio();score=0;balls=3;multiplier=1;combo=0;tilt=0;lanes.forEach(l=>l.lit=false);state="playing";ui.overlay.classList.add("hidden");resetBall();updateUI();sound(160,.14,"sawtooth",.04)}
  function beginCharge(){if(state!=="playing"||ball.active)return;charging=true;charge=Math.max(charge,.04);ui.status.textContent="PLUNGER 4%";initAudio()}
  function launch(){if(state!=="playing"||ball.active||!charging)return;charging=false;ball.active=true;ball.vx=0;ball.vy=-(1380+charge*520);ui.status.textContent="BALL IN SHOOTER LANE";sound(95+charge*80,.2,"sawtooth",.065);charge=0}
  function drain(){if(!ball.active)return;ball.active=false;balls--;sound(85,.5,"sawtooth",.05);updateUI();if(balls<=0){state="gameover";ui.title.innerHTML="GAME<br>OVER";ui.copy.textContent=`FINAL SCORE ${format(score)}`;ui.start.querySelector("span").textContent="PLAY AGAIN";ui.overlay.classList.remove("hidden");ui.status.textContent="GAME OVER"}else{callout("BALL LOST");setTimeout(()=>state==="playing"&&resetBall(),650)}}
  function closest(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy)));return{x:x1+t*dx,y:y1+t*dy,t}}
  function lineCollision(x1,y1,x2,y2,bounce=.78,kick=0){const p=closest(ball.x,ball.y,x1,y1,x2,y2),dx=ball.x-p.x,dy=ball.y-p.y,d=Math.hypot(dx,dy);if(d<ball.r+5&&d>.001){const nx=dx/d,ny=dy/d,over=ball.r+5-d;ball.x+=nx*over;ball.y+=ny*over;const dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=(1+bounce)*dot*nx;ball.vy-=(1+bounce)*dot*ny;ball.vx+=nx*kick;ball.vy+=ny*kick;return true}}return false}
  function circleCollision(o,bounce=1.08,kick=120){const dx=ball.x-o.x,dy=ball.y-o.y,d=Math.hypot(dx,dy),min=ball.r+o.r;if(d<min&&d>.001){const nx=dx/d,ny=dy/d;ball.x=o.x+nx*min;ball.y=o.y+ny*min;const dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=(1+bounce)*dot*nx;ball.vy-=(1+bounce)*dot*ny;ball.vx+=nx*kick;ball.vy+=ny*kick}return true}return false}
  function physics(dt){
    flippers.forEach((f,i)=>{f.down=i?keys.right:keys.left;const target=f.down?f.active:f.rest;const before=f.angle;f.angle+=(target-f.angle)*Math.min(1,dt*30);f.speed=(f.angle-before)/dt});
    if(charging){charge=Math.min(1,charge+dt*.72);ball.y=842+charge*34;ui.status.textContent=`PLUNGER ${Math.round(charge*100)}%`}
    if(!ball.active)return;ball.vy+=770*dt;ball.vx*=.9995;ball.vy*=.9995;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
    walls.forEach(w=>lineCollision(...w));
    posts.forEach(p=>circleCollision(p,.82,25));
    bumpers.forEach((b,i)=>{if(circleCollision(b,1.12,260)){if(b.hit<=0){b.hit=.18;shake=5;addScore(1250,combo===0?"BUMPER +1250":"");sound(210+i*90,.09,"square",.045)}};b.hit=Math.max(0,b.hit-dt)});
    targets.forEach(t=>{if(lineCollision(t.x,t.y,t.x,t.y+t.h,1,120)&&t.hit<=0){t.hit=.22;addScore(750,"SPINNER +750");sound(510,.06,"square",.03)}t.hit=Math.max(0,t.hit-dt)});
    lanes.forEach((l,i)=>{if(!l.lit&&ball.y>128&&ball.y<210&&Math.abs(ball.x-l.x)<34){l.lit=true;addScore(400,`LANE ${i+1} LIT`);sound(620+i*80,.08,"sine",.04);if(lanes.every(x=>x.lit)){multiplier=Math.min(5,multiplier+1);lanes.forEach(x=>x.lit=false);callout(`${multiplier}X MULTIPLIER`);updateUI()}}});
    flippers.forEach(f=>{const ex=f.x+Math.cos(f.angle)*f.len,ey=f.y+Math.sin(f.angle)*f.len;if(lineCollision(f.x,f.y,ex,ey,.74)){const p=closest(ball.x,ball.y,f.x,f.y,ex,ey);const rx=p.x-f.x,ry=p.y-f.y;ball.vx+=-ry*f.speed*.78;ball.vy+=rx*f.speed*.78;if(f.down)sound(145,.04,"square",.025)}});
    if(ball.y<220&&ball.x>535&&!ball.gated){ball.vx-=1900*dt;ball.vy+=180*dt}
    if(ball.y<220&&ball.x<540&&!ball.gated){ball.gated=true;addScore(500,"SKILL SHOT +500");ui.status.textContent="BALL IN PLAY";sound(720,.12,"square",.04)}
    if(ball.y>220&&ball.x>551&&ball.x<608){if(ball.x+ball.r>608){ball.x=608-ball.r;ball.vx=-Math.abs(ball.vx)*.7}if(ball.x-ball.r<551){ball.x=551+ball.r;ball.vx=Math.abs(ball.vx)*.7}}
    if(ball.y>950||ball.x<-30||ball.x>670)drain();
    comboClock-=dt;if(comboClock<=0)combo=0;ballSearch(dt);ball.trail.unshift({x:ball.x,y:ball.y});if(ball.trail.length>9)ball.trail.pop();shake*=.9;
  }
  function drawLine(x1,y1,x2,y2,width=10,color="#70756b"){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
  function draw(){
    ctx.save();ctx.clearRect(0,0,W,H);ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);ctx.fillStyle="#171916";ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="#252822";ctx.lineWidth=1;for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.fillStyle="#20231e";ctx.beginPath();ctx.moveTo(70,90);ctx.lineTo(120,58);ctx.lineTo(510,58);ctx.lineTo(548,105);ctx.lineTo(548,700);ctx.lineTo(495,800);ctx.lineTo(450,845);ctx.lineTo(190,845);ctx.lineTo(145,805);ctx.lineTo(70,700);ctx.closePath();ctx.fill();
    ctx.fillStyle="#262922";ctx.fillRect(551,95,57,800);ctx.fillStyle="#20231e";ctx.fillRect(535,96,48,125);ctx.fillStyle="#e34f32";ctx.fillRect(551,220,4,675);
    lanes.forEach((l,i)=>{ctx.fillStyle=l.lit?"#dfc456":"#3d4139";ctx.fillRect(l.x-26,116,52,6);ctx.font="600 13px IBM Plex Mono";ctx.textAlign="center";ctx.fillText(String(i+1),l.x,105)});
    walls.forEach(w=>drawLine(...w,9,"#777c70"));walls.forEach(w=>drawLine(...w,3,"#d7dbce"));
    ctx.textAlign="center";ctx.font="900 32px Barlow Condensed";ctx.fillStyle="#363a32";ctx.fillText("DEAD FLIP",320,550);ctx.font="600 11px IBM Plex Mono";ctx.fillText("NO MERCY / NO REFUNDS",320,570);
    bumpers.forEach((b,i)=>{ctx.save();ctx.translate(b.x,b.y);const s=b.hit>0?1.12:1;ctx.scale(s,s);ctx.fillStyle="#11120f";ctx.strokeStyle=b.color;ctx.lineWidth=9;ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle="#50544b";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,b.r-13,0,Math.PI*2);ctx.stroke();ctx.fillStyle=b.color;ctx.font="900 18px Barlow Condensed";ctx.fillText(["RED","RISK","RIOT"][i],0,6);ctx.restore()});
    posts.forEach(p=>{ctx.fillStyle="#d7dbce";ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#3e423a";ctx.beginPath();ctx.arc(p.x,p.y,p.r-6,0,Math.PI*2);ctx.fill()});
    targets.forEach(t=>{ctx.fillStyle=t.hit>0?"#dfc456":"#e34f32";ctx.fillRect(t.x-5,t.y,10,t.h)});
    flippers.forEach((f,i)=>{const ex=f.x+Math.cos(f.angle)*f.len,ey=f.y+Math.sin(f.angle)*f.len;drawLine(f.x,f.y,ex,ey,25,"#dfe1d7");drawLine(f.x,f.y,ex,ey,7,i?"#dfc456":"#e34f32");ctx.fillStyle="#171916";ctx.beginPath();ctx.arc(f.x,f.y,8,0,Math.PI*2);ctx.fill()});
    const plungerY=870+charge*34;ctx.strokeStyle="#dfc456";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(563,plungerY);ctx.lineTo(597,plungerY);ctx.stroke();ctx.strokeStyle="#777c70";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(580,plungerY+3);for(let y=plungerY+7,side=-1;y<935;y+=7,side*=-1)ctx.lineTo(580+side*7,y);ctx.stroke();ctx.fillStyle="#777c70";ctx.fillRect(574,932,12,20);if(charging){ctx.fillStyle="#dfc456";ctx.fillRect(558,920,44*charge,4)}
    if(ball.active||state==="playing"){ball.trail.forEach((p,i)=>{ctx.globalAlpha=(1-i/ball.trail.length)*.18;ctx.fillStyle="#e9eadf";ctx.beginPath();ctx.arc(p.x,p.y,ball.r-i*.65,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;const g=ctx.createRadialGradient(ball.x-4,ball.y-5,2,ball.x,ball.y,ball.r);g.addColorStop(0,"#ffffff");g.addColorStop(.38,"#c8ccc1");g.addColorStop(1,"#565b52");ctx.fillStyle=g;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill()}
    ctx.restore();
  }
  function frame(t){const dt=Math.min(.035,(t-last)/1000||0);last=t;if(state==="playing"){accumulator+=dt;while(accumulator>=FIXED){physics(FIXED);accumulator-=FIXED}}draw();requestAnimationFrame(frame)}
  function setFlipper(side,on){keys[side]=on;const id=side==="left"?"leftTouch":"rightTouch";document.getElementById(id).classList.toggle("active",on)}
  addEventListener("keydown",e=>{if(["Space","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==="KeyZ"||e.code==="ArrowLeft")setFlipper("left",true);if(e.code==="Slash"||e.code==="ArrowRight")setFlipper("right",true);if(e.code==="Space"){if(state==="ready"||state==="gameover")startGame();else beginCharge()}if(e.code==="KeyP")togglePause();if((e.code==="ArrowLeft"||e.code==="ArrowRight")&&ball.active){ball.vx+=e.code==="ArrowLeft"?-70:70;tilt++;if(tilt>8)callout("EASY, HOTSHOT")}});
  addEventListener("keyup",e=>{if(e.code==="KeyZ"||e.code==="ArrowLeft")setFlipper("left",false);if(e.code==="Slash"||e.code==="ArrowRight")setFlipper("right",false);if(e.code==="Space")launch()});
  function bindHold(id,side){const el=document.getElementById(id);el.addEventListener("pointerdown",e=>{e.preventDefault();setFlipper(side,true)});["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,()=>setFlipper(side,false)))}
  bindHold("leftTouch","left");bindHold("rightTouch","right");const launchTouch=document.getElementById("launchTouch");launchTouch.addEventListener("pointerdown",e=>{e.preventDefault();if(state==="ready"||state==="gameover")startGame();else beginCharge()});["pointerup","pointercancel","pointerleave"].forEach(ev=>launchTouch.addEventListener(ev,launch));
  function togglePause(){if(state==="playing"){state="paused";ui.title.innerHTML="PAUSED";ui.copy.textContent="The machine is holding its breath.";ui.start.querySelector("span").textContent="RESUME";ui.overlay.classList.remove("hidden");ui.status.textContent="PAUSED"}else if(state==="paused"){state="playing";ui.overlay.classList.add("hidden");ui.status.textContent=ball.active?"BALL IN PLAY":"HOLD SPACE TO LAUNCH"}}
  ui.start.addEventListener("click",()=>state==="paused"?togglePause():startGame());ui.pause.addEventListener("click",togglePause);document.getElementById("restartButton").addEventListener("click",startGame);document.getElementById("rescueButton").addEventListener("click",rescueBall);ui.sound.addEventListener("click",()=>{muted=!muted;ui.sound.classList.toggle("muted",muted);ui.sound.setAttribute("aria-label",muted?"Enable sound":"Mute sound")});
  requestAnimationFrame(frame);
})();
