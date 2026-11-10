(() => {
  'use strict';
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d', { alpha: false });
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  const WORLD = { minX: -1500, maxX: 1850, minY: -900, maxY: 900 };
  let W = innerWidth, H = innerHeight, dpr = 1, elapsed = 0, last = performance.now();
  let active = false, paused = false, dialoguePerson = null, toastTimer = 0, damageFlash = 0;
  const keys = new Set();
  const player = { x: -610, y: 80, vx: 0, vy: 0, faceX: 1, faceY: 0, hp: 100, stamina: 100, attack: 0, attackCooldown: 0, dodge: 0, invuln: 0, step: 0 };
  const quest = { stage: 0, spoken: new Set(), freed: new Set() };
  const villagers = [
    { id:'mara', name:'Mara', role:'VILLAGE HERBALIST', x:-67, y:-83, coat:'#a87853', fur:'#eee6ce', ear:'droop', horn:'#b9a784', mood:'worried', lines:0, greeting:'You came all this way on foot? Then you have my respect already. I am Mara. We have been trying to keep the lamps lit and the fear outside.' },
    { id:'tovin', name:'Tovin', role:'SHEPHERD OF BELLWETHER', x:93, y:27, coat:'#71866c', fur:'#c4b393', ear:'perky', horn:'#86765e', mood:'steadfast', lines:0, greeting:'The valley used to be quiet enough to hear the grass grow. I am Tovin. The raiders have made a habit of coming down the east road after dusk.' },
    { id:'elin', name:'Elin', role:'VILLAGE STORYKEEPER', x:-3, y:122, coat:'#9c6680', fur:'#e5d7c1', ear:'perky', horn:'#8a795f', mood:'hopeful', lines:0, greeting:'A stranger, and not one of the people who came with ropes. I am Elin. That is already a promising start to a story.' },
    { id:'oren', name:'Oren', role:'MILLER', x:208, y:-65, coat:'#647b89', fur:'#b5a27f', ear:'droop', horn:'#655d50', mood:'anxious', lines:0, greeting:'I keep listening for the mill wheel. It is strange what you miss when a village goes quiet. Oren, at your service.' }
  ];
  const enemies = [
    { id:'raider1',name:'Brann',species:'HUMAN RAIDER',x:1126,y:-88,hp:3,maxHp:3,coat:'#75483b',fur:'#b28c65',cool:0,faceX:-1,alive:true },
    { id:'raider2',name:'Sable',species:'FOX RAIDER',x:1314,y:41,hp:3,maxHp:3,coat:'#59433a',fur:'#bc8154',cool:.6,faceX:-1,alive:true },
    { id:'raider3',name:'Grusk',species:'BOAR RAIDER',x:1194,y:147,hp:4,maxHp:4,coat:'#4d5150',fur:'#84736a',cool:1.2,faceX:-1,alive:true }
  ];
  const captives = [
    { id:'captive1',name:'Pella',x:1380,y:-35,freed:false,fur:'#d9d0b8',coat:'#997559',ear:'droop' },
    { id:'captive2',name:'Nim',x:1434,y:35,freed:false,fur:'#a89578',coat:'#72826d',ear:'perky' },
    { id:'captive3',name:'Alder',x:1385,y:111,freed:false,fur:'#ede1c5',coat:'#8a6e82',ear:'droop' }
  ];
  const houses = [
    {x:-185,y:-22,w:100,h:68,wall:'#d7bf91',roof:'#75483d',name:'MARA’S COTTAGE'},
    {x:146,y:104,w:118,h:77,wall:'#b9c2a0',roof:'#806043',name:'THE LONGHOUSE'},
    {x:230,y:-143,w:92,h:66,wall:'#d2b88a',roof:'#8f5f42',name:'OLD MILL'},
    {x:-255,y:153,w:81,h:62,wall:'#bcbf9f',roof:'#6f6151',name:'THE BAKEHOUSE'}
  ];
  const zones = [
    {name:'THE OLD ROAD',x:-610,y:80,r:360},
    {name:'BELLWETHER',x:0,y:0,r:310},
    {name:'BRACKEN MEADOW',x:560,y:-60,r:370},
    {name:'RAIDER OUTPOST',x:1240,y:55,r:400}
  ];
  const worldSeed = n => { const s=Math.sin(n*127.1+311.7)*43758.5453; return s-Math.floor(s); };
  function resize(){ W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0); }
  addEventListener('resize',resize); resize();
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function nearestEntity(){let list=[...villagers.filter(v=>v.x!=null),...captives.filter(c=>c.freed),...captives.filter(c=>!c.freed&&c.x!=null)];let n=null,nd=90;for(const e of list){const d=dist(player,e);if(d<nd){n=e;nd=d}}if(enemies.some(e=>e.alive&&dist(player,e)<78))return null;return n}
  function currentZone(){let z=zones[0];for(const q of zones)if(Math.hypot(player.x-q.x,player.y-q.y)<q.r)z=q;return z}
  function updateQuestUI(){
    const title=$('quest-title'),copy=$('quest-copy'),stage=$('quest-stage'),count=$('quest-count'),fill=$('quest-progress-fill');
    if(quest.stage===0){title.textContent='A village in need';copy.textContent='Find Bellwether and hear what troubles its people.';stage.textContent='THE BRACKEN VALE';count.textContent=`${quest.spoken.size} / 3`;fill.style.width=`${Math.min(quest.spoken.size/3,1)*100}%`}
    else if(quest.stage===1){title.textContent='A trail of ashes';copy.textContent='Follow the old road east. Find the raiders’ outpost.';stage.textContent='THE EASTERN ROAD';count.textContent='→';fill.style.width='48%'}
    else if(quest.stage===2){title.textContent='Bring them home';copy.textContent='Drive off the raiders and unlock the holding pens.';stage.textContent='RAIDER OUTPOST';count.textContent=`${enemies.filter(e=>e.alive).length} LEFT`;fill.style.width=`${60+(3-enemies.filter(e=>e.alive).length)*10}%`}
    else if(quest.stage===3){title.textContent='No one left behind';copy.textContent='Free the villagers being held in the pens.';stage.textContent='RAIDER OUTPOST';count.textContent=`${quest.freed.size} / 3`;fill.style.width=`${65+quest.freed.size/3*35}%`}
    else{title.textContent='A road made kinder';copy.textContent='The rescued villagers are safe. The vale remembers.';stage.textContent='JOURNEY COMPLETE';count.textContent='✦';fill.style.width='100%'}
  }
  function sayToast(text){const el=$('toast');el.textContent=text;el.classList.add('visible');toastTimer=2.6}
  function drawPath(){
    ctx.save();ctx.beginPath();ctx.moveTo(-1700,175);ctx.bezierCurveTo(-1050,250,-800,-200,-360,-56);ctx.bezierCurveTo(-80,18,185,-45,430,-4);ctx.bezierCurveTo(745,53,770,145,1010,95);ctx.bezierCurveTo(1130,70,1130,10,1240,14);
    ctx.lineCap='round';ctx.lineWidth=106;ctx.strokeStyle='#8c8063';ctx.stroke();ctx.lineWidth=92;ctx.strokeStyle='#b9a985';ctx.stroke();ctx.lineWidth=75;ctx.strokeStyle='#c8b997';ctx.stroke();ctx.globalAlpha=.22;ctx.lineWidth=1;
    for(let i=0;i<115;i++){let x=-1650+i*26,y=95+Math.sin(i*.07)*112+Math.sin(i*.027)*35;ctx.beginPath();ctx.ellipse(x,y,3+worldSeed(i)*7,1.3,worldSeed(i+8),0,TAU);ctx.fillStyle=i%2?'#f0dfb9':'#726c57';ctx.fill()}ctx.restore();
  }
  function drawGround(){
    ctx.fillStyle='#80936a';ctx.fillRect(-1800,-1100,3800,2200);
    // Broad, painterly meadow patches.
    for(let i=0;i<95;i++){let x=-1550+worldSeed(i+3)*3300,y=-850+worldSeed(i+22)*1700,r=45+worldSeed(i+41)*120;ctx.beginPath();ctx.ellipse(x,y,r,r*.44,worldSeed(i)*3,0,TAU);ctx.fillStyle=['rgba(181,176,112,.09)','rgba(46,91,61,.10)','rgba(218,197,135,.10)','rgba(231,219,168,.10)'][i%4];ctx.fill()}
    // Fine grass flecks repeat deterministically in the moving view.
    let x0=Math.floor((player.x-W/2-100)/48),x1=Math.ceil((player.x+W/2+100)/48),y0=Math.floor((player.y-H/2-100)/48),y1=Math.ceil((player.y+H/2+100)/48);
    for(let ix=x0;ix<=x1;ix++)for(let iy=y0;iy<=y1;iy++){const seed=ix*99+iy*317,r=worldSeed(seed);if(r<.28)continue;const x=ix*48+worldSeed(seed+7)*44,y=iy*48+worldSeed(seed+13)*44;if(Math.hypot(x,y)<285||Math.hypot(x-1240,y-55)<300)continue;ctx.strokeStyle=r>.83?'rgba(231,215,155,.45)':'rgba(40,78,48,.32)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y+3);ctx.lineTo(x-2+worldSeed(seed+5)*5,y-3);ctx.stroke();if(r>.94){ctx.fillStyle='rgba(232,222,180,.7)';ctx.beginPath();ctx.arc(x+2,y,1.3,0,TAU);ctx.fill()}}
    // Distant hedge and tree masses frame the playable meadow.
    for(let i=0;i<68;i++){const x=-1600+i*52,y=-660+worldSeed(i+130)*260;if(Math.abs(x)<430&&y<0)continue;drawTree(x,y,1.1+worldSeed(i+90)*.55,'distant',i)}
    for(let i=0;i<50;i++){const x=-1450+i*63,y=630+worldSeed(i+311)*205;drawTree(x,y,1+worldSeed(i+19)*.55,'distant',i+700)}
    drawPath(); drawRiver();
  }
  function drawRiver(){
    ctx.save();ctx.beginPath();ctx.moveTo(-165,790);ctx.bezierCurveTo(-70,510,190,360,338,150);ctx.bezierCurveTo(468,-34,355,-240,565,-470);ctx.lineWidth=68;ctx.strokeStyle='#567968';ctx.stroke();ctx.lineWidth=56;ctx.strokeStyle='#83a89a';ctx.stroke();ctx.lineWidth=38;ctx.strokeStyle='#9bbbab';ctx.stroke();ctx.globalAlpha=.28;ctx.lineWidth=2;for(let i=0;i<24;i++){let y=460-i*36,x=50+Math.sin(i*.47)*100;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+38,y-5,x+65,y-10);ctx.strokeStyle='#e2e4cc';ctx.stroke()}ctx.restore();
  }
  function drawTree(x,y,s=1,type='oak',seed=0){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    if(type==='distant'){ctx.globalAlpha=.6}
    ctx.fillStyle='rgba(27,39,26,.22)';ctx.beginPath();ctx.ellipse(6,7,30,13,0,0,TAU);ctx.fill();ctx.fillStyle='#655a40';ctx.fillRect(-5,-19,10,25);
    const colors=['#425f42','#506d47','#60774b','#6c8050','#52694a'];
    for(let i=0;i<5;i++){const a=i*1.25;ctx.beginPath();ctx.ellipse(Math.cos(a)*12,Math.sin(a)*8-24,20+worldSeed(seed*9+i)*8,17+worldSeed(seed+i)*8,a,0,TAU);ctx.fillStyle=colors[(seed+i)%colors.length];ctx.fill();ctx.beginPath();ctx.ellipse(Math.cos(a)*12-5,Math.sin(a)*8-29,9,5,a,0,TAU);ctx.fillStyle='rgba(200,191,119,.18)';ctx.fill()}
    ctx.restore();
  }
  function drawHouse(h){
    ctx.save();ctx.translate(h.x,h.y);ctx.fillStyle='rgba(26,35,27,.23)';ctx.beginPath();ctx.ellipse(8,h.h*.49,h.w*.68,15,0,0,TAU);ctx.fill();
    // house body and end wall
    ctx.fillStyle=h.wall;ctx.fillRect(-h.w/2,-h.h/2,h.w,h.h);ctx.fillStyle='rgba(83,66,47,.23)';ctx.fillRect(-h.w/2,-h.h/2,h.w,7);ctx.fillRect(h.w/2-10,-h.h/2,10,h.h);
    ctx.beginPath();ctx.moveTo(-h.w*.65,-h.h/2+2);ctx.lineTo(0,-h.h*.92);ctx.lineTo(h.w*.66,-h.h/2+2);ctx.lineTo(h.w*.48,-h.h*.57);ctx.lineTo(0,-h.h*.81);ctx.lineTo(-h.w*.48,-h.h*.57);ctx.closePath();ctx.fillStyle=h.roof;ctx.fill();
    ctx.strokeStyle='rgba(45,34,28,.25)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-h.w*.52,-h.h*.52);ctx.lineTo(0,-h.h*.84);ctx.lineTo(h.w*.52,-h.h*.52);ctx.stroke();
    ctx.fillStyle='#554838';ctx.fillRect(-10,h.h*.08,20,h.h*.42);ctx.fillStyle='rgba(224,195,126,.25)';ctx.fillRect(-h.w*.32,-h.h*.18,14,18);ctx.fillRect(h.w*.2,-h.h*.18,14,18);ctx.strokeStyle='#5e503c';ctx.strokeRect(-h.w*.32,-h.h*.18,14,18);ctx.strokeRect(h.w*.2,-h.h*.18,14,18);
    // chimney, roof texture and doorstep
    ctx.fillStyle='#77654d';ctx.fillRect(h.w*.24,-h.h*.93,13,19);ctx.fillStyle='#957c58';ctx.fillRect(h.w*.22,-h.h*.96,17,4);ctx.fillStyle='rgba(46,38,29,.19)';for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(-h.w*.42+i*13,-h.h*.67);ctx.lineTo(-h.w*.1+i*13,-h.h*.82);ctx.strokeStyle='#80604a';ctx.lineWidth=1;ctx.stroke()}
    ctx.restore();
  }
  function drawVillage(){
    // fence, flower beds, well and lamplight
    ctx.save();ctx.strokeStyle='#8d7954';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-360,-245);ctx.lineTo(330,-245);ctx.lineTo(360,250);ctx.moveTo(-345,205);ctx.lineTo(-360,-245);ctx.stroke();
    for(let x=-345;x<350;x+=30){if(x>-210&&x<-150)continue;ctx.fillStyle='#9c835c';ctx.fillRect(x,-252,4,18);ctx.fillRect(x,198,4,18)}
    ctx.fillStyle='#726248';ctx.beginPath();ctx.ellipse(0,-12,40,25,0,0,TAU);ctx.fill();ctx.fillStyle='#b9a987';ctx.beginPath();ctx.ellipse(0,-18,33,19,0,0,TAU);ctx.fill();ctx.fillStyle='#7fa6a0';ctx.beginPath();ctx.ellipse(0,-20,22,10,0,0,TAU);ctx.fill();ctx.fillStyle='#685c44';ctx.fillRect(-3,-48,6,26);ctx.fillRect(-26,-48,52,5);
    for(let i=0;i<25;i++){const x=-330+worldSeed(i+54)*630,y=-225+worldSeed(i+85)*435;if(Math.hypot(x,y)>285)continue;if(houses.some(h=>Math.abs(x-h.x)<h.w*.6&&Math.abs(y-h.y)<h.h*.65))continue;const c=['#d7c080','#e7d4a0','#bc8b87','#f0e2bd'][i%4];ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,1.8+worldSeed(i+121)*1.6,0,TAU);ctx.fill()}
    // lanterns glow at the village crossroads
    for(const [x,y] of [[-60,-3],[101,94],[256,-119]]){const g=ctx.createRadialGradient(x,y-30,1,x,y-30,53);g.addColorStop(0,'rgba(239,197,116,.27)');g.addColorStop(1,'rgba(239,197,116,0)');ctx.fillStyle=g;ctx.fillRect(x-53,y-83,106,106);ctx.fillStyle='#534d3a';ctx.fillRect(x-2,y-36,4,30);ctx.fillStyle='#e5c27b';ctx.beginPath();ctx.arc(x,y-39,4,0,TAU);ctx.fill()}
    ctx.restore();
    for(const h of houses)drawHouse(h);
    drawTree(-307,-111,1.15,'oak',45);drawTree(330,50,1.22,'oak',12);drawTree(62,-292,1.28,'oak',20);
  }
  function drawOutpost(){
    ctx.save();ctx.fillStyle='rgba(50,41,34,.13)';ctx.beginPath();ctx.ellipse(1240,55,285,208,0,0,TAU);ctx.fill();
    // muddy trampled clearing
    ctx.fillStyle='rgba(112,91,65,.4)';ctx.beginPath();ctx.ellipse(1240,55,250,176,-.04,0,TAU);ctx.fill();
    // stockade perimeter with irregular sharpened logs
    ctx.strokeStyle='#554638';ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(1030,-120);ctx.lineTo(1450,-120);ctx.lineTo(1480,190);ctx.lineTo(1025,190);ctx.closePath();ctx.stroke();ctx.strokeStyle='#977852';ctx.lineWidth=5;ctx.stroke();
    for(let x=1035;x<=1455;x+=21){for(const y of [-120,190]){ctx.fillStyle='#634b37';ctx.beginPath();ctx.moveTo(x-5,y+5);ctx.lineTo(x,y-22);ctx.lineTo(x+5,y+5);ctx.fill()} }
    for(let y=-110;y<=185;y+=23){for(const x of [1030,1453]){ctx.fillStyle='#624b38';ctx.beginPath();ctx.moveTo(x-5,y+5);ctx.lineTo(x,y-22);ctx.lineTo(x+5,y+5);ctx.fill()}}
    // gate and watch shelter
    ctx.fillStyle='#393a31';ctx.fillRect(1007,-10,42,82);ctx.strokeStyle='#ad956a';ctx.lineWidth=3;ctx.strokeRect(1007,-10,42,82);for(let y=-8;y<72;y+=14){ctx.beginPath();ctx.moveTo(1007,y);ctx.lineTo(1049,y);ctx.stroke()}
    ctx.fillStyle='#50483d';ctx.fillRect(1275,-79,92,62);ctx.beginPath();ctx.moveTo(1262,-76);ctx.lineTo(1320,-111);ctx.lineTo(1381,-76);ctx.fillStyle='#4b3b34';ctx.fill();ctx.fillStyle='#252b26';ctx.fillRect(1306,-54,26,38);
    // cages/holding pens
    for(const x of [1364,1420]){ctx.fillStyle='rgba(51,42,33,.52)';ctx.fillRect(x-24,-20,46,74);ctx.strokeStyle='#8d7857';ctx.lineWidth=3;ctx.strokeRect(x-24,-20,46,74);for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(x-24+i*9,-19);ctx.lineTo(x-24+i*9,53);ctx.stroke()}ctx.strokeStyle='#d5bb84';ctx.beginPath();ctx.moveTo(x-25,54);ctx.lineTo(x+23,54);ctx.stroke()}
    // supply crates, barrels and fire pit
    for(const [x,y] of [[1088,124],[1105,128],[1152,-75],[1438,124],[1170,150]]){ctx.fillStyle='#806748';ctx.fillRect(x-11,y-10,23,20);ctx.strokeStyle='#493f33';ctx.lineWidth=2;ctx.strokeRect(x-11,y-10,23,20);ctx.beginPath();ctx.moveTo(x-10,y-2);ctx.lineTo(x+10,y-2);ctx.stroke()}
    ctx.fillStyle='#5d5547';ctx.beginPath();ctx.ellipse(1175,40,25,15,0,0,TAU);ctx.fill();const flame=ctx.createRadialGradient(1175,36,1,1175,36,42);flame.addColorStop(0,'rgba(253,194,102,.6)');flame.addColorStop(1,'rgba(240,110,49,0)');ctx.fillStyle=flame;ctx.fillRect(1130,-7,90,90);ctx.fillStyle='#efaa60';ctx.beginPath();ctx.arc(1175,34,7+Math.sin(elapsed*8)*2,0,TAU);ctx.fill();ctx.restore();
  }
  function drawGoat(g,kind='villager'){
    const walking=Math.abs(g.vx||0)+Math.abs(g.vy||0)>.2, bob=walking?Math.sin(elapsed*10+(g.x||0)*.02)*1.5:Math.sin(elapsed*1.6+(g.x||0))*0.6;
    const f=g.faceX||1, scale=kind==='player'?1.1:1.04;
    ctx.save();ctx.translate(g.x,g.y+(g.dodge?Math.sin(elapsed*30)*2:0));ctx.scale(scale,scale);
    ctx.fillStyle='rgba(28,38,28,.26)';ctx.beginPath();ctx.ellipse(0,2,15,7,0,0,TAU);ctx.fill();ctx.translate(0,bob);
    const footY=-1;ctx.fillStyle=g.fur||'#ddd1b8';ctx.strokeStyle='rgba(50,42,35,.6)';ctx.lineWidth=.7;
    for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(side*6,footY,4.2,7,-.08*side,0,TAU);ctx.fill();ctx.stroke();for(let t=0;t<5;t++){const tx=side*6+(t-2)*1.38,ty=footY-5.7-Math.abs(t-2)*.48;ctx.beginPath();ctx.ellipse(tx,ty,1.05,1.35,0,0,TAU);ctx.fillStyle='#242522';ctx.fill();ctx.fillStyle=g.fur||'#ddd1b8'} }
    ctx.fillStyle=g.coat||'#57675a';ctx.beginPath();ctx.moveTo(-9,-7);ctx.lineTo(-8,-21);ctx.quadraticCurveTo(0,-25,8,-21);ctx.lineTo(9,-7);ctx.quadraticCurveTo(0,-3,-9,-7);ctx.fill();
    ctx.fillStyle=g.fur||'#ddd1b8';ctx.fillRect(-6,-11,4,8);ctx.fillRect(2,-11,4,8);
    for(const side of [-1,1]){const hx=side*11,hy=-19;ctx.strokeStyle=g.fur||'#ddd1b8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(side*7,-20);ctx.lineTo(hx,hy);ctx.stroke();ctx.fillStyle=g.fur||'#ddd1b8';ctx.beginPath();ctx.ellipse(hx,hy,3,3.8,0,0,TAU);ctx.fill();for(let n=0;n<5;n++){const a=(-.85+n*.43);ctx.strokeStyle=g.fur||'#ddd1b8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(hx+Math.cos(a)*2,hy+Math.sin(a)*2);ctx.lineTo(hx+Math.cos(a)*4.5,hy+Math.sin(a)*4.5);ctx.stroke();ctx.fillStyle='#282923';ctx.beginPath();ctx.arc(hx+Math.cos(a)*4.5,hy+Math.sin(a)*4.5,.7,0,TAU);ctx.fill()} }
    if(kind==='villager'||kind==='captive'){
      const fur=g.fur||'#ddd1b8';ctx.fillStyle=fur;ctx.beginPath();ctx.ellipse(0,-29,9.3,11.3,.02,0,TAU);ctx.fill();ctx.fillStyle=fur;ctx.beginPath();if(g.ear==='droop'){ctx.ellipse(-11,-28,3.5,8,-.52,0,TAU);ctx.ellipse(11,-28,3.5,8,.52,0,TAU)}else{ctx.moveTo(-6,-35);ctx.quadraticCurveTo(-15,-45,-18,-42);ctx.quadraticCurveTo(-16,-32,-7,-31);ctx.moveTo(6,-35);ctx.quadraticCurveTo(15,-45,18,-42);ctx.quadraticCurveTo(16,-32,7,-31);ctx.fill()}
      ctx.strokeStyle=g.horn||'#9b8764';ctx.lineWidth=2.7;ctx.lineCap='round';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*5,-36);ctx.quadraticCurveTo(side*10,-46,side*7,-49);ctx.quadraticCurveTo(side*3,-51,side*3,-45);ctx.stroke()}
      const eyeX=f*4;ctx.fillStyle='#eee4ce';ctx.beginPath();ctx.ellipse(eyeX,-31,2.4,1.7,0,0,TAU);ctx.fill();ctx.fillStyle='#222820';ctx.fillRect(eyeX-.65,-32.2,1.3,2.5);ctx.fillStyle=shade(fur,-14);ctx.beginPath();ctx.ellipse(f*2,-24,5.6,4.5,0,0,TAU);ctx.fill();ctx.fillStyle='#4b3b34';ctx.beginPath();ctx.ellipse(f*6,-24,1.6,1.1,0,0,TAU);ctx.fill();ctx.strokeStyle='rgba(51,46,37,.55)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(0,-21);ctx.lineTo(2,-19);ctx.stroke();
    }else if(kind==='enemy'){
      const fur=g.fur||'#a67b5e';ctx.fillStyle=fur;ctx.beginPath();ctx.ellipse(0,-29,9,10,0,0,TAU);ctx.fill();if(g.id==='raider2'){ctx.fillStyle=fur;ctx.beginPath();ctx.moveTo(-7,-35);ctx.lineTo(-11,-47);ctx.lineTo(-1,-38);ctx.moveTo(7,-35);ctx.lineTo(11,-47);ctx.lineTo(1,-38);ctx.fill()}else if(g.id==='raider3'){ctx.fillStyle='#705d52';ctx.beginPath();ctx.ellipse(f*5,-25,7,5,0,0,TAU);ctx.fill();ctx.fillStyle='#c3a78a';ctx.beginPath();ctx.moveTo(4,-26);ctx.lineTo(12,-24);ctx.lineTo(4,-22);ctx.fill()}ctx.fillStyle='#ead9bf';ctx.beginPath();ctx.ellipse(f*3,-31,2.4,1.6,0,0,TAU);ctx.fill();ctx.fillStyle='#b84837';ctx.fillRect(f*3-.7,-32.2,1.4,2.7);ctx.strokeStyle='#c6a174';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,-22);ctx.lineTo(6,-7);ctx.stroke();
    }else{
      ctx.fillStyle='#37443b';ctx.beginPath();ctx.moveTo(-11,-19);ctx.quadraticCurveTo(-11,-33,0,-36);ctx.quadraticCurveTo(11,-33,11,-19);ctx.lineTo(7,-10);ctx.lineTo(-7,-10);ctx.closePath();ctx.fill();ctx.fillStyle='#202a24';ctx.beginPath();ctx.moveTo(-10,-32);ctx.quadraticCurveTo(0,-42,10,-32);ctx.lineTo(7,-29);ctx.lineTo(-7,-29);ctx.closePath();ctx.fill();ctx.fillStyle='#d2b579';ctx.fillRect(-5,-28,10,1.6);ctx.strokeStyle='#d6c6a2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-9,-18);ctx.lineTo(9,-18);ctx.stroke();
    }
    if(g.emoteUntil>elapsed){const pose=g.emote||'wave';ctx.strokeStyle=g.fur||'#ddd1b8';ctx.lineWidth=3;ctx.lineCap='round';if(pose==='wave'){ctx.beginPath();ctx.moveTo(8,-19);ctx.lineTo(16,-31+Math.sin(elapsed*12)*2);ctx.lineTo(18,-37+Math.sin(elapsed*12)*2);ctx.stroke()}else if(pose==='leg'){ctx.beginPath();ctx.moveTo(4,-8);ctx.quadraticCurveTo(14,-10,13,-21);ctx.stroke()}else if(pose==='sit'){ctx.fillStyle=g.coat;ctx.beginPath();ctx.ellipse(0,-8,12,6,0,0,TAU);ctx.fill();ctx.fillStyle=g.fur;ctx.beginPath();ctx.ellipse(0,-16,8,7,0,0,TAU);ctx.fill()}else if(pose==='bow'){ctx.save();ctx.rotate(.25);ctx.fillStyle=g.fur;ctx.beginPath();ctx.ellipse(0,-28,9,11,0,0,TAU);ctx.fill();ctx.restore()}else if(pose==='dance'){ctx.rotate(Math.sin(elapsed*9)*.13);ctx.beginPath();ctx.moveTo(-8,-18);ctx.lineTo(-16,-27);ctx.moveTo(8,-18);ctx.lineTo(16,-27);ctx.stroke()}}
    if(g.attack>0&&kind==='player'){ctx.strokeStyle='rgba(231,213,167,.9)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f*13,-20,22,-1.15,1.0);ctx.stroke()}
    if(kind==='enemy'&&g.hp<g.maxHp){ctx.fillStyle='rgba(22,25,22,.7)';ctx.fillRect(-12,-54,24,3);ctx.fillStyle='#d77b62';ctx.fillRect(-12,-54,24*g.hp/g.maxHp,3)}ctx.restore();
  }
  function shade(hex,amount){const n=parseInt(hex.slice(1),16);if(!Number.isFinite(n))return hex;const r=clamp((n>>16)+amount,0,255),g=clamp(((n>>8)&255)+amount,0,255),b=clamp((n&255)+amount,0,255);return `rgb(${r},${g},${b})`}
  function drawActors(){const actors=[...villagers.map(g=>({g,k:'villager'})),...captives.map(g=>({g,k:'captive'})),...enemies.filter(e=>e.alive).map(g=>({g,k:'enemy'})),{g:player,k:'player'}];actors.sort((a,b)=>a.g.y-b.g.y);for(const a of actors){if(Math.abs(a.g.x-player.x)>W/2+80||Math.abs(a.g.y-player.y)>H/2+80)continue;drawGoat(a.g,a.k)}}
  function drawLabels(){if(!active)return;for(const v of villagers){if(dist(player,v)>140)continue;ctx.save();ctx.font='700 8px "DM Sans"';ctx.textAlign='center';ctx.fillStyle='rgba(245,240,229,.9)';ctx.shadowColor='rgba(18,25,18,.9)';ctx.shadowBlur=5;ctx.fillText(v.name.toUpperCase(),v.x,v.y-63);ctx.fillStyle='#e2c57f';ctx.fillText('✦',v.x,v.y-72);ctx.restore()}}
  function drawScene(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);const camX=clamp(player.x,-WORLD.maxX+W/2,WORLD.maxX-W/2),camY=clamp(player.y,-WORLD.maxY+H/2,WORLD.maxY-H/2);ctx.save();ctx.translate(W/2-camX,H/2-camY);drawGround();drawVillage();drawOutpost();drawActors();drawLabels();ctx.restore();const grad=ctx.createRadialGradient(W*.52,H*.46,Math.min(W,H)*.18,W*.52,H*.46,Math.max(W,H)*.77);grad.addColorStop(0,'rgba(14,22,17,0)');grad.addColorStop(1,'rgba(16,25,19,.31)');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);if(damageFlash>0){ctx.fillStyle=`rgba(157,50,37,${damageFlash*.16})`;ctx.fillRect(0,0,W,H)}}
  function drawMini(){const w=mini.width,h=mini.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#71835e';mctx.fillRect(0,0,w,h);mctx.fillStyle='rgba(190,176,129,.45)';mctx.beginPath();mctx.moveTo(0,h*.76);mctx.quadraticCurveTo(w*.37,h*.97,w*.63,h*.48);mctx.quadraticCurveTo(w*.81,h*.3,w,h*.4);mctx.lineWidth=5;mctx.strokeStyle='#c4b38f';mctx.stroke();mctx.strokeStyle='rgba(151,187,173,.65)';mctx.lineWidth=4;mctx.beginPath();mctx.moveTo(w*.25,h);mctx.quadraticCurveTo(w*.42,h*.55,w*.65,0);mctx.stroke();const px=x=>((x-WORLD.minX)/(WORLD.maxX-WORLD.minX))*w,py=y=>((y-WORLD.minY)/(WORLD.maxY-WORLD.minY))*h;mctx.fillStyle='#a5d19b';mctx.beginPath();mctx.arc(px(0),py(0),4,0,TAU);mctx.fill();mctx.fillStyle='#e08063';mctx.beginPath();mctx.arc(px(1240),py(55),4,0,TAU);mctx.fill();mctx.fillStyle='#f9e596';mctx.beginPath();mctx.arc(px(player.x),py(player.y),3.7,0,TAU);mctx.fill();mctx.strokeStyle='rgba(255,244,198,.8)';mctx.lineWidth=1;mctx.stroke()}
  function environmentFor(npc){
    const zone=currentZone();const nearbyEnemies=enemies.filter(e=>e.alive&&dist(npc,e)<300).length;const rescued=quest.freed.size;
    if(npc.id==='mara')return `Mara is the village herbalist. Her cottage has drying herbs and a small flower patch. She is worried about her neighbors and tends to speak gently. Current area: ${zone.name}.`;
    if(npc.id==='tovin')return `Tovin is a shepherd in Bellwether, practical and steadfast. He knows the eastern road and the raiders' outpost. Current area: ${zone.name}.`;
    if(npc.id==='elin')return `Elin keeps Bellwether's stories. She is hopeful and observant. Current area: ${zone.name}.`;
    if(npc.id==='oren')return `Oren is Bellwether's miller, anxious but kind. Current area: ${zone.name}.`;
    if(npc.freed)return `${npc.name} was held captive at the raider outpost and has just been freed. They are relieved and grateful. ${rescued} people have been rescued.`;
    return `${npc.name} is a rescued villager, safe near the outpost. ${rescued} people have been rescued. Current area: ${zone.name}.`;
  }
  function getGreeting(npc){
    if(npc.id==='mara')return npc.lines===0?npc.greeting:'The kettle is still warm, and so are we. What would you like to know?';
    if(npc.id==='tovin')return npc.lines===0?npc.greeting:'Keep your eyes on the eastern track. The old road leads right to their fence.';
    if(npc.id==='elin')return npc.lines===0?npc.greeting:'Perhaps this story can end better than the last one. What is on your mind?';
    if(npc.id==='oren')return npc.lines===0?npc.greeting:'I hope we can get the mill turning again. Ask away, friend.';
    return `We are safe because of you. ${npc.name} looks toward the road, still catching their breath.`;
  }
  function openDialogue(npc){
    if(!npc)return;if(quest.stage===0&&villagers.includes(npc)){quest.spoken.add(npc.id);if(quest.spoken.size>=3){quest.stage=1;sayToast('Tovin has marked the eastern road on your map. Find the raider outpost.')}updateQuestUI()}dialoguePerson=npc;paused=true;const panel=$('dialogue-panel');panel.classList.remove('hidden');$('speaker-name').textContent=npc.name;$('speaker-role').textContent=npc.role||'RESCUED VILLAGER';$('speaker-avatar').textContent=npc.freed?'♡':'✦';
    setDialogueText(getGreeting(npc));npc.lines=(npc.lines||0)+1;renderChoices(npc);$('ask-input').focus();
  }
  function setDialogueText(text,playerText=''){
    const body=$('dialogue-body');body.replaceChildren();if(playerText){const p=document.createElement('div');p.className='player-line';p.textContent=`YOU  ·  “${playerText}”`;body.append(p)}const answer=document.createElement('div');answer.textContent=text;body.append(answer);body.scrollTop=body.scrollHeight;
  }
  function renderChoices(npc){
    const box=$('dialogue-choices');box.replaceChildren();let options=[];
    if(npc.id==='mara')options=[['What happened here?','tell me about the raids'],['How can I help?','how can I help'],['Tell me about Bellwether.','tell me about the village']];
    else if(npc.id==='tovin')options=[['Where is the outpost?','where is the raider outpost'],['How many are there?','how many raiders'],['Can you guide me?','guide me to the outpost']];
    else if(npc.id==='elin')options=[['What do you remember?','tell me a story'],['Who was taken?','who was kidnapped'],['What gives you hope?','what gives you hope']];
    else if(npc.id==='oren')options=[['What did you see?','what did you see'],['What is the eastern road like?','tell me about the road']];
    else options=[['Are you alright?','are you alright'],['Come back to Bellwether with me.','come back to Bellwether']];
    for(const [label,text] of options){const b=document.createElement('button');b.className='choice-button';b.type='button';b.textContent=label;b.addEventListener('click',()=>askNpc(text));box.append(b)}
  }
  function localAnswer(npc,text){
    const q=text.toLowerCase(),zone=currentZone().name;
    if(/sit|leg behind|lift.*leg|wave|dance|bow|stand on one|pose|action/.test(q))return performRequestedAction(npc,q);
    if(npc.id==='mara'){
      if(/raid|kidnap|enslav|happen|trouble|taken/.test(q))return 'They came in the night, took our neighbors, and left the doors open behind them. Their outpost lies east along the old road. We are frightened, but not broken.';
      if(/help|mission|what can i|need/.test(q))return 'Please find the outpost and bring our people home. Tovin can point you east. If you can stop the raiders, do it—but please come back safely.';
      if(/village|bellwether|people|goat/.test(q))return 'Bellwether is small, but our doors are open to anyone who comes in peace. The longhouse is where we gather when the weather turns.';
      if(/herb|plant|flower|medicine/.test(q))return 'I dry yarrow and moonmint beneath that little window. If you find the captives, they may need something soothing for the road home.';
      return 'I wish I had a better answer. I know the road east, and I know that people can be braver together than they feel alone.';
    }
    if(npc.id==='tovin'){
      if(/where|outpost|east|direction|road|guide/.test(q))return 'Follow the rutted road east, past the bracken meadow and the bend in the stream. The stockade is hard to miss. You can see its watch shelter from the rise.';
      if(/how many|raider|enemy|guard/.test(q))return 'I saw three of them at the fence: a broad-shouldered human, a fox with a quick step, and a boar who carries himself like a wall. Stay light on your feet.';
      if(/why|risk|danger|afraid/.test(q))return 'Because those people deserve to come home. And because the longer cruelty goes unanswered, the bolder it gets.';
      return 'The road is safest in daylight. Keep east until you see a rough fence and a watch shelter. I will keep the village ready for anyone who returns.';
    }
    if(npc.id==='elin'){
      if(/who|taken|kidnap|captive/.test(q))return 'Pella, Nim, and Alder. Pella used to sing while kneading bread; Nim is always asking a hundred questions; Alder knows every shortcut through the hills.';
      if(/hope|feel|brave|story/.test(q))return 'There is a story about a little lantern that outlasted a storm. It was not the strongest light, only the one somebody remembered to relight. I think that is what courage is.';
      return 'We are people with names, recipes, arguments, jokes, and muddy boots. I hope the raiders learn that the people they took are not just a number.';
    }
    if(npc.id==='oren'){
      if(/road|east|outpost|direction/.test(q))return 'The old road bends east beyond the meadow. There is a stream crossing, then a slope, then that ugly stockade. Look for smoke from their cookfire.';
      return 'I heard boots and shouting after sundown. Three raiders, maybe more passed through, but only three stayed to guard the outpost. The captives were alive when they left.';
    }
    if(/alright|safe|thank/.test(q))return 'Shaken, but safe. I can breathe again. Thank you for coming back for us.';
    if(/bellwether|home|come back/.test(q))return 'Yes. We will follow the road home together. I want to see the village lamps again.';
    return `I am still finding my words. But standing here in ${zone}, free beneath the open sky, feels like a beginning.`;
  }
  function performRequestedAction(npc,q){
    let pose='wave',reply='They give you a small, cheerful wave.';
    if(/sit/.test(q)){pose='sit';reply=`${npc.name} settles into a careful sit, looking a little amused.`}
    else if(/leg|behind/.test(q)){pose='leg';reply=`${npc.name} lifts one leg behind them, steadying themself with a grin.`}
    else if(/dance/.test(q)){pose='dance';reply=`${npc.name} does a few light, playful steps in the grass.`}
    else if(/bow/.test(q)){pose='bow';reply=`${npc.name} offers you a respectful bow.`}
    npc.emote=pose;npc.emoteUntil=elapsed+4;return reply;
  }
  async function askNpc(text){
    if(!dialoguePerson||!text.trim())return;const npc=dialoguePerson,body=$('dialogue-body');const clean=text.trim().slice(0,500);$('ask-input').value='';$('dialogue-choices').replaceChildren();setDialogueText('Thinking…',clean);body.lastChild.className='thinking';
    const config=readSettings();let answer;
    if(config.endpoint&&config.model&&config.key){
      try{answer=await requestAI(npc,clean,config)}catch(err){answer=localAnswer(npc,clean)+' (Your AI service could not be reached, so this is an in-world fallback.)'}
    }else answer=localAnswer(npc,clean);
    if(dialoguePerson!==npc)return;setDialogueText(answer,clean);renderChoices(npc);
  }
  async function requestAI(npc,text,cfg){
    const response=await fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${cfg.key}`},body:JSON.stringify({model:cfg.model,temperature:.8,max_tokens:170,messages:[{role:'system',content:`You are ${npc.name}, a character in a gentle open-world RPG called Hearthwild. Stay in character, keep replies to 1-3 sentences, and never claim powers outside the game. Environment and character context: ${environmentFor(npc)} The player's quest state: ${quest.stage===0?'They have just arrived in Bellwether.':quest.stage===1?'They are traveling to the raider outpost.':quest.stage===2?'They are fighting raiders at the outpost.':quest.stage===3?'They are freeing captives.':'The captives have been rescued.'} If asked to perform an action, respond naturally as if acting it out. Do not invent changing quest facts.`},{role:'user',content:text}]})});if(!response.ok)throw new Error(`AI service returned ${response.status}`);const data=await response.json();const content=data.choices?.[0]?.message?.content;if(typeof content!=='string'||!content.trim())throw new Error('Empty AI reply');return content.trim().slice(0,900);
  }
  function readSettings(){try{return{endpoint:localStorage.getItem('hearthwild.endpoint')||'',model:localStorage.getItem('hearthwild.model')||'',key:localStorage.getItem('hearthwild.key')||''}}catch{return{endpoint:'',model:'',key:''}}}
  function writeSettings(config){try{localStorage.setItem('hearthwild.endpoint',config.endpoint);localStorage.setItem('hearthwild.model',config.model);localStorage.setItem('hearthwild.key',config.key);return true}catch{return false}}
  function drawBigMap(){
    const c=$('bigmap'),g=c.getContext('2d'),w=c.width,h=c.height;g.clearRect(0,0,w,h);g.fillStyle='#74855e';g.fillRect(0,0,w,h);
    for(let i=0;i<34;i++){const x=worldSeed(i+91)*w,y=worldSeed(i+137)*h;g.beginPath();g.ellipse(x,y,24+worldSeed(i+188)*75,12+worldSeed(i+299)*30,worldSeed(i+377)*3,0,TAU);g.fillStyle=i%2?'rgba(42,78,50,.12)':'rgba(220,201,146,.12)';g.fill()}
    const px=x=>(x-WORLD.minX)/(WORLD.maxX-WORLD.minX)*w,py=y=>(y-WORLD.minY)/(WORLD.maxY-WORLD.minY)*h;
    g.beginPath();g.moveTo(0,h*.66);g.bezierCurveTo(w*.18,h*.7,w*.26,h*.42,w*.39,h*.48);g.bezierCurveTo(w*.53,h*.55,w*.55,h*.46,w*.68,h*.49);g.bezierCurveTo(w*.83,h*.52,w*.82,h*.39,w,h*.4);g.strokeStyle='#c9b991';g.lineWidth=16;g.lineCap='round';g.stroke();g.strokeStyle='#9bbbab';g.lineWidth=9;g.beginPath();g.moveTo(w*.28,h);g.bezierCurveTo(w*.38,h*.7,w*.52,h*.56,w*.61,h*.32);g.stroke();
    for(const [x,y,label,color] of [[0,0,'BELLWETHER','#a8d09a'],[1240,55,'RAIDER OUTPOST','#dc8669']]){g.beginPath();g.arc(px(x),py(y),8,0,TAU);g.fillStyle=color;g.fill();g.strokeStyle='rgba(255,244,218,.9)';g.lineWidth=2;g.stroke();g.fillStyle='#f7f0dc';g.font='700 13px "DM Sans"';g.fillText(label,px(x)+13,py(y)+4)}
    g.beginPath();g.arc(px(player.x),py(player.y),7,0,TAU);g.fillStyle='#ffe18e';g.fill();g.strokeStyle='#fff4c6';g.lineWidth=2;g.stroke();
  }
  function updateHud(){
    $('location-name').textContent=currentZone().name;$('health-fill').style.width=`${player.hp}%`;$('health-number').textContent=Math.ceil(player.hp);$('stamina-fill').style.width=`${player.stamina}%`;
    const enemyCount=enemies.filter(e=>e.alive).length;$('enemy-count').textContent=enemyCount;
    const inOutpost=Math.hypot(player.x-1240,player.y-55)<380;$('combat-banner').classList.toggle('visible',active&&inOutpost&&quest.stage>=2&&quest.stage<4);
    $('combat-hint').classList.toggle('visible',active&&inOutpost&&quest.stage>=2&&quest.stage<4);
    const nearby=nearestEntity(),prompt=$('interaction-prompt');
    if(active&&!paused&&nearby){prompt.classList.add('visible');prompt.querySelector('span').textContent=nearby.freed?'E  ·  Speak with '+nearby.name:nearby.id?.startsWith('captive')?'E  ·  Free '+nearby.name:'E  ·  Speak with '+nearby.name}else prompt.classList.remove('visible');
    $('compass-label').textContent=quest.stage===0?'BELLWETHER':quest.stage<4?'THE OUTPOST':'HOMEWARD';updateQuestUI();
  }
  function enterOutpost(){
    if(quest.stage===1&&Math.hypot(player.x-1240,player.y-55)<355){quest.stage=2;updateQuestUI();sayToast('The stockade is ahead. The raiders have spotted you!')}
  }
  function freeCaptive(c){
    if(quest.stage<3){sayToast('The holding pens are still guarded. Deal with the raiders first.');return}
    c.freed=true;c.x=0;c.y=0;c.vx=0;c.vy=0;quest.freed.add(c.id);sayToast(`${c.name} is free. One more step toward home.`);updateQuestUI();
    if(quest.freed.size===captives.length){quest.stage=4;for(let i=0;i<captives.length;i++){captives[i].x=-35+i*35;captives[i].y=30+i*32}sayToast('Everyone is free. Bellwether’s lamps are waiting.');updateQuestUI()}
  }
  function interact(){
    if(!active||paused)return;const target=nearestEntity();
    if(target){if(target.id?.startsWith('captive')&&!target.freed)freeCaptive(target);else openDialogue(target);return}
    if(quest.stage===0&&Math.hypot(player.x,player.y)<350){sayToast('Speak with three villagers to learn what happened.');return}
    if(quest.stage===1&&Math.hypot(player.x-1240,player.y-55)<430){enterOutpost();return}
    if(quest.stage===2)sayToast('Drive off the remaining raiders first.');else if(quest.stage===3)sayToast('Find the villagers inside the holding pens.');else if(quest.stage===4)sayToast('Return west to Bellwether and tell the villagers the good news.');
  }
  function doAttack(){
    if(!active||paused||player.attackCooldown>0||player.stamina<12)return;player.attack=.24;player.attackCooldown=.36;player.stamina=Math.max(0,player.stamina-12);
    let target=null,best=74;
    for(const e of enemies){if(!e.alive)continue;const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy),forward=dx*player.faceX+dy*player.faceY;if(d<best&&forward>-18){target=e;best=d}}
    if(target){target.hp--;target.flash=.18;target.knockX=player.faceX;target.knockY=player.faceY;if(target.hp<=0){target.alive=false;sayToast(`${target.name} retreats from the fight.`)}else sayToast(`A clean strike! ${target.name} staggers back.`)}
    if(quest.stage===2&&enemies.every(e=>!e.alive)){quest.stage=3;sayToast('The outpost is quiet. Find the keys and free the captives.');updateQuestUI()}
  }
  function hurtPlayer(amount){if(player.invuln>0)return;player.hp=Math.max(0,player.hp-amount);player.invuln=.65;damageFlash=.9;if(player.hp<=0){player.hp=100;player.stamina=100;player.x=-75;player.y=80;player.vx=player.vy=0;sayToast('You catch your breath back in Bellwether. The raiders still hold the outpost.')}}
  function setMovement(key,on){if(on)keys.add(key);else keys.delete(key)}
  function tick(dt){
    elapsed+=dt;toastTimer=Math.max(0,toastTimer-dt);if(toastTimer===0)$('toast').classList.remove('visible');damageFlash=Math.max(0,damageFlash-dt);player.attack=Math.max(0,player.attack-dt);player.attackCooldown=Math.max(0,player.attackCooldown-dt);player.invuln=Math.max(0,player.invuln-dt);
    if(active&&!paused){
      let ix=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),iy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);const len=Math.hypot(ix,iy)||1;ix/=len;iy/=len;
      const running=keys.has('shift')&&player.stamina>2,mult=running?1.52:1,speed=running?252:168;if(running)player.stamina=Math.max(0,player.stamina-25*dt);else player.stamina=Math.min(100,player.stamina+19*dt);
      if(ix||iy){player.faceX=ix;player.faceY=iy;player.step+=dt*speed/20}
      player.vx+=(ix*speed*mult-player.vx)*Math.min(1,dt*10);player.vy+=(iy*speed*mult-player.vy)*Math.min(1,dt*10);player.x=clamp(player.x+player.vx*dt,WORLD.minX+24,WORLD.maxX-24);player.y=clamp(player.y+player.vy*dt,WORLD.minY+24,WORLD.maxY-24);
      if(player.dodge>0){player.dodge=Math.max(0,player.dodge-dt);player.invuln=Math.max(player.invuln,.12)}
      if(quest.stage===1&&Math.hypot(player.x-1240,player.y-55)<355)enterOutpost();
      for(const e of enemies){if(!e.alive)continue;e.cool=Math.max(0,e.cool-dt);if(e.flash)e.flash=Math.max(0,e.flash-dt);if(e.knockX&&e.flash>0){e.x+=e.knockX*65*dt;e.y+=e.knockY*65*dt}
        if(quest.stage>=2&&quest.stage<4&&dist(e,player)<260){const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;e.faceX=dx/d;if(d>34){e.x+=dx/d*72*dt;e.y+=dy/d*72*dt}else if(e.cool<=0){e.cool=1.1;hurtPlayer(10)}}
      }
      if(quest.stage===4&&Math.hypot(player.x,player.y)<280){quest.stage=5;sayToast('The road ends where a welcome begins. Journey complete.');updateQuestUI()}
    }
    updateHud();drawScene();drawMini();
  }
  function loop(now){const dt=Math.min(.04,(now-last)/1000);last=now;tick(dt);requestAnimationFrame(loop)}
  function startGame(){if(active)return;active=true;paused=false;$('start-screen').classList.add('hidden');$('loading-screen').classList.remove('done');setTimeout(()=>$('loading-screen').classList.add('done'),550);sayToast('Find Bellwether to the east. The road is yours.');}
  function closeDialogue(){dialoguePerson=null;paused=false;$('dialogue-panel').classList.add('hidden');if(document.activeElement===$('ask-input'))document.activeElement.blur()}
  function openSettings(){paused=true;const c=readSettings();$('api-endpoint').value=c.endpoint;$('api-model').value=c.model;$('api-key').value=c.key;$('settings-modal').classList.remove('hidden')}
  function closeSettings(){ $('settings-modal').classList.add('hidden');paused=!!dialoguePerson }
  function openMap(){if(!active)return;paused=true;drawBigMap();$('map-overlay').classList.remove('hidden')}
  function closeMap(){$('map-overlay').classList.add('hidden');paused=!!dialoguePerson}
  $('begin-button').addEventListener('click',startGame);
  $('close-dialogue').addEventListener('click',closeDialogue);
  $('ask-form').addEventListener('submit',e=>{e.preventDefault();askNpc($('ask-input').value)});
  $('settings-button').addEventListener('click',openSettings);
  $('close-settings').addEventListener('click',closeSettings);
  $('settings-modal').addEventListener('click',e=>{if(e.target===$('settings-modal'))closeSettings()});
  $('ai-settings-link').addEventListener('click',openSettings);
  $('save-settings').addEventListener('click',()=>{const endpoint=$('api-endpoint').value.trim(),model=$('api-model').value.trim(),key=$('api-key').value.trim();if(endpoint&&!/^https:\/\//i.test(endpoint)){sayToast('Use a secure HTTPS endpoint for AI chat.');return}if(endpoint&&!model){sayToast('Add a public model name to enable AI chat.');return}const ok=writeSettings({endpoint,model,key});closeSettings();sayToast(ok?'Settings saved on this device.':'Browser storage is unavailable; settings were not saved.')});
  $('clear-ai').addEventListener('click',()=>{$('api-endpoint').value='';$('api-model').value='';$('api-key').value='';writeSettings({endpoint:'',model:'',key:''});sayToast('AI connection cleared.')});
  $('close-map').addEventListener('click',closeMap);$('map-overlay').addEventListener('click',e=>{if(e.target===$('map-overlay'))closeMap()});
  addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key)&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName))e.preventDefault();
    if(key==='escape'){if(!$('dialogue-panel').classList.contains('hidden'))closeDialogue();else if(!$('settings-modal').classList.contains('hidden'))closeSettings();else if(!$('map-overlay').classList.contains('hidden'))closeMap();return}
    if(key==='e'){interact();return}if(key==='m'){if($('map-overlay').classList.contains('hidden'))openMap();else closeMap();return}if(key===' '){doAttack();return}
    if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','shift'].includes(key))setMovement(key,true);
  });
  addEventListener('keyup',e=>setMovement(e.key.toLowerCase(),false));
  addEventListener('blur',()=>keys.clear());
  for(const button of document.querySelectorAll('[data-move]')){const dir=button.dataset.move,map={up:'w',down:'s',left:'a',right:'d'},key=map[dir];button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);setMovement(key,true)});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>setMovement(key,false))}
  for(const button of document.querySelectorAll('[data-action]')){const action=button.dataset.action;button.addEventListener('pointerdown',e=>{e.preventDefault();if(action==='attack')doAttack();else interact()})}
  $('reduced-motion').checked=localStorage.getItem('hearthwild.reducedMotion')==='true';$('reduced-motion').addEventListener('change',e=>{try{localStorage.setItem('hearthwild.reducedMotion',e.target.checked?'true':'false')}catch{}});
  $('volume').value=localStorage.getItem('hearthwild.volume')||'45';$('volume').addEventListener('input',e=>{try{localStorage.setItem('hearthwild.volume',e.target.value)}catch{}});
  villagers.forEach(v=>{const original=v.greeting;v.greeting=original});
  updateQuestUI();drawMini();requestAnimationFrame(loop);
})();

