const AUDIO_EXT=['mp3','wav','ogg','flac','aac','m4a','opus','wma','oga','m4b'];
const VIDEO_EXT=['mp4','webm','mov','avi','mkv','m4v','wmv','3gp','flv','ogv'];

let files=[],playlist=[],cur=-1;
let shuffle=true,repeat='off';
let playing=false,objUrl=null,audioEl=null,media=null;
let eqInterval=null,listOpen=false;

const $=id=>document.getElementById(id);
const ext=n=>(n.split('.').pop()||'').toLowerCase();
const isVid=n=>VIDEO_EXT.includes(ext(n));
const fmt=s=>!isFinite(s)||isNaN(s)?'0:00':Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Custom names (localStorage) ────────────────────────────
const NAMES_KEY='rp_names';
let customNames={};
try{customNames=JSON.parse(localStorage.getItem(NAMES_KEY)||'{}')}catch(e){}

function fileKey(f){return f.name+'|'+f.size}
function getDisplayName(f){return customNames[fileKey(f)]||f.name.replace(/\.[^.]+$/,'')}
function saveCustomName(f,name){
  customNames[fileKey(f)]=name;
  try{localStorage.setItem(NAMES_KEY,JSON.stringify(customNames))}catch(e){}
}

function rpRenameTrack(pi,event){
  event.stopPropagation();
  const f=files[playlist[pi]];
  const current=getDisplayName(f);
  const newName=prompt('Neuer Name:',current);
  if(newName===null)return;
  const trimmed=newName.trim();
  if(!trimmed)return;
  saveCustomName(f,trimmed);
  renderList();
  if(pi===cur){
    $('rpTrackName').textContent=trimmed;
    $('rpTrackName').classList.toggle('scrolling',trimmed.length>22);
  }
}

// ── IndexedDB (Ordner-Handle speichern) ────────────────────
function openDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('rp-db',1);
    r.onupgradeneeded=e=>e.target.result.createObjectStore('data');
    r.onsuccess=e=>res(e.target.result);
    r.onerror=rej;
  });
}
async function dbSet(key,val){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction('data','readwrite');
    tx.objectStore('data').put(val,key);
    tx.oncomplete=res;tx.onerror=rej;
  });
}
async function dbGet(key){
  const db=await openDB();
  return new Promise(res=>{
    const tx=db.transaction('data','readonly');
    const r=tx.objectStore('data').get(key);
    r.onsuccess=e=>res(e.target.result||null);
    r.onerror=()=>res(null);
  });
}

// ── Rekursiver Ordner-Scan ─────────────────────────────────
async function scanDir(dirHandle,arr){
  for await(const[,handle] of dirHandle){
    if(handle.kind==='file'){
      try{
        const f=await handle.getFile();
        const x=ext(f.name);
        if(AUDIO_EXT.includes(x)||VIDEO_EXT.includes(x)){
          arr.push(f);
          $('rpScanCount').textContent=arr.length+' Dateien gefunden';
        }
      }catch(e){}
    }else if(handle.kind==='directory'){
      try{await scanDir(handle,arr)}catch(e){}
    }
  }
}

// ── Haupt-Ordner auswählen ─────────────────────────────────
async function rpPickRootFolder(){
  if(!window.showDirectoryPicker){
    // Fallback: alter Input
    $('rpFolderIn').click();return;
  }
  try{
    const handle=await window.showDirectoryPicker({mode:'read',startIn:'music'});
    await dbSet('rootDir',handle);
    await rpScanHandle(handle);
  }catch(e){
    if(e.name!=='AbortError')rpToast('Fehler beim Ordner laden');
  }
}

async function rpScanHandle(handle){
  // Scan-UI zeigen
  $('rpSetupBox').style.display='none';
  $('rpReloadBox').style.display='none';
  $('rpScanBox').style.display='flex';
  $('rpScanCount').textContent='0 Dateien gefunden';

  const arr=[];
  try{
    await scanDir(handle,arr);
  }catch(e){}

  $('rpScanBox').style.display='none';

  if(!arr.length){
    $('rpSetupBox').style.display='';
    rpToast('Keine Musikdateien gefunden');
    return;
  }
  files=arr;
  buildPlaylist(false);
  rpToast('✓ '+files.length+' Tracks geladen');
}

// ── Letzten Ordner neu laden ───────────────────────────────
async function rpReloadLast(){
  const handle=await dbGet('rootDir');
  if(!handle){$('rpReloadBox').style.display='none';$('rpSetupBox').style.display='';return}
  try{
    const perm=await handle.requestPermission({mode:'read'});
    if(perm==='granted'){await rpScanHandle(handle);return}
  }catch(e){}
  rpToast('Zugriff verweigert – bitte Ordner neu auswählen');
  $('rpReloadBox').style.display='none';
  $('rpSetupBox').style.display='';
}

// ── Beim App-Start: Handle prüfen ──────────────────────────
async function rpCheckSavedDir(){
  try{
    const handle=await dbGet('rootDir');
    if(!handle)return;
    const perm=await handle.queryPermission({mode:'read'});
    if(perm==='granted'){
      // Still granted – direkt laden
      await rpScanHandle(handle);
    }else{
      // Braucht erneute Erlaubnis (Nutzergeste nötig)
      $('rpSetupBox').style.display='none';
      $('rpReloadBox').style.display='flex';
    }
  }catch(e){}
}

// ── File loading (Fallback: Input) ─────────────────────────
function rpOpenFilePicker(){$('rpFilesIn').click()}
function rpOpenPicker(t){$(t==='folder'?'rpFolderIn':'rpFilesIn').click()}

function rpLoad(e){
  const valid=Array.from(e.target.files).filter(f=>{const x=ext(f.name);return AUDIO_EXT.includes(x)||VIDEO_EXT.includes(x)});
  if(!valid.length){alert('Keine Musik- oder Videodateien gefunden.');return}
  const seen=new Set(files.map(f=>f.name+f.size));
  valid.forEach(f=>{if(!seen.has(f.name+f.size))files.push(f)});
  buildPlaylist(true);
  e.target.value='';
}

function buildPlaylist(autoplay){
  const idx=files.map((_,i)=>i);
  if(shuffle){for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}}
  playlist=idx;cur=files.length?0:-1;
  renderUI();
  if(autoplay&&files.length)playTrack(0);
}

// ── Einfacher Toast ────────────────────────────────────────
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
  cur=pi;
  const f=files[playlist[pi]];
  if(objUrl){URL.revokeObjectURL(objUrl);objUrl=null}
  objUrl=URL.createObjectURL(f);
  ensureAudio();

  const vid=$('rpVideo'),va=$('rpVideoArea'),viny=$('rpVinylArea');

  if(isVid(f.name)){
    // Video mode
    audioEl.pause();audioEl.src='';
    vid.removeEventListener('timeupdate',onTime);
    vid.removeEventListener('ended',onEnded);
    vid.removeEventListener('loadedmetadata',onMeta);
    vid.addEventListener('timeupdate',onTime);
    vid.addEventListener('ended',onEnded);
    vid.addEventListener('loadedmetadata',onMeta);
    vid.src=objUrl;
    va.className='video-area visible';
    viny.style.display='none';
    media=vid;
  }else{
    // Audio mode – Vinyl anzeigen
    vid.pause();vid.src='';
    va.className='video-area';
    viny.style.display='';
    audioEl.src=objUrl;
    media=audioEl;
  }

  media.volume=parseFloat($('rpVol').value);
  media.play().then(()=>{playing=true;updateUI()}).catch(()=>{playing=false;updateUI()});

  const clean=getDisplayName(f);
  $('rpTrackName').textContent=clean;
  $('rpTrackSub').textContent='TRACK '+(pi+1)+' / '+playlist.length+'  ·  '+ext(f.name).toUpperCase();
  $('rpBar').value=0;$('rpBar').style.setProperty('--v','0%');
  $('rpCur').textContent='0:00';$('rpTot').textContent='0:00';

  // Marquee bei langen Namen
  const el=$('rpTrackName');
  el.classList.toggle('scrolling',clean.length>22);

  // Vinyl
  $('rpVinyl').classList.toggle('playing',!isVid(f.name));

  startEq();
  highlightItem(pi);
  updateMediaSession(f);
}

function onTime(){
  if(!media)return;
  const p=media.duration?(media.currentTime/media.duration)*100:0;
  $('rpBar').value=p;$('rpBar').style.setProperty('--v',p+'%');
  $('rpCur').textContent=fmt(media.currentTime);
}
function onMeta(){if(media)$('rpTot').textContent=fmt(media.duration)}
function onEnded(){
  if(repeat==='one'){media.currentTime=0;media.play();return}
  if(cur+1<playlist.length)playTrack(cur+1);
  else if(repeat==='all'){if(shuffle)buildPlaylist(true);else playTrack(0)}
  else{playing=false;$('rpVinyl').classList.remove('playing');stopEq();updateUI()}
}

function rpTogglePlay(){
  if(!media)return;
  if(playing){
    media.pause();playing=false;
    $('rpVinyl').classList.remove('playing');stopEq();
  }else{
    media.play();playing=true;
    if(media===audioEl)$('rpVinyl').classList.add('playing');
    startEq();
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

// ── Video Fullscreen ───────────────────────────────────────
function rpVideoFullscreen(){
  const vid=$('rpVideo');
  const req=vid.requestFullscreen||vid.webkitRequestFullscreen||vid.mozRequestFullScreen||vid.msRequestFullscreen;
  if(req) req.call(vid);
}

// Landscape-Rotation beim Vollbild
document.addEventListener('fullscreenchange',handleFsChange);
document.addEventListener('webkitfullscreenchange',handleFsChange);
function handleFsChange(){
  const inFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
  if(inFs&&screen.orientation&&screen.orientation.lock){
    screen.orientation.lock('landscape').catch(()=>{});
  }else if(!inFs&&screen.orientation&&screen.orientation.unlock){
    screen.orientation.unlock();
  }
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
function rpToggleRepeat(){
  const m=['off','all','one'];
  repeat=m[(m.indexOf(repeat)+1)%3];
  updateUI();
}

// ── Playlist overlay ───────────────────────────────────────
function rpToggleList(){
  listOpen=!listOpen;
  $('rpPlOverlay').classList.toggle('open',listOpen);
  $('rpPlPanel').classList.toggle('open',listOpen);
  if(listOpen)renderList();
}

// ── EQ ────────────────────────────────────────────────────
const EQ_N=12;
function startEq(){
  stopEq();
  eqInterval=setInterval(()=>{
    for(let i=0;i<EQ_N;i++){const b=$('eq'+i);if(b)b.style.height=(12+Math.random()*78)+'%'}
  },130);
}
function stopEq(){
  clearInterval(eqInterval);
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
  $('rpList').innerHTML=playlist.map((fi,pi)=>{
    const f=files[fi];
    const icon=isVid(f.name)?'🎬':'🎵';
    const x=ext(f.name).toUpperCase();
    const name=esc(getDisplayName(f));
    return`<div class="pl-item${pi===cur?' active':''}" id="pi${pi}" onclick="playTrack(${pi});rpToggleList()">
      <span class="pl-num">${pi+1}</span>
      <span class="pl-icon">${icon}</span>
      <span class="pl-name">${name}</span>
      <span class="pl-ext">${x}</span>
      <button class="pl-rename-btn" onclick="rpRenameTrack(${pi},event)" title="Umbenennen">✏️</button>
    </div>`;
  }).join('');
}

function highlightItem(pi){
  document.querySelectorAll('.pl-item').forEach((el,i)=>el.classList.toggle('active',i===pi));
  const el=$('pi'+pi);
  if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function rpClear(){
  if(!confirm('Playlist leeren?'))return;
  if(media){media.pause();media.src=''}
  if(audioEl)audioEl.src='';
  const v=$('rpVideo');v.pause();v.src='';
  $('rpVideoArea').className='video-area';
  $('rpVinylArea').style.display='';
  $('rpVinyl').classList.remove('playing');
  stopEq();
  if(objUrl){URL.revokeObjectURL(objUrl);objUrl=null}
  files=[];playlist=[];cur=-1;playing=false;media=null;
  listOpen=false;
  $('rpPlOverlay').classList.remove('open');
  $('rpPlPanel').classList.remove('open');
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
  navigator.mediaSession.metadata=new MediaMetadata({title:f.name.replace(/\.[^.]+$/,''),artist:'D_a_N Player'});
  navigator.mediaSession.setActionHandler('play',rpTogglePlay);
  navigator.mediaSession.setActionHandler('pause',rpTogglePlay);
  navigator.mediaSession.setActionHandler('nexttrack',rpNext);
  navigator.mediaSession.setActionHandler('previoustrack',rpPrev);
}

// ── Service Worker ─────────────────────────────────────────
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

// ── Start ──────────────────────────────────────────────────
updateUI();
rpCheckSavedDir();
