// =============================
// CAPACITOR NATIVE BRIDGE
// =============================
// Guards: all native code runs only when Capacitor is present.
// Web fallbacks keep the app fully functional in the browser.

function isNative() {
  return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
}

function capPlugin(name) {
  return isNative() && Capacitor.Plugins && Capacitor.Plugins[name]
    ? Capacitor.Plugins[name]
    : null;
}

// =============================
// @capacitor/preferences — secure key-value storage
// =============================
const PREF_KEYS = [
  'studio_api_key',
  'studio_groq_model',
  'studio_tavily_key',
  'studio_yt_key',
  'studio_sb_url',
  'studio_sb_key',
  'studio_voice_persona'
];

async function nativePrefSync() {
  const prefs = capPlugin('Preferences');
  if (!prefs) return;
  for (const key of PREF_KEYS) {
    try {
      const { value } = await prefs.get({ key });
      if (value !== null && value !== undefined) {
        localStorage.setItem(key, value);
      } else {
        // Mirror existing localStorage value into Preferences
        const existing = localStorage.getItem(key);
        if (existing !== null) await prefs.set({ key, value: existing });
      }
    } catch (e) {
      console.warn('[native] Preferences.get failed for', key, e.message);
    }
  }
}

async function nativePrefSet(key, value) {
  localStorage.setItem(key, value);
  const prefs = capPlugin('Preferences');
  if (!prefs) return;
  try {
    await prefs.set({ key, value: String(value) });
  } catch (e) {
    console.warn('[native] Preferences.set failed for', key, e.message);
  }
}

// =============================
// @capacitor/filesystem — native audio browser
// =============================
let _nativeAudioFiles = [];

const AUDIO_DIRS = [
  { label: 'Musik', path: 'Music',     dir: 'EXTERNAL_STORAGE' },
  { label: 'Downloads', path: 'Download', dir: 'EXTERNAL_STORAGE' },
  { label: 'Dokumente', path: '',          dir: 'DOCUMENTS' }
];

const AUDIO_EXTS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.opus', '.wma'];

function _isAudioFile(name) {
  return AUDIO_EXTS.some(ext => name.toLowerCase().endsWith(ext));
}

async function openNativeAudioBrowser() {
  const fs = capPlugin('Filesystem');
  if (!fs) {
    // Fallback: trigger normal file input
    const input = document.getElementById('audioFileInput');
    if (input) input.click();
    return;
  }

  showToast('Suche Audiodateien…', 'info');
  _nativeAudioFiles = [];

  for (const { label, path, dir } of AUDIO_DIRS) {
    try {
      const result = await fs.readdir({ path, directory: dir });
      const files = (result.files || []);
      for (const entry of files) {
        const name = typeof entry === 'string' ? entry : (entry.name || '');
        if (!_isAudioFile(name)) continue;
        const fullPath = path ? (path + '/' + name) : name;
        _nativeAudioFiles.push({ name, path: fullPath, dir, label });
      }
    } catch (e) {
      console.warn('[native] readdir failed for', label, e.message);
    }
  }

  if (_nativeAudioFiles.length === 0) {
    showToast('Keine Audiodateien gefunden. Bitte manuell hochladen.', 'error');
    const input = document.getElementById('audioFileInput');
    if (input) input.click();
    return;
  }

  _renderNativeFilePicker();
}

function _renderNativeFilePicker() {
  const existing = document.getElementById('_nativePickerModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = '_nativePickerModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background:var(--card,#12121e);border:1px solid var(--border,#1e1e35);
    border-radius:16px;padding:20px;width:100%;max-width:480px;
    max-height:75vh;display:flex;flex-direction:column;gap:12px;
  `;

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
  header.innerHTML = `
    <span style="font-weight:700;color:var(--text,#e2e8f0);font-size:1rem;">
      📁 Audiodateien (${_nativeAudioFiles.length})
    </span>
    <button onclick="document.getElementById('_nativePickerModal').remove()"
      style="background:none;border:none;color:var(--text-muted,#94a3b8);
             font-size:1.4rem;cursor:pointer;line-height:1;">×</button>
  `;

  const list = document.createElement('div');
  list.style.cssText = 'overflow-y:auto;display:flex;flex-direction:column;gap:6px;';

  _nativeAudioFiles.forEach((f, idx) => {
    const item = document.createElement('button');
    item.style.cssText = `
      background:var(--card2,#1a1a2e);border:1px solid var(--border,#1e1e35);
      border-radius:10px;padding:10px 14px;text-align:left;cursor:pointer;
      color:var(--text,#e2e8f0);font-size:.85rem;transition:border-color .15s;
    `;
    item.onmouseenter = () => item.style.borderColor = 'var(--purple,#7c3aed)';
    item.onmouseleave = () => item.style.borderColor = 'var(--border,#1e1e35)';
    item.innerHTML = `
      <div style="font-weight:600;">🎵 ${escHtml(f.name)}</div>
      <div style="color:var(--text-muted,#94a3b8);font-size:.75rem;margin-top:3px;">
        ${escHtml(f.label)} / ${escHtml(f.path)}
      </div>
    `;
    item.onclick = () => selectNativeAudioFile(idx);
    list.appendChild(item);
  });

  box.appendChild(header);
  box.appendChild(list);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

async function selectNativeAudioFile(idx) {
  const entry = _nativeAudioFiles[idx];
  if (!entry) return;

  const modal = document.getElementById('_nativePickerModal');
  if (modal) modal.remove();

  const fs = capPlugin('Filesystem');
  if (!fs) return;

  showToast('Lade ' + entry.name + '…', 'info');

  try {
    // Build the full URI via getUri, then convert for web use
    const { uri } = await fs.getUri({ path: entry.path, directory: entry.dir });
    const webSrc = Capacitor.convertFileSrc(uri);
    _loadAudioNative(webSrc, entry.name);
  } catch (e) {
    console.warn('[native] getUri failed, falling back to base64:', e.message);
    // Base64 fallback
    try {
      const { data } = await fs.readFile({ path: entry.path, directory: entry.dir });
      const ext = entry.name.split('.').pop().toLowerCase();
      const mimeMap = { mp3:'audio/mpeg', wav:'audio/wav', flac:'audio/flac',
                        aac:'audio/aac', ogg:'audio/ogg', m4a:'audio/mp4',
                        opus:'audio/opus', wma:'audio/x-ms-wma' };
      const mime = mimeMap[ext] || 'audio/mpeg';
      const src = 'data:' + mime + ';base64,' + data;
      _loadAudioNative(src, entry.name);
    } catch (e2) {
      showToast('Datei konnte nicht geladen werden: ' + e2.message, 'error');
    }
  }
}

function _loadAudioNative(src, filename) {
  const audio = document.getElementById('audioElement');
  if (!audio) { showToast('Audio-Player nicht gefunden!', 'error'); return; }

  // Fake a file object so existing code paths still work for display/metadata
  // currentAudioFile is used only for re-saving to IDB; native files skip that
  currentAudioFile = { name: filename, size: 0, type: 'audio/mpeg' };
  currentAudioDuration = 0;

  audio.src = src;
  audio.load();

  const nameEl = document.getElementById('audioFileName');
  if (nameEl) {
    nameEl.textContent = '📎 ' + filename + ' (nativ)';
    nameEl.style.display = 'block';
  }

  ['audioPlayerCard', 'bpmCard', 'transcriptionCard', 'timelineCard', 'audioAiCard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });

  audio.ontimeupdate = typeof updateAudioProgress === 'function' ? updateAudioProgress : null;
  audio.onended = () => {
    const b = document.getElementById('playBtn');
    if (b) b.textContent = '▶';
  };
  audio.onloadedmetadata = () => {
    currentAudioDuration = audio.duration;
    if (typeof updateAudioProgress === 'function') updateAudioProgress();
  };

  if (currentSongId && songs && songs[currentSongId]) {
    songs[currentSongId].p8_audio_filename = filename;
    if (typeof saveToStorage === 'function') saveToStorage();
  }

  if (typeof updateMarkerList === 'function') updateMarkerList();
  showToast('Audio geladen: ' + filename, 'success');
}

// =============================
// @capacitor/share — native share sheet
// =============================
async function nativeShare({ title = '', text = '', url = '', dialogTitle = '' } = {}) {
  const share = capPlugin('Share');
  if (share) {
    try {
      await share.share({ title, text, url, dialogTitle });
      return;
    } catch (e) {
      if (e.message && e.message.includes('canceled')) return; // user dismissed
      console.warn('[native] Share.share failed:', e.message);
    }
  }
  // Progressive web fallback
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  // Clipboard fallback
  const content = [title, text, url].filter(Boolean).join('\n\n');
  if (typeof copyText === 'function') {
    copyText(content);
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(content).catch(() => {});
    showToast('In Zwischenablage kopiert!', 'success');
  }
}

function shareSong(type) {
  const appName = 'D_a_N Studio';
  const songName = (currentSongId && songs && songs[currentSongId]?.p1_titel) || 'Song';

  if (type === 'lyrics') {
    const lyrics = document.getElementById('p2_lyrics')?.value?.trim() || '';
    nativeShare({
      title: songName + ' – Lyrics',
      text: lyrics || 'Noch keine Lyrics vorhanden.',
      dialogTitle: 'Lyrics teilen'
    });

  } else if (type === 'concept') {
    const concept = (currentSongId && songs && songs[currentSongId]?.p1_konzept) || '';
    nativeShare({
      title: songName + ' – Konzept',
      text: concept || 'Noch kein Konzept vorhanden.',
      dialogTitle: 'Konzept teilen'
    });

  } else if (type === 'beat') {
    const beat = (currentSongId && songs && songs[currentSongId]?.p3_beat) || '';
    nativeShare({
      title: songName + ' – Beat-Beschreibung',
      text: beat || 'Noch keine Beat-Beschreibung vorhanden.',
      dialogTitle: 'Beat teilen'
    });

  } else if (type === 'all') {
    const data = currentSongId && songs ? songs[currentSongId] : {};
    const parts = [];
    if (data.p1_titel)   parts.push('🎵 ' + data.p1_titel);
    if (data.p1_konzept) parts.push('📋 Konzept:\n' + data.p1_konzept);
    if (data.p2_lyrics)  parts.push('✍️ Lyrics:\n' + data.p2_lyrics);
    if (data.p3_beat)    parts.push('🥁 Beat:\n' + data.p3_beat);
    nativeShare({
      title: songName + ' – ' + appName,
      text: parts.join('\n\n') || 'Noch kein Inhalt vorhanden.',
      dialogTitle: 'Song teilen'
    });
  }
}

// =============================
// initNativeUI — inject native buttons into the DOM
// Called from DOMContentLoaded in app.js (after DOM is ready)
// =============================
function initNativeUI() {
  if (!isNative()) return;

  // --- Phase 8: native audio browse button after dropzone ---
  const dropzone = document.getElementById('audioDropzone');
  if (dropzone && !document.getElementById('_nativeBrowseBtn')) {
    const btn = document.createElement('button');
    btn.id = '_nativeBrowseBtn';
    btn.className = 'btn';
    btn.style.cssText = 'margin-top:12px;width:100%;';
    btn.textContent = '📁 Musik-Ordner öffnen (nativ)';
    btn.onclick = openNativeAudioBrowser;
    dropzone.insertAdjacentElement('afterend', btn);
  }

  // --- Phase 2: lyrics share button ---
  // Insert after the first copy button in the lyrics result area
  const lyricsArea = document.getElementById('p2_lyrics');
  if (lyricsArea && !document.getElementById('_nativeLyricsShareBtn')) {
    const btn = document.createElement('button');
    btn.id = '_nativeLyricsShareBtn';
    btn.className = 'btn btn-secondary';
    btn.style.cssText = 'margin-top:8px;';
    btn.innerHTML = '📤 Lyrics teilen';
    btn.onclick = () => shareSong('lyrics');
    lyricsArea.insertAdjacentElement('afterend', btn);
  }

  // --- Topbar: share button next to PDF export ---
  const pdfBtn = document.querySelector('.btn-pdf');
  if (pdfBtn && !document.getElementById('_nativePdfShareBtn')) {
    const btn = document.createElement('button');
    btn.id = '_nativePdfShareBtn';
    btn.className = 'btn btn-secondary';
    btn.style.cssText = 'margin-left:8px;';
    btn.innerHTML = '📤 Teilen';
    btn.onclick = () => shareSong('all');
    pdfBtn.insertAdjacentElement('afterend', btn);
  }
}
