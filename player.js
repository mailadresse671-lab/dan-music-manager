const AUDIO_EXT=['mp3','wav','ogg','flac','aac','m4a','opus','wma','oga','m4b'];
const VIDEO_EXT=['mp4','webm','mov','avi','mkv','m4v','wmv','3gp','flv','ogv'];

let files=[],playlist=[],cur=-1;
let shuffle=true,repeat='off';
let playing=false,objUrl=null,audioEl=null,media=null;
let eqInterval=null;

const $=id=>document.getElementById(id);
const ext=n=>(n.split('.').pop()||'').toLowerCase();
const isVid=n=>VIDEO_EXT.includes(ext(n));
const fmt=s=>!isFinite(s)||isNaN(s)?'0:00':Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── File loading ───────────────────────────────────────────
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
  if(shuffle){
    for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}
  }
  playlist=idx;cur=files.length?0:-1;
  renderUI();
  if(autoplay&&files.length)playTrack(0);
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

  const vid=$('rpVideo'),vw=$('rpVideoWrap');
  if(isVid(f.name)){
    audioEl.pause();audioEl.src='';
    vid.removeEventListener('timeupdate',onTime);
    vid.removeEventListener('ended',onEnded);
    vid.removeEventListener('loadedmetadata',onMeta);
    vid.addEventListener('timeupdate',onTime);
    vid.addEventListener('ended',onEnded);
    vid.addEventListener('loadedmetadata',onMeta);
    vid.src=objUrl;vw.className='video-wrap visible';media=vid;
  }else{
    vid.pause();vid.src='';vw.className='video-wrap';
    audioEl.src=objUrl;media=audioEl;
  }

  media.volume=parseFloat($('rpVol').value);
  media.play().then(()=>{playing=true;updateUI()}).catch(()=>{playing=false;updateUI()});

  const clean=f.name.replace(/\.[^.]+$/,'');
  $('rpTrackName').textContent=clean;
  $('rpTrackSub').textContent='TRACK '+(pi+1)+' / '+playlist.length+'  ·  '+ext(f.name).toUpperCase();
  $('rpBar').value=0;$('rpBar').style.setProperty('--v','0%');
  $('rpCur').textContent='0:00';$('rpTot').textContent='0:00';

  // Marquee nur bei langen Namen
  const el=$('rpTrackName');
  el.classList.toggle('long',clean.length>20);

  // Vinyl spin
  $('rpVinyl').classList.add('playing');

  // EQ
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
  if(playing){media.pause();playing=false;$('rpVinyl').classList.remove('playing');stopEq()}
  else{media.play();playing=true;$('rpVinyl').classList.add('playing');startEq()}
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

// ── Equalizer (animated) ───────────────────────────────────
const EQ_BARS=12;
function startEq(){
  stopEq();
  eqInterval=setInterval(()=>{
    for(let i=0;i<EQ_BARS;i++){
      const b=$('eq'+i);
      if(b)b.style.height=(15+Math.random()*75)+'%';
    }
  },130);
}
function stopEq(){
  clearInterval(eqInterval);
  for(let i=0;i<EQ_BARS;i++){const b=$('eq'+i);if(b)b.style.height='10%'}
}

// ── UI ─────────────────────────────────────────────────────
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
  updateUI();renderList();
}

function renderList(){
  $('rpList').innerHTML=playlist.map((fi,pi)=>{
    const f=files[fi];
    const icon=isVid(f.name)?'🎬':'🎵';
    const x=ext(f.name).toUpperCase();
    const name=esc(f.name.replace(/\.[^.]+$/,''));
    return`<div class="pl-item${pi===cur?' active':''}" id="pi${pi}" onclick="playTrack(${pi})">
      <span class="pl-num">${pi+1}</span>
      <span class="pl-icon">${icon}</span>
      <span class="pl-name">${name}</span>
      <span class="pl-ext">${x}</span>
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
  $('rpVideoWrap').className='video-wrap';
  $('rpVinyl').classList.remove('playing');
  stopEq();
  if(objUrl){URL.revokeObjectURL(objUrl);objUrl=null}
  files=[];playlist=[];cur=-1;playing=false;media=null;
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
  navigator.mediaSession.metadata=new MediaMetadata({
    title:f.name.replace(/\.[^.]+$/,''),
    artist:'D_a_N Player'
  });
  navigator.mediaSession.setActionHandler('play',rpTogglePlay);
  navigator.mediaSession.setActionHandler('pause',rpTogglePlay);
  navigator.mediaSession.setActionHandler('nexttrack',rpNext);
  navigator.mediaSession.setActionHandler('previoustrack',rpPrev);
}

// ── Service Worker ─────────────────────────────────────────
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

// ── Init ───────────────────────────────────────────────────
updateUI();
