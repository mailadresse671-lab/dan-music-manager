// =============================
// INDEXEDDB – AUDIO STORAGE
// =============================
let idb = null;
function openIDB() {
  if (idb) return Promise.resolve(idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open('studio_audio', 1);
    req.onupgradeneeded = e => { e.target.result.createObjectStore('audio', {keyPath:'songId'}); };
    req.onsuccess = e => { idb = e.target.result; res(idb); };
    req.onerror = () => rej(req.error);
  });
}
async function saveAudioToIDB(songId, file) {
  try {
    const db = await openIDB();
    const blob = new Blob([await file.arrayBuffer()], {type: file.type});
    return new Promise((res, rej) => {
      const tx = db.transaction('audio','readwrite');
      tx.objectStore('audio').put({songId, blob, name: file.name, type: file.type});
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch(e) { console.warn('IDB save failed:', e.message); }
}
async function loadAudioFromIDB(songId) {
  try {
    const db = await openIDB();
    return new Promise((res) => {
      const tx = db.transaction('audio','readonly');
      const req = tx.objectStore('audio').get(songId);
      req.onsuccess = () => {
        const row = req.result;
        if (row) {
          const file = new File([row.blob], row.name, {type: row.type});
          loadAudioFile(file, false); // false = don't save to IDB again
        }
        res(row || null);
      };
      req.onerror = () => res(null);
    });
  } catch(e) { return null; }
}
async function deleteAudioFromIDB(songId) {
  try {
    const db = await openIDB();
    const tx = db.transaction('audio','readwrite');
    tx.objectStore('audio').delete(songId);
  } catch(e) {}
}
async function saveMatFileToIDB(matId, file) {
  try {
    const db = await openIDB();
    const blob = new Blob([await file.arrayBuffer()], {type: file.type});
    return new Promise((res, rej) => {
      const tx = db.transaction('audio','readwrite');
      tx.objectStore('audio').put({songId: 'mat_file_'+matId, blob, name: file.name, type: file.type});
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch(e) { console.warn('Mat IDB save failed:', e.message); }
}
async function loadMatFileFromIDB(matId) {
  try {
    const db = await openIDB();
    return new Promise((res) => {
      const tx = db.transaction('audio','readonly');
      const req = tx.objectStore('audio').get('mat_file_'+matId);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch(e) { return null; }
}
async function deleteMatFileFromIDB(matId) {
  try {
    const db = await openIDB();
    const tx = db.transaction('audio','readwrite');
    tx.objectStore('audio').delete('mat_file_'+matId);
  } catch(e) {}
}
async function openMatFile(matId) {
  const row = await loadMatFileFromIDB(matId);
  if (!row) { showToast('Datei nicht gefunden im lokalen Speicher!', 'error'); return; }
  const url = URL.createObjectURL(row.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = row.name;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

// =============================
// AUDIO STUDIO (PHASE 8)
// =============================
let currentAudioFile = null;
let currentAudioDuration = 0;
let pendingMarkerTimeVal = null;

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('audioDropzone').classList.add('dragover');
}
function handleDragLeave() {
  document.getElementById('audioDropzone').classList.remove('dragover');
}
function handleAudioDrop(e) {
  e.preventDefault();
  document.getElementById('audioDropzone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('audio/')) loadAudioFile(file);
  else showToast('Bitte eine Audiodatei auswählen!', 'error');
}
function handleAudioFile(event) {
  const file = event.target.files[0];
  if (file) loadAudioFile(file);
}

function loadAudioFile(file, saveToIdb = true) {
  if (file.size > 50 * 1024 * 1024) { showToast('Datei zu groß! Max. 50 MB', 'error'); return; }
  currentAudioFile = file;
  const url = URL.createObjectURL(file);
  const audio = document.getElementById('audioElement');
  audio.src = url;
  audio.load();
  const nameEl = document.getElementById('audioFileName');
  if (nameEl) { nameEl.textContent = '📎 ' + file.name + ' (' + (file.size/1024/1024).toFixed(1) + ' MB)'; nameEl.style.display = 'block'; }
  ['audioPlayerCard','bpmCard','transcriptionCard','timelineCard','audioAiCard'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'block';
  });
  audio.ontimeupdate = updateAudioProgress;
  audio.onended = () => { const b = document.getElementById('playBtn'); if(b) b.textContent = '▶'; };
  audio.onloadedmetadata = () => { currentAudioDuration = audio.duration; updateAudioProgress(); };
  if (currentSongId && songs[currentSongId]) {
    songs[currentSongId].p8_audio_filename = file.name;
    saveToStorage();
    if (saveToIdb) {
      saveAudioToIDB(currentSongId, file).then(() => showToast('Audio geladen & gespeichert: ' + file.name, 'success'));
    }
  } else if (saveToIdb) {
    showToast('Audio geladen: ' + file.name, 'success');
  }
  updateMarkerList();
}

function togglePlay() {
  const audio = document.getElementById('audioElement');
  if (!audio.src || audio.src === window.location.href) { showToast('Kein Audio geladen!', 'error'); return; }
  if (audio.paused) { audio.play(); document.getElementById('playBtn').textContent = '⏸'; }
  else { audio.pause(); document.getElementById('playBtn').textContent = '▶'; }
}

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function updateAudioProgress() {
  const audio = document.getElementById('audioElement');
  const dur = audio.duration || 0;
  const cur = audio.currentTime || 0;
  const pct = dur > 0 ? (cur / dur) * 100 : 0;
  const f = document.getElementById('audioProgressFill');
  const t = document.getElementById('audioTime');
  const l = document.getElementById('timelineProgressLine');
  if (f) f.style.width = pct + '%';
  if (t) t.textContent = formatTime(cur) + ' / ' + formatTime(dur);
  if (l) l.style.left = pct + '%';
}

function seekAudio(e) {
  const audio = document.getElementById('audioElement');
  const bar = document.getElementById('audioProgress');
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * (audio.duration || 0);
}

async function analyzeBPM() {
  if (!currentAudioFile) { showToast('Erst Audio importieren!', 'error'); return; }
  const btn = document.getElementById('bpmBtn');
  const icon = document.getElementById('bpmBtnIcon');
  const text = document.getElementById('bpmBtnText');
  const info = document.getElementById('bpmInfo');
  btn.disabled = true;
  icon.innerHTML = '<span class="spinner"></span>';
  text.textContent = 'Analysiere...';
  if (info) info.textContent = 'Beat wird erkannt...';
  try {
    const ab = await currentAudioFile.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await ctx.decodeAudioData(ab);
    ctx.close();
    const bpm = detectBPMFromBuffer(audioBuffer);
    if (bpm) {
      const bpmEl = document.getElementById('bpmValue');
      if (bpmEl) bpmEl.textContent = bpm;
      if (info) info.textContent = 'Automatisch erkannt';
      document.getElementById('bpmManual').value = bpm;
      if (currentSongId && songs[currentSongId]) {
        songs[currentSongId].p8_bpm = bpm;
        songs[currentSongId].p3_bpm = bpm;
        document.getElementById('p3_bpm').value = bpm;
        document.getElementById('p3_bpm_val').textContent = bpm;
        saveToStorage();
      }
      showToast('BPM erkannt: ' + bpm, 'success');
    } else {
      const bpmEl = document.getElementById('bpmValue');
      if (bpmEl) bpmEl.textContent = '?';
      if (info) info.textContent = 'Nicht eindeutig – manuell eingeben';
      showToast('BPM konnte nicht erkannt werden', 'error');
    }
  } catch(e) { showToast('BPM-Fehler: ' + e.message, 'error'); }
  finally { btn.disabled = false; icon.textContent = '🥁'; text.textContent = 'BPM erkennen'; }
}

function detectBPMFromBuffer(audioBuffer) {
  const sr = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const hop = Math.round(sr * 0.01);
  const win = Math.round(sr * 0.05);
  const energies = [];
  for (let i = 0; i < data.length - win; i += hop) {
    let e = 0;
    for (let j = 0; j < win; j++) e += data[i+j] * data[i+j];
    energies.push(e / win);
  }
  const odf = [0];
  for (let i = 1; i < energies.length; i++) odf.push(Math.max(0, energies[i] - energies[i-1]));
  const fr = sr / hop;
  const minDist = Math.round(fr * 0.25);
  const thWin = Math.round(fr * 2);
  const peaks = [];
  for (let i = minDist; i < odf.length - minDist; i++) {
    let sum = 0, cnt = 0;
    for (let k = Math.max(0,i-thWin); k < Math.min(odf.length,i+thWin); k++) { sum+=odf[k]; cnt++; }
    if (odf[i] > (sum/cnt) * 1.5) {
      let isMax = true;
      for (let k = i-minDist; k <= i+minDist && isMax; k++) if (k!==i && odf[k]>=odf[i]) isMax=false;
      if (isMax) peaks.push(i);
    }
  }
  if (peaks.length < 4) return null;
  const iois = [];
  for (let i = 1; i < peaks.length; i++) iois.push((peaks[i]-peaks[i-1])/fr);
  const counts = {};
  iois.forEach(ioi => {
    for (let m = 0.5; m <= 2; m *= 2) {
      const b = Math.round(60/(ioi*m));
      if (b >= 50 && b <= 240) counts[b] = (counts[b]||0) + (m===1?2:1);
    }
  });
  if (!Object.keys(counts).length) return null;
  return parseInt(Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]);
}

function saveBpmManual() {
  const val = parseInt(document.getElementById('bpmManual').value);
  if (val && val >= 40 && val <= 300) {
    const bpmEl = document.getElementById('bpmValue');
    const info = document.getElementById('bpmInfo');
    if (bpmEl) bpmEl.textContent = val;
    if (info) info.textContent = 'Manuell eingegeben';
    if (currentSongId && songs[currentSongId]) {
      songs[currentSongId].p8_bpm = val;
      songs[currentSongId].p3_bpm = val;
      const p3bpm = document.getElementById('p3_bpm');
      const p3bpmVal = document.getElementById('p3_bpm_val');
      if (p3bpm) p3bpm.value = val;
      if (p3bpmVal) p3bpmVal.textContent = val;
      saveToStorage();
    }
  }
}

async function transcribeAudio() {
  if (!currentAudioFile) { showToast('Erst Audio importieren!', 'error'); return; }
  const apiKey = sessionStorage.getItem('studio_api_key');
  if (!apiKey) { openApiModal(); return; }
  const lang = document.getElementById('transcribeLang').value;
  const btn = document.getElementById('transcribeBtn');
  const icon = document.getElementById('transcribeIcon');
  const text = document.getElementById('transcribeText');
  btn.disabled = true;
  icon.innerHTML = '<span class="spinner"></span>';
  text.textContent = 'Transkribiere...';
  try {
    const fd = new FormData();
    fd.append('file', currentAudioFile, currentAudioFile.name);
    fd.append('model', 'whisper-large-v3');
    if (lang) fd.append('language', lang);
    fd.append('response_format', 'json');
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}` }, body: fd
    });
    if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.error?.message||`HTTP ${res.status}`); }
    const data = await res.json();
    const tr = data.text || '';
    document.getElementById('p8_transcription').value = tr;
    saveField('p8_transcription', tr);
    showToast('Transkription abgeschlossen!', 'success');
  } catch(e) {
    // Groq audio API blocks browser uploads via CORS – show curl workaround
    if (e.message === 'Failed to fetch' || e.message.includes('NetworkError') || e.message.includes('CORS')) {
      openTranscribeHelperModal(apiKey, lang);
    } else {
      showToast('Transkriptions-Fehler: ' + e.message, 'error');
    }
  }
  finally { btn.disabled = false; icon.textContent = '🎤'; text.textContent = 'Lyrics extrahieren'; }
}

function openTranscribeHelperModal(apiKey, lang) {
  const langFlag = lang ? `--form language=${lang} ` : '';
  const curlCmd = `curl -X POST https://api.groq.com/openai/v1/audio/transcriptions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -F "file=@DEINE_DATEI.mp3" \\
  ${langFlag}-F "model=whisper-large-v3" \\
  -F "response_format=json"`;
  document.getElementById('transcribeCurlCode').textContent = curlCmd;
  document.getElementById('transcribeHelperModal').classList.remove('hidden');
}

function closeTranscribeHelperModal() {
  document.getElementById('transcribeHelperModal').classList.add('hidden');
}

function copyTranscribeCurl() {
  const text = document.getElementById('transcribeCurlCode').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('Kopiert!', 'success')).catch(() => {
    fallbackCopy(text); showToast('Kopiert!', 'success');
  });
}

function pasteTranscriptionResult() {
  const input = document.getElementById('transcribePasteInput').value.trim();
  if (!input) { showToast('Bitte Text einfügen!', 'error'); return; }
  // Parse JSON if user pasted raw JSON
  let text = input;
  try { const parsed = JSON.parse(input); if (parsed.text) text = parsed.text; } catch(e) {}
  document.getElementById('p8_transcription').value = text;
  saveField('p8_transcription', text);
  closeTranscribeHelperModal();
  showToast('Transkription gespeichert!', 'success');
}

function sendTranscriptionToLyrics() {
  const text = document.getElementById('p8_transcription').value.trim();
  if (!text) { showToast('Keine Transkription vorhanden!', 'error'); return; }
  if (currentSongId && songs[currentSongId]) {
    const ex = songs[currentSongId].p2_lyrics || '';
    songs[currentSongId].p2_lyrics = ex ? ex + '\n\n--- Transkription ---\n' + text : text;
    document.getElementById('p2_lyrics').value = songs[currentSongId].p2_lyrics;
    saveToStorage();
    showToast('In Lyrics-Editor übernommen!', 'success');
    switchPhase(2);
  }
}

function addMarkerAtCurrentTime() {
  const audio = document.getElementById('audioElement');
  if (!audio.src || audio.src === window.location.href) { showToast('Erst Audio laden!', 'error'); return; }
  pendingMarkerTimeVal = audio.currentTime;
  openMarkerForm(audio.currentTime);
}

function addMarkerFromTimeline(e) {
  const bar = document.getElementById('timelineBar');
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  pendingMarkerTimeVal = pct * (currentAudioDuration || 0);
  openMarkerForm(pendingMarkerTimeVal);
}

function openMarkerForm(time) {
  const formEl = document.getElementById('markerForm');
  const timeEl = document.getElementById('markerFormTime');
  const inputEl = document.getElementById('markerInstructionInput');
  if (timeEl) timeEl.textContent = formatTime(time);
  if (inputEl) inputEl.value = '';
  if (formEl) formEl.style.display = 'block';
  if (inputEl) inputEl.focus();
}

function cancelMarker() {
  pendingMarkerTimeVal = null;
  const f = document.getElementById('markerForm');
  if (f) f.style.display = 'none';
}

function confirmAddMarker() {
  const inputEl = document.getElementById('markerInstructionInput');
  const instruction = inputEl ? inputEl.value.trim() : '';
  if (!instruction) { showToast('Bitte Anweisung eingeben!', 'error'); return; }
  if (!currentSongId || !songs[currentSongId]) return;
  const typeEl = document.getElementById('markerTypeSelect');
  const type = typeEl ? typeEl.value : 'allgemein';
  const marker = { id: 'mk_' + Date.now(), time: pendingMarkerTimeVal || 0, type, instruction };
  if (!songs[currentSongId].p8_markers) songs[currentSongId].p8_markers = [];
  songs[currentSongId].p8_markers.push(marker);
  songs[currentSongId].p8_markers.sort((a, b) => a.time - b.time);
  saveToStorage();
  cancelMarker();
  updateMarkerList();
  showToast('Marke gesetzt!', 'success');
}

function deleteMarker(id) {
  if (!currentSongId || !songs[currentSongId]) return;
  songs[currentSongId].p8_markers = (songs[currentSongId].p8_markers || []).filter(m => m.id !== id);
  saveToStorage();
  updateMarkerList();
  showToast('Marke gelöscht', 'info');
}

function jumpToMarker(time) {
  const audio = document.getElementById('audioElement');
  if (audio && audio.src && audio.src !== window.location.href) audio.currentTime = time;
}

function updateMarkerList() {
  const markers = (currentSongId && songs[currentSongId]?.p8_markers) || [];
  const list = document.getElementById('markerList');
  const noMsg = document.getElementById('noMarkersMsg');
  const pins = document.getElementById('timelinePins');
  if (!list) return;
  const TC = { vocal:'#3b82f6', beat:'#f59e0b', arrangement:'#10b981', allgemein:'#a78bfa' };
  const TL = { vocal:'🎤 Vocal', beat:'🥁 Beat', arrangement:'🎼 Arrangement', allgemein:'📝 Allgemein' };
  if (markers.length === 0) {
    list.innerHTML = '';
    if (noMsg) noMsg.style.display = 'block';
    if (pins) pins.innerHTML = '';
    return;
  }
  if (noMsg) noMsg.style.display = 'none';
  if (pins && currentAudioDuration > 0) {
    pins.innerHTML = '';
    markers.forEach(m => {
      const pin = document.createElement('div');
      pin.className = 'timeline-marker-pin';
      pin.style.cssText = `left:${(m.time/currentAudioDuration)*100}%;background:${TC[m.type]||TC.allgemein}`;
      pin.title = formatTime(m.time) + ': ' + m.instruction;
      pin.onclick = (e) => { e.stopPropagation(); jumpToMarker(m.time); };
      pins.appendChild(pin);
    });
  }
  list.innerHTML = '';
  markers.forEach(m => {
    const col = TC[m.type] || TC.allgemein;
    const lbl = TL[m.type] || m.type;
    const item = document.createElement('div');
    item.className = 'marker-item';
    item.innerHTML = `<span class="marker-time" onclick="jumpToMarker(${m.time})" title="Zu dieser Zeit springen">${escHtml(formatTime(m.time))}</span><span class="marker-type-badge" style="background:${col}22;border:1px solid ${col}44;color:${col};">${escHtml(lbl)}</span><span class="marker-instruction">${escHtml(m.instruction)}</span><button class="marker-del" onclick="deleteMarker('${escHtml(m.id)}')" title="Löschen">×</button>`;
    list.appendChild(item);
  });
}

async function analyzeMarkers() {
  if (!currentSongId || !songs[currentSongId]) return;
  const song = songs[currentSongId];
  const markers = song.p8_markers || [];
  if (markers.length === 0) { showToast('Keine Marken vorhanden!', 'error'); return; }
  const markerText = markers.map(m => `[${formatTime(m.time)}] ${m.type.toUpperCase()}: ${m.instruction}`).join('\n');
  const bpm = song.p8_bpm || song.p3_bpm || '?';
  const trSnip = song.p8_transcription ? `\n\nTranskription:\n${song.p8_transcription.substring(0, 600)}` : '';
  const lySnip = song.p2_lyrics ? `\n\nLyrics:\n${song.p2_lyrics.substring(0, 500)}` : '';
  const _p8 = getProfile();
  const prompt = `Song: "${song.name}" von ${_p8.name} | BPM: ${bpm}${trSnip}${lySnip}

Produktions-Zeitmarken:
${markerText}

Analysiere alle Zeitmarken professionell. Für jede Marke: konkrete Vocal-Anweisungen, Beat-Elemente, Arrangement-Struktur und Mixing-Hinweise. Nutze Fachbegriffe. Sei so detailliert wie ein echter Produzent im Studio.`;
  const btn = document.getElementById('analyzeMarkersIcon')?.closest('button');
  const icon = document.getElementById('analyzeMarkersIcon');
  const txt = document.getElementById('analyzeMarkersText');
  if (btn) btn.disabled = true;
  if (icon) icon.innerHTML = '<span class="spinner"></span>';
  if (txt) txt.textContent = 'Analysiere...';
  try {
    const result = await callClaude(prompt);
    showResult('p8_result', 'p8_result_content', result);
    saveField('p8_ai_result', result);
    showToast('Analyse abgeschlossen!', 'success');
  } catch(e) { showToast('Fehler: ' + e.message, 'error'); }
  finally {
    if (btn) btn.disabled = false;
    if (icon) icon.textContent = '🎵';
    if (txt) txt.textContent = 'Alle Marken analysieren';
  }
}

// =============================
// INTRO SCREEN
// =============================

// VU bar data: [lo, hi, dur, color]
const VU_LEFT = [
  ['6px','55px','0.85s','#7c3aed'],['10px','90px','0.55s','#7c3aed'],
  ['14px','120px','0.72s','#9d5ff3'],['8px','100px','0.48s','#7c3aed'],
  ['20px','150px','0.63s','#9d5ff3'],['12px','80px','0.78s','#7c3aed'],
  ['6px','60px','0.90s','#6d28d9'],['16px','110px','0.58s','#7c3aed'],
  ['10px','90px','0.70s','#9d5ff3'],['8px','70px','0.52s','#7c3aed'],
];
const VU_RIGHT = [
  ['8px','70px','0.62s','#3b82f6'],['6px','100px','0.80s','#3b82f6'],
  ['18px','140px','0.50s','#60a5fa'],['10px','80px','0.75s','#3b82f6'],
  ['14px','110px','0.68s','#60a5fa'],['6px','55px','0.88s','#3b82f6'],
  ['20px','130px','0.56s','#60a5fa'],['12px','90px','0.73s','#3b82f6'],
  ['8px','75px','0.64s','#60a5fa'],['16px','120px','0.46s','#3b82f6'],
];

function buildVUCol(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  data.forEach(([lo, hi, dur, color], i) => {
    const bar = document.createElement('div');
    bar.className = 'intro-vu-bar';
    bar.style.cssText = `--lo:${lo};--hi:${hi};--dur:${dur};--del:${(i*0.07).toFixed(2)}s;height:${lo};color:${color};background:${color};`;
    el.appendChild(bar);
  });
}

// Mark letters as "lit" after their animation completes (adds ongoing glow)
function initLetterGlow() {
  ['il_D','il_a','il_N'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const delay = parseFloat(el.style.animationDelay || '0') * 1000 + 700;
    setTimeout(() => { el.classList.add('lit'); }, delay);
  });
}

// ===== INTRO BEAT – Cinematic Gangster Rap (Dark Movie Intro Style) =====
let _introCtx        = null;
let _introMaster     = null;
let _introComp       = null;
let _introNextBar    = 0;
let _introLoopId     = null;
let _introBeatStarted = false;
let _introRevSend     = null;   // reverb send bus
let _introRev         = null;   // convolver reverb node

// ── Stereo reverb from algorithmically generated impulse response ──
function _makeIntroReverb(ctx, dur = 2.4, decay = 2.8) {
  const len = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

// ── "DaN" cinematic FM-bell ident (replaces broken formant voice) ──
// Three bell tones tuned to D4–A4–D5 (D·A·N mnemonic) with heavy reverb
let _voiceSynthed = false;
function synthIntroVoice() {
  if (_voiceSynthed || !_introCtx || !_introMaster) return;
  _voiceSynthed = true;
  const ctx = _introCtx;

  // FM bell: modulator rides on carrier, creates metallic shimmer
  const bell = (t, freq, vol = 0.11, dur = 2.2) => {
    const mod  = ctx.createOscillator();
    const modG = ctx.createGain();
    mod.type = 'sine';
    mod.frequency.value = freq * 3.51;
    modG.gain.setValueAtTime(freq * 4.5, t);
    modG.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.35);
    mod.connect(modG);

    const car = ctx.createOscillator();
    car.type  = 'sine';
    car.frequency.value = freq;
    modG.connect(car.frequency);   // FM: modulator → carrier frequency

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    car.connect(env);
    env.connect(_introRevSend);    // lush reverb
    env.connect(_introMaster);     // dry too

    mod.start(t); mod.stop(t + dur);
    car.start(t); car.stop(t + dur);
  };

  const T = ctx.currentTime + 0.3;
  bell(T + 0.00, 293.7, 0.11, 2.8);  // D4
  bell(T + 0.72, 440.0, 0.09, 2.4);  // A4
  bell(T + 1.45, 587.3, 0.08, 2.0);  // D5 (octave up)
}

// ── PLACEHOLDER: old formant voice (kept as dead comment only) ──
// Formant synthesis removed – it sounded terrible (robotic/demonic artefacts).
// Replaced by FM-bell ident above.
function _oldFormant_REMOVED() {
  // void – do not call
  const ctx = _introCtx;

  // Speak one vowel/syllable: sawtooth glottal source → two formant filters → envelope
  const spell = (t, f1, f2, dur, consonant = false) => {
    const PITCH = 72;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(PITCH, t);
    osc.frequency.exponentialRampToValueAtTime(PITCH * 0.87, t + dur);

    // Amplitude envelope: sharp attack, clean release
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.04);
    env.gain.setValueAtTime(1, t + dur - 0.09);
    env.gain.linearRampToValueAtTime(0, t + dur);

    // Formant 1 (vowel openness) and Formant 2 (vowel character)
    [{ freq: f1, q: 11, vol: 0.14 }, { freq: f2, q: 16, vol: 0.038 }].forEach(({ freq, q, vol }) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = vol;
      osc.connect(bp); bp.connect(g); g.connect(env);
    });
    env.connect(_introMaster);
    osc.start(t); osc.stop(t + dur + 0.1);

    // Consonant burst at start (for D and N – plosive/nasal attack)
    if (consonant) {
      const nlen = Math.ceil(ctx.sampleRate * 0.038);
      const nbuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const nd = nbuf.getChannelData(0);
      for (let i = 0; i < nlen; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nlen);
      const ns = ctx.createBufferSource(); ns.buffer = nbuf;
      const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 1800; nbp.Q.value = 2;
      const ng = ctx.createGain(); ng.gain.value = 0.10;
      ns.connect(nbp); nbp.connect(ng); ng.connect(_introMaster);
      ns.start(t); ns.stop(t + 0.042);
    }
  };

  const T = ctx.currentTime;
  // old formant spells (dead code – see _oldFormant_REMOVED above)
  // spell(T + 0.0, 310, 2280, 0.90, true);
  // spell(T + 2.3, 560, 1900, 0.95, false);
  // spell(T + 4.7, 500, 1600, 0.85, true);
}

// ══════════════════════════════════════════════════════════════════════
//  NEURAL TRAP — Dark Intro Beat  |  95 BPM  |  G minor
//  Architecture: master → compressor → destination
//                      reverb bus ─────────────↗
//  808 kick · layered snare · triplet hats · 808 bass slides
//  detuned sawtooth pad · filtered lead melody · FM bell ident
// ══════════════════════════════════════════════════════════════════════
function tryStartIntroBeat() {
  if (_introBeatStarted) return;
  _introBeatStarted = true;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    _introCtx = ctx;
    if (ctx.state === 'suspended') ctx.resume();

    // ── Master bus ──
    _introMaster = ctx.createGain();
    _introMaster.gain.value = 0;

    _introComp = ctx.createDynamicsCompressor();
    _introComp.threshold.value = -10;
    _introComp.knee.value      = 5;
    _introComp.ratio.value     = 6;
    _introComp.attack.value    = 0.003;
    _introComp.release.value   = 0.14;
    _introMaster.connect(_introComp);
    _introComp.connect(ctx.destination);

    // ── Reverb bus (algorithmic IR) ──
    _introRev  = _makeIntroReverb(ctx, 2.4, 2.8);
    const revG = ctx.createGain(); revG.gain.value = 0.22;
    _introRev.connect(revG); revG.connect(_introMaster);
    _introRevSend = ctx.createGain(); _introRevSend.gain.value = 1.0;
    _introRevSend.connect(_introRev);

    // ── Smooth fade-in ──
    _introMaster.gain.linearRampToValueAtTime(0.82, ctx.currentTime + 1.4);

    // ── Dark detuned pad: G minor (G2 Bb2 D3 G3) – 2 sawtooth layers per note ──
    const padLP  = ctx.createBiquadFilter();
    padLP.type = 'lowpass'; padLP.frequency.value = 700; padLP.Q.value = 0.55;
    const padG   = ctx.createGain(); padG.gain.value = 0;
    padLP.connect(padG);
    padG.connect(_introRevSend);   // mostly reverb
    padG.connect(_introMaster);    // a little dry
    [
      [98.0,  +0], [98.0,  +7],   // G2 detuned pair
      [116.5, +0], [116.5, -5],   // Bb2 detuned pair
      [146.8, +0], [146.8, +4],   // D3 detuned pair
      [196.0, +0], [196.0, -3],   // G3 detuned pair
    ].forEach(([hz, c]) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz * Math.pow(2, c / 1200);
      const og = ctx.createGain(); og.gain.value = 0.06;
      o.connect(og); og.connect(padLP); o.start();
    });
    padG.gain.setValueAtTime(0,      ctx.currentTime);
    padG.gain.linearRampToValueAtTime(0.38, ctx.currentTime + 2.8);

    // ── Sub G1 (49 Hz) ──
    const subO = ctx.createOscillator();
    const subL = ctx.createBiquadFilter();
    const subG2 = ctx.createGain();
    subO.type = 'sine'; subO.frequency.value = 49;
    subL.type = 'lowpass'; subL.frequency.value = 80;
    subG2.gain.value = 0.06;
    subO.connect(subL); subL.connect(subG2); subG2.connect(_introMaster);
    subO.start();

    _introNextBar = ctx.currentTime + 0.18;
    scheduleIntroBar(0);
  } catch(e) { /* silent fail on unsupported browsers */ }
}

function scheduleIntroBar(barIdx) {
  if (!_introCtx || !_introMaster) return;
  const ctx  = _introCtx;
  const out  = _introMaster;
  const revS = _introRevSend;

  const BPM  = 95;
  const BEAT = 60 / BPM;   // ≈ 0.632 s
  const S16  = BEAT / 4;   // ≈ 0.158 s  (16th note)
  const T    = _introNextBar;

  // ── 808 Kick ──
  const kick = (t, vol = 1.0, decay = 0.72) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(105, t);
    o.frequency.exponentialRampToValueAtTime(28, t + decay * 0.88);
    g.gain.setValueAtTime(vol * 0.96, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + decay + 0.12);
    // Transient click
    const oc = ctx.createOscillator(), gc = ctx.createGain();
    oc.type = 'triangle'; oc.frequency.value = 560;
    gc.gain.setValueAtTime(vol * 0.30, t);
    gc.gain.exponentialRampToValueAtTime(0.001, t + 0.014);
    oc.connect(gc); gc.connect(out);
    oc.start(t); oc.stop(t + 0.018);
  };

  // ── Snare (noise layer + oscillator body) ──
  const snare = (t, vol = 1.0) => {
    const sr = ctx.sampleRate, dur = 0.26;
    const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < buf.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / buf.length * 11);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp  = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
    const gs  = ctx.createGain();         gs.gain.value = vol * 0.60;
    src.connect(hp); hp.connect(gs); gs.connect(out);
    gs.connect(revS);  // snare into reverb for space
    src.start(t); src.stop(t + dur);
    // Body tone
    const ob = ctx.createOscillator(), gb = ctx.createGain();
    ob.type = 'triangle';
    ob.frequency.setValueAtTime(220, t);
    ob.frequency.exponentialRampToValueAtTime(88, t + 0.058);
    gb.gain.setValueAtTime(vol * 0.32, t);
    gb.gain.exponentialRampToValueAtTime(0.001, t + 0.072);
    ob.connect(gb); gb.connect(out);
    ob.start(t); ob.stop(t + 0.085);
  };

  // ── 808 Bass with optional frequency slide ──
  const bass808 = (t, fromHz, toHz, vol = 0.14, dur = 0.55, slideMs = 0.10) => {
    const o  = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g  = ctx.createGain();
    o.type = 'sine'; lp.type = 'lowpass'; lp.frequency.value = 200;
    o.frequency.setValueAtTime(fromHz, t);
    if (toHz !== fromHz)
      o.frequency.exponentialRampToValueAtTime(toHz, t + slideMs);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.016);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.06);
  };

  // ── Closed / Open Hi-hat ──
  const hat = (t, vol = 0.065, open = false) => {
    const dur = open ? 0.14 : 0.020;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < buf.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / buf.length, open ? 0.5 : 2.2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp  = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 10500;
    const g   = ctx.createGain(); g.gain.value = vol;
    src.connect(hp); hp.connect(g); g.connect(out);
    src.start(t); src.stop(t + dur + 0.01);
  };

  // ── Filtered sawtooth lead melody ──
  const lead = (t, freq, vol = 0.062, dur = 0.42, cutoff = 2000) => {
    const o  = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g  = ctx.createGain();
    o.type  = 'sawtooth'; o.frequency.value = freq;
    lp.type = 'lowpass'; lp.Q.value = 3.5;
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(cutoff * 0.28, t + dur * 0.55);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(lp); lp.connect(g);
    g.connect(out);
    g.connect(revS);   // lead has some reverb tail
    o.start(t); o.stop(t + dur + 0.06);
  };

  // ── Melody phrases — G minor (G4=392 Bb4=466 C5=523 D5=587 Eb5=622 F5=699) ──
  // phraseA: ascending tension phrase
  const phraseA = [
    [0,  392.0, 0.068, 0.44, 2400],  // G4
    [3,  466.2, 0.062, 0.38, 2100],  // Bb4
    [5,  523.3, 0.060, 0.36, 1900],  // C5
    [7,  587.3, 0.064, 0.42, 2200],  // D5
    [9,  699.5, 0.072, 0.54, 2600],  // F5  ← peak note
    [12, 622.3, 0.052, 0.30, 1700],  // Eb5 chromatic colour
    [14, 523.3, 0.046, 0.26, 1500],  // C5  descend
    [15, 466.2, 0.040, 0.22, 1400],  // Bb4 land
  ];
  // phraseB: falling resolution phrase
  const phraseB = [
    [0,  392.0, 0.064, 0.42, 2200],  // G4
    [2,  349.2, 0.058, 0.34, 1800],  // F4
    [4,  392.0, 0.062, 0.38, 2000],  // G4
    [6,  466.2, 0.066, 0.44, 2100],  // Bb4
    [8,  523.3, 0.064, 0.52, 2000],  // C5 sustained
    [11, 466.2, 0.052, 0.32, 1700],  // Bb4
    [13, 392.0, 0.046, 0.28, 1500],  // G4 resolution
    [15, 349.2, 0.040, 0.24, 1300],  // F4 close
  ];

  const phrase = (barIdx % 2 === 0) ? phraseA : phraseB;

  // ── Arrange by bar ──
  if (barIdx === 0) {
    // ── Intro bar: silence + bell ident ──
    synthIntroVoice();
    // Low sub pulse only, no drums yet
    bass808(T,          98.0, 98.0, 0.10, 1.8, 0);   // long G2 drone
    bass808(T + 2*BEAT, 87.3, 87.3, 0.08, 1.4, 0);   // F2 drift

  } else if (barIdx === 1) {
    // ── Drop bar: bare kick, no snare yet ──
    kick(T,          1.0,  0.72);
    kick(T + 2*BEAT, 0.80, 0.70);
    hat(T + 0.5*BEAT, 0.045); hat(T + 1.5*BEAT, 0.038);
    hat(T + 2.5*BEAT, 0.045); hat(T + 3.5*BEAT, 0.038);
    bass808(T, 98.0, 73.4, 0.14, 1.5, 0.14);   // G2 slides down

  } else if (barIdx === 2) {
    // ── Full beat enters ──
    kick(T,          1.0,  0.72);
    snare(T + BEAT);
    kick(T + 2*BEAT, 0.86, 0.68);
    snare(T + 3*BEAT);
    for (let e = 0; e < 8; e++) hat(T + e * 0.5 * BEAT, e % 2 === 0 ? 0.068 : 0.048);
    bass808(T,          98.0, 73.4,  0.14, 0.52, 0.11);  // G2 → F#2 slide
    bass808(T + 2*BEAT, 116.5, 116.5, 0.13, 0.52, 0);    // Bb2 steady
    // Melody starts bar 2
    phrase.forEach(([s, fr, v, d, c]) => lead(T + s * S16, fr, v, d, c));

  } else if (barIdx % 4 === 3) {
    // ── Fill bar (every 4th) ──
    kick(T,                1.0,  0.72);
    snare(T + BEAT);
    kick(T + 1.5 * BEAT,   0.38, 0.52);
    kick(T + 2 * BEAT,     0.84, 0.68);
    snare(T + 3 * BEAT);
    kick(T + 3.75 * BEAT,  0.26, 0.44);
    // Triplet hi-hat roll in bar 4
    for (let e = 0; e < 8; e++) hat(T + e * 0.5 * BEAT, 0.058 - e * 0.003);
    hat(T + 3 * BEAT + S16 * 0.67, 0.04);
    hat(T + 3 * BEAT + S16 * 1.33, 0.04);
    hat(T + 3 * BEAT + S16 * 2.0,  0.04, true); // open on end
    bass808(T,          87.3, 98.0, 0.13, 0.46, 0.09);   // F2 → G2 slide
    bass808(T + 2*BEAT, 110.0, 82.4, 0.14, 0.50, 0.13);  // A2 → E2 down-slide
    phrase.forEach(([s, fr, v, d, c]) => lead(T + s * S16, fr, v, d, c));

  } else if (barIdx % 2 === 0) {
    // ── Groove A ──
    kick(T,               1.0,  0.72);
    kick(T + S16 * 3,     0.28, 0.46);
    snare(T + BEAT);
    kick(T + 2 * BEAT,    0.86, 0.68);
    kick(T + 2*BEAT + S16*2, 0.20, 0.40);
    snare(T + 3 * BEAT);
    for (let e = 0; e < 8; e++) hat(T + e * 0.5 * BEAT, e % 2 === 0 ? 0.065 : 0.046, e === 7);
    bass808(T,          98.0, 73.4,  0.14, 0.50, 0.11);
    bass808(T + 2*BEAT, 116.5, 116.5, 0.13, 0.50, 0);
    phrase.forEach(([s, fr, v, d, c]) => lead(T + s * S16, fr, v, d, c));

  } else {
    // ── Groove B ──
    kick(T,               1.0,  0.72);
    snare(T + BEAT);
    kick(T + 1.75*BEAT,   0.36, 0.52);
    kick(T + 2*BEAT,      0.84, 0.68);
    snare(T + 3*BEAT);
    for (let e = 0; e < 8; e++) hat(T + e * 0.5 * BEAT, 0.058 - e * 0.001);
    hat(T + 1.5*BEAT, 0.055, true);   // open hat ghost accent
    hat(T + 3.5*BEAT, 0.050, true);
    bass808(T,          87.3, 98.0, 0.13, 0.46, 0.08);   // F2 → G2
    bass808(T + 2*BEAT, 98.0, 82.4, 0.14, 0.50, 0.13);   // G2 → E2 slide
    phrase.forEach(([s, fr, v, d, c]) => lead(T + s * S16, fr, v, d, c));
  }

  _introNextBar += 4 * BEAT;
  const msUntilNext = (_introNextBar - ctx.currentTime - 0.15) * 1000;
  _introLoopId = setTimeout(() => scheduleIntroBar(barIdx + 1), Math.max(0, msUntilNext));
}

function stopIntroBeat(onDone) {
  clearTimeout(_introLoopId);
  if (_introCtx && _introMaster) {
    _introMaster.gain.linearRampToValueAtTime(0, _introCtx.currentTime + 0.40);
    setTimeout(() => {
      try { _introCtx.close(); } catch(e) {}
      _introCtx = null; _introMaster = null; _introRev = null; _introRevSend = null;
      _introBeatStarted = false; _voiceSynthed = false;
      if (onDone) onDone();
    }, 480);
  } else {
    if (onDone) onDone();
  }
}

function playEntranceSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // ── Master chain: Compressor → Limiter → Out ──
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 3;
    comp.ratio.value = 14; comp.attack.value = 0.0003; comp.release.value = 0.06;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1; limiter.knee.value = 0;
    limiter.ratio.value = 20; limiter.attack.value = 0.0001; limiter.release.value = 0.02;
    comp.connect(limiter); limiter.connect(ctx.destination);

    // ── Simple plate reverb (pre-delay + all-pass cascade) ──
    const makeReverb = (decaySec=1.2) => {
      const len = Math.ceil(ctx.sampleRate * decaySec);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch=0;ch<2;ch++){
        const d=buf.getChannelData(ch);
        for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.2);
      }
      const rev = ctx.createConvolver(); rev.buffer=buf;
      const rg = ctx.createGain(); rg.gain.value=0.22;
      rev.connect(rg); rg.connect(comp);
      return rev;
    };
    const reverb = makeReverb(1.4);

    // ── MASSIVE 808 SUB-BASS KICK with layered distortion ──
    const kick808 = (t, freq=200, decay=1.1, vol=1.0) => {
      const dist = ctx.createWaveShaper();
      const curve = new Float32Array(512);
      for (let i=0;i<512;i++){const x=(i*2/512)-1; curve[i]=x<0?-Math.pow(-x,0.4):Math.pow(x,0.4);}
      dist.curve=curve;
      // Sub sine
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='sine';
      o.frequency.setValueAtTime(freq,t);
      o.frequency.exponentialRampToValueAtTime(26,t+decay);
      g.gain.setValueAtTime(vol,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+decay+0.08);
      o.connect(dist); dist.connect(g); g.connect(comp);
      o.start(t); o.stop(t+decay+0.12);
      // Hard click
      const oc=ctx.createOscillator(),gc=ctx.createGain();
      oc.type='square'; oc.frequency.value=1200;
      gc.gain.setValueAtTime(0.35,t); gc.gain.exponentialRampToValueAtTime(0.001,t+0.015);
      oc.connect(gc); gc.connect(comp);
      oc.start(t); oc.stop(t+0.018);
      // Noise burst on attack
      const nlen=Math.ceil(ctx.sampleRate*0.04);
      const nbuf=ctx.createBuffer(1,nlen,ctx.sampleRate);
      const nd=nbuf.getChannelData(0);
      for(let i=0;i<nlen;i++) nd[i]=(Math.random()*2-1)*(1-i/nlen);
      const ns=ctx.createBufferSource(); ns.buffer=nbuf;
      const nlp=ctx.createBiquadFilter(); nlp.type='lowpass'; nlp.frequency.value=200;
      const ng=ctx.createGain(); ng.gain.value=0.4;
      ns.connect(nlp); nlp.connect(ng); ng.connect(comp);
      ns.start(t); ns.stop(t+0.045);
    };

    // ── BIG NOISE CRASH ──
    const noiseBurst = (t, dur=0.25, vol=0.55, hpFreq=3000) => {
      const len=Math.ceil(ctx.sampleRate*dur);
      const buf=ctx.createBuffer(1,len,ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.3);
      const src=ctx.createBufferSource(); src.buffer=buf;
      const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=hpFreq;
      const g=ctx.createGain(); g.gain.value=vol;
      src.connect(hp); hp.connect(g); g.connect(comp);
      g.connect(reverb);
      src.start(t); src.stop(t+dur+0.05);
    };

    // ── DEEP SUB RUMBLE ──
    const subRumble = (t, dur=2.5) => {
      // Two detuned saws for thickness
      [36, 36.4].forEach(freq => {
        const o=ctx.createOscillator(), g=ctx.createGain();
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=90;
        o.type='sawtooth'; o.frequency.value=freq;
        g.gain.setValueAtTime(0,t);
        g.gain.linearRampToValueAtTime(0.38,t+0.04);
        g.gain.exponentialRampToValueAtTime(0.001,t+dur);
        o.connect(lp); lp.connect(g); g.connect(comp);
        o.start(t); o.stop(t+dur+0.1);
      });
    };

    // ── RISER ──
    const riser = (t, dur=0.5) => {
      const len=Math.ceil(ctx.sampleRate*dur);
      const buf=ctx.createBuffer(1,len,ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(i/len);
      const src=ctx.createBufferSource(); src.buffer=buf;
      const bp=ctx.createBiquadFilter(); bp.type='bandpass';
      bp.frequency.setValueAtTime(300,t);
      bp.frequency.exponentialRampToValueAtTime(12000,t+dur);
      bp.Q.value=0.4;
      const g=ctx.createGain(); g.gain.value=0.5;
      src.connect(bp); bp.connect(g); g.connect(comp);
      g.connect(reverb);
      src.start(t); src.stop(t+dur+0.05);
    };

    // ── DETUNED POWER CHORD (multi-oscillator for fatness) ──
    const synthHit = (freq, t, dur, vol, type='sawtooth') => {
      [-7, 0, 7].forEach(cents => {  // detune spread
        const o=ctx.createOscillator(), g=ctx.createGain();
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2800;
        o.type=type; o.frequency.value=freq * Math.pow(2, cents/1200);
        g.gain.setValueAtTime(vol/3,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+dur);
        o.connect(lp); lp.connect(g); g.connect(comp);
        lp.connect(reverb);
        o.start(t); o.stop(t+dur+0.05);
      });
    };

    // ═══ ABLAUF ═══

    // -0.05 bis 0: Stille / Spannung
    // 0.00: Riser baut sich auf
    riser(now, 0.52);

    // 0.52: MEGA IMPACT
    kick808(now+0.52, 210, 1.3, 1.0);
    noiseBurst(now+0.52, 0.28, 0.6, 2200);
    subRumble(now+0.52, 2.8);

    // 0.52: 5-stimmiger Power-Chord-Stab (fette Detuned-Synths)
    [41.2, 55, 82.4, 110, 138.6, 164.8].forEach((f,i) =>
      synthHit(f, now+0.52, 2.2-i*0.12, 0.18)
    );

    // 0.72: Zweiter Kick (Nachschlag-Punch)
    kick808(now+0.72, 170, 0.7, 0.65);
    noiseBurst(now+0.72, 0.12, 0.28, 4500);

    // 0.72: Snare auf 2
    (() => {
      const len=Math.ceil(ctx.sampleRate*0.22);
      const buf=ctx.createBuffer(1,len,ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.5);
      const src=ctx.createBufferSource(); src.buffer=buf;
      const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=3200; bp.Q.value=0.5;
      const g=ctx.createGain(); g.gain.value=0.65;
      src.connect(bp); bp.connect(g); g.connect(comp);
      bp.connect(reverb);
      src.start(now+0.72); src.stop(now+0.72+0.25);
    })();

    // 1.10: Melodischer Aufstieg
    [110, 146.8, 196, 261.6, 349.2, 440, 587.3, 880].forEach((f,i) =>
      synthHit(f, now+1.1+i*0.065, 0.55, 0.07, 'triangle')
    );

    // 1.70: Dritter Kick (Abschluss-Punch)
    kick808(now+1.70, 180, 0.9, 0.75);
    noiseBurst(now+1.70, 0.15, 0.35, 3000);

    // 2.00–2.4: Finaler Bell-Chord
    [[523.3,0.07],[659.3,0.06],[880,0.055],[1046.5,0.05],[1318.5,0.04]].forEach(([f,v],i) =>
      synthHit(f, now+2.0+i*0.06, 1.8-i*0.15, v, 'sine')
    );

  } catch(e) {}
}

// ── startEverything: called by launch gate click – THE user gesture that unlocks audio ──
// =============================
// DEEP SPACE STARFIELD
// =============================
function buildIntroParticles() {
  const canvas = document.getElementById('introStars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.offsetWidth  || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const STAR_COUNT = 200;
  const stars = Array.from({length: STAR_COUNT}, () => ({
    x: Math.random(),
    y: Math.random(),
    size:   Math.random() < 0.75 ? 0.4 + Math.random() * 1.1 : 1.4 + Math.random() * 1.8,
    base:   0.1 + Math.random() * 0.65,
    speed:  0.4 + Math.random() * 2.2,
    phase:  Math.random() * Math.PI * 2,
    dx:     (Math.random() - 0.5) * 0.000018,
    dy:     (Math.random() - 0.5) * 0.000018,
    color:  Math.random() > 0.85 ? [200,180,255] : [220,215,255],
  }));

  const shoots = [];
  let lastShoot = 0, nextShoot = 4000 + Math.random() * 5000;

  function spawnShoot() {
    shoots.push({
      x: 0.1 + Math.random() * 0.8,
      y: Math.random() * 0.45,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.6,
      tailLen: 0.08 + Math.random() * 0.12,
      traveled: 0,
      maxTravel: 0.18 + Math.random() * 0.14,
      life: 0, maxLife: 0.5 + Math.random() * 0.4,
    });
  }

  let lastTs = 0;
  function draw(ts) {
    const dt = Math.min(ts - lastTs, 50); lastTs = ts;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Stars
    for (const s of stars) {
      const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(ts * 0.001 * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2);
      const [r,g,b] = s.color;
      ctx.fillStyle = `rgba(${r},${g},${b},${s.base * tw})`;
      ctx.fill();
      s.x += s.dx; s.y += s.dy;
      if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
      if (s.y < 0) s.y = 1; if (s.y > 1) s.y = 0;
    }

    // Shooting stars
    if (ts - lastShoot > nextShoot) {
      spawnShoot();
      lastShoot = ts;
      nextShoot = 3500 + Math.random() * 6000;
    }
    for (let i = shoots.length - 1; i >= 0; i--) {
      const sh = shoots[i];
      sh.life += dt * 0.001;
      sh.traveled += (dt * 0.001) * 0.18;
      if (sh.life >= sh.maxLife) { shoots.splice(i, 1); continue; }
      const p = sh.life / sh.maxLife;
      const alpha = p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.85);
      const hx = (sh.x + Math.cos(sh.angle) * sh.traveled) * W;
      const hy = (sh.y + Math.sin(sh.angle) * sh.traveled) * H;
      const tx = hx - Math.cos(sh.angle) * sh.tailLen * W;
      const ty = hy - Math.sin(sh.angle) * sh.tailLen * H;
      const g2 = ctx.createLinearGradient(tx, ty, hx, hy);
      g2.addColorStop(0, `rgba(200,180,255,0)`);
      g2.addColorStop(1, `rgba(230,220,255,${alpha * 0.95})`);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy);
      ctx.strokeStyle = g2; ctx.lineWidth = 1.5; ctx.stroke();
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

