const AUDIO_EXT=['mp3','wav','ogg','flac','aac','m4a','opus','wma','oga','m4b'];
const VIDEO_EXT=['mp4','webm','mov','avi','mkv','m4v','wmv','3gp','flv','ogv'];

let files=[],playlist=[],cur=-1,fileDurations={};
let shuffle=true,repeat='off';
let playing=false,objUrl=null,audioEl=null,media=null;
let eqInterval=null,listOpen=false;

const $=id=>document.getElementById(id);
const ext=n=>(n.split('.').pop()||'').toLowerCase();
const isVid=n=>VIDEO_EXT.includes(ext(n));
const fmt=s=>!isFinite(s)||isNaN(s)?'0:00':Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtSize=b=>b>1048576?(b/1048576).toFixed(1)+' MB':(b/1024).toFixed(0)+' KB';

// ── Custom names ───────────────────────────────────────────
const NAMES_KEY='rp_names';
let customNames={};
try{customNames=JSON.parse(localStorage.getItem(NAMES_KEY)||'{}')}catch(e){}
function fileKey(f){return f.name+'|'+f.size}
function getDisplayName(f){return customNames[fileKey(f)]||f.name.replace(/\.[^.]+$/,'')}
function saveCustomName(f,name){customNames[fileKey(f)]=name;try{localStorage.setItem(NAMES_KEY,JSON.stringify(customNames))}catch(e){}}

function rpRenameTrack(pi,event){
  event.stopPropagation();
  const f=files[playlist[pi]];
  const newName=prompt('Neuer Name:',getDisplayName(f));
  if(newName===null||!newName.trim())return;
  saveCustomName(f,newName.trim());
  renderList();
  if(pi===cur){const n=newName.trim();$('rpTrackName').textContent=n;$('rpTrackName').classList.toggle('scrolling',n.length>22)}
}

// ── Favorites ──────────────────────────────────────────────
const FAVS_KEY='rp_favs';
let favorites=new Set();
try{favorites=new Set(JSON.parse(localStorage.getItem(FAVS_KEY)||'[]'))}catch(e){}
let favFilterOn=false;
function saveFavs(){try{localStorage.setItem(FAVS_KEY,JSON.stringify([...favorites]))}catch(e){}}
function rpToggleFav(pi,event){
  event.stopPropagation();
  const k=fileKey(files[playlist[pi]]);
  if(favorites.has(k))favorites.delete(k);else favorites.add(k);
  saveFavs();renderList();
}
function rpToggleFavFilter(){
  favFilterOn=!favFilterOn;
  $('rpFavFilterBtn').classList.toggle('on',favFilterOn);
  renderList();
}

// ── Search ─────────────────────────────────────────────────
let searchTerm='';
function rpFilterList(){
  searchTerm=$('rpSearch').value.toLowerCase().trim();
  renderList();
}

// ── Sleep Timer ────────────────────────────────────────────
const SLEEP_STEPS=[0,15,30,60];
let sleepIdx=0,sleepTimeout=null,sleepInterval=null,sleepEnd=0;
function rpCycleSleep(){
  sleepIdx=(sleepIdx+1)%SLEEP_STEPS.length;
  clearTimeout(sleepTimeout);clearInterval(sleepInterval);
  $('rpSleepToast').style.display='none';
  if(sleepIdx===0){$('rpSleepBtn').classList.remove('on');return}
  const mins=SLEEP_STEPS[sleepIdx];
  $('rpSleepBtn').classList.add('on');
  $('rpSleepBtn').title='Sleep: '+mins+' min';
  sleepEnd=Date.now()+mins*60000;
  const update=()=>{
    const left=Math.max(0,sleepEnd-Date.now());
    const m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);
    const t=$('rpSleepToast');
    t.style.display='block';
    t.textContent='🌙 '+m+':'+String(s).padStart(2,'0');
    if(left===0){t.style.display='none';clearInterval(sleepInterval)}
  };
  update();
  sleepInterval=setInterval(update,1000);
  sleepTimeout=setTimeout(()=>{
    if(media){media.pause();playing=false;$('rpVinyl').classList.remove('playing');stopEq();updateUI()}
    sleepIdx=0;$('rpSleepBtn').classList.remove('on');
    $('rpSleepToast').style.display='none';
    clearInterval(sleepInterval);
    rpToast('🌙 Sleep-Timer abgelaufen');
  },mins*60000);
}

// ── Color Themes ───────────────────────────────────────────
const THEME_KEY='rp_theme';
let currentTheme=localStorage.getItem(THEME_KEY)||'gold';
function applyTheme(t){
  document.body.className=t==='gold'?'':'theme-'+t;
  currentTheme=t;
  try{localStorage.setItem(THEME_KEY,t)}catch(e){}
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active',b.dataset.theme===t));
}
function rpSetTheme(t){applyTheme(t);rpCloseThemePicker()}
function rpOpenThemePicker(){
  $('rpThemeOverlay').classList.add('open');$('rpThemePanel').classList.add('open');
}
function rpCloseThemePicker(){
  $('rpThemeOverlay').classList.remove('open');$('rpThemePanel').classList.remove('open');
}

// ── Track Info Modal ───────────────────────────────────────
function rpShowTrackInfo(){
  if(cur<0||!files.length)return;
  const f=files[playlist[cur]];
  $('rpInfoTitle').textContent=getDisplayName(f);
  const rows=[
    ['Datei',f.name],
    ['Format',ext(f.name).toUpperCase()],
    ['Größe',fmtSize(f.size)],
    ['Dauer',fmt(media?.duration||0)],
    ['Track','#'+(cur+1)+' von '+playlist.length],
  ];
  $('rpInfoGrid').innerHTML=rows.map(([k,v])=>`<span class="info-key">${k}</span><span class="info-val">${esc(String(v))}</span>`).join('');
  $('rpInfoOverlay').classList.add('open');$('rpInfoPanel').classList.add('open');
}
function rpCloseTrackInfo(){
  $('rpInfoOverlay').classList.remove('open');$('rpInfoPanel').classList.remove('open');
}

// ── Web Audio – Mastering Chain ────────────────────────────
let audioCtx=null,audioSrcNode=null,eqBands=[],compressor=null,limiter=null,analyser=null,analyserData=null,animFrame=null;
let coverArtUrl=null;

// Bands: 80Hz  250Hz  1kHz  5kHz  12kHz
const EQ_TYPES =['lowshelf','peaking','peaking','peaking','highshelf'];
const EQ_FREQS =[80,250,1000,5000,12000];
const EQ_QS    =[0.7,1.2,1.5,1.2,0.7];

// Gains pro Preset: [80Hz, 250Hz, 1kHz, 5kHz, 12kHz]
const EQ_PRESETS={
  master:  [+3.0,-2.5, 0.0,+3.0,+2.5], // Warm · Klar · Luftig – Standard
  flat:    [ 0.0, 0.0, 0.0, 0.0, 0.0],
  bass:    [+7.0,-1.5,-1.0,+2.0,+1.5],
  hiphop:  [+6.0,-2.0,-1.0,+3.0,+2.0],
  rock:    [+4.0,-1.5,+1.0,+4.5,+3.0],
  pop:     [+2.0,-1.0,+2.0,+4.5,+3.5],
  vocal:   [-1.0,-2.5,+4.5,+5.0,+3.0],
};

function initWebAudio(){
  if(audioCtx||!audioEl)return;
  try{
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    audioSrcNode=audioCtx.createMediaElementSource(audioEl);

    // Hochpass: entfernt Subsonic-Rumble unter 30 Hz
    const hpf=audioCtx.createBiquadFilter();
    hpf.type='highpass';hpf.frequency.value=30;hpf.Q.value=0.7;

    // 5-Band parametrischer EQ
    eqBands=EQ_FREQS.map((freq,i)=>{
      const f=audioCtx.createBiquadFilter();
      f.type=EQ_TYPES[i];f.frequency.value=freq;
      f.Q.value=EQ_QS[i];f.gain.value=0;return f;
    });

    // Kompressor – sanfter dynamischer Ausgleich
    compressor=audioCtx.createDynamicsCompressor();
    compressor.threshold.value=-24;compressor.knee.value=10;
    compressor.ratio.value=4;compressor.attack.value=0.005;
    compressor.release.value=0.1;

    // Limiter – verhindert jegliches Clipping
    limiter=audioCtx.createDynamicsCompressor();
    limiter.threshold.value=-1;limiter.knee.value=0;
    limiter.ratio.value=20;limiter.attack.value=0.001;
    limiter.release.value=0.05;

    // Chain: source → hpf → eq[0..4] → compressor → limiter → out
    let node=audioSrcNode;
    node.connect(hpf);node=hpf;
    eqBands.forEach(b=>{node.connect(b);node=b;});
    node.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(audioCtx.destination);

    // Analyser als Tap-Point für Visualizer (kein Einfluss auf Klang)
    analyser=audioCtx.createAnalyser();
    analyser.fftSize=256;
    analyser.smoothingTimeConstant=0.82;
    analyserData=new Uint8Array(analyser.frequencyBinCount);
    limiter.connect(analyser);
  }catch(e){audioCtx=null}
}

// ── Cover Art ──────────────────────────────────────────────
async function loadCoverArt(file){
  if(coverArtUrl){URL.revokeObjectURL(coverArtUrl);coverArtUrl=null}
  const img=$('rpVinylArt'),dot=$('rpVinylDot'),name=$('rpVinylLabelName'),bg=$('rpBgArt');
  img.style.display='none';dot.style.display='';name.style.display='';
  bg.classList.remove('show');bg.style.backgroundImage='';
  if(typeof jsmediatags==='undefined')return;
  const ext_=file.name.split('.').pop().toLowerCase();
  if(!['mp3','mp4','m4a','aac','ogg','flac'].includes(ext_))return;
  try{
    await new Promise((res)=>{
      jsmediatags.read(file,{
        onSuccess(tag){
          const pic=tag.tags.picture;
          if(!pic){res();return}
          const blob=new Blob([new Uint8Array(pic.data)],{type:pic.format||'image/jpeg'});
          coverArtUrl=URL.createObjectURL(blob);
          img.src=coverArtUrl;
          img.style.display='block';
          dot.style.display='none';
          name.style.display='none';
          bg.style.backgroundImage=`url(${coverArtUrl})`;
          bg.classList.add('show');
          res();
        },
        onError(){res()}
      });
    });
  }catch(e){}
}

function rpSetBass(val){
  const v=parseFloat(val);
  $('rpBassVal').textContent=(v>=0?'+':'')+v+' dB';
  const pct=((v-(-10))/(15-(-10)))*100;
  $('rpBass').style.setProperty('--v',pct+'%');
  if(eqBands[0])eqBands[0].gain.value=v;
}

// ── EQ Presets ─────────────────────────────────────────────
function rpSetPreset(name){
  const gains=EQ_PRESETS[name];if(!gains)return;
  if(eqBands.length)gains.forEach((g,i)=>{if(eqBands[i])eqBands[i].gain.value=g});
  // Bass-Slider auf 80Hz-Wert des Presets setzen
  $('rpBass').value=gains[0];
  $('rpBassVal').textContent=(gains[0]>=0?'+':'')+gains[0]+' dB';
  const pct=((gains[0]-(-10))/(15-(-10)))*100;
  $('rpBass').style.setProperty('--v',pct+'%');
  document.querySelectorAll('.eq-preset-btn').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));
  try{localStorage.setItem('rp_preset',name)}catch(e){}
}

// ── IndexedDB ──────────────────────────────────────────────
function openDB(){
  return new Promise((res,rej)=>{const r=indexedDB.open('rp-db',1);r.onupgradeneeded=e=>e.target.result.createObjectStore('data');r.onsuccess=e=>res(e.target.result);r.onerror=rej});
}
async function dbSet(key,val){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(val,key);tx.oncomplete=res;tx.onerror=rej})}
async function dbGet(key){const db=await openDB();return new Promise(res=>{const tx=db.transaction('data','readonly');const r=tx.objectStore('data').get(key);r.onsuccess=e=>res(e.target.result||null);r.onerror=()=>res(null)})}

// ── Rekursiver Ordner-Scan ─────────────────────────────────
async function scanDir(dirHandle,arr){
  for await(const[,handle] of dirHandle){
    if(handle.kind==='file'){
      try{const f=await handle.getFile();const x=ext(f.name);if(AUDIO_EXT.includes(x)||VIDEO_EXT.includes(x)){arr.push(f);$('rpScanCount').textContent=arr.length+' Dateien gefunden'}}catch(e){}
    }else if(handle.kind==='directory'){try{await scanDir(handle,arr)}catch(e){}}
  }
}

// ── Haupt-Ordner auswählen ─────────────────────────────────
async function rpPickRootFolder(){
  if(!window.showDirectoryPicker){$('rpFolderIn').click();return}
  try{
    const handle=await window.showDirectoryPicker({mode:'read',startIn:'music'});
    await dbSet('rootDir',handle);await rpScanHandle(handle);
  }catch(e){if(e.name!=='AbortError')rpToast('Fehler beim Ordner laden')}
}
async function rpScanHandle(handle){
  $('rpSetupBox').style.display='none';$('rpReloadBox').style.display='none';
  $('rpScanBox').style.display='flex';$('rpScanCount').textContent='0 Dateien gefunden';
  const arr=[];try{await scanDir(handle,arr)}catch(e){}
  $('rpScanBox').style.display='none';
  if(!arr.length){$('rpSetupBox').style.display='';rpToast('Keine Musikdateien gefunden');return}
  files=arr;buildPlaylist(false);rpToast('✓ '+files.length+' Tracks geladen');
  $('rpRescanBtn').style.display='flex';
}

// ── Rescan ─────────────────────────────────────────────────
async function rpRescan(){
  const handle=await dbGet('rootDir');
  if(!handle){rpToast('Kein Ordner gespeichert');return}
  try{const perm=await handle.requestPermission({mode:'read'});if(perm!=='granted'){rpToast('Zugriff verweigert');return}}catch(e){rpToast('Fehler');return}
  const curName=cur>=0?files[playlist[cur]]?.name:null;
  $('rpScanBox').style.display='flex';$('rpScanCount').textContent='0 Dateien gefunden';
  const arr=[];try{await scanDir(handle,arr)}catch(e){}
  $('rpScanBox').style.display='none';
  if(!arr.length){rpToast('Keine Dateien gefunden');return}
  files=arr;buildPlaylist(false);
  if(curName){const idx=files.findIndex(f=>f.name===curName);if(idx>=0){const pi=playlist.indexOf(idx);if(pi>=0)cur=pi}}
  renderUI();rpToast('✓ '+files.length+' Tracks · Neu eingelesen');
}

// ── Letzten Ordner neu laden ───────────────────────────────
async function rpReloadLast(){
  const handle=await dbGet('rootDir');
  if(!handle){$('rpReloadBox').style.display='none';$('rpSetupBox').style.display='';return}
  try{const perm=await handle.requestPermission({mode:'read'});if(perm==='granted'){await rpScanHandle(handle);return}}catch(e){}
  rpToast('Zugriff verweigert');$('rpReloadBox').style.display='none';$('rpSetupBox').style.display='';
}

// ── App-Start ──────────────────────────────────────────────
async function rpCheckSavedDir(){
  try{
    const handle=await dbGet('rootDir');if(!handle)return;
    const perm=await handle.queryPermission({mode:'read'});
    if(perm==='granted'){await rpScanHandle(handle)}else{$('rpSetupBox').style.display='none';$('rpReloadBox').style.display='flex'}
  }catch(e){}
}

// ── Ordner hinzufügen (ohne zu ersetzen) ──────────────────
async function rpAddFolder(){
  if(!window.showDirectoryPicker){$('rpFolderIn').click();return}
  try{
    const handle=await window.showDirectoryPicker({mode:'read',startIn:'music'});
    rpToast('Scanne Ordner…');
    const arr=[];try{await scanDir(handle,arr)}catch(e){}
    if(!arr.length){rpToast('Keine Musikdateien gefunden');return}
    const seen=new Set(files.map(f=>f.name+f.size));
    let added=0;arr.forEach(f=>{if(!seen.has(f.name+f.size)){files.push(f);added++}});
    if(!added){rpToast('Alle Dateien bereits in der Liste');return}
    const wasCur=cur>=0?playlist[cur]:-1;
    const idx=files.map((_,i)=>i);
    if(shuffle){for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}}
    playlist=idx;cur=wasCur>=0?playlist.indexOf(wasCur):0;if(cur<0)cur=0;
    renderUI();renderList();rpToast('✓ '+added+' Tracks hinzugefügt');
  }catch(e){if(e.name!=='AbortError')rpToast('Fehler beim Ordner laden')}
}

// ── File loading ───────────────────────────────────────────
function rpOpenFilePicker(){$('rpFilesIn').click()}
function rpOpenPicker(t){$(t==='folder'?'rpFolderIn':'rpFilesIn').click()}
function rpLoad(e){
  const valid=Array.from(e.target.files).filter(f=>{const x=ext(f.name);return AUDIO_EXT.includes(x)||VIDEO_EXT.includes(x)});
  if(!valid.length){alert('Keine Musik- oder Videodateien gefunden.');return}
  const seen=new Set(files.map(f=>f.name+f.size));
  valid.forEach(f=>{if(!seen.has(f.name+f.size))files.push(f)});
  buildPlaylist(true);e.target.value='';
}

function buildPlaylist(autoplay){
  const idx=files.map((_,i)=>i);
  if(shuffle){for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}}
  playlist=idx;cur=files.length?0:-1;
  renderUI();if(autoplay&&files.length)playTrack(0);
}

// ── Toast ──────────────────────────────────────────────────
function rpToast(msg){
  let t=$('rpToast');
  if(!t){t=document.createElement('div');t.id='rpToast';
    Object.assign(t.style,{position:'fixed',bottom:'80px',left:'50%',transform:'translateX(-50%)',
      background:'rgba(212,160,23,0.95)',color:'#0d0b08',padding:'8px 18px',borderRadius:'20px',
      fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',letterSpacing:'1px',
      zIndex:'200',pointerEvents:'none',transition:'opacity 0.4s'});
    document.body.appendChild(t);
  }
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(t._to);t._to=setTimeout(()=>t.style.opacity='0',2500);
}

// ── Playback ───────────────────────────────────────────────
function ensureAudio(){
  if(audioEl)return;
  audioEl=new Audio();
  audioEl.addEventListener('timeupdate',onTime);
  audioEl.addEventListener('ended',onEnded);
  audioEl.addEventListener('loadedmetadata',onMeta);
}

function playTrack(pi){
  if(pi<0||pi>=playlist.length)return;
  cur=pi;const f=files[playlist[pi]];
  if(objUrl){URL.revokeObjectURL(objUrl);objUrl=null}
  objUrl=URL.createObjectURL(f);
  ensureAudio();

  const vid=$('rpVideo'),va=$('rpVideoArea'),viny=$('rpVinylArea');

  if(isVid(f.name)){
    audioEl.pause();audioEl.src='';
    vid.removeEventListener('timeupdate',onTime);vid.removeEventListener('ended',onEnded);vid.removeEventListener('loadedmetadata',onMeta);
    vid.addEventListener('timeupdate',onTime);vid.addEventListener('ended',onEnded);vid.addEventListener('loadedmetadata',onMeta);
    vid.src=objUrl;va.className='video-area visible';viny.style.display='none';media=vid;
  }else{
    vid.pause();vid.src='';va.className='video-area';viny.style.display='';
    audioEl.src=objUrl;media=audioEl;
    // Init Web Audio on first audio play (needs user gesture)
    if(!audioCtx)initWebAudio();
    if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
  }

  media.volume=parseFloat($('rpVol').value);
  media.play().then(()=>{playing=true;updateUI()}).catch(()=>{playing=false;updateUI()});

  const clean=getDisplayName(f);
  $('rpTrackName').textContent=clean;
  $('rpTrackSub').textContent='TRACK '+(pi+1)+' / '+playlist.length+'  ·  '+ext(f.name).toUpperCase();
  $('rpBar').value=0;$('rpBar').style.setProperty('--v','0%');
  $('rpCur').textContent='0:00';$('rpTot').textContent='0:00';
  $('rpTrackName').classList.toggle('scrolling',clean.length>22);

  // Vinyl label: Song-Name (rotiert mit, CSS übernimmt Umbruch/Clamp)
  $('rpVinylLabelName').textContent=clean;
  $('rpVinyl').classList.toggle('playing',!isVid(f.name));

  startEq();highlightItem(pi);updateMediaSession(f);
  loadCoverArt(f);
}

function onTime(){
  if(!media)return;
  const p=media.duration?(media.currentTime/media.duration)*100:0;
  $('rpBar').value=p;$('rpBar').style.setProperty('--v',p+'%');
  $('rpCur').textContent=fmt(media.currentTime);
}
function onMeta(){
  if(!media)return;
  $('rpTot').textContent=fmt(media.duration);
  if(cur>=0){fileDurations[playlist[cur]]=media.duration;renderList()}
}
function onEnded(){
  if(media)media.volume=parseFloat($('rpVol').value);
  if(repeat==='one'){media.currentTime=0;media.play();return}
  if(cur+1<playlist.length)playTrack(cur+1);
  else if(repeat==='all'){if(shuffle)buildPlaylist(true);else playTrack(0)}
  else{playing=false;$('rpVinyl').classList.remove('playing');stopEq();updateUI()}
}

function rpTogglePlay(){
  if(!media)return;
  if(playing){media.pause();playing=false;$('rpVinyl').classList.remove('playing');stopEq()}
  else{
    if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
    media.play();playing=true;if(media===audioEl)$('rpVinyl').classList.add('playing');startEq();
  }
  updateUI();
}
function rpNext(){if(playlist.length)playTrack(cur+1<playlist.length?cur+1:0)}
function rpPrev(){
  if(!playlist.length)return;
  if(media&&media.currentTime>3){media.currentTime=0;return}
  playTrack(cur>0?cur-1:playlist.length-1);
}
function rpSeek(v){if(media&&media.duration)media.currentTime=(v/100)*media.duration}
function rpSetVol(v){const n=parseFloat(v);if(audioEl)audioEl.volume=n;$('rpVideo').volume=n}
function rpSetSpeed(v){
  const n=parseFloat(v);
  if(audioEl)audioEl.playbackRate=n;
  $('rpVideo').playbackRate=n;
  document.querySelectorAll('.speed-btn').forEach(b=>b.classList.toggle('active',parseFloat(b.dataset.speed)===n));
  try{localStorage.setItem('rp_speed',v)}catch(e){}
}

// ── Vinyl DJ-Scratch ───────────────────────────────────────
(function(){
  const v=$('rpVinyl');
  let startX=0,startY=0,startT=0;
  let scratching=false,lastX=0,lastMoveT=0,visualRot=0;
  let wasPlaying=false,savedRate=1;

  function currentRotation(){
    const m=getComputedStyle(v).transform;
    if(!m||m==='none')return 0;
    const p=m.match(/matrix\(([^,]+),([^,]+)/);
    if(!p)return 0;
    return Math.atan2(parseFloat(p[2]),parseFloat(p[1]))*180/Math.PI;
  }

  v.addEventListener('touchstart',e=>{
    const t=e.touches[0];
    startX=lastX=t.clientX;startY=t.clientY;startT=Date.now();
    lastMoveT=Date.now();
    visualRot=currentRotation();
    scratching=false;
  },{passive:true});

  v.addEventListener('touchmove',e=>{
    const t=e.touches[0];
    const dx=t.clientX-startX,dy=t.clientY-startY;

    if(!scratching&&Math.hypot(dx,dy)>10){
      scratching=true;
      wasPlaying=playing;
      savedRate=parseFloat(localStorage.getItem('rp_speed')||'1');
      // Musik MUSS spielen damit playbackRate einen Ton erzeugt
      if(media){
        if(media.paused){media.play().catch(()=>{});playing=true;updateUI()}
        if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
      }
      v.classList.add('scratching');
      v.style.transform=`rotate(${visualRot}deg)`;
    }
    if(!scratching)return;
    e.preventDefault();

    const now=Date.now();
    const dt=Math.max(8,now-lastMoveT);
    const moveDelta=t.clientX-lastX; // Pixel pro Frame
    const velocity=moveDelta/dt;     // px/ms

    if(Math.abs(velocity)<0.05){
      // Finger kaum bewegt → Musik bremst stark ab
      if(media)media.playbackRate=0.12;
    }else if(velocity>0){
      // Vorwärts schieben → Ton wird höher/schneller
      const rate=Math.max(0.5,Math.min(4.0,velocity*20));
      if(media){media.playbackRate=rate;}
    }else{
      // Rückwärts schieben → tiefer Ton + zurückspulen
      const rate=Math.max(0.08,Math.min(0.6,Math.abs(velocity)*12));
      if(media){
        media.playbackRate=rate;
        if(media.duration)media.currentTime=Math.max(0,media.currentTime+velocity*0.08);
      }
    }

    // Visuelle Rotation (1px = 1.5°)
    visualRot+=moveDelta*1.5;
    v.style.transform=`rotate(${visualRot}deg)`;

    lastX=t.clientX;lastMoveT=now;
  },{passive:false});

  v.addEventListener('touchend',e=>{
    const t=e.changedTouches[0];
    const dx=t.clientX-startX,dy=t.clientY-startY,dt=Date.now()-startT;
    if(scratching){
      scratching=false;
      v.classList.remove('scratching');
      v.style.transform='';
      if(media)media.playbackRate=savedRate;
      if(!wasPlaying&&media){media.pause();playing=false;stopEq();updateUI()}
      else if(wasPlaying)startEq();
    }else if(Math.abs(dx)<20&&Math.abs(dy)<20&&dt<300){
      rpTogglePlay();
    }else if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){
      if(dx<0)rpNext();else rpPrev();
    }
  },{passive:true});
})();

// ── Video Fullscreen ───────────────────────────────────────
function rpVideoFullscreen(){
  const vid=$('rpVideo');
  const req=vid.requestFullscreen||vid.webkitRequestFullscreen||vid.mozRequestFullScreen||vid.msRequestFullscreen;
  if(req)req.call(vid);
}
document.addEventListener('fullscreenchange',handleFsChange);
document.addEventListener('webkitfullscreenchange',handleFsChange);
function handleFsChange(){
  const inFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
  if(inFs&&screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(()=>{});
  else if(!inFs&&screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();
}

// ── Shuffle / Repeat ───────────────────────────────────────
function rpToggleShuffle(){
  shuffle=!shuffle;
  if(files.length){
    const cf=playlist[cur];
    const rest=files.map((_,i)=>i).filter(i=>i!==cf);
    if(shuffle){for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]]}}
    playlist=[cf,...rest];cur=0;renderList();highlightItem(0);
  }
  updateUI();
}
function rpToggleRepeat(){const m=['off','all','one'];repeat=m[(m.indexOf(repeat)+1)%3];updateUI()}

// ── Playlist overlay ───────────────────────────────────────
function rpToggleList(){
  listOpen=!listOpen;
  $('rpPlOverlay').classList.toggle('open',listOpen);
  $('rpPlPanel').classList.toggle('open',listOpen);
  if(listOpen){$('rpSearch').value='';searchTerm='';renderList()}
}

// ── EQ Visualizer (echt) ───────────────────────────────────
const EQ_N=12;
function startEq(){
  stopEq();
  if(analyser){
    const bins=analyserData.length;
    const update=()=>{
      analyser.getByteFrequencyData(analyserData);
      for(let i=0;i<EQ_N;i++){
        const b=$('eq'+i);if(!b)continue;
        const s=Math.floor((i/EQ_N)*bins*0.7);
        const e=Math.floor(((i+1)/EQ_N)*bins*0.7);
        let sum=0;for(let j=s;j<e;j++)sum+=analyserData[j];
        const avg=e>s?sum/(e-s):analyserData[s]||0;
        b.style.height=Math.max(6,(avg/255)*96)+'%';
      }
      animFrame=requestAnimationFrame(update);
    };
    update();
  }else{
    eqInterval=setInterval(()=>{for(let i=0;i<EQ_N;i++){const b=$('eq'+i);if(b)b.style.height=(12+Math.random()*78)+'%'}},130);
  }
}
function stopEq(){
  clearInterval(eqInterval);
  cancelAnimationFrame(animFrame);
  animFrame=null;
  for(let i=0;i<EQ_N;i++){const b=$('eq'+i);if(b)b.style.height='10%'}
}

// ── UI update ──────────────────────────────────────────────
function updateUI(){
  $('rpPlayBtn').textContent=playing?'⏸':'▶';
  $('rpShuffleBtn').classList.toggle('on',shuffle);
  const rb=$('rpRepeatBtn');
  if(repeat==='off'){rb.classList.remove('on');rb.textContent='🔁'}
  else if(repeat==='all'){rb.classList.add('on');rb.textContent='🔁'}
  else{rb.classList.add('on');rb.textContent='🔂'}
}

function renderUI(){
  const has=files.length>0;
  $('rpEmpty').style.display=has?'none':'flex';
  $('rpPlayer').style.display=has?'flex':'none';
  $('rpCount').textContent=files.length+' TRACKS';
  updateUI();
}

function renderList(){
  let items=playlist.map((fi,pi)=>({fi,pi}));
  // Favorites filter
  if(favFilterOn)items=items.filter(({fi})=>favorites.has(fileKey(files[fi])));
  // Search filter
  if(searchTerm)items=items.filter(({fi})=>getDisplayName(files[fi]).toLowerCase().includes(searchTerm));
  $('rpList').innerHTML=items.map(({fi,pi})=>{
    const f=files[fi];
    const icon=isVid(f.name)?'🎬':'🎵';
    const x=ext(f.name).toUpperCase();
    const name=esc(getDisplayName(f));
    const isFav=favorites.has(fileKey(f));
    const dur=fileDurations[fi]?fmt(fileDurations[fi]):'';
    return`<div class="pl-item${pi===cur?' active':''}" id="pi${pi}" onclick="playTrack(${pi});rpToggleList()">
      <span class="pl-num">${pi+1}</span>
      <span class="pl-icon">${icon}</span>
      <span class="pl-name">${name}</span>
      <span class="pl-dur">${dur}</span>
      <button class="pl-fav-btn${isFav?' active':''}" onclick="rpToggleFav(${pi},event)" title="Favorit">❤️</button>
      <button class="pl-rename-btn" onclick="rpRenameTrack(${pi},event)" title="Umbenennen">✏️</button>
    </div>`;
  }).join('');
}

function highlightItem(pi){
  document.querySelectorAll('.pl-item').forEach((el,i)=>el.classList.toggle('active',i===pi));
  const el=$('pi'+pi);if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function rpClear(){
  if(!confirm('Playlist leeren?'))return;
  if(media){media.pause();media.src=''}
  if(audioEl)audioEl.src='';
  const v=$('rpVideo');v.pause();v.src='';
  $('rpVideoArea').className='video-area';$('rpVinylArea').style.display='';
  $('rpVinyl').classList.remove('playing');stopEq();
  if(objUrl){URL.revokeObjectURL(objUrl);objUrl=null}
  files=[];playlist=[];cur=-1;playing=false;media=null;
  listOpen=false;$('rpPlOverlay').classList.remove('open');$('rpPlPanel').classList.remove('open');
  $('rpVinylLabelName').textContent='DaN';
  renderUI();
}

// ── Drag & Drop ────────────────────────────────────────────
const drop=$('rpDrop');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over')});
drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
drop.addEventListener('drop',e=>{
  e.preventDefault();drop.classList.remove('over');
  const valid=Array.from(e.dataTransfer.files).filter(f=>{const x=ext(f.name);return AUDIO_EXT.includes(x)||VIDEO_EXT.includes(x)});
  if(!valid.length)return;
  const seen=new Set(files.map(f=>f.name+f.size));
  valid.forEach(f=>{if(!seen.has(f.name+f.size))files.push(f)});
  buildPlaylist(true);
});

// ── Media Session ──────────────────────────────────────────
function updateMediaSession(f){
  if(!('mediaSession' in navigator))return;
  navigator.mediaSession.metadata=new MediaMetadata({title:f.name.replace(/\.[^.]+$/,''),artist:'DaN Vibe'});
  navigator.mediaSession.setActionHandler('play',rpTogglePlay);
  navigator.mediaSession.setActionHandler('pause',rpTogglePlay);
  navigator.mediaSession.setActionHandler('nexttrack',rpNext);
  navigator.mediaSession.setActionHandler('previoustrack',rpPrev);
}

// ── DJ MODE ────────────────────────────────────────────────
let djElA=null,djElB=null,djUrlA=null,djUrlB=null;
let djPlayA=false,djPlayB=false,djCFVal=50;
let djLoopA=false,djLoopB=false;
let djHotCues={A:[null,null,null,null,null,null,null,null],B:[null,null,null,null,null,null,null,null]};
let djVuInterval=null,djTimeInterval=null;
let djChanVolA=1,djChanVolB=1,djMasterVol=1;
let djFX={A:{echo:false,flng:false,filt:false,rvs:false},B:{echo:false,flng:false,filt:false,rvs:false}};
let djSessionStart=null,djWaveRaf=null;
let djScratchData={A:{active:false,lastX:0,lastT:0,rot:0,wasPlaying:false},B:{active:false,lastX:0,lastT:0,rot:0,wasPlaying:false}};

function rpOpenDJ(){
  if(!files.length){rpToast('Erst Musik laden!');return}
  if(!djElA){
    djElA=new Audio();
    djElA.addEventListener('ended',()=>{
      if(djLoopA&&djElA.duration){djElA.currentTime=0;djElA.play().catch(()=>{})}
      else{djPlayA=false;$('rpDJVinylA').classList.remove('playing');$('rpDJBassA')?.classList.remove('active');$('rpDJTapeA')?.classList.remove('running');rpDJUpdateBtn('A')}
    });
  }
  if(!djElB){
    djElB=new Audio();
    djElB.addEventListener('ended',()=>{
      if(djLoopB&&djElB.duration){djElB.currentTime=0;djElB.play().catch(()=>{})}
      else{djPlayB=false;$('rpDJVinylB').classList.remove('playing');$('rpDJBassB')?.classList.remove('active');$('rpDJTapeB')?.classList.remove('running');rpDJUpdateBtn('B')}
    });
  }
  $('rpDJOverlay').style.display='flex';
  rpDJRenderList();
  rpDJCrossfade(50);
  djSessionStart=Date.now();
  djVuInterval=setInterval(rpDJAnimateVU,80);
  djTimeInterval=setInterval(rpDJUpdateTime,500);
  djWaveRaf=requestAnimationFrame(rpDJWaveLoop);
}

function rpCloseDJ(){
  $('rpDJOverlay').style.display='none';
  clearInterval(djVuInterval);clearInterval(djTimeInterval);
  if(djWaveRaf){cancelAnimationFrame(djWaveRaf);djWaveRaf=null;}
}

function rpDJRenderList(){
  const el=$('rpDJList');if(!el)return;
  const items=playlist.filter(fi=>!isVid(files[fi].name));
  el.innerHTML=items.map(fi=>{
    const name=esc(getDisplayName(files[fi]));
    return`<div class="dj-list-item">
      <span class="dj-list-item-name">${name}</span>
      <button class="dj-load-btn" onclick="rpDJLoad('A',${fi})">→ A</button>
      <button class="dj-load-btn" onclick="rpDJLoad('B',${fi})">→ B</button>
    </div>`;
  }).join('');
}

function rpDJLoad(deck,pi){
  if(pi<0){rpToast('Track aus der Liste wählen ↓');return}
  const f=files[pi];
  const el=deck==='A'?djElA:djElB;
  const prevUrl=deck==='A'?djUrlA:djUrlB;
  if(prevUrl)URL.revokeObjectURL(prevUrl);
  const url=URL.createObjectURL(f);
  if(deck==='A'){djUrlA=url;djPlayA=false;djHotCues.A=[null,null,null,null,null,null,null,null]}
  else{djUrlB=url;djPlayB=false;djHotCues.B=[null,null,null,null,null,null,null,null]}
  el.src=url;el.load();el.currentTime=0;
  $('rpDJName'+deck).textContent=getDisplayName(f);
  $('rpDJVinyl'+deck).classList.remove('playing');
  $('rpDJBass'+deck)?.classList.remove('active');
  $('rpDJTape'+deck)?.classList.remove('running');
  rpDJUpdateBtn(deck);
  // Reset hot cue visuals
  document.querySelectorAll('.dj-hc').forEach(b=>b.classList.remove('set'));
  document.querySelectorAll('.dj-pad').forEach(b=>b.classList.remove('set'));
  rpToast('Deck '+deck+': '+getDisplayName(f));
}

function rpDJToggle(deck){
  const el=deck==='A'?djElA:djElB;
  const url=deck==='A'?djUrlA:djUrlB;
  if(!url){rpToast('Track aus der Liste wählen → '+deck);return}
  const isPlaying=deck==='A'?djPlayA:djPlayB;
  if(isPlaying){
    el.pause();
    if(deck==='A'){djPlayA=false;$('rpDJVinylA').classList.remove('playing')}
    else{djPlayB=false;$('rpDJVinylB').classList.remove('playing')}
    $('rpDJBass'+deck)?.classList.remove('active');
    $('rpDJTape'+deck)?.classList.remove('running');
  }else{
    el.play().catch(()=>{});
    if(deck==='A'){djPlayA=true;$('rpDJVinylA').classList.add('playing')}
    else{djPlayB=true;$('rpDJVinylB').classList.add('playing')}
    $('rpDJBass'+deck)?.classList.add('active');
    $('rpDJTape'+deck)?.classList.add('running');
  }
  rpDJUpdateBtn(deck);
}

function rpDJUpdateBtn(deck){
  const isPlaying=deck==='A'?djPlayA:djPlayB;
  const btn=$('rpDJPlayBtn'+deck);
  btn.textContent=isPlaying?'⏸':'▶';
  btn.classList.toggle('playing-state',isPlaying);
}

function rpDJCue(deck){
  const el=deck==='A'?djElA:djElB;
  if(el)el.currentTime=0;
}

function rpDJSetVolumes(){
  const a=djCFVal/100*Math.PI/2;
  const cfA=Math.max(0,Math.min(1,Math.cos(a)));
  const cfB=Math.max(0,Math.min(1,Math.sin(a)));
  if(djElA)djElA.volume=djChanVolA*djMasterVol*cfA;
  if(djElB)djElB.volume=djChanVolB*djMasterVol*cfB;
}

function rpDJCrossfade(val){
  djCFVal=parseFloat(val);
  rpDJSetVolumes();
}

function rpDJPitch(deck,val){
  const r=parseFloat(val);
  const el=deck==='A'?djElA:djElB;
  if(el)el.playbackRate=r;
  const pct=Math.round((r-1)*100);
  $('rpDJPitchVal'+deck).textContent=(pct>0?'+':'')+pct+'%';
}

function rpDJChanVol(deck,val){
  if(deck==='A')djChanVolA=Math.max(0,Math.min(1,parseFloat(val)));
  else djChanVolB=Math.max(0,Math.min(1,parseFloat(val)));
  rpDJSetVolumes();
}

let djKills={A:{hi:false,mid:false,lo:false},B:{hi:false,mid:false,lo:false}};

function rpDJKill(deck,band){
  djKills[deck][band]=!djKills[deck][band];
  const id='rpDJKill'+band.charAt(0).toUpperCase()+band.slice(1)+deck;
  $(id)?.classList.toggle('killed',djKills[deck][band]);
  rpToast('Kill '+band.toUpperCase()+' '+deck+': '+(djKills[deck][band]?'AN':'AUS'));
}

function rpDJSync(deck){
  const src=deck==='A'?djElA:djElB;
  const ref=deck==='A'?djElB:djElA;
  if(!src||!ref||!ref.src)return;
  const refRate=ref.playbackRate||1;
  src.playbackRate=refRate;
  const pct=Math.round((refRate-1)*100);
  $('rpDJPitchVal'+deck).textContent=(pct>0?'+':'')+pct+'%';
  $('rpDJPitch'+deck).value=refRate;
  rpToast('Deck '+deck+' SYNC → '+(pct>0?'+':'')+pct+'%');
}

function rpDJMasterVol(val){
  djMasterVol=Math.max(0,Math.min(1,parseFloat(val)));
  rpDJSetVolumes();
}

function rpDJFX(deck,fx){
  djFX[deck][fx]=!djFX[deck][fx];
  document.getElementById('rpDJFX_'+fx+deck)?.classList.toggle('fx-on',djFX[deck][fx]);
}

function rpDJWaveLoop(){
  rpDJDrawWave('A');
  rpDJDrawWave('B');
  djWaveRaf=requestAnimationFrame(rpDJWaveLoop);
}

function rpDJDrawWave(deck){
  const canvas=document.getElementById('rpDJWave'+deck);
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const isPlaying=deck==='A'?djPlayA:djPlayB;
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  if(!isPlaying){
    ctx.strokeStyle='rgba(0,180,60,0.12)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    return;
  }
  const t=Date.now()/180;
  ctx.shadowColor='#00dd77';ctx.shadowBlur=5;
  ctx.strokeStyle='#00dd77';ctx.lineWidth=1.5;
  ctx.beginPath();
  for(let x=0;x<w;x++){
    const y=h/2+(Math.sin(x*0.12+t)*0.55+Math.sin(x*0.31+t*1.7)*0.25+Math.sin(x*0.07-t*0.5)*0.2)*(h*0.38);
    x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.stroke();
}

function rpDJLoop(deck){
  if(deck==='A'){
    djLoopA=!djLoopA;
    $('rpDJLoopBtnA').classList.toggle('loop-active',djLoopA);
    rpToast('Loop A: '+(djLoopA?'AN':'AUS'));
  }else{
    djLoopB=!djLoopB;
    $('rpDJLoopBtnB').classList.toggle('loop-active',djLoopB);
    rpToast('Loop B: '+(djLoopB?'AN':'AUS'));
  }
}

function rpDJHotCue(deck,idx){
  const el=deck==='A'?djElA:djElB;
  if(!el||!el.src)return;
  const cues=djHotCues[deck];
  if(cues[idx]===null){
    cues[idx]=el.currentTime;
    $('rpDJHc'+idx+deck)?.classList.add('set');
    $('rpDJPad'+idx+deck)?.classList.add('set');
    rpToast('CUE '+(idx+1)+' gesetzt · '+fmt(cues[idx]));
  }else{
    el.currentTime=cues[idx];
    // Flash the pad
    const p=$('rpDJPad'+idx+deck);
    if(p){p.classList.add('flash');setTimeout(()=>p.classList.remove('flash'),180);}
  }
}

function rpDJUpdateTime(){
  ['A','B'].forEach(d=>{
    const el=d==='A'?djElA:djElB;
    if(!el)return;
    const t=$('rpDJTime'+d);
    if(t)t.textContent=fmt(el.currentTime||0);
    const rate=el.playbackRate||1;
    const bpmEl=$('rpDJBpm'+d);
    if(bpmEl&&el.src)bpmEl.textContent=Math.round(128*rate)+' BPM';
  });
  // Session clock
  if(djSessionStart){
    const s=Math.floor((Date.now()-djSessionStart)/1000);
    const m=String(Math.floor(s/60)).padStart(2,'0');
    const ss=String(s%60).padStart(2,'0');
    const el=$('rpDJSession');
    if(el)el.textContent=m+':'+ss;
  }
}

function rpDJAnimateVU(){
  ['A','B'].forEach(d=>{
    const isPlaying=d==='A'?djPlayA:djPlayB;
    const bar=$('rpDJVu'+d);
    if(!bar)return;
    const segs=bar.querySelectorAll('.dj-vs');
    if(isPlaying){
      const level=Math.floor(Math.random()*3)+Math.floor(Math.random()*5);
      segs.forEach((s,i)=>s.classList.toggle('active',i<level));
    }else{
      segs.forEach(s=>s.classList.remove('active'));
    }
  });
}

// DJ Scratch (direkt auf den DJ-Vinyls)
function rpDJScratchStart(e,deck){
  e.preventDefault();
  const t=e.touches[0];
  const d=djScratchData[deck];
  d.lastX=t.clientX;d.lastT=Date.now();d.active=false;
  d.wasPlaying=deck==='A'?djPlayA:djPlayB;
  const v=$('rpDJVinyl'+deck);
  const m=getComputedStyle(v).transform;
  if(m&&m!=='none'){const p=m.match(/matrix\(([^,]+),([^,]+)/);if(p)d.rot=Math.atan2(parseFloat(p[2]),parseFloat(p[1]))*180/Math.PI}
}
function rpDJScratchMove(e,deck){
  e.preventDefault();
  const t=e.touches[0];
  const d=djScratchData[deck];
  const dx=t.clientX-d.lastX;
  if(!d.active&&Math.abs(dx)>8){
    d.active=true;
    const el=deck==='A'?djElA:djElB;
    const url=deck==='A'?djUrlA:djUrlB;
    if(url&&el.paused){el.play().catch(()=>{});if(deck==='A')djPlayA=true;else djPlayB=true;rpDJUpdateBtn(deck);$('rpDJVinyl'+deck).classList.add('playing')}
    $('rpDJVinyl'+deck).classList.add('scratching');
  }
  if(!d.active)return;
  const now=Date.now();
  const dt=Math.max(8,now-d.lastT);
  const vel=dx/dt;
  const el=deck==='A'?djElA:djElB;
  if(Math.abs(vel)<0.05){if(el)el.playbackRate=0.1}
  else if(vel>0){if(el)el.playbackRate=Math.max(0.5,Math.min(4,vel*18))}
  else{if(el){el.playbackRate=Math.max(0.08,Math.min(0.6,Math.abs(vel)*12));if(el.duration)el.currentTime=Math.max(0,el.currentTime+vel*0.1)}}
  d.rot+=dx*1.5;
  $('rpDJVinyl'+deck).style.transform=`rotate(${d.rot}deg)`;
  d.lastX=t.clientX;d.lastT=now;
}
function rpDJScratchEnd(e,deck){
  const d=djScratchData[deck];
  if(d.active){
    d.active=false;
    $('rpDJVinyl'+deck).classList.remove('scratching');
    $('rpDJVinyl'+deck).style.transform='';
    const el=deck==='A'?djElA:djElB;
    if(el)el.playbackRate=parseFloat($('rpDJPitch'+deck).value)||1;
    if(!d.wasPlaying&&el){el.pause();if(deck==='A')djPlayA=false;else djPlayB=false;rpDJUpdateBtn(deck);$('rpDJVinyl'+deck).classList.remove('playing')}
  }
}

// ── Service Worker ─────────────────────────────────────────
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

// ── Vollbild ───────────────────────────────────────────────
(function(){
  const isInstalled=()=>
    window.matchMedia('(display-mode:fullscreen)').matches||
    window.matchMedia('(display-mode:standalone)').matches||
    navigator.standalone===true;

  function goFullscreen(){
    if(isInstalled())return;
    const el=document.documentElement;
    const req=el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen;
    if(req)req.call(el).catch(()=>{});
  }

  // Beim ersten Tippen Vollbild aktivieren
  document.addEventListener('touchstart',goFullscreen,{once:true,passive:true});
  document.addEventListener('click',goFullscreen,{once:true});

  // Vollbild wiederherstellen wenn App nach Pause zurückkommt
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&!isInstalled())goFullscreen();
  });
})();

// ── Intro Splash ───────────────────────────────────────────
(function(){
  const intro=document.getElementById('rpIntro');
  if(!intro)return;
  setTimeout(()=>{
    intro.classList.add('hiding');
    setTimeout(()=>{intro.style.display='none'},700);
  },2300);
})();

// ── Start ──────────────────────────────────────────────────
applyTheme(currentTheme);
const savedPreset=localStorage.getItem('rp_preset')||'master';
rpSetPreset(savedPreset);
const savedSpeed=parseFloat(localStorage.getItem('rp_speed')||'1');
rpSetSpeed(savedSpeed);
updateUI();
rpCheckSavedDir();
