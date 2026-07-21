(() => {
  "use strict";
  if (!window.Matter) throw new Error("Matter.js failed to load");
  const {Engine,World,Bodies,Body,Events}=Matter;
  const canvas=document.getElementById("gameCanvas"),ctx=canvas.getContext("2d"),W=760,H=1180,STEP=1000/120,BALL_R=12,SAFE_D=30;
  const ui={score,balls:ballCount,high:highScore,low:lowScore,shortest:shortestGame,longest:longestGame,multi:multiplier,status:statusText,overlay:gameOverlay,title:overlayTitle,copy:overlayCopy,start:startButton,callout,sound:soundButton};
  const C={ink:"#d8ddd0",darkInk:"#222723",muted:"#858b81",rail:"#d9ddd4",edge:"#666c65",blue:"#2c9bd4",red:"#e34f32",green:"#69a956",yellow:"#e4c64e",white:"#eceee8",field:"#20231e"};
  const GRID={cell:20,step:10,cols:38,rows:59,clearance:15};
  const gx=col=>col*GRID.step,gy=row=>row*GRID.step,point=(col,row)=>[gx(col),gy(row)],circleAt=(col,row,r,...data)=>[gx(col),gy(row),r,...data];
  const G={
    rails:{
      boundary:[[58,300,58,900],[58,900,92,950],[92,950,285,1115],[285,1115,335,1115],[425,1115,565,1115],[565,1115,650,1035],[650,1035,650,510],[58,300,64,235],[64,235,84,165],[84,165,120,112],[120,112,170,80],[170,80,235,62],[235,62,575,62]],
      shooter:[[674,1090,674,490],[674,490,674,250],[674,250,666,210],[666,210,650,175],[650,175,625,145],[726,1090,726,125],[726,125,704,93],[704,93,670,72],[670,72,575,62]],
      sides:[[105,510,105,855],[610,510,610,935],[610,935,550,985]],
      returns:[[105,855,145,900],[145,900,205,950],[600,855,560,900],[560,900,515,940]],
      outlanes:[[105,855,105,935],[105,935,165,985]]
    },
    circles:{
      awards:[circleAt(25,16,26,10),circleAt(38,16,26,25),circleAt(51,16,26,50)],
      bumpers:[circleAt(38,35,42),circleAt(28,46,42),circleAt(49,46,42)],
      posts:[circleAt(26,76,10),circleAt(50,76,10),circleAt(26,84,10),circleAt(50,84,10)]
    },
    lines:{upperSlings:[[145,420,225,315],[615,420,535,315]]},
    polys:{
      midSlings:[[[145,625],[165,625],[235,705],[220,720],[145,670]],[[595,625],[575,625],[505,705],[520,720],[595,670]]],
      lowerSlings:[[[165,760],[185,750],[235,840],[215,855],[165,825]],[[595,760],[575,750],[525,840],[545,855],[595,825]]]
    },
    drops:[[gx(33),gy(67),34,42],[gx(38),gy(67),34,42],[gx(43),gy(67),34,42]],
    inserts:[[260,235,14],[500,235,14],[305,595,13],[380,585,13],[455,595,13],[380,1065,14]],
    triangles:[[175,210],[585,210],[300,570],[460,570]],
    spinner:{x:gx(38),y:gy(78),r:15},
    flippers:[{pivot:{x:gx(25),y:gy(100)},len:118,rest:.42,active:-.5},{pivot:{x:gx(51),y:gy(100)},len:118,rest:Math.PI-.42,active:Math.PI+.5}],
    sensors:{shooterExit:[690,175,40,52],spinner:[380,775,70,24],jackpot:[380,735,82,20],drain:[380,1142,120,28],leftDrain:[88,920,42,82],rightDrain:[630,920,40,82]}
  };
  const LABELS=[
    ["TG1",250,118],["TG2",380,118],["TG3",510,118],
    ["IN1",260,265],["IN2",500,265],["IN3",305,620],["IN4",380,615],["IN5",455,620],["IN6",380,1090],
    ["MK1",175,185],["MK2",585,185],["MK3",300,545],["MK4",460,545],
    ["US1",160,365],["US2",600,365],["BM1",380,295],["BM2",275,505],["BM3",485,505],
    ["MS1",175,690],["MS2",565,690],["DT1",330,710],["DT2",380,710],["DT3",430,710],["SP1",380,835],
    ["PO1",260,735],["PO2",500,735],["PO3",260,865],["PO4",500,865],
    ["LS1",190,810],["LS2",570,810],["FL1",250,1035],["FL2",510,1035],
    ["WL1",105,535],["RT1",175,925],["RT2",545,915],["OL1",115,960],["OL2",625,720],
    ["SH1",700,470],["PL1",700,1120],["DR1",380,1168]
  ];
  const engine=Engine.create({gravity:{x:0,y:1,scale:.00116}}),world=engine.world,keys={left:false,right:false};
  const walls=[],bumpers=[],posts=[],slings=[],targets=[],sensors=[],flippers=[];
  let state="ready",points=0,ballsLeft=3,multi=1,high=+(localStorage.getItem("deadFlipHigh")||0),low=localStorage.getItem("deadFlipLow"),shortest=localStorage.getItem("deadFlipShortest"),longest=localStorage.getItem("deadFlipLongest"),sessionTime=0,last=0,acc=0,shake=0,muted=false,audio;
  low=low===null?null:+low;shortest=shortest===null?null:+shortest;longest=longest===null?null:+longest;
  let charging=false,charge=0,ball=null,ballQueued=false,stuckClock=0,searchPulses=0,jackpotOpen=false,targetReset=0,spinnerCool=0,debug=false,exitCrossed=false,drainFlash=0,readyFlash=0;
  const tag=(body,type,data={})=>{body.game={type,...data};return body};
  function rail(a,w=9,group="rail"){const [x1,y1,x2,y2]=a,dx=x2-x1,dy=y2-y1,b=tag(Bodies.rectangle((x1+x2)/2,(y1+y2)/2,Math.hypot(dx,dy),w,{isStatic:true,angle:Math.atan2(dy,dx),restitution:.68,friction:0}),"wall",{line:a,width:w,group});walls.push(b);return b}
  Object.entries(G.rails).forEach(([group,list])=>list.forEach(v=>rail(v,group==="shooter"?8:9,group)));
  G.lines.upperSlings.forEach((v,i)=>{const b=rail(v,18,`upperSling${i}`);b.game={type:"sling",line:v,width:18,index:i,hit:0,color:C.blue,group:`upperSling${i}`};slings.push(b)});
  G.circles.awards.forEach(([x,y,r,value],i)=>targets.push(tag(Bodies.circle(x,y,r,{isStatic:true,restitution:.82}),"award",{index:i,value,hit:0,down:false})));
  G.circles.bumpers.forEach(([x,y,r],i)=>bumpers.push(tag(Bodies.circle(x,y,r,{isStatic:true,restitution:1.2,friction:0}),"bumper",{index:i,hit:0})));
  G.circles.posts.forEach(([x,y,r],i)=>posts.push(tag(Bodies.circle(x,y,r,{isStatic:true,restitution:.82}),"post",{id:`PO${i+1}`,clearance:GRID.clearance})));
  Object.entries(G.polys).forEach(([group,list])=>list.forEach((pts,i)=>{const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cy=pts.reduce((s,p)=>s+p[1],0)/pts.length,verts=pts.map(([x,y])=>({x:x-cx,y:y-cy})),b=tag(Bodies.fromVertices(cx,cy,[verts],{isStatic:true,restitution:1.02}),"sling",{group:`${group}${i}`,kind:group,index:i,points:pts,hit:0,color:group==="midSlings"?C.blue:C.red});slings.push(b)}));
  G.drops.forEach(([x,y,w,h],i)=>targets.push(tag(Bodies.rectangle(x,y,w,h,{isStatic:true,restitution:.75}),"drop",{index:i,down:false,hit:0})));
  const spinnerBody=tag(Bodies.rectangle(G.spinner.x,G.spinner.y,42,7,{isStatic:true,restitution:.9,friction:0}),"spinner",{hit:0});
  function sensor(v,type){const [x,y,w,h]=v,b=tag(Bodies.rectangle(x,y,w,h,{isStatic:true,isSensor:true}),type);sensors.push(b);return b}
  Object.entries(G.sensors).forEach(([name,v])=>sensor(v,name));
  G.flippers.forEach((d,i)=>{const f={...d,angle:d.rest,body:null};f.body=tag(Bodies.rectangle(d.pivot.x+Math.cos(d.rest)*d.len/2,d.pivot.y+Math.sin(d.rest)*d.len/2,d.len,28,{isStatic:true,angle:d.rest,restitution:.58}),"flipper",{index:i});flippers.push(f);walls.push(f.body)});
  World.add(world,[...walls,...bumpers,...posts,...slings,...targets,...sensors,spinnerBody]);
  function fmt(n){return Math.floor(n).toString().padStart(6,"0")}
  function initAudio(){if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==="suspended")audio.resume()}
  function sfx(freq=220,dur=.08,type="square",vol=.035){if(muted)return;initAudio();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.7),audio.currentTime+dur);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}
  function fmtTime(seconds){const total=Math.max(0,Math.floor(seconds)),minutes=Math.floor(total/60);return `${minutes.toString().padStart(2,"0")}:${(total%60).toString().padStart(2,"0")}`}
  function updateUI(){ui.score.textContent=fmt(points);ui.balls.textContent=ballsLeft;ui.high.textContent=fmt(high);ui.low.textContent=low===null?"------":fmt(low);ui.shortest.textContent=shortest===null?"--:--":fmtTime(shortest);ui.longest.textContent=longest===null?"--:--":fmtTime(longest);ui.multi.textContent=`${multi}X`}
  function pop(text){ui.callout.textContent=text;ui.callout.classList.remove("pop");void ui.callout.offsetWidth;ui.callout.classList.add("pop")}
  function scoreAdd(base,label){points+=base*multi;if(label)pop(label);if(points>high){high=points;localStorage.setItem("deadFlipHigh",high)}updateUI()}
  function removeBall(){if(ball){World.remove(world,ball);ball=null}}
  function resetSearch(){stuckClock=0;searchPulses=0;rescueButton.classList.remove("visible")}
  function readyBall(){removeBall();ballQueued=true;charging=false;charge=0;exitCrossed=false;readyFlash=1.25;resetSearch();ui.status.textContent="NEXT BALL READY";pop("BALL READY - HOLD SPACE");sfx(420,.08,"sine",.03);setTimeout(()=>state==="playing"&&ballQueued&&(ui.status.textContent="HOLD SPACE TO CHARGE"),1100)}
  function resetTable(){jackpotOpen=false;targetReset=0;targets.forEach(t=>{t.game.down=false;t.game.hit=0;t.collisionFilter.mask=0xFFFFFFFF})}
  function startGame(){initAudio();points=0;ballsLeft=3;multi=1;sessionTime=0;resetTable();state="playing";ui.overlay.classList.add("hidden");ui.start.querySelector("span").textContent="START GAME";readyBall();updateUI();sfx(160,.14,"sawtooth",.04)}
  function beginCharge(){if(state!=="playing"||ball)return;charging=true;charge=Math.max(charge,.04);initAudio()}
  function launchAt(power=charge){if(ball||state!=="playing")return;charging=false;ballQueued=false;ball=tag(Bodies.circle(700,1070,BALL_R,{restitution:.7,friction:0,frictionAir:.001,density:.002}),"ball");World.add(world,ball);Body.setVelocity(ball,{x:0,y:-(51+Math.max(.04,power)*17)});charge=0;exitCrossed=false;ui.status.textContent="BALL IN SHOOTER LANE";sfx(130,.2,"sawtooth",.065)}
  function launch(){if(!charging)return;launchAt(charge)}
  function recordGame(){const duration=Math.max(1,Math.round(sessionTime));if(low===null||points<low){low=points;localStorage.setItem("deadFlipLow",low)}if(shortest===null||duration<shortest){shortest=duration;localStorage.setItem("deadFlipShortest",shortest)}if(longest===null||duration>longest){longest=duration;localStorage.setItem("deadFlipLongest",longest)}updateUI();return duration}
  function drain(){if(!ball)return;removeBall();ballQueued=false;ballsLeft--;drainFlash=1;shake=Math.max(shake,8);sfx(92,.42,"sawtooth",.07);setTimeout(()=>sfx(58,.32,"square",.035),90);updateUI();if(ballsLeft<=0){state="gameover";const duration=recordGame();ui.title.innerHTML="GAME<br>OVER";ui.copy.textContent=`FINAL ${fmt(points)} / ${fmtTime(duration)}`;ui.start.querySelector("span").textContent="PLAY AGAIN";ui.overlay.classList.remove("hidden");ui.status.textContent="GAME OVER"}else{ui.status.textContent="BALL DRAINED";pop(`BALL DRAINED - ${ballsLeft} LEFT`);setTimeout(()=>state==="playing"&&readyBall(),900)}}
  function rescue(){if(!ball||state!=="playing")return;pop("BALL RESCUED");sfx(310,.16,"sine",.04);readyBall()}
  function kickFrom(body,power){if(!ball)return;const dx=ball.position.x-body.position.x,dy=ball.position.y-body.position.y,d=Math.hypot(dx,dy)||1;Body.setVelocity(ball,{x:dx/d*power,y:dy/d*power})}
  function hit(body){const g=body.game;if(!g)return;
    if(g.type==="bumper"&&g.hit<=0){g.hit=.14;kickFrom(body,19);shake=4;scoreAdd(1000,"BUMPER +1000");sfx(240+g.index*70)}
    if(g.type==="sling"&&g.hit<=0){g.hit=.13;kickFrom(body,g.kind==="lowerSlings"?17:15);scoreAdd(150,"SLING +150");sfx(175,.05)}
    if(g.type==="award"&&!g.down){g.down=true;g.hit=.2;body.collisionFilter.mask=0;scoreAdd(g.value*100,`${g.value} TARGET`);sfx(420+g.index*100,.1);if(targets.filter(t=>t.game.type==="award").every(t=>t.game.down)){multi=Math.min(5,multi+1);pop(`${multi}X MULTIPLIER`);updateUI();targetReset=6}}
    if(g.type==="drop"&&!g.down){g.down=true;g.hit=.2;body.collisionFilter.mask=0;scoreAdd(750,"DROP +750");sfx(500,.07);if(targets.filter(t=>t.game.type==="drop").every(t=>t.game.down)){jackpotOpen=true;scoreAdd(3000,"BANK COMPLETE +3000");targetReset=7}}
    if(g.type==="spinner"&&spinnerCool<=0){spinnerCool=.35;scoreAdd(100,"SPINNER +100");sfx(700,.05,"triangle")}
    if(g.type==="jackpot"&&jackpotOpen){jackpotOpen=false;scoreAdd(10000,"BONUS +10000");sfx(840,.22,"square",.055)}
    if(g.type==="shooterExit"&&!exitCrossed&&ball){exitCrossed=true;Body.setPosition(ball,{x:665,y:205});Body.setVelocity(ball,{x:-11,y:Math.max(4,Math.abs(ball.velocity.y)*.18)});ui.status.textContent="BALL IN PLAY";scoreAdd(500,"SKILL SHOT +500")}
    if(g.type==="drain"||g.type==="leftDrain"||g.type==="rightDrain")drain();
  }
  Events.on(engine,"collisionStart",e=>e.pairs.forEach(p=>{const other=p.bodyA===ball?p.bodyB:p.bodyB===ball?p.bodyA:null;if(other)hit(other)}));
  function tick(dt){sessionTime+=dt;drainFlash=Math.max(0,drainFlash-dt*1.8);readyFlash=Math.max(0,readyFlash-dt);flippers.forEach((f,i)=>{const target=(i?keys.right:keys.left)?f.active:f.rest;f.angle+=(target-f.angle)*Math.min(1,dt*42);Body.setAngle(f.body,f.angle);Body.setPosition(f.body,{x:f.pivot.x+Math.cos(f.angle)*f.len/2,y:f.pivot.y+Math.sin(f.angle)*f.len/2})});Body.setAngle(spinnerBody,(performance.now()/120)%Math.PI);if(charging){charge=Math.min(1,charge+dt*.7);ui.status.textContent=`PLUNGER ${Math.round(charge*100)}%`}
    [...bumpers,...slings,...targets].forEach(b=>b.game.hit=Math.max(0,(b.game.hit||0)-dt));spinnerCool=Math.max(0,spinnerCool-dt);if(targetReset>0&&(targetReset-=dt)<=0)targets.forEach(t=>{t.game.down=false;t.collisionFilter.mask=0xFFFFFFFF});
    if(ball){const speed=ball.speed;if(speed<.62)stuckClock+=dt;else if(stuckClock>=3.5){resetSearch();ui.status.textContent=exitCrossed?"BALL IN PLAY":"BALL IN SHOOTER LANE"}else stuckClock=0;if(stuckClock>=4){ui.status.textContent="BALL SEARCH";rescueButton.classList.add("visible");const due=stuckClock>=5.2?2:1;if(searchPulses<due){searchPulses=due;Body.setVelocity(ball,{x:(Math.random()-.5)*7,y:-9});pop(`BALL SEARCH ${due}/2`)}if(stuckClock>=7)rescue()}if(ball.position.y>1170)drain()}
    shake*=.9;Engine.update(engine,STEP)
  }
  function line(v,w=8,c=C.rail){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(v[0],v[1]);ctx.lineTo(v[2],v[3]);ctx.stroke()}
  function drawRails(list,w=8){list.forEach(v=>{line(v,w+4,C.edge);line(v,w,C.rail)})}
  function polygon(pts,fill,stroke=C.edge,w=5){ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();ctx.stroke()}
  function circle(x,y,r,fill,stroke=C.edge,w=5){ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke()}
  function drawFlipper(f,i){const x=f.pivot.x+Math.cos(f.angle)*f.len,y=f.pivot.y+Math.sin(f.angle)*f.len;line([f.pivot.x,f.pivot.y,x,y],29,C.edge);line([f.pivot.x,f.pivot.y,x,y],21,C.white);circle(f.pivot.x,f.pivot.y,7,i?C.red:C.blue,C.edge,2)}
  function drawLabels(){ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="700 11px IBM Plex Mono";LABELS.forEach(([text,x,y])=>{const w=ctx.measureText(text).width+8;ctx.fillStyle="rgba(12,14,12,.86)";ctx.strokeStyle="rgba(223,196,86,.72)";ctx.lineWidth=1;ctx.fillRect(x-w/2,y-8,w,16);ctx.strokeRect(x-w/2+.5,y-7.5,w-1,15);ctx.fillStyle=C.yellow;ctx.fillText(text,x,y+.5)});ctx.restore()}
  function drawDebug(){ctx.save();ctx.globalAlpha=.72;ctx.strokeStyle="#39443d";ctx.lineWidth=1;for(let x=0;x<=W;x+=GRID.cell){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<=H;y+=GRID.cell){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}walls.forEach(b=>{if(b.game.type==="flipper")return;line(b.game.line,b.game.width,"#00ccec")});ctx.strokeStyle="#ff35c8";ctx.lineWidth=2;sensors.forEach(s=>ctx.strokeRect(s.bounds.min.x,s.bounds.min.y,s.bounds.max.x-s.bounds.min.x,s.bounds.max.y-s.bounds.min.y));ctx.strokeStyle="#ff9d2e";flippers.forEach(f=>{ctx.beginPath();ctx.arc(f.pivot.x,f.pivot.y,f.len,Math.min(f.rest,f.active),Math.max(f.rest,f.active));ctx.stroke()});ctx.strokeStyle="#42e56c";posts.forEach(p=>{ctx.beginPath();ctx.arc(p.position.x,p.position.y,p.circleRadius+GRID.clearance,0,Math.PI*2);ctx.stroke()});ctx.beginPath();ctx.arc(700,1070,SAFE_D/2,0,Math.PI*2);ctx.stroke();[[674,726,1060],[625,674,175],[338,422,345],[105,635,520],[354,406,995]].forEach(([a,b,y])=>{ctx.beginPath();ctx.moveTo(a,y);ctx.lineTo(b,y);ctx.stroke()});ctx.restore()}
  function draw(){ctx.save();ctx.clearRect(0,0,W,H);ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);ctx.fillStyle="#181a18";ctx.fillRect(0,0,W,H);ctx.fillStyle=C.field;ctx.beginPath();ctx.moveTo(58,300);ctx.quadraticCurveTo(58,62,250,62);ctx.lineTo(575,62);ctx.quadraticCurveTo(650,70,674,170);ctx.lineTo(674,1035);ctx.lineTo(565,1115);ctx.lineTo(285,1115);ctx.lineTo(58,900);ctx.closePath();ctx.fill();
    drawRails(G.rails.boundary);drawRails(G.rails.shooter,7);drawRails(G.rails.sides,7);drawRails(G.rails.returns,7);drawRails(G.rails.outlanes,7);
    G.circles.awards.forEach(([x,y,r,value],i)=>{const t=targets[i];if(!t.game.down){circle(x,y,r,C.white,[C.blue,C.green,C.red][i],5);ctx.fillStyle=C.darkInk;ctx.font="800 22px Barlow Condensed";ctx.textAlign="center";ctx.fillText(value,x,y+7)}});
    G.inserts.forEach(([x,y,r],i)=>circle(x,y,r,i===5?(jackpotOpen?C.yellow:C.green):C.green,C.white,4));G.triangles.forEach(([x,y])=>polygon([[x,y-13],[x-12,y+11],[x+12,y+11]],C.yellow,C.darkInk,2));
    G.lines.upperSlings.forEach((v,i)=>{line(v,23,C.edge);line(v,16,i?C.blue:C.blue);circle(v[2],v[3],7,C.white,C.edge,2)});
    bumpers.forEach(b=>{const s=b.game.hit?1.08:1;ctx.save();ctx.translate(b.position.x,b.position.y);ctx.scale(s,s);circle(0,0,b.circleRadius,C.white,C.edge,5);circle(0,0,b.circleRadius-13,"#eef0eb",C.red,5);ctx.restore()});
    posts.forEach(p=>circle(p.position.x,p.position.y,p.circleRadius,C.white,C.edge,3));
    G.polys.midSlings.forEach(p=>polygon(p,C.blue,C.edge,5));G.polys.lowerSlings.forEach(p=>polygon(p,C.red,C.edge,5));
    targets.filter(t=>t.game.type==="drop").forEach(t=>{if(!t.game.down){const [x,y,w,h]=G.drops[t.game.index];ctx.fillStyle=t.game.hit?C.yellow:"#777d78";ctx.strokeStyle=C.darkInk;ctx.lineWidth=3;ctx.fillRect(x-w/2,y-h/2,w,h);ctx.strokeRect(x-w/2,y-h/2,w,h)}});
    ctx.save();ctx.translate(G.spinner.x,G.spinner.y);ctx.rotate(spinnerBody.angle);line([-21,0,21,0],9,C.edge);line([-18,0,18,0],5,C.blue);circle(0,0,4,C.white,C.edge,1);ctx.restore();ctx.fillStyle=C.ink;ctx.font="700 13px Barlow Condensed";ctx.textAlign="center";ctx.fillText("SPINNER 100",380,810);ctx.fillText("DROP TARGETS",380,640);ctx.fillText("OUTLANE BONUS",380,1098);
    flippers.forEach(drawFlipper);ctx.fillStyle=drainFlash?`rgba(227,79,50,${.22+drainFlash*.55})`:"#0d0f0d";ctx.beginPath();ctx.moveTo(335,1098);ctx.lineTo(425,1098);ctx.lineTo(440,1160);ctx.lineTo(320,1160);ctx.closePath();ctx.fill();ctx.strokeStyle=drainFlash?C.yellow:C.red;ctx.lineWidth=3+drainFlash*5;ctx.beginPath();ctx.moveTo(335,1100);ctx.lineTo(425,1100);ctx.stroke();ctx.fillStyle=drainFlash?C.yellow:C.muted;ctx.font="700 11px Barlow Condensed";ctx.fillText(drainFlash?"BALL LOST":"DRAIN",380,1145);const py=1090+charge*46;line([686,py,714,py],4,readyFlash&&Math.floor(readyFlash*8)%2?C.white:C.red);ctx.strokeStyle=C.edge;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(700,py+3);for(let y=py+8,s=-1;y<1150;y+=8,s*=-1)ctx.lineTo(700+s*7,y);ctx.stroke();if(charging){ctx.fillStyle=C.red;ctx.fillRect(681,1155,38*charge,5)}
    const shownBall=ball?ball.position:ballQueued?{x:700,y:1070}:null;if(shownBall){const g=ctx.createRadialGradient(shownBall.x-4,shownBall.y-5,2,shownBall.x,shownBall.y,BALL_R);g.addColorStop(0,"#fff");g.addColorStop(.45,"#c8ccc5");g.addColorStop(1,"#555b56");ctx.fillStyle=g;ctx.beginPath();ctx.arc(shownBall.x,shownBall.y,BALL_R,0,Math.PI*2);ctx.fill();if(ballQueued){ctx.strokeStyle=readyFlash&&Math.floor(readyFlash*8)%2?C.white:C.yellow;ctx.lineWidth=readyFlash?4:2;ctx.beginPath();ctx.arc(shownBall.x,shownBall.y,BALL_R+4+readyFlash*4,0,Math.PI*2);ctx.stroke()}}if(drainFlash){ctx.fillStyle=`rgba(227,79,50,${drainFlash*.12})`;ctx.fillRect(0,0,W,H)}drawLabels();if(debug)drawDebug();ctx.restore()
  }
  function distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])-a[2]-b[2]}
  function validateGeometry(){const checks=[{name:"shooter channel",actual:726-674-8,minimum:42},{name:"shooter exit",actual:674-625,minimum:44},{name:"upper bumper left gap",actual:distance([380,350,42],[280,460,42]),minimum:36},{name:"upper bumper right gap",actual:distance([380,350,42],[490,460,42]),minimum:36},{name:"lower bumper gap",actual:distance([280,460,42],[490,460,42]),minimum:36},{name:"spinner approach",actual:430-330-34,minimum:42},{name:"flipper drain",actual:406-354,minimum:44},{name:"drain opening",actual:425-335,minimum:44},{name:"OL2 channel",actual:650-610,minimum:36}];const bodies=[...walls.filter(b=>b.game.type!=="flipper"),...bumpers,...posts,...slings,...targets.filter(t=>!t.game.down),spinnerBody],overlaps=[],clearanceConflicts=[],joined=new Set(["boundary:shooter","returns:sides","outlanes:returns"]);for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j],pair=[a.game.group,b.game.group].sort().join(":");if(a.game.group&&a.game.group===b.game.group||joined.has(pair))continue;if(Matter.Collision.collides(a,b))overlaps.push(`${a.game.id||a.game.type} / ${b.game.id||b.game.type}`)}posts.forEach(p=>{const envelope=Bodies.circle(p.position.x,p.position.y,p.circleRadius+GRID.clearance,{isStatic:true});[...slings,...walls.filter(w=>w.game.type!=="flipper")].forEach(o=>{if(Matter.Collision.collides(envelope,o))clearanceConflicts.push(`${p.game.id} clearance / ${o.game.group||o.game.type}`)})});const aligned=[...G.circles.awards,...G.circles.bumpers,...G.circles.posts,...G.drops].every(v=>v[0]%GRID.step===0&&v[1]%GRID.step===0);return {ok:checks.every(c=>c.actual>=c.minimum)&&overlaps.length===0&&clearanceConflicts.length===0&&aligned,grid:{cell:GRID.cell,step:GRID.step,aligned},checks:checks.map(c=>({...c,actual:Math.round(c.actual*10)/10,ok:c.actual>=c.minimum})),overlaps,clearanceConflicts}}
  function frame(t){const dt=Math.min(.034,(t-last)/1000||0);last=t;if(state==="playing"){acc+=dt;while(acc>=1/120){tick(1/120);acc-=1/120}}draw();requestAnimationFrame(frame)}
  function setFlip(side,on){const wasOn=keys[side];keys[side]=on;document.getElementById(side==="left"?"leftTouch":"rightTouch").classList.toggle("active",on);if(on&&!wasOn&&ball&&ball.position.y>900){const pivot=flippers[side==="left"?0:1].pivot,dx=ball.position.x-pivot.x,dy=ball.position.y-pivot.y,d=Math.hypot(dx,dy);if(d<155&&dy<45){const outward=side==="left"?1:-1,tipFactor=Math.max(.35,Math.min(1,(Math.abs(dx)-12)/105));Body.setVelocity(ball,{x:ball.velocity.x+outward*(3+tipFactor*5),y:Math.min(ball.velocity.y,-18-tipFactor*9)});shake=Math.max(shake,2);sfx(125,.045,"square",.025)}}}
  addEventListener("keydown",e=>{if(["Space","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==="KeyZ"||e.code==="ArrowLeft")setFlip("left",true);if(e.code==="Slash"||e.code==="ArrowRight")setFlip("right",true);if(e.code==="Space"){if(state==="ready"||state==="gameover")startGame();else beginCharge()}if(e.code==="KeyP")togglePause();if(e.code==="KeyD"&&e.shiftKey)debug=!debug;if((e.code==="ArrowLeft"||e.code==="ArrowRight")&&ball)Body.setVelocity(ball,{x:ball.velocity.x+(e.code==="ArrowLeft"?-2.2:2.2),y:ball.velocity.y})});
  addEventListener("keyup",e=>{if(e.code==="KeyZ"||e.code==="ArrowLeft")setFlip("left",false);if(e.code==="Slash"||e.code==="ArrowRight")setFlip("right",false);if(e.code==="Space")launch()});
  function bind(id,side){const el=document.getElementById(id);el.addEventListener("pointerdown",e=>{e.preventDefault();setFlip(side,true)});["pointerup","pointercancel","pointerleave"].forEach(v=>el.addEventListener(v,()=>setFlip(side,false)))}bind("leftTouch","left");bind("rightTouch","right");
  launchTouch.addEventListener("pointerdown",e=>{e.preventDefault();if(state==="ready"||state==="gameover")startGame();else beginCharge()});["pointerup","pointercancel","pointerleave"].forEach(v=>launchTouch.addEventListener(v,launch));
  function togglePause(){if(state==="playing"){state="paused";ui.title.textContent="PAUSED";ui.copy.textContent="The machine is holding its breath.";ui.start.querySelector("span").textContent="RESUME";ui.overlay.classList.remove("hidden")}else if(state==="paused"){state="playing";ui.overlay.classList.add("hidden")}}
  function placeBall(x,y,vx=0,vy=0){removeBall();ball=tag(Bodies.circle(x,y,BALL_R,{restitution:.7,friction:0,frictionAir:.001,density:.002}),"ball");World.add(world,ball);Body.setVelocity(ball,{x:vx,y:vy});return ball}
  window.__pinballTest={validateGeometry,start:startGame,launch:launchAt,placeBall,getBall:()=>ball&&({x:ball.position.x,y:ball.position.y,vx:ball.velocity.x,vy:ball.velocity.y}),getState:()=>({state,ballsLeft,points,exitCrossed,jackpotOpen,ballQueued,sessionTime,low,shortest,longest,drainFlash,readyFlash,status:ui.status.textContent}),setDebug:v=>debug=!!v,flip:setFlip,removeBall};
  ui.start.addEventListener("click",()=>state==="paused"?togglePause():startGame());pauseButton.addEventListener("click",togglePause);restartButton.addEventListener("click",startGame);rescueButton.addEventListener("click",rescue);ui.sound.addEventListener("click",()=>{muted=!muted;ui.sound.classList.toggle("muted",muted)});updateUI();requestAnimationFrame(frame);
})();
