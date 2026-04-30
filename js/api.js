// =============================
// API
// =============================
function getGroqModel() {
  return localStorage.getItem('studio_groq_model') || 'llama-3.3-70b-versatile';
}

function openApiModal() {
  document.getElementById('apiModal').classList.remove('hidden');
  const existing = sessionStorage.getItem('studio_api_key') || localStorage.getItem('studio_api_key');
  if (existing) document.getElementById('apiKeyInput').value = existing;
  document.getElementById('apiKeyPersist').checked = !!localStorage.getItem('studio_api_key');
  // Restore saved model selection
  const savedModel = getGroqModel();
  const radioBtn = document.querySelector(`input[name="groqModel"][value="${savedModel}"]`);
  if (radioBtn) radioBtn.checked = true;
  else { const first = document.querySelector('input[name="groqModel"]'); if(first) first.checked = true; }
  document.getElementById('apiKeyInput').focus();
}

function closeApiModal() {
  document.getElementById('apiModal').classList.add('hidden');
}

async function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  const saveBtn = document.querySelector('#apiModal .btn-primary');
  if (!key) { showToast('Bitte API Key eingeben!', 'error'); return; }
  if (!key.startsWith('gsk_')) {
    showToast('API Key Format ungültig (sollte mit gsk_ beginnen)', 'error');
    return;
  }

  // Key live testen bevor er gespeichert wird
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Teste Key...'; }
  try {
    const testRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
    });
    if (!testRes.ok) {
      const err = await testRes.json().catch(() => ({}));
      showToast('❌ Key ungültig: ' + (err.error?.message || 'Bitte neuen Key erstellen auf console.groq.com'), 'error');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Speichern'; }
      return;
    }
  } catch(e) {
    showToast('⚠️ Verbindung fehlgeschlagen – Key trotzdem gespeichert', 'info');
  }
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Speichern'; }

  // Save selected model
  const selectedModel = document.querySelector('input[name="groqModel"]:checked')?.value || 'llama-3.3-70b-versatile';
  localStorage.setItem('studio_groq_model', selectedModel);
  const persist = document.getElementById('apiKeyPersist').checked;
  sessionStorage.setItem('studio_api_key', key);
  if (persist) {
    localStorage.setItem('studio_api_key', key);
    showToast('✅ API Key gültig & dauerhaft gespeichert!', 'success');
  } else {
    localStorage.removeItem('studio_api_key');
    showToast('✅ API Key gültig & gespeichert (nur diese Session)!', 'success');
  }
  updateApiStatus();
  closeApiModal();
}

function updateApiStatus() {
  const key = sessionStorage.getItem('studio_api_key');
  const dot = document.getElementById('apiDot');
  const text = document.getElementById('apiStatusText');
  if (key) {
    dot.classList.add('active');
    text.textContent = 'API aktiv';
  } else {
    dot.classList.remove('active');
    text.textContent = 'Kein API Key';
  }
}

function buildAutoSearchQuery(prompt) {
  // Extrahiere Kern-Keywords aus dem Prompt für eine relevante Suchanfrage
  const heute = new Date().getFullYear();
  const keywords = prompt
    .replace(/[^\w\säöüÄÖÜß]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 5)
    .join(' ');
  return `${keywords} deutsch rap hip-hop ${heute} aktuell trend`;
}

async function callClaude(prompt, systemPrompt = null) {
  const apiKey = sessionStorage.getItem('studio_api_key');
  if (!apiKey) {
    openApiModal();
    throw new Error('Kein API Key vorhanden');
  }

  // Inject Voice Persona into every AI call
  const baseSystem = systemPrompt || PRODUCER_SYSTEM_PROMPT;
  const vp = loadVoicePersona();
  let fullSystem = baseSystem;
  if (vp.charakter || vp.flow || vp.name) {
    const songEmotion = (currentSongId && songs[currentSongId]?.p1_emotion) || vp.defaultEmotion || '';
    const vpBlock = [
      `\n\n---\n🎤 ARTIST VOICE PERSONA (IMMER BEIBEHALTEN):`,
      vp.name       ? `Künstler: ${vp.name}` : '',
      vp.charakter  ? `Charakter: ${vp.charakter}` : '',
      vp.flow       ? `Sprachstil: ${vp.flow}` : '',
      songEmotion   ? `Aktuelle Emotion / Tonlage: ${songEmotion}` : '',
      `Die Persönlichkeit bleibt IMMER gleich. Nur die Emotionsebene variiert je nach Song.`,
      `---`
    ].filter(Boolean).join('\n');
    fullSystem = baseSystem + vpBlock;
  }

  // Automatische Web-Recherche wenn Tavily Key vorhanden
  if (tavilyKey) {
    const searchQuery = buildAutoSearchQuery(prompt);
    const webData = await searchWeb(searchQuery);
    if (webData) {
      const today = new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});
      let webCtx = `\n\n---\n🌐 AKTUELLE WEB-RECHERCHE (${today}):\n`;
      if (webData.answer) webCtx += webData.answer + '\n';
      if (webData.results?.length) {
        webCtx += '\nQuellen:\n' + webData.results.slice(0, 3).map(r => `- ${r.title}: ${r.content?.substring(0, 180)}`).join('\n');
      }
      webCtx += '\n---\nNutze diese aktuellen Infos in deiner Antwort. Keine veralteten Infos aus dem Training.';
      fullSystem = fullSystem + webCtx;
    }
  }

  const messages = [
    { role: 'system', content: fullSystem },
    { role: 'user', content: prompt }
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || `API Fehler: ${response.status}`;
    // Parse rate limit retry time for a user-friendly hint
    const retryMatch = msg.match(/try again in ([\d]+m[\d.]+s|[\d.]+s)/i);
    if (retryMatch) {
      throw new Error(`⏳ Rate Limit erreicht – bitte warte ${retryMatch[1]}.\n💡 Tipp: Wechsle im API-Menü zu "Llama 3.1 8B Instant" für ein ~5× höheres Tageslimit.`);
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// =============================
// SUPABASE CLOUD SYNC
// =============================
// Credentials are stored in localStorage only — never hardcode here
let sbUrl = '';
let sbKey = '';
let cloudConnected = false;
let syncDebounceTimer = null;

function getSbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': sbKey,
    'Authorization': 'Bearer ' + sbKey,
    'Prefer': 'resolution=merge-duplicates'
  };
}

function loadCloudConfig() {
  const storedUrl = localStorage.getItem('studio_sb_url') || '';
  const storedKey = localStorage.getItem('studio_sb_key') || '';
  if (storedUrl.startsWith('https://')) sbUrl = storedUrl;
  if (storedKey) sbKey = storedKey;
  if (sbUrl && sbKey) {
    cloudConnected = true;
    updateCloudStatus('connected');
  }
}

function updateCloudStatus(state, msg) {
  const dot = document.getElementById('cloudDot');
  const btn = document.getElementById('cloudBtn');
  const text = document.getElementById('cloudBtnText');
  dot.className = 'cloud-dot';
  btn.className = 'btn-cloud';
  if (state === 'connected') {
    dot.classList.add('connected');
    text.textContent = '☁ Cloud';
  } else if (state === 'syncing') {
    dot.classList.add('connected');
    btn.classList.add('syncing');
    text.textContent = '☁ Sync...';
  } else if (state === 'error') {
    dot.classList.add('error');
    btn.classList.add('error');
    text.textContent = '☁ Fehler';
  } else {
    text.textContent = '☁ Cloud';
  }
}

function openCloudModal() {
  document.getElementById('sbUrl').value = sbUrl;
  document.getElementById('sbKey').value = sbKey;
  document.getElementById('cloudSyncNowBtn').style.display = cloudConnected ? 'inline-flex' : 'none';
  document.getElementById('cloudStatusMsg').textContent = cloudConnected ? '✓ Verbunden mit ' + sbUrl : '';
  document.getElementById('cloudModal').classList.remove('hidden');
}

function closeCloudModal() {
  document.getElementById('cloudModal').classList.add('hidden');
}

async function saveCloudConfig() {
  let url = document.getElementById('sbUrl').value.trim().replace(/\/$/, '');
  if (url && !url.startsWith('http')) url = 'https://' + url;
  const key = document.getElementById('sbKey').value.trim();
  if (!url || !key) { showToast('Bitte URL und Key eingeben!', 'error'); return; }

  const statusEl = document.getElementById('cloudStatusMsg');
  statusEl.textContent = '⏳ Verbinde...';

  try {
    // Test connection
    const res = await fetch(`${url}/rest/v1/studio_songs?limit=1`, {
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.hint || `HTTP ${res.status} – Tabelle vorhanden?`);
    }

    sbUrl = url;
    sbKey = key;
    cloudConnected = true;
    localStorage.setItem('studio_sb_url', url);
    localStorage.setItem('studio_sb_key', key);
    updateCloudStatus('connected');
    document.getElementById('cloudSyncNowBtn').style.display = 'inline-flex';
    statusEl.textContent = '✓ Verbunden! Synchronisiere...';

    await fullSync();
    statusEl.textContent = '✓ Verbunden und synchronisiert mit ' + url;
    showToast('Cloud-Sync aktiv!', 'success');
  } catch(e) {
    updateCloudStatus('error');
    statusEl.textContent = '✗ Fehler: ' + e.message;
    showToast('Verbindungsfehler: ' + e.message, 'error');
  }
}

async function pushSongToCloud(song) {
  if (!cloudConnected || !sbUrl || !sbKey) return;
  try {
    const res = await fetch(`${sbUrl}/rest/v1/studio_songs`, {
      method: 'POST',
      headers: getSbHeaders(),
      body: JSON.stringify({
        song_id: song.id,
        name: song.name,
        data: song,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Cloud push failed:', err.message || `HTTP ${res.status}`);
    }
  } catch(e) {
    console.warn('Cloud push failed:', e.message);
  }
}

async function deleteSongFromCloud(id) {
  if (!cloudConnected || !sbUrl || !sbKey) return;
  try {
    await fetch(`${sbUrl}/rest/v1/studio_songs?song_id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'apikey': sbKey, 'Authorization': 'Bearer ' + sbKey }
    });
  } catch(e) {
    console.warn('Cloud delete failed:', e.message);
  }
}

async function fullSync() {
  if (!cloudConnected || !sbUrl || !sbKey) return;
  updateCloudStatus('syncing');
  try {
    // Push all local songs
    const localIds = Object.keys(songs);
    for (const id of localIds) {
      await pushSongToCloud(songs[id]);
    }

    // Pull remote songs not in local
    const res = await fetch(`${sbUrl}/rest/v1/studio_songs?select=song_id,name,data,updated_at&order=updated_at.desc`, {
      headers: { 'apikey': sbKey, 'Authorization': 'Bearer ' + sbKey }
    });
    if (res.ok) {
      const remote = await res.json();
      let added = 0;
      for (const row of remote) {
        const localSong = songs[row.song_id];
        const remoteDate = new Date(row.updated_at);
        const localDate = localSong ? new Date(localSong.updatedAt || 0) : new Date(0);
        // Use remote if newer or not present locally
        if (!localSong || remoteDate > localDate) {
          songs[row.song_id] = { ...row.data, id: row.song_id };
          added++;
        }
      }
      if (added > 0) {
        saveToStorage();
        renderSongList();
      }
    }
    updateCloudStatus('connected');
  } catch(e) {
    updateCloudStatus('error');
    showToast('Sync-Fehler: ' + e.message, 'error');
  }
}

async function manualSync() {
  showToast('Synchronisiere...', 'info');
  await fullSync();
  showToast('Synchronisiert!', 'success');
  document.getElementById('cloudStatusMsg').textContent = '✓ Zuletzt synchronisiert: ' + new Date().toLocaleTimeString('de-DE');
}

// =============================
// PRODUCER CHAT (PHASE 9)
// =============================
let tavilyKey = '';

function loadTavilyKey() {
  tavilyKey = localStorage.getItem('studio_tavily_key') || '';
  updateTavilyStatus();
}

function updateTavilyStatus() {
  const el = document.getElementById('tavilyStatus');
  if (!el) return;
  const toggle = document.getElementById('useWebSearch');
  if (tavilyKey) {
    el.textContent = '(aktiv – automatisch)';
    el.style.color = 'var(--success)';
    if (toggle) { toggle.checked = true; toggle.disabled = true; }
  } else {
    el.textContent = '(kein Key)';
    el.style.color = 'var(--danger)';
    if (toggle) { toggle.checked = false; toggle.disabled = false; }
  }
}

function openTavilyModal() {
  document.getElementById('tavilyModal').classList.remove('hidden');
  document.getElementById('tavilyKeyInput').value = tavilyKey;
  document.getElementById('tavilyKeyInput').focus();
}

function closeTavilyModal() {
  document.getElementById('tavilyModal').classList.add('hidden');
}

function saveTavilyKey() {
  const key = document.getElementById('tavilyKeyInput').value.trim();
  if (!key) { showToast('Bitte Key eingeben!', 'error'); return; }
  tavilyKey = key;
  localStorage.setItem('studio_tavily_key', key);
  updateTavilyStatus();
  closeTavilyModal();
  showToast('Tavily Key gespeichert!', 'success');
}

function checkTavily() {
  if (document.getElementById('useWebSearch').checked && !tavilyKey) {
    document.getElementById('useWebSearch').checked = false;
    showToast('Tavily Key benötigt für Web-Suche', 'info');
    openTavilyModal();
  }
}

async function searchWeb(query) {
  if (!tavilyKey) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: tavilyKey, query, search_depth: 'advanced', max_results: 4, include_answer: true })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch(e) { console.warn('Tavily:', e.message); return null; }
}

async function callClaudeChat(messages, systemPrompt) {
  const apiKey = sessionStorage.getItem('studio_api_key');
  if (!apiKey) { openApiModal(); throw new Error('Kein API Key'); }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: getGroqModel(), messages: [{ role: 'system', content: systemPrompt }, ...messages], max_tokens: 2048 })
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    const msg = err.error?.message || `API Fehler: ${res.status}`;
    const retryMatch = msg.match(/try again in ([\d]+m[\d.]+s|[\d.]+s)/i);
    if (retryMatch) throw new Error(`⏳ Rate Limit erreicht – bitte warte ${retryMatch[1]}.\n💡 Wechsle im API-Menü zu "Llama 3.1 8B Instant".`);
    throw new Error(msg);
  }
  return (await res.json()).choices[0].message.content;
}

function debouncedCloudSync() {
  if (!cloudConnected) return;
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    if (currentSongId && songs[currentSongId]) {
      songs[currentSongId].updatedAt = new Date().toISOString();
      pushSongToCloud(songs[currentSongId]);
    }
  }, 2000);
}

