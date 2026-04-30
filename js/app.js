// =============================
// MULTI-PROFILE SYSTEM
// =============================
const PP_COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
let _newProfileMode = false;

function getProfiles() {
  try { return JSON.parse(localStorage.getItem('studio_profiles') || '[]'); } catch { return []; }
}

function getActiveProfileId() {
  return localStorage.getItem('studio_active_profile') || '';
}

function getProfile() {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  const p = profiles.find(pr => pr.id === activeId) || profiles[0] || {};
  return {
    name:          p.name          || 'Artist',
    handle:        p.handle        || '',
    genre:         p.genre         || '',
    city:          p.city          || '',
    sunoHandle:    p.sunoHandle    || '',
    youtubeHandle: p.youtubeHandle || ''
  };
}

function saveProfile(data) {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  const idx = profiles.findIndex(p => p.id === activeId);
  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], ...data };
  } else {
    const id = 'p_' + Date.now();
    profiles.push({ id, color: PP_COLORS[0], createdAt: new Date().toISOString(), ...data });
    localStorage.setItem('studio_active_profile', id);
  }
  localStorage.setItem('studio_profiles', JSON.stringify(profiles));
}

function hasProfile() {
  const p = getProfile();
  return !!(p.name && p.name.trim() && p.name !== 'Artist');
}

function getInitials(name) {
  return (name || '?').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// One-time migration: single-profile → multi-profile
function migrateStorageKeys() {
  // Migrate to multi-profile structure if not done yet
  if (!localStorage.getItem('studio_profiles')) {
    const oldProfile = localStorage.getItem('studio_profile');
    const oldSongs = localStorage.getItem('studio_music_songs');
    const pid = 'p_default';
    let pd = { name: 'Artist', handle: '', genre: '', city: '', sunoHandle: '', youtubeHandle: '' };
    if (oldProfile) {
      try { pd = { ...pd, ...JSON.parse(oldProfile) }; } catch {}
    } else {
      try {
        const bio = JSON.parse(localStorage.getItem('studio_bio_profile') || '{}');
        if (bio.name) { pd.name = bio.name; pd.genre = bio.stil || ''; pd.city = bio.herkunft || ''; }
      } catch {}
    }
    const profile = { id: pid, color: PP_COLORS[0], createdAt: new Date().toISOString(), ...pd };
    localStorage.setItem('studio_profiles', JSON.stringify([profile]));
    if (oldSongs) localStorage.setItem('studio_music_songs_' + pid, oldSongs);
    localStorage.setItem('studio_active_profile', pid);
  }
}

// ── Profile Picker UI ──
function renderProfilePicker() {
  const profiles = getProfiles();
  const grid = document.getElementById('ppGrid');
  if (!grid) return;
  let html = profiles.map(p => `
    <div class="pp-card" onclick="selectProfileAndEnter('${p.id}')">
      <button class="pp-delete" onclick="event.stopPropagation();event.preventDefault();deleteProfile('${p.id}')">✕</button>
      <div class="pp-avatar" style="background:linear-gradient(135deg,${p.color},${p.color}99)">
        ${getInitials(p.name)}
      </div>
      <div class="pp-name">${escHtml ? escHtml(p.name) : p.name}</div>
      ${p.handle ? `<div class="pp-handle">${p.handle}</div>` : ''}
    </div>`).join('');
  html += `<div class="pp-card pp-add-card" onclick="addNewProfile()">
    <div class="pp-avatar">+</div>
    <div class="pp-name">Neues Profil</div>
  </div>`;
  grid.innerHTML = html;
}

function selectProfileAndEnter(id) {
  if (document.getElementById('profilePicker')?.classList.contains('pp-manage-mode')) return;
  localStorage.setItem('studio_active_profile', id);

  // Load songs for this profile so we can show them
  const pid = id;
  let profileSongs = {};
  try { profileSongs = JSON.parse(localStorage.getItem('studio_music_songs_' + pid) || '{}'); } catch {}

  const picker = document.getElementById('profilePicker');
  picker.classList.add('hiding');
  setTimeout(() => {
    picker.style.display = 'none';
    picker.classList.remove('hiding');
    showSongPicker(id, profileSongs);
  }, 480);
}

function addNewProfile() {
  _newProfileMode = true;
  // Close manage mode first
  document.getElementById('profilePicker')?.classList.remove('pp-manage-mode');
  document.getElementById('ppManageBtn') && (document.getElementById('ppManageBtn').textContent = '⚙ Verwalten');
  document.getElementById('ppManageBtn')?.classList.remove('active');
  showOnboarding();
}

function deleteProfile(id) {
  const profiles = getProfiles();
  const profile = profiles.find(p => p.id === id);
  const name = profile ? profile.name : 'dieses Profil';
  if (!confirm(`"${name}" löschen?\n\nAlle Songs dieses Profils gehen verloren.`)) return;

  const remaining = profiles.filter(p => p.id !== id);
  localStorage.setItem('studio_profiles', JSON.stringify(remaining));
  localStorage.removeItem('studio_music_songs_' + id);

  if (remaining.length === 0) {
    // No profiles left → clear active and show onboarding to create new one
    localStorage.removeItem('studio_active_profile');
    renderProfilePicker();
    _newProfileMode = true;
    showOnboarding();
  } else {
    // Switch active profile if deleted one was active
    if (getActiveProfileId() === id) {
      localStorage.setItem('studio_active_profile', remaining[0].id);
    }
    renderProfilePicker();
  }
}

// Show profile picker overlay (for switching profiles from within the app)
function switchProfile() {
  // Save current state first
  if (currentSongId) autoSave();
  renderProfilePicker();
  const picker = document.getElementById('profilePicker');
  picker.style.display = '';
  picker.style.opacity = '0';
  picker.classList.remove('hiding', 'pp-manage-mode');
  requestAnimationFrame(() => { picker.style.transition = 'opacity 0.3s'; picker.style.opacity = '1'; });
}

// ── Song Picker ──────────────────────────────────────
function showSongPicker(profileId, profileSongs) {
  const sp = document.getElementById('songPicker');
  sp.classList.add('visible');
  sp.style.opacity = '0';
  requestAnimationFrame(() => { sp.style.transition = 'opacity 0.35s'; sp.style.opacity = '1'; });

  // Show current profile badge
  const profiles = getProfiles();
  const profile = profiles.find(p => p.id === profileId) || {};
  const dot = document.getElementById('spProfileDot');
  if (dot) { dot.style.background = profile.color || '#7c3aed'; dot.textContent = getInitials(profile.name || 'A'); }
  const nameEl = document.getElementById('spProfileName');
  if (nameEl) nameEl.textContent = profile.name || 'Artist';

  // Hide new form
  document.getElementById('spNewForm').classList.remove('visible');
  document.getElementById('spNewTitle').value = '';

  // Render song cards
  const grid = document.getElementById('spGrid');
  const songIds = Object.keys(profileSongs);

  let html = `
    <div class="sp-song-card sp-new-card" onclick="spShowNewForm()">
      <div class="sp-new-icon">+</div>
      <div class="sp-new-label">Neues Lied</div>
    </div>`;

  if (songIds.length > 0) {
    songIds.slice().reverse().forEach(id => {
      const s = profileSongs[id];
      const phase = spGetPhaseLabel(s);
      const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString('de-DE', { day:'2-digit', month:'short', year:'2-digit' }) : '';
      html += `
        <div class="sp-song-card" onclick="spSelectSong('${id}')">
          <div class="sp-song-title">${escHtml(s.name || 'Unbekannt')}</div>
          <div class="sp-song-meta">
            ${date ? `<span>📅 ${date}</span>` : ''}
            ${s.p3_bpm ? `<span>🎵 ${s.p3_bpm} BPM</span>` : ''}
          </div>
          <div class="sp-song-phase">${phase}</div>
        </div>`;
    });
  }

  grid.innerHTML = html;
  // Store songs ref for use by spSelectSong
  sp._profileSongs = profileSongs;
}

function spGetPhaseLabel(song) {
  if (!song) return 'Neu';
  if (song.p2_lyrics && song.p2_lyrics.trim()) {
    if (song.p3_stil || song.p3_bpm !== 140) return '🎹 Beat & Sound';
    return '✍️ Lyrics';
  }
  if (song.p1_thema && song.p1_thema.trim()) return '💡 Konzept';
  return '🆕 Neu';
}

function spSelectSong(songId) {
  const sp = document.getElementById('songPicker');
  const profileSongs = sp._profileSongs || {};
  // Load this profile's songs into global songs object
  songs = profileSongs;
  sp.classList.add('hiding');
  setTimeout(() => {
    sp.classList.remove('visible', 'hiding');
    sp.style.opacity = '';
    enterFromSongPicker(songId);
  }, 350);
}

function spShowNewForm() {
  const form = document.getElementById('spNewForm');
  form.classList.add('visible');
  document.getElementById('spNewTitle').focus();
  // Scroll to top
  document.getElementById('songPicker').scrollTo({ top: 0, behavior: 'smooth' });
}

function spCancelNew() {
  document.getElementById('spNewForm').classList.remove('visible');
}

function spConfirmNew() {
  const raw = document.getElementById('spNewTitle').value.trim();
  if (!raw) {
    document.getElementById('spNewTitle').style.borderColor = 'var(--danger)';
    setTimeout(() => { document.getElementById('spNewTitle').style.borderColor = ''; }, 1500);
    return;
  }
  // Load profile songs first so createSong works correctly
  const sp = document.getElementById('songPicker');
  songs = sp._profileSongs || {};

  // Create song directly (bypass modal)
  const id = 'song_' + Date.now();
  const name = raw;
  songs[id] = {
    id, name,
    createdAt: new Date().toISOString(),
    p1_thema:'', p1_emotion:'', p1_sprache:'', p1_tonalitaet:'', p1_zielgruppe:'', p1_stil:'', p1_ai_result:'',
    p1_song_format:'solo', p1_female_voice:'', p1_duett_split:'', p1_sprache_split:'', p1_bez_modul:'',
    p2_konzept:'', p2_lyrics:'',
    p3_bpm:140, p3_key:'G minor', p3_stil:'', p3_mood:'', p3_instrumente:'', p3_ai_result:'', p3_suno_link:'', p3_feedback:'', p3_versions:[],
    p4_checklist:{}, p4_ai_result:'',
    p5_stimmung:'', p5_stil:'', p5_farben:'', p5_motiv:'', p5_ai_result:'',
    p6_konzept:'', p6_ai_result:'',
    p7_zusatz:'', p7_ai_result:'',
    song_notes:'', drive_link:'', materials:[],
    p8_audio_filename:'', p8_bpm:null, p8_transcription:'', p8_markers:[], p8_ai_result:'',
    p9_messages:[]
  };
  saveToStorage();

  sp.classList.add('hiding');
  setTimeout(() => {
    sp.classList.remove('visible', 'hiding');
    sp.style.opacity = '';
    enterFromSongPicker(id);
  }, 350);
}

function enterFromSongPicker(songId) {
  // Run app init then select the song
  initAfterProfile();
  // Select song after init renders the list
  requestAnimationFrame(() => {
    if (songs[songId]) selectSong(songId);
  });
  // Show intro launch gate
  const launch = document.getElementById('intro-launch');
  if (launch) launch.style.display = '';
}

function showProfilePicker() {
  // Hide song picker, show profile picker
  const sp = document.getElementById('songPicker');
  sp.classList.add('hiding');
  setTimeout(() => {
    sp.classList.remove('visible', 'hiding');
    sp.style.opacity = '';
  }, 350);
  renderProfilePicker();
  const picker = document.getElementById('profilePicker');
  picker.style.display = '';
  picker.style.opacity = '0';
  picker.classList.remove('hiding');
  requestAnimationFrame(() => { picker.style.transition = 'opacity 0.35s'; picker.style.opacity = '1'; });
}

// Apply profile data to all dynamic UI elements
function applyProfileToUI() {
  const p = getProfile();
  const tagline = [p.genre, p.city].filter(Boolean).join(' · ') || 'Music Studio';

  // Header / intro elements
  _setTxt('launch-artist-name',    p.name);
  _setTxt('launch-artist-sub',     tagline);
  _setTxt('intro-artist-handle',   p.handle || '');
  _setTxt('intro-artist-tagline',  tagline);
  _setTxt('topbar-artist-handle',  p.handle);

  // Song format buttons
  _setTxt('sfmt-solo-btn',  '🎤 Solo — Nur ' + p.name);
  _setTxt('sfmt-duett-btn', '🎤🎙️ Duett — ' + p.name + ' + Feature');

  // YouTube section
  _setTxt('yt-channel-name-display', p.handle || p.name);
  const ytBtn = document.getElementById('yt-open-channel-btn');
  if (ytBtn) ytBtn.title = p.youtubeHandle ? 'youtube.com/' + p.youtubeHandle : 'Kein YouTube Handle eingetragen';

  // Suno section
  const sunoUrl = document.getElementById('suno-profile-url');
  if (sunoUrl) sunoUrl.textContent = p.sunoHandle ? 'suno.com/' + p.sunoHandle : 'Kein Suno Handle eingetragen';

  document.title = 'D_a_N Studio — ' + p.name;
}

function _setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Open Suno profile in new tab
function openSunoProfile() {
  const p = getProfile();
  const handle = p.sunoHandle ? p.sunoHandle.replace(/^@/, '') : null;
  const url = handle ? 'https://suno.com/@' + handle : 'https://suno.com';
  window.open(url, '_blank');
}

// Open YouTube channel in new tab
function openYouTubeChannel() {
  const p = getProfile();
  const handle = p.youtubeHandle ? p.youtubeHandle.replace(/^@/, '') : null;
  const url = handle ? 'https://www.youtube.com/@' + handle : 'https://www.youtube.com';
  window.open(url, '_blank');
}

// ── Onboarding wizard ──
function showOnboarding() {
  document.getElementById('onboardingOverlay').classList.add('open');
  _obGoto(1);
}
function closeOnboarding() {
  document.getElementById('onboardingOverlay').classList.remove('open');
}
function _obGoto(step) {
  [1,2,3].forEach(s => {
    document.getElementById('ob-step-' + s)?.classList.toggle('active', s === step);
    document.getElementById('ob-dot-' + s)?.classList.toggle('active', s === step);
  });
  document.getElementById('ob-current-step').textContent = step;
}
function obNext(cur) {
  if (cur === 1) {
    const n = document.getElementById('ob_name').value.trim();
    if (!n) {
      const el = document.getElementById('ob_name');
      el.style.borderColor = 'var(--danger)';
      el.focus();
      setTimeout(() => { el.style.borderColor = ''; }, 1800);
      return;
    }
  }
  if (cur < 3) _obGoto(cur + 1);
}
function obBack(cur) { if (cur > 1) _obGoto(cur - 1); }
function obSkip() {
  // In new-profile mode, skip just cancels without creating
  if (_newProfileMode) { _newProfileMode = false; closeOnboarding(); return; }
  // Allow skipping only if a profile already exists
  if (hasProfile()) { closeOnboarding(); return; }
  // Save minimal placeholder so we don't re-show
  saveProfile({ name: 'Artist', handle: '', genre: '', city: '', sunoHandle: '', youtubeHandle: '' });
  closeOnboarding();
  applyProfileToUI();
}
function obFinish() {
  const name = document.getElementById('ob_name').value.trim();
  if (!name) { _obGoto(1); return; }
  const handle        = document.getElementById('ob_handle').value.trim();
  const genre         = document.getElementById('ob_genre').value.trim();
  const city          = document.getElementById('ob_city').value.trim();
  const sunoHandle    = document.getElementById('ob_suno').value.trim();
  const youtubeHandle = document.getElementById('ob_youtube').value.trim();

  if (_newProfileMode) {
    // Create brand-new profile entry
    const profiles = getProfiles();
    const color = PP_COLORS[profiles.length % PP_COLORS.length];
    const id = 'p_' + Date.now();
    profiles.push({ id, name, handle, genre, city, sunoHandle, youtubeHandle, color, createdAt: new Date().toISOString() });
    localStorage.setItem('studio_profiles', JSON.stringify(profiles));
    _newProfileMode = false;
    closeOnboarding();
    // If we're still on the picker (not yet in app), select and enter
    const picker = document.getElementById('profilePicker');
    if (picker && picker.style.display !== 'none') {
      renderProfilePicker();
      selectProfileAndEnter(id);
    } else {
      // Already in app — switch to new profile
      localStorage.setItem('studio_active_profile', id);
      songs = {}; renderSongList(); applyProfileToUI();
      showToast('Neues Profil "' + name + '" erstellt! 🎤', 'success');
    }
  } else {
    // Edit existing active profile
    saveProfile({ name, handle, genre, city, sunoHandle, youtubeHandle });
    const existing = JSON.parse(localStorage.getItem('studio_bio_profile') || '{}');
    if (!existing.name) localStorage.setItem('studio_bio_profile', JSON.stringify({ name, herkunft: city, text: '', ziele: '', stil: genre }));
    closeOnboarding();
    applyProfileToUI();
    showToast('Willkommen, ' + name + '! 🎤 Profil eingerichtet.', 'success');
  }
}
// Open wizard for profile editing (called from settings)
function openProfileSettings() {
  const p = getProfile();
  document.getElementById('ob_name').value    = p.name !== 'Artist' ? p.name : '';
  document.getElementById('ob_handle').value  = p.handle;
  document.getElementById('ob_genre').value   = p.genre;
  document.getElementById('ob_city').value    = p.city;
  document.getElementById('ob_suno').value    = p.sunoHandle;
  document.getElementById('ob_youtube').value = p.youtubeHandle;
  showOnboarding();
}

// =============================
// STATE
// =============================
let currentSongId = null;
let currentPhase = 1;
let songs = {};
let sidebarOpen = false;

const CHECKLIST_KEYS = ['idee','lyrics','beat','recording','editing','mixing','mastering','artwork','promo','release'];

// Manager state
const mgrMessages = {1:[],2:[],3:[],4:[],5:[],6:[],7:[],8:[]};
let selectedMatType = 'audio';
let pendingMatFile = null;
let ytApiKey = '';
const YT_CHANNEL_ID = 'UCc72jjvyE5AGgY4It7uLn-Q';

// ===========================
// OPTION PRESETS (A-Z)
// ===========================
const OPTION_PRESETS = {
  emotion: [
    // Basis
    'Aggressiv','Aufbruch','Bittersüß','Dankbarkeit','Depression','Einsamkeit','Entschlossenheit','Euphorie','Freude','Hoffnung','Hunger','Kraft','Melancholie','Nostalgie','Schmerz','Sehnsucht','Stolz','Trauer','Verlorenheit','Verzweiflung','Wut','Zuversicht',
    // Kennenlernen & Liebe
    'Herzrasen','Magie des ersten Moments','Unsicherheit','Maskentragen','Intimität','Vertrauen','Eifersucht','Co-Abhängigkeit',
    // Elternschaft & Familie
    'Väterlicher Stolz','Schutzinstinkt','Löwenmutter-Energie','Postpartale Leere','Existenzdruck','Vatersehnsucht','Wochenend-Papa-Schmerz',
    // Alltag & Beziehung
    'Vertraute Ruhe','Schweigendes Verständnis','Routine-Erschöpfung','Einsamkeit zu zweit','Unsichtbare Arbeit','Stiller Versorger',
    // Konflikt & Einsicht
    'Kampfgeist','Vergebung','Loslassen','Reue','Demut','Bittersüße Erleichterung',
    // Rosenkrieg & Danach
    'Kalte Distanz','Rosenkrieg','Respektvolle Elternschaft','Neuanfang','Traurige Erleichterung'
  ],
  stil: [
    // Genres / Stile
    '187 Strassenbande Stil','Afro Trap','Aggressive','Atmosphärisch','Boombap','Cloud Rap','Drill','Emo Rap','Gangsta Rap','German Trap','Hamburgrap','Hardcore Rap','Lo-Fi Hip Hop','Melodic Rap','OG Rap','Oldschool','Phonk','Pluggnb','Punchline Rap','Storytelling','Underground',
    // Deutschrap Subgenres (2024/2025)
    'Melodischer Herzschmerz-Rap','Aggressiver Drill DE','Sommer Afro-Trap DE','Post-Punk Synth-Pop DE','Modern Acoustic Pop DE','Techno-Rap / Rave-Pop','Urban Soul R&B DE','Chill-out Nachtfahrt','Conscious Rap DE',
    // Deutsche Rapper
    'Afrob','AK Ausserkontrolle','B-Tight','Bonez MC','Bushido','Capo','Capital Bra','Celo & Abdi','Chakuza','Curse','Eko Fresh','Farid Bang','Fard','Fler','Genetikk','Haftbefehl','KC Rebell','Kollegah','Kool Savas','LX','Manuellsen','Massiv','Maxwell','MC Bogy','MoTrip','Nimo','Olexesh','PA Sports','Samy Deluxe','Sido','Shindy','Ssio','Summer Cem','Ufo361',
    // US Rapper 90er
    '2Pac / Tupac','Big L','Big Pun','Biggie / Notorious B.I.G.','Busta Rhymes','Cypress Hill','DMX','Dr. Dre','E-40','Gang Starr','Ice Cube','Ice-T','Jay-Z','Kurupt','LL Cool J','Method Man','Mobb Deep','Nas','Outkast','Rakim','Redman','Scarface','Snoop Dogg','Wu-Tang Clan',
    // Weitere Referenzen
    'A Tribe Called Quest','Common','J Dilla','Kendrick Lamar','Lil Wayne','Rick Ross'
  ],
  zielgruppe: ['13-17 Jahre','18-24 Jahre','25-34 Jahre','35+ Jahre','Alle Altersgruppen','Frauen','Hip-Hop Fans','Jugendliche','Männer','Musikliebhaber','Partypeople','Streetwear-Szene'],
  mood: ['Aggressive','Atmospheric','Calm','Cinematic','Dark','Deep','Dramatic','Emotional','Energetic','Epic','Gritty','Hard','Heavy','Hypnotic','Intense','Melancholic','Menacing','Mysterious','Ominous','Raw','Relaxed','Sad','Smooth','Triumphant'],
  genre: ['Afrobeat','Afro Trap','Boom Bap','Cloud Rap','Conscious Rap','Dancehall','Drill','East Coast','Emo Rap','Gangsta Rap','German Trap','Hardcore Rap','Lo-Fi Hip Hop','Melodic Rap','NYC Drill','Oldschool Hip Hop','Phonk','Plugg','R&B Rap','Streetrap','Trap','UK Drill','West Coast'],
  instrumente: ['808s','Akustik-Gitarre','Bells','Brass','Choir','Claps','Distorted Guitar','Drums','E-Gitarre','Flute','FX Sounds','Hi-Hats','Kick Drum','Piano','Melodica','Oud','Pad Sounds','Saxophone','Shakers','Snare','Strings','Synth Bass','Synthesizer','Timpani','Trumpet','Violine','Xylophone'],
  stimmung: ['Aggressiv','Brutal','Dunkel','Düster','Elegant','Energetisch','Episch','Feierlich','Geheimnisvoll','Hoffnungsvoll','Kraftvoll','Melancholisch','Minimalistisch','Nostalgisch','Optimistisch','Poetisch','Rau','Romantisch','Stark','Triumphierend','Urban'],
  visual_stil: ['Abstract Art','Anime','Cinematic','Comic Art','Concept Art','Dark Fantasy','Digital Art','Film Noir','Futurism','Graffiti','Impressionism','Lo-Fi Art','Manga','Minimalist','Neon','Oil Painting','Photorealism','Pop Art','Street Art','Surrealism','Urban'],
  farben: ['Blau & Silber','Gold & Schwarz','Grün & Grau','Lila & Schwarz','Monochrom Schwarz','Monochrom Weiß','Neonfarben','Pastell','Rot & Schwarz','Rot & Weiß','Schwarz & Weiß','Schwarz Lila Gold','Sepia','Urban Grau'],
  motiv: ['Abstrakt','Cityscape','Dark Landscape','Figur im Gegenlicht','Gesicht / Portrait','Graffiti Wall','Gruppenaufnahme','Hände','Mikrofonaufnahme','Portrait','Silhouette','Skyline','Spotlight','Stadium / Crowd','Studio Setup','Symbolik','Urban Street'],
  tonalitaet: ['Aggressiv','Authentisch','Bescheiden','Direkt','Drohend','Dunkel','Düster','Ehrlich','Emotional','Episch','Euphorisch','Feierlich','Hoffnungsvoll','Humorvoll','Introvertiert','Ironisch','Kämpferisch','Kraftvoll','Melancholisch','Motivierend','Nachdenklich','Nostalgisch','Poetisch','Provokativ','Rau','Rebellisch','Sarkastisch','Sentimental','Stolz','Trotzig','Verletzlich','Wütend']
};

// =============================
// INIT
// =============================
document.addEventListener('DOMContentLoaded', () => {
  migrateStorageKeys();  // migrate to multi-profile if needed
  renderProfilePicker(); // show profile picker first

  // Keyboard shortcut (registered once globally)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentSongId) { saveSong(); showToast('Song gespeichert!', 'success'); }
    }
  });

  // Wire up step2 material checkboxes
  ['Audio','Video','Image','Drive'].forEach(t => {
    const cb = document.getElementById('matHas'+t);
    const inp = document.getElementById('mat'+t+'Note') || document.getElementById('mat'+t.charAt(0).toUpperCase()+t.slice(1)+'Link');
    if (cb && inp) cb.addEventListener('change', () => { inp.style.display = cb.checked ? 'block' : 'none'; });
  });
});

// Called after a profile is selected in the picker
function initAfterProfile() {
  applyProfileToUI();
  loadFromStorage();
  updateApiStatus();
  // Datum dynamisch setzen
  const el = document.getElementById('lastUpdated');
  if (el) {
    const now = new Date();
    const d = now.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});
    const t = now.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
    el.textContent = `▸ Stand: ${d} – ${t}`;
  }
  loadCloudConfig();
  loadTavilyKey();
  loadYtKey();
  renderSongList();
  initAllSelects();

  const apiKey = sessionStorage.getItem('studio_api_key') || localStorage.getItem('studio_api_key');
  if (apiKey && apiKey.startsWith('gsk_')) {
    document.getElementById('apiModal')?.classList.add('hidden');
  }

  const songIds = Object.keys(songs);
  if (songIds.length > 0) selectSong(songIds[0]);

  if (cloudConnected) {
    fullSync().then(() => {
      const ids = Object.keys(songs);
      if (ids.length > 0 && !currentSongId) selectSong(ids[0]);
    });
  }
}

// =============================
// CUSTOM SELECT SYSTEM
// =============================
function getCustomOpts(key) {
  try { return JSON.parse(localStorage.getItem('studio_co_' + key) || '[]'); } catch { return []; }
}
function saveCustomOpt(key, val) {
  const ex = getCustomOpts(key);
  if (!ex.includes(val)) { ex.push(val); localStorage.setItem('studio_co_' + key, JSON.stringify(ex)); }
}
function buildSelect(selId, key, currentVal) {
  const el = document.getElementById(selId);
  if (!el) return;
  const presets = OPTION_PRESETS[key] || [];
  const custom = getCustomOpts(key);
  const flatPresets = presets.flat ? presets.flat() : presets;
  const all = [...new Set([...flatPresets, ...custom])].sort((a,b) => a.localeCompare(b,'de'));
  const current = currentVal ? currentVal.split(',').map(v=>v.trim()).filter(Boolean) : [];
  // If already a multi-select wrap, just refresh options
  const existingWrap = el.tagName === 'INPUT' ? el.closest('.multi-sel-wrap') : null;
  if (existingWrap) {
    renderMultiSelOpts(selId, key, all, current, '');
    renderMultiSelTags(selId, current);
    return;
  }
  // Replace <select> with custom multi-select component
  const wrap = document.createElement('div');
  wrap.className = 'multi-sel-wrap';
  wrap.id = selId + '_wrap';
  wrap.innerHTML = `
    <input type="hidden" id="${selId}" value="${escHtml(current.join(','))}">
    <div class="multi-sel-box" id="${selId}_box" onclick="toggleMultiSel('${selId}')">
      <div class="multi-sel-tags" id="${selId}_tags"><span class="multi-sel-ph">-- Auswählen... --</span></div>
      <span class="multi-sel-arrow">▾</span>
    </div>
    <div class="multi-sel-drop hidden" id="${selId}_drop">
      <input class="multi-sel-search" placeholder="🔍 Suchen..." oninput="filterMultiSel('${selId}','${key}',this.value)">
      <div class="multi-sel-opts" id="${selId}_opts"></div>
      <div class="multi-sel-footer">
        <button onclick="event.stopPropagation();addCustomMultiOpt('${selId}','${key}')">➕ Eigene Option</button>
        <span class="multi-sel-count" id="${selId}_count"></span>
      </div>
    </div>`;
  el.parentNode.replaceChild(wrap, el);
  renderMultiSelOpts(selId, key, all, current, '');
  renderMultiSelTags(selId, current);
}
function renderMultiSelOpts(selId, key, all, current, filter) {
  const optsEl = document.getElementById(selId + '_opts');
  if (!optsEl) return;
  const f = filter.toLowerCase();
  const filtered = f ? all.filter(o => o.toLowerCase().includes(f)) : all;
  optsEl.innerHTML = filtered.map(o => {
    const sel = current.includes(o);
    return `<div class="multi-sel-opt${sel?' sel':''}" onclick="event.stopPropagation();toggleMultiOpt('${selId}','${escHtml(o).replace(/'/g,"\\'")}')">
      <input type="checkbox"${sel?' checked':''} onclick="event.stopPropagation();toggleMultiOpt('${selId}','${escHtml(o).replace(/'/g,"\\'")}')"> ${escHtml(o)}
    </div>`;
  }).join('');
}
function renderMultiSelTags(selId, current) {
  const tagsEl = document.getElementById(selId + '_tags');
  const countEl = document.getElementById(selId + '_count');
  if (!tagsEl) return;
  if (!current.length) {
    tagsEl.innerHTML = '<span class="multi-sel-ph">-- Auswählen... --</span>';
  } else {
    tagsEl.innerHTML = current.map(v =>
      `<span class="multi-sel-tag">${escHtml(v)}<span class="multi-sel-tag-x" onclick="event.stopPropagation();removeMultiOpt('${selId}','${escHtml(v).replace(/'/g,"\\'")}')">×</span></span>`
    ).join('');
  }
  if (countEl) countEl.textContent = current.length ? `${current.length} ausgewählt` : '';
}
function toggleMultiSel(selId) {
  const drop = document.getElementById(selId + '_drop');
  const box = document.getElementById(selId + '_box');
  if (!drop) return;
  const isOpen = !drop.classList.contains('hidden');
  // Close all other dropdowns
  document.querySelectorAll('.multi-sel-drop').forEach(d => {
    d.classList.add('hidden');
    const b = document.getElementById(d.id.replace('_drop','_box'));
    if (b) b.classList.remove('open');
  });
  if (!isOpen) {
    drop.classList.remove('hidden');
    box.classList.add('open');
    const searchEl = drop.querySelector('.multi-sel-search');
    if (searchEl) { searchEl.value = ''; searchEl.focus(); }
    const hidden = document.getElementById(selId);
    const current = hidden ? hidden.value.split(',').map(v=>v.trim()).filter(Boolean) : [];
    const key = drop.closest('.multi-sel-wrap')?.querySelector('[id$="_opts"]')?.id?.replace(selId+'_opts','') || '';
    refreshMultiSelOpts(selId, current, '');
  }
}
function refreshMultiSelOpts(selId, current, filter) {
  const optsEl = document.getElementById(selId + '_opts');
  if (!optsEl) return;
  optsEl.querySelectorAll('.multi-sel-opt').forEach(el => {
    const txt = el.textContent.trim();
    const sel = current.includes(txt);
    el.classList.toggle('sel', sel);
    const cb = el.querySelector('input[type=checkbox]');
    if (cb) cb.checked = sel;
    el.style.display = (!filter || txt.toLowerCase().includes(filter.toLowerCase())) ? '' : 'none';
  });
}
function filterMultiSel(selId, key, query) {
  const hidden = document.getElementById(selId);
  const current = hidden ? hidden.value.split(',').map(v=>v.trim()).filter(Boolean) : [];
  const presets = OPTION_PRESETS[key] || [];
  const flatPresets = presets.flat ? presets.flat() : presets;
  const custom = getCustomOpts(key);
  const all = [...new Set([...flatPresets, ...custom])].sort((a,b) => a.localeCompare(b,'de'));
  renderMultiSelOpts(selId, key, all, current, query);
}
function toggleMultiOpt(selId, value) {
  const hidden = document.getElementById(selId);
  if (!hidden) return;
  let current = hidden.value.split(',').map(v=>v.trim()).filter(Boolean);
  const idx = current.indexOf(value);
  if (idx >= 0) current.splice(idx, 1); else current.push(value);
  hidden.value = current.join(', ');
  renderMultiSelTags(selId, current);
  refreshMultiSelOpts(selId, current, document.querySelector('#'+selId+'_drop .multi-sel-search')?.value || '');
  autoSave();
  updateNavLocks();
}
function removeMultiOpt(selId, value) {
  toggleMultiOpt(selId, value);
}
function addCustomOpt(selId, key) {
  addCustomMultiOpt(selId, key);
}
function addCustomMultiOpt(selId, key) {
  const val = prompt('Eigene Option eingeben:');
  if (!val?.trim()) return;
  const v = val.trim();
  saveCustomOpt(key, v);
  // Re-build opts and select the new value
  const presets = OPTION_PRESETS[key] || [];
  const flatPresets = presets.flat ? presets.flat() : presets;
  const custom = getCustomOpts(key);
  const all = [...new Set([...flatPresets, ...custom])].sort((a,b) => a.localeCompare(b,'de'));
  const hidden = document.getElementById(selId);
  const current = hidden ? hidden.value.split(',').map(x=>x.trim()).filter(Boolean) : [];
  renderMultiSelOpts(selId, key, all, current, '');
  toggleMultiOpt(selId, v);
}
function onSelChange(selId, key) { /* legacy no-op */ }
// Close dropdowns on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.multi-sel-wrap')) {
    document.querySelectorAll('.multi-sel-drop').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.multi-sel-box').forEach(b => b.classList.remove('open'));
  }
});
function initAllSelects() {
  const map = [
    ['p1_emotion','emotion'],['p1_tonalitaet','tonalitaet'],['p1_zielgruppe','zielgruppe'],['p1_stil','stil'],
    ['p3_mood','mood'],['p3_stil','genre'],['p3_instrumente','instrumente'],
    ['p5_stimmung','stimmung'],['p5_stil','visual_stil'],['p5_farben','farben'],['p5_motiv','motiv']
  ];
  map.forEach(([id, key]) => buildSelect(id, key, ''));
}

// =============================
// CROSS-PHASE SONG BRIEFING
// =============================
function getFullSongContext(songId) {
  const song = songs[songId || currentSongId];
  if (!song) return '';
  const p = getProfile();
  const lines = [`\n\n---\n📋 SONG-BRIEFING: "${song.name}" von ${p.name || 'Künstler'}`];

  // Phase 1 – Konzept (Ace)
  const hasP1 = song.p1_thema || song.p1_emotion || song.p1_ai_result;
  if (hasP1) {
    lines.push(`\n🎯 ACE (A&R) hat erarbeitet:`);
    if (song.p1_thema)      lines.push(`  Thema: ${song.p1_thema}`);
    if (song.p1_emotion)    lines.push(`  Emotion: ${song.p1_emotion}`);
    if (song.p1_sprache)    lines.push(`  Sprache: ${song.p1_sprache}`);
    if (song.p1_tonalitaet) lines.push(`  Tonalität: ${song.p1_tonalitaet}`);
    if (song.p1_song_format)lines.push(`  Format: ${song.p1_song_format}`);
    if (song.p1_ai_result)  lines.push(`  Konzept:\n${song.p1_ai_result.substring(0, 400)}`);
  }

  // Phase 2 – Lyrics (Ink)
  if (song.p2_lyrics) {
    lines.push(`\n✍️ INK (Songwriter) hat geschrieben:`);
    lines.push(`${song.p2_lyrics.substring(0, 500)}`);
  }

  // Phase 3 – Beat (Beat-Doc)
  const hasP3 = song.p3_bpm || song.p3_key || song.p3_ai_result || song.p8_bpm;
  if (hasP3) {
    lines.push(`\n🎹 BEAT-DOC (Producer) hat festgelegt:`);
    if (song.p3_bpm || song.p8_bpm) lines.push(`  BPM: ${song.p3_bpm || song.p8_bpm}`);
    if (song.p3_key)        lines.push(`  Tonart: ${song.p3_key}`);
    if (song.p3_ai_result)  lines.push(`  Suno-Prompt:\n${song.p3_ai_result.substring(0, 300)}`);
  }

  // Phase 5 – Artwork (Iris)
  if (song.p5_ai_result) {
    lines.push(`\n🎨 IRIS (Creative Director) hat entwickelt:`);
    lines.push(`${song.p5_ai_result.substring(0, 250)}`);
  }

  // Phase 6 – Promo (Hype)
  if (song.p6_ai_result) {
    lines.push(`\n📱 HYPE (Marketing) hat geplant:`);
    lines.push(`${song.p6_ai_result.substring(0, 200)}`);
  }

  // Phase 7 – YouTube (Grid)
  if (song.p7_ai_result) {
    lines.push(`\n▶️ GRID (Distribution) hat vorbereitet:`);
    lines.push(`${song.p7_ai_result.substring(0, 200)}`);
  }

  lines.push(`\n---\nNutze dieses Briefing – du weißt was deine Kollegen bereits erarbeitet haben. Baue darauf auf.`);
  return lines.join('\n');
}

// =============================
// TEAM CARD INJECTION
// =============================
const _visitedPhases = new Set();

function injectTeamCard(phaseNum) {
  const member = TEAM[phaseNum];
  if (!member) return;
  const panel = document.getElementById('phase' + phaseNum);
  if (!panel) return;

  // Remove old card if exists
  const old = panel.querySelector('.team-card');
  if (old) old.remove();

  const isFirstVisit = !_visitedPhases.has(phaseNum);
  _visitedPhases.add(phaseNum);

  const introText = isFirstVisit
    ? member.intro
    : `${member.name} hier. Was kann ich für dich tun?`;

  const card = document.createElement('div');
  card.className = 'team-card';
  card.style.setProperty('--team-color', member.color);
  card.innerHTML = `
    <div class="team-avatar">${member.emoji}</div>
    <div class="team-info">
      <div class="team-name">${member.name}</div>
      <div class="team-role">${member.role}</div>
      <div class="team-intro-text" id="teamIntro${phaseNum}">"${introText}"</div>
    </div>
    <button class="team-card-toggle" onclick="this.previousElementSibling.querySelector('.team-intro-text').style.display = this.previousElementSibling.querySelector('.team-intro-text').style.display==='none'?'block':'none'; this.textContent = this.textContent==='▲'?'▼':'▲';">▲</button>
  `;

  // Insert before first child of panel
  panel.insertBefore(card, panel.firstChild);
}

function getSongFormatContext() {
  const s = (currentSongId && songs[currentSongId]) || {};
  const fmt = s.p1_song_format || 'solo';
  const sprache = s.p1_sprache || 'Deutsch';
  const bezMod = s.p1_bez_modul || '';
  const _pCtx = getProfile();
  let ctx = '';

  // Language
  if (sprache === 'Deutsch+Italiano') {
    const split = s.p1_sprache_split || 'Beide Sprachen durchgemischt';
    ctx += `\nSprache: Deutsch und Italiano gemischt (${split}). ${_pCtx.name} singt/rappt auf Deutsch, Italienische Passagen fließen natürlich ein.`;
  } else if (sprache === 'Italiano') {
    ctx += `\nSprache: Italiano. Lyrics vollständig auf Italienisch, ${_pCtx.name}s Stil bleibt erhalten.`;
  } else {
    ctx += `\nSprache: Deutsch.`;
  }

  // Song format
  if (fmt === 'duett') {
    const femVoice = s.p1_female_voice || 'Sanft-emotional';
    const split = (s.p1_duett_split || 'Verse ich / Hook Feature').replace(/\bich\b/g, _pCtx.name);
    ctx += `\nSong-Format: DUETT (${_pCtx.name} + Feature-Stimme). ${_pCtx.name} ist die Hauptstimme und führt die Hauptverse. Die Feature-Stimme (${femVoice}) übernimmt: ${split}. ${_pCtx.name}s Perspective ist dominant — die Feature-Stimme ist Kontrast oder Ergänzung.`;
  } else {
    ctx += `\nSong-Format: SOLO — ausschließlich ${_pCtx.name}s Stimme.`;
  }

  // Beziehungs-Modul
  if (bezMod && BEZ_MODULE[bezMod]) {
    const m = BEZ_MODULE[bezMod];
    ctx += `\nBeziehungs-Kontext: ${m.title}. Emotionale Lichtseite: ${m.licht.emo}. Schattenseite: ${m.schatten.emo}.`;
  }

  return ctx;
}

let iwHistory = [];
let iwQuestionCount = 0;
let iwParsedKonzept = null;

function handleIwIdeaKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startIdeenWorkshop(); }
}

function handleIwKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendIdeenAntwort(); }
}

function iwShowView(view) {
  document.getElementById('iwViewIdle').style.display = view === 'idle' ? '' : 'none';
  document.getElementById('iwViewChat').style.display = view === 'chat' ? '' : 'none';
  document.getElementById('iwViewDone').style.display = view === 'done' ? '' : 'none';
}

function iwUpdateProgress(q) {
  const pct = Math.min(100, q * 20);
  const fill = document.getElementById('iwProgressFill');
  const text = document.getElementById('iwProgressText');
  const badge = document.getElementById('iwBadge');
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = q < 5 ? `Frage ${q} von 5` : 'Fast fertig…';
  if (badge) badge.textContent = q < 5 ? `Schritt ${q+1}/5` : 'Schritt 5/5';
}

function iwAppendMsg(role, text, tempId) {
  const box = document.getElementById('iwChatMsgs');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'iw-msg ' + (role === 'user' ? 'user' : 'ai');
  if (tempId) div.id = tempId;
  const t = new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  div.innerHTML = `<div>${text === '⏳ …' ? text : escHtml(text).replace(/\n/g,'<br>')}</div><div class="iw-msg-time">${t}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function startIdeenWorkshop() {
  const input = document.getElementById('iwIdeaInput');
  const idea = input ? input.value.trim() : '';
  if (!idea) { showToast('Bitte erst deine Idee eingeben!', 'error'); return; }

  const btn = document.getElementById('iwStartBtn');
  if (btn) btn.disabled = true;

  // Switch to chat view
  iwHistory = [];
  iwQuestionCount = 0;
  iwParsedKonzept = null;
  document.getElementById('iwChatMsgs').innerHTML = '';
  iwShowView('chat');
  iwUpdateProgress(0);

  // Show user's idea as first message
  iwAppendMsg('user', idea);
  iwHistory.push({ role: 'user', content: idea });

  // Get first question from AI
  const thinkId = 'iw_think_' + Date.now();
  iwAppendMsg('ai', '⏳ …', thinkId);
  document.getElementById('iwSendBtn').disabled = true;

  try {
    const reply = await callClaudeChat(
      [{ role: 'user', content: idea }],
      IW_SYSTEM_PROMPT
    );
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.remove();

    const konzept = iwExtractKonzept(reply);
    if (konzept) {
      iwFinalize(konzept, reply);
    } else {
      iwQuestionCount++;
      iwUpdateProgress(iwQuestionCount);
      iwHistory.push({ role: 'assistant', content: reply });
      iwAppendMsg('ai', reply);
      iwSaveState();
    }
  } catch(err) {
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.remove();
    iwAppendMsg('ai', 'Fehler: ' + err.message);
  } finally {
    const sendBtn = document.getElementById('iwSendBtn');
    if (sendBtn) sendBtn.disabled = false;
    if (btn) btn.disabled = false;
  }
}

async function sendIdeenAntwort() {
  const input = document.getElementById('iwAnswerInput');
  const sendBtn = document.getElementById('iwSendBtn');
  const ans = input ? input.value.trim() : '';
  if (!ans) return;
  if (input) input.value = '';

  iwAppendMsg('user', ans);
  iwHistory.push({ role: 'user', content: ans });
  iwSaveState();

  if (sendBtn) sendBtn.disabled = true;
  const thinkId = 'iw_think_' + Date.now();
  iwAppendMsg('ai', '⏳ …', thinkId);

  try {
    const msgs = iwHistory.map(h => ({ role: h.role, content: h.content }));
    const reply = await callClaudeChat(msgs, IW_SYSTEM_PROMPT);
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.remove();

    const konzept = iwExtractKonzept(reply);
    if (konzept) {
      iwHistory.push({ role: 'assistant', content: reply });
      iwFinalize(konzept, reply);
    } else {
      iwQuestionCount++;
      iwUpdateProgress(iwQuestionCount);
      iwHistory.push({ role: 'assistant', content: reply });
      iwAppendMsg('ai', reply);
      iwSaveState();
    }
  } catch(err) {
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.remove();
    iwAppendMsg('ai', 'Fehler: ' + err.message);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

function iwExtractKonzept(text) {
  // Accept both single and double brackets: [[KONZEPT]] or [KONZEPT]
  let m = text.match(/\[{1,2}KONZEPT\]{1,2}([\s\S]*?)\[{1,2}\/KONZEPT\]{1,2}/);
  if (m) {
    try { const p = JSON.parse(m[1].trim()); if (p && p.thema) return p; } catch(e) {}
  }
  // Fallback: find the outermost { ... } block that contains "thema" and "konzept_text"
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const p = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      if (p && p.thema && p.konzept_text) return p;
    } catch(e) {}
  }
  return null;
}

function iwFinalize(konzept, rawReply) {
  iwParsedKonzept = konzept;

  // Show last AI message without the [[KONZEPT]]...[[/KONZEPT]] block
  const cleanReply = rawReply.replace(/\[\[KONZEPT\]\][\s\S]*?\[\[\/KONZEPT\]\]/, '').trim();
  if (cleanReply) iwAppendMsg('ai', cleanReply);

  // Build done view
  const box = document.getElementById('iwKonzeptBox');
  if (box) {
    const fields = [
      ['Thema', konzept.thema],
      ['Emotion', konzept.emotion],
      ['Tonalität', konzept.tonalitaet],
      ['Zielgruppe', konzept.zielgruppe],
      ['Stil', konzept.stil],
    ].filter(([,v]) => v);
    box.innerHTML = fields.map(([l,v]) =>
      `<div class="iw-konzept-field"><span class="iw-konzept-label">${l}</span><span class="iw-konzept-value">${escHtml(v)}</span></div>`
    ).join('') + (konzept.konzept_text ? `<div class="iw-konzept-text-block">${escHtml(konzept.konzept_text)}</div>` : '');
  }

  // Update badge
  const badge = document.getElementById('iwBadge');
  if (badge) { badge.textContent = '✅ Fertig'; badge.style.background = 'rgba(16,185,129,0.15)'; badge.style.borderColor = 'rgba(16,185,129,0.3)'; badge.style.color = 'var(--success)'; }

  // Switch view after a small delay so the last message is visible
  setTimeout(() => iwShowView('done'), 800);
  iwSaveState();
}

function applyIdeenKonzept() {
  if (!iwParsedKonzept) return;
  const k = iwParsedKonzept;

  if (k.thema) { const el = document.getElementById('p1_thema'); if (el) el.value = k.thema; }

  // For select-with-add fields: inject as custom option if not already there
  function injectSelect(id, val) {
    if (!val) return;
    const sel = document.getElementById(id);
    if (!sel) return;
    let found = false;
    for (const opt of sel.options) { if (opt.value === val) { found = true; break; } }
    if (!found) { const o = new Option(val, val); sel.appendChild(o); }
    sel.value = val;
  }

  injectSelect('p1_emotion', k.emotion);
  injectSelect('p1_tonalitaet', k.tonalitaet);
  injectSelect('p1_zielgruppe', k.zielgruppe);
  injectSelect('p1_stil', k.stil);

  // Fill p2_konzept with the concept text
  if (k.konzept_text) {
    const p2 = document.getElementById('p2_konzept');
    if (p2 && !p2.value.trim()) p2.value = k.konzept_text;
  }

  // Auto-detect language from concept text
  if (!document.getElementById('p1_sprache').value) {
    const allText = [k.thema, k.emotion, k.tonalitaet, k.zielgruppe, k.stil, k.konzept_text].join(' ').toLowerCase();
    if (/italian|italiano/.test(allText) && /deutsch|german/.test(allText)) {
      document.getElementById('p1_sprache').value = 'Deutsch+Italiano';
    } else if (/\bitaliano\b|\bitalien/.test(allText)) {
      document.getElementById('p1_sprache').value = 'Italiano';
    }
  }

  autoSave();
  updateNavLocks();
}

function applyAndProceed() {
  applyIdeenKonzept();

  // Scroll to the Eingaben card so user can see filled fields and pick language
  setTimeout(() => {
    const eingaben = document.querySelector('#phase1 .card:has(#p1_thema)') ||
                     document.getElementById('p1_thema')?.closest('.card');
    if (eingaben) eingaben.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // If Sprache is still empty, highlight it with a pulsing border
    const sprache = document.getElementById('p1_sprache');
    if (sprache && !sprache.value) {
      sprache.classList.add('field-needs-attention');
      showToast('✅ Konzept übernommen! Wähle noch die Sprache — dann kannst du zu Lyrics weiter.', 'success');
      setTimeout(() => sprache.classList.remove('field-needs-attention'), 4000);
    } else {
      showToast('✅ Alles ausgefüllt! Klicke "Weiter: Lyrics schreiben →"', 'success');
      // Highlight the next-step button
      const nextBtn = document.querySelector('#phase1 .btn-phase-next');
      if (nextBtn) {
        nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nextBtn.classList.add('btn-phase-next--highlight');
        setTimeout(() => nextBtn.classList.remove('btn-phase-next--highlight'), 3000);
      }
    }
  }, 400);
}

function resetIdeenWorkshop() {
  iwHistory = [];
  iwQuestionCount = 0;
  iwParsedKonzept = null;

  const ideaInput = document.getElementById('iwIdeaInput');
  if (ideaInput) ideaInput.value = '';
  const chatMsgs = document.getElementById('iwChatMsgs');
  if (chatMsgs) chatMsgs.innerHTML = '';
  const badge = document.getElementById('iwBadge');
  if (badge) { badge.textContent = 'Schritt 1/5'; badge.style.background = ''; badge.style.borderColor = ''; badge.style.color = ''; }
  iwUpdateProgress(0);
  iwShowView('idle');
  iwSaveState();
}

function iwSaveState() {
  if (!currentSongId || !songs[currentSongId]) return;
  songs[currentSongId].iw_history = iwHistory;
  songs[currentSongId].iw_q_count = iwQuestionCount;
  songs[currentSongId].iw_konzept = iwParsedKonzept;
  saveToStorage();
}

function iwLoadState(song) {
  iwHistory = song.iw_history || [];
  iwQuestionCount = song.iw_q_count || 0;
  iwParsedKonzept = song.iw_konzept || null;

  // Reset badge
  const badge = document.getElementById('iwBadge');
  if (badge) { badge.textContent = 'Schritt 1/5'; badge.style.background = ''; badge.style.borderColor = ''; badge.style.color = ''; }

  if (iwParsedKonzept) {
    // Restore done state
    const box = document.getElementById('iwKonzeptBox');
    if (box) {
      const k = iwParsedKonzept;
      const fields = [
        ['Thema', k.thema], ['Emotion', k.emotion], ['Tonalität', k.tonalitaet],
        ['Zielgruppe', k.zielgruppe], ['Stil', k.stil],
      ].filter(([,v]) => v);
      box.innerHTML = fields.map(([l,v]) =>
        `<div class="iw-konzept-field"><span class="iw-konzept-label">${l}</span><span class="iw-konzept-value">${escHtml(v)}</span></div>`
      ).join('') + (k.konzept_text ? `<div class="iw-konzept-text-block">${escHtml(k.konzept_text)}</div>` : '');
    }
    if (badge) { badge.textContent = '✅ Fertig'; badge.style.background = 'rgba(16,185,129,0.15)'; badge.style.borderColor = 'rgba(16,185,129,0.3)'; badge.style.color = 'var(--success)'; }
    iwShowView('done');
  } else if (iwHistory.length > 0) {
    // Restore chat state
    const chatMsgs = document.getElementById('iwChatMsgs');
    if (chatMsgs) {
      chatMsgs.innerHTML = '';
      iwHistory.forEach(h => iwAppendMsg(h.role === 'user' ? 'user' : 'ai', h.content));
    }
    iwUpdateProgress(iwQuestionCount);
    iwShowView('chat');
  } else {
    iwShowView('idle');
  }
}

// Phase 1
async function generatePhase1() {
  const thema = document.getElementById('p1_thema').value.trim();
  const emotion = document.getElementById('p1_emotion')?.value || '';
  const zielgruppe = document.getElementById('p1_zielgruppe')?.value || '';
  const stil = document.getElementById('p1_stil')?.value || '';

  // Include materials context
  const mats = (currentSongId && songs[currentSongId]?.materials) || [];
  const matCtx = mats.length > 0 ? `\n\nVorhandene Materialien: ${mats.map(m => m.type + ': ' + m.note).join(', ')}` : '';

  if (!thema && !emotion) { showToast('Bitte mindestens Thema und Emotion ausfüllen!', 'error'); return; }

  const fmtCtx = getSongFormatContext();
  const _p1 = getProfile();
  const prompt = `Du bist ein erfahrener Musikproduzent und A&R. Entwickle ein detailliertes Song-Konzept für ${_p1.name}${_p1.genre ? ' (' + _p1.genre + ')' : ''} basierend auf: Thema: ${thema || 'offen'}, Emotion: ${emotion || 'offen'}, Zielgruppe: ${zielgruppe || 'allgemein'}, Stil/Einflüsse: ${stil || _p1.genre || 'Musik'}.${matCtx}${fmtCtx}\n\nErstelle: 3 Titel-Vorschläge, eine Storyline (3-4 Sätze), die emotionale Botschaft, Stimmungsbeschreibung, und konkrete Bild/Metapher-Vorschläge für die Lyrics.`;

  setLoading('p1_spinner_icon', 'p1_btn_text', true, '✨', 'Mit KI generieren');
  try {
    const result = await callClaude(prompt);
    showResult('p1_result', 'p1_result_content', result);
    saveField('p1_ai_result', result);
    showToast('Konzept generiert!', 'success');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    setLoading('p1_spinner_icon', 'p1_btn_text', false, '✨', 'Mit KI generieren');
  }
}

// Phase 2
async function generatePhase2() {
  const konzept = document.getElementById('p2_konzept').value.trim();
  if (!konzept) { showToast('Bitte Konzept/Briefing eingeben!', 'error'); return; }

  const fmtCtx = getSongFormatContext();
  const s = (currentSongId && songs[currentSongId]) || {};
  const fmt = s.p1_song_format || 'solo';
  const isDuett = fmt === 'duett';
  const duettSplit = s.p1_duett_split || 'Verse ich / Hook Feature';
  const sprache = s.p1_sprache || 'Deutsch';
  const _p2 = getProfile();

  let structureNote = 'Schreibe: Intro (4 Zeilen), Verse 1 (16 Zeilen), Hook (8 Zeilen, catchy und eingängig), Verse 2 (16 Zeilen), Bridge (8 Zeilen), Outro (4 Zeilen).';
  if (isDuett) {
    structureNote += ` DUETT-STRUKTUR: ${duettSplit.replace(/ich/g, _p2.name)}. Markiere ${_p2.name}-Passagen mit [${_p2.name}] und Feature-Passagen mit [Feature]. ${_p2.name} singt/rappt die Hauptverse. Das Feature singt/rappt seinen Teil — klare Abgrenzung im Text.`;
  }

  let sprachNote = 'Authentischer Stil, Reime, keine Klischees.';
  if (sprache === 'Deutsch+Italiano') {
    const sprSplit = s.p1_sprache_split || 'Beide Sprachen durchgemischt';
    sprachNote = `Sprachaufteilung: ${sprSplit}. Zeilen fließen natürlich ineinander über. Reime funktionieren jeweils in der eigenen Sprache.`;
  } else if (sprache === 'Italiano') {
    sprachNote = `Lyrics vollständig auf Italienisch. ${_p2.name}s authentischer Stil, echte Reime auf Italienisch.`;
  }

  const prompt = `Du bist ein professioneller Songtexter. Schreibe komplette Song-Lyrics für ${_p2.name}${_p2.genre ? ' (' + _p2.genre + ')' : ''}. Konzept: ${konzept}.${fmtCtx}\n\n${structureNote} ${sprachNote}`;

  setLoading('p2_spinner_icon', 'p2_btn_text', true, '✨', 'Mit KI generieren');
  try {
    const result = await callClaude(prompt);
    document.getElementById('p2_lyrics').value = result;
    autoSave();
    updateLyricsCounter();
    showToast('Lyrics generiert!', 'success');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    setLoading('p2_spinner_icon', 'p2_btn_text', false, '✨', 'Mit KI generieren');
  }
}

async function regenerateLyrics() {
  await generatePhase2();
}

async function addVerse() {
  const existingLyrics = document.getElementById('p2_lyrics').value.trim();
  if (!existingLyrics) { showToast('Erst Lyrics generieren!', 'error'); return; }
  const konzept = document.getElementById('p2_konzept').value.trim();

  const _pAV = getProfile();
  const prompt = `Du bist ein professioneller Songtexter. Hier sind bestehende Lyrics für ${_pAV.name}:\n\n${existingLyrics}\n\nKonzept: ${konzept}\n\nFüge eine weitere Strophe (Verse 3, 16 Zeilen) hinzu, die perfekt zum bestehenden Song passt. Schreibe NUR die neue Strophe mit dem Label [Verse 3] davor.`;

  const btn = document.querySelector('[onclick="addVerse()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generiere...'; }
  try {
    const result = await callClaude(prompt);
    const lyrics = document.getElementById('p2_lyrics');
    lyrics.value = existingLyrics + '\n\n' + result;
    autoSave();
    updateLyricsCounter();
    showToast('Strophe hinzugefügt!', 'success');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '+ Strophe hinzufügen'; }
  }
}

function initBeatStudio() {
  const seq = document.getElementById('bsSequencer');
  if (!seq) return;
  seq.innerHTML = BS_ROWS.map((row, ri) =>
    `<div class="bs-row">
      <div class="bs-label">${row.label}</div>
      ${Array.from({length:16}, (_,si) =>
        `<div class="bs-step${_bsPatterns[ri][si]?' on':''}"
              style="--bs-color:${row.color}"
              data-row="${ri}" data-step="${si}"
              onclick="toggleBsStep(this,${ri},${si})"></div>`
      ).join('')}
    </div>`
  ).join('');
}

function toggleBsStep(el, ri, si) {
  _bsPatterns[ri][si] = _bsPatterns[ri][si] ? 0 : 1;
  el.classList.toggle('on', !!_bsPatterns[ri][si]);
}

function toggleBeatStudio() {
  const btn = document.getElementById('bsPlayBtn');
  if (_bsPlaying) {
    _bsPlaying = false;
    clearInterval(_bsInterval);
    _bsInterval = null;
    if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
    // Clear playhead highlight
    document.querySelectorAll('.bs-step.active').forEach(el => el.classList.remove('active'));
  } else {
    _bsPlaying = true;
    _bsStep = 0;
    if (btn) { btn.textContent = '■'; btn.classList.add('playing'); }
    const bpm = parseInt(document.getElementById('p3_bpm')?.value || 140);
    const ms = Math.round(60000 / bpm / 4); // 16th note
    _bsInterval = setInterval(bsTickStep, ms);
    bsTickStep();
  }
}

function bsTickStep() {
  // Remove prev highlight
  document.querySelectorAll('.bs-step.active').forEach(el => el.classList.remove('active'));
  // Highlight current column + flash if on
  BS_ROWS.forEach((_, ri) => {
    const els = document.querySelectorAll(`.bs-row:nth-child(${ri+1}) .bs-step`);
    if (els[_bsStep]) {
      els[_bsStep].classList.add('active');
      if (_bsPatterns[ri][_bsStep]) els[_bsStep].classList.add('flash');
    }
  });
  _bsStep = (_bsStep + 1) % 16;
  // Sync BPM display
  const bpmNum = document.getElementById('bsBpmNum');
  if (bpmNum) bpmNum.textContent = document.getElementById('p3_bpm')?.value || 140;
}

function setBsGenre(btn, genre) {
  document.querySelectorAll('.bs-genre-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Apply to p3_stil (custom multi-select hidden input)
  const hidden = document.getElementById('p3_stil');
  if (hidden) {
    // Add genre if not already present
    let current = hidden.value.split(',').map(v => v.trim()).filter(Boolean);
    if (!current.includes(genre)) {
      current.push(genre);
      hidden.value = current.join(', ');
      renderMultiSelTags('p3_stil', current);
    }
    autoSave();
  }
  showToast(`Genre: ${genre}`, 'success');
}

// Sync BPM display when slider changes
function updateBsBpm() {
  const v = document.getElementById('p3_bpm')?.value || 140;
  const el = document.getElementById('bsBpmNum');
  if (el) el.textContent = v;
  const keyEl = document.getElementById('bsKeyDisplay');
  if (keyEl) keyEl.textContent = document.getElementById('p3_key')?.value || 'G minor';
  if (_bsPlaying) {
    clearInterval(_bsInterval);
    const ms = Math.round(60000 / parseInt(v) / 4);
    _bsInterval = setInterval(bsTickStep, ms);
  }
}

// Phase 3
function updateBpmDisplay() {
  document.getElementById('p3_bpm_val').textContent = document.getElementById('p3_bpm').value;
}

async function generatePhase3() {
  const song = songs[currentSongId] || {};
  const bpm = document.getElementById('p3_bpm').value;
  const key = document.getElementById('p3_key').value;
  const stil = document.getElementById('p3_stil')?.value || '';
  const mood = document.getElementById('p3_mood')?.value || '';
  const instrumente = document.getElementById('p3_instrumente')?.value || '';

  const konzeptCtx = song.p1_ai_result ? `\n\nSong-Konzept (Phase 1):\n${song.p1_ai_result}` : '';
  const lyricsCtx = song.p2_lyrics ? `\n\nLyrics (Phase 2):\n${song.p2_lyrics}` : '';

  const fmtCtx = getSongFormatContext();
  const fmt = song.p1_song_format || 'solo';
  const isDuett = fmt === 'duett';
  const sprache = song.p1_sprache || 'Deutsch';
  const langNote = sprache === 'Deutsch+Italiano' ? 'german-italian mixed language rap' : sprache === 'Italiano' ? 'italian rap' : 'german rap';
  const _pBeat = getProfile();
  const duettNote = isDuett ? `, featuring contrasting female voice (${song.p1_female_voice || 'soft emotional'}) — ${_pBeat.name} leads all verses, female voice on hooks/bridge only` : ', solo vocals only';

  const prompt = `Create a detailed Suno AI music prompt in English for a ${langNote} song${duettNote}. Style: ${stil || _pBeat.genre || 'Rap'}, BPM: ${bpm}, Key: ${key}, Mood: ${mood || 'dark'}, Instruments: ${instrumente || '808s, hi-hats, piano'}.${konzeptCtx}${lyricsCtx}${fmtCtx}\n\nInclude: genre tags, mood descriptors, instrument specifications, production style, vocal style guidance for the lead artist${isDuett ? ' and the feature counterpart role' : ''}. Format it as a ready-to-paste Suno prompt.`;

  setLoading('p3_spinner_icon', 'p3_btn_text', true, '✨', 'Suno Prompt generieren');
  try {
    const result = await callClaude(prompt);
    showResult('p3_result', 'p3_result_content', result);
    saveField('p3_ai_result', result);
    showToast('Suno Prompt generiert!', 'success');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    setLoading('p3_spinner_icon', 'p3_btn_text', false, '✨', 'Suno Prompt generieren');
  }
}

async function improveSunoPrompt() {
  const song = songs[currentSongId] || {};
  // Read from saved state first, fall back to DOM
  const currentPrompt = song.p3_ai_result?.trim() || document.getElementById('p3_result_content').textContent.trim();
  const feedback = document.getElementById('p3_feedback').value.trim();

  if (!currentPrompt) { showToast('Zuerst einen Suno Prompt generieren!', 'error'); return; }
  if (!feedback) { showToast('Bitte Feedback eingeben was verbessert werden soll!', 'error'); return; }

  const konzeptCtx = song.p1_ai_result ? `\nKonzept: ${song.p1_ai_result}` : '';
  const lyricsCtx = song.p2_lyrics ? `\nLyrics: ${song.p2_lyrics}` : '';

  const prompt = `Du bist ein Experte für Suno AI Prompts.\n\nSong: ${song.name || 'Unbekannt'}${konzeptCtx}${lyricsCtx}\n\nAktueller Suno-Prompt:\n${currentPrompt}\n\nFeedback / Was verbessert werden soll:\n${feedback}\n\nErstelle einen verbesserten Suno-Prompt der das Feedback berücksichtigt. Nutze alle Song-Infos für maximale Qualität. Gib nur den fertigen Prompt zurück, keinen Erklärungstext.`;

  setLoading('p3_improve_icon', 'p3_improve_text', true, '🔄', 'Prompt verbessern');
  try {
    const result = await callClaude(prompt);
    showResult('p3_result', 'p3_result_content', result);
    saveField('p3_ai_result', result);
    if (!songs[currentSongId].p3_versions) songs[currentSongId].p3_versions = [];
    songs[currentSongId].p3_versions.push({ prompt: result, feedback, ts: new Date().toISOString() });
    saveToStorage();
    showToast('Prompt verbessert!', 'success');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    setLoading('p3_improve_icon', 'p3_improve_text', false, '🔄', 'Prompt verbessern');
  }
}

function openInSuno() {
  const prompt = document.getElementById('p3_result_content').textContent.trim();
  if (!prompt) { showToast('Zuerst Suno Prompt generieren!', 'error'); return; }
  navigator.clipboard.writeText(prompt).then(() => {
    showToast('Prompt kopiert! Suno öffnet sich...', 'success');
    setTimeout(() => window.open('https://suno.com/create', '_blank'), 700);
  }).catch(() => {
    window.open('https://suno.com/create', '_blank');
    showToast('Suno geöffnet – Prompt manuell einfügen', 'info');
  });
}

function openSunoLink() {
  const link = document.getElementById('p3_suno_link').value.trim();
  if (!link) { showToast('Kein Suno Link gespeichert!', 'error'); return; }
  window.open(link, '_blank');
}

// Phase 4
function updateChecklist() {
  const items = document.querySelectorAll('#p4_checklist .checklist-item');
  let checked = 0;
  items.forEach(item => {
    const chk = item.querySelector('input[type="checkbox"]');
    if (chk.checked) {
      checked++;
      item.classList.add('checked');
    } else {
      item.classList.remove('checked');
    }
  });
  const pct = Math.round((checked / items.length) * 100);
  document.getElementById('p4_progress_text').textContent = pct + '%';
  document.getElementById('p4_progress_bar').style.width = pct + '%';
  autoSave();
}

function resetChecklist() {
  CHECKLIST_KEYS.forEach(k => {
    const chk = document.getElementById('chk_' + k);
    if (chk) chk.checked = false;
  });
  updateChecklist();
  showToast('Checkliste zurückgesetzt', 'info');
}

async function generatePhase4() {
  const checked = [];
  const unchecked = [];
  CHECKLIST_KEYS.forEach(k => {
    const chk = document.getElementById('chk_' + k);
    const label = document.querySelector(`label[for="chk_${k}"]`);
    if (chk && label) {
      if (chk.checked) checked.push(label.textContent);
      else unchecked.push(label.textContent);
    }
  });

  const songName = getCurrentSongName();
  const _p4 = getProfile();
  const prompt = `Du bist ein Musik-Produktionsmanager beim Song "${songName}" von ${_p4.name}. Aktueller Stand:\n\nAbgeschlossen: ${checked.join(', ') || 'Noch nichts'}\nNoch offen: ${unchecked.join(', ') || 'Alles fertig!'}\n\nGib konkrete, priorisierte Empfehlungen für die nächsten Schritte. Was sollte als nächstes gemacht werden und warum?`;

  setLoading('p4_spinner_icon', 'p4_btn_text', true, '🤖', 'Nächste Schritte mit KI');
  try {
    const result = await callClaude(prompt);
    showResult('p4_result', 'p4_result_content', result);
    saveField('p4_ai_result', result);
    showToast('Empfehlungen generiert!', 'success');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    setLoading('p4_spinner_icon', 'p4_btn_text', false, '🤖', 'Nächste Schritte mit KI');
  }
}

// Phase 5
async function generatePhase5() {
  const songName = getCurrentSongName();
  const stimmung = document.getElementById('p5_stimmung')?.value || '';
  const stil = document.getElementById('p5_stil')?.value || '';
  const farben = document.getElementById('p5_farben')?.value || '';
  const motiv = document.getElementById('p5_motiv')?.value || '';
  // Include image materials if available
  const mats = (currentSongId && songs[currentSongId]?.materials?.filter(m => m.type==='bild')) || [];
  const matCtx = mats.length > 0 ? ` Vorhandene Bild-Materialien: ${mats.map(m=>m.note).join(', ')}.` : '';

  const prompt = `Du bist ein kreativer Director für Musik-Artwork. Erstelle detaillierte Bildprompts für den Song: ${songName}. Stimmung: ${stimmung || 'dunkel, kraftvoll'}, Stil: ${stil || 'cinematic'}, Farben: ${farben || 'schwarz, lila'}, Motiv: ${motiv || 'Portrait'}.${matCtx} Erstelle: 1 Midjourney-Prompt (mit --ar 1:1 --style raw) und 1 DALL-E-Prompt, beide auf Englisch, sehr detailliert und künstlerisch.`;

  setLoading('p5_spinner_icon', 'p5_btn_text', true, '✨', 'Prompts generieren');
  try {
    const result = await callClaude(prompt);
    showResult('p5_result', 'p5_result_content', result);
    saveField('p5_ai_result', result);
    showToast('Artwork Prompts generiert!', 'success');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    setLoading('p5_spinner_icon', 'p5_btn_text', false, '✨', 'Prompts generieren');
  }
}

// Phase 6
async function generatePhase6() {
  const songName = getCurrentSongName();
  const konzept = document.getElementById('p6_konzept').value.trim();

  const _p6 = getProfile();
  const prompt = `Du bist ein Social Media Manager für Musik. Erstelle Promo-Content für den Song '${songName}' von ${_p6.name}${_p6.handle ? ' (' + _p6.handle + ')' : ''}. Konzept: ${konzept || 'Musik Song'}. Erstelle: 5 TikTok Hooks (erste 3 Sekunden, aufmerksamkeitsstark), 1 Instagram Caption (mit Emojis, Hashtags), 3 konkrete Reels-Ideen (mit Beschreibung was zu filmen ist), 1 Twitter/X Post.`;

  setLoading('p6_spinner_icon', 'p6_btn_text', true, '📣', 'Promo-Content generieren');
  try {
    const result = await callClaude(prompt);
    showResult('p6_result', 'p6_result_content', result);
    saveField('p6_ai_result', result);
    showToast('Promo Content generiert!', 'success');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    setLoading('p6_spinner_icon', 'p6_btn_text', false, '📣', 'Promo-Content generieren');
  }
}

// Phase 7
async function generatePhase7() {
  const songName = getCurrentSongName();
  const zusatz = document.getElementById('p7_zusatz').value.trim();
  const song = songs[currentSongId] || {};
  const lyricCtx = song.p2_lyrics ? `\n\nLyrics (Ausschnitt):\n${song.p2_lyrics.substring(0,400)}` : '';
  const videoMats = (song.materials||[]).filter(m=>m.type==='video');
  const vidCtx = videoMats.length ? `\n\nVorhandenes Video-Material: ${videoMats.map(m=>m.note).join(', ')}` : '';

  const _p7 = getProfile();
  const ytHandle = _p7.youtubeHandle || _p7.handle || _p7.name;
  const prompt = `Du bist ein YouTube SEO Experte für Musik. Kanal: youtube.com/${ytHandle}. Optimiere den Upload für '${songName}' von ${_p7.name}${_p7.genre ? ' (Genre: ' + _p7.genre + ')' : ''}. Zusatzinfo: ${zusatz || 'kein'}.${lyricCtx}${vidCtx}\n\nErstelle: 1 optimierten Titel (max 70 Zeichen), vollständige Videobeschreibung (mit Intro-Text, Lyrics-Hinweis, YouTube-Links zum Kanal, Social Media Platzhalter, Timestamps-Vorlage), 30 relevante Tags (kommasepariert), 3 Thumbnail-Text-Ideen, und eine Posting-Zeit-Empfehlung.`;

  setLoading('p7_spinner_icon', 'p7_btn_text', true, '▶️', 'YouTube Content generieren');
  try {
    const result = await callClaude(prompt);
    showResult('p7_result', 'p7_result_content', result);
    saveField('p7_ai_result', result);
    showToast('YouTube Content generiert!', 'success');
  } catch(e) {
    showToast('Fehler: ' + e.message, 'error');
  } finally {
    setLoading('p7_spinner_icon', 'p7_btn_text', false, '▶️', 'YouTube Content generieren');
  }
}

// =============================
// MANAGER SYSTEM (per phase)
// =============================
function getMgrPrompts() {
  const p = getProfile();
  const artist = p.name + (p.handle ? ' (' + p.handle + ')' : '');
  const genre  = p.genre || 'Musik';
  const ctx = currentSongId ? getFullSongContext(currentSongId) : '';
  const result = {};
  for (const [phase, member] of Object.entries(TEAM)) {
    result[phase] = member.system(artist, genre, ctx);
  }
  return result;
}
// Backward-compat alias for code that reads MGR_PROMPTS directly
const MGR_PROMPTS = new Proxy({}, { get: (_, k) => getMgrPrompts()[k] });

function toggleMgr(n) {
  const toggle = document.getElementById('mgrToggle'+n);
  const body = document.getElementById('mgrBody'+n);
  if (!toggle || !body) return;
  const isOpen = body.classList.contains('open');
  toggle.classList.toggle('open', !isOpen);
  body.classList.toggle('open', !isOpen);
}

function handleMgrKey(e, n) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMgr(n); }
}

async function sendMgr(n, preset) {
  const inputEl = document.getElementById('mgrInput'+n);
  const msgsEl = document.getElementById('mgrMsgs'+n);
  const sendBtn = document.getElementById('mgrSend'+n);
  if (!msgsEl) return;
  const msg = preset || (inputEl ? inputEl.value.trim() : '');
  if (!msg) return;
  if (inputEl) inputEl.value = '';

  // Clear empty state
  const emptyEl = msgsEl.querySelector('.mgr-empty');
  if (emptyEl) emptyEl.remove();

  // Add user message
  appendMgrMsg(msgsEl, 'user', msg);

  // Disable send
  if (sendBtn) { sendBtn.disabled = true; }
  const thinkId = 'mgr_think_'+Date.now();
  appendMgrMsg(msgsEl, 'assistant', '⏳ ...', thinkId, true);

  try {
    const song = currentSongId ? songs[currentSongId] : null;
    let ctx = song ? `\n\nAktueller Song: "${song.name}"` : '';
    if (song?.p1_thema) ctx += `, Thema: ${song.p1_thema}`;
    if (song?.p1_emotion) ctx += `, Emotion: ${song.p1_emotion}`;
    if (song?.p1_stil) ctx += `, Stil: ${song.p1_stil}`;
    if (song?.p3_bpm || song?.p8_bpm) ctx += `, BPM: ${song.p8_bpm || song.p3_bpm}`;
    if (song?.p2_lyrics) ctx += `\n\nLyrics (Ausschnitt): ${song.p2_lyrics.substring(0,300)}`;
    if (song?.materials && song.materials.length > 0) {
      ctx += `\n\nVorhandene Song-Materialien:\n${song.materials.map(m => `- [${m.type.toUpperCase()}] ${m.note || m.fileName || ''}${m.url ? ' → ' + m.url : ''}${m.fileName ? ' (Datei: ' + m.fileName + ')' : ''}`).join('\n')}`;
    }

    // Include history
    const history = mgrMessages[n] || [];
    const sysPrompt = (MGR_PROMPTS[n] || PRODUCER_SYSTEM_PROMPT) + ctx;
    const historyMsgs = history.slice(-6).map(h => ({role:h.role, content:h.content}));
    historyMsgs.push({role:'user', content:msg});

    const result = await callClaudeChat(historyMsgs, sysPrompt);

    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.remove();
    appendMgrMsg(msgsEl, 'assistant', result);

    if (!mgrMessages[n]) mgrMessages[n] = [];
    mgrMessages[n].push({role:'user', content:msg}, {role:'assistant', content:result});
    mgrMessages[n] = mgrMessages[n].slice(-12);
  } catch(e) {
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.remove();
    appendMgrMsg(msgsEl, 'assistant', 'Fehler: '+e.message);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

function appendMgrMsg(container, role, content, id, isTemp) {
  const div = document.createElement('div');
  div.className = 'mgr-msg ' + role;
  if (id) div.id = id;
  const now = new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  div.innerHTML = `<div>${isTemp ? content : escHtml(content).replace(/\n/g,'<br>')}</div><div class="mgr-msg-time">${now}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// =============================
// MATERIAL SYSTEM
// =============================
function openMaterialModal() {
  selectedMatType = 'audio';
  pendingMatFile = null;
  document.getElementById('matNoteInput').value = '';
  document.getElementById('matUrlInput').value = '';
  document.getElementById('matFileInput').value = '';
  const drop = document.getElementById('matFileDrop');
  drop.classList.remove('has-file');
  document.getElementById('matFileLabel').textContent = '📎 Klicken oder Datei hierher ziehen';
  document.querySelectorAll('.mat-type-btn').forEach(b => b.classList.toggle('sel', b.dataset.type === 'audio'));
  document.getElementById('materialModal').classList.remove('hidden');
}
function closeMaterialModal() {
  document.getElementById('materialModal').classList.add('hidden');
}
function selectMatType(type) {
  selectedMatType = type;
  document.querySelectorAll('.mat-type-btn').forEach(b => b.classList.toggle('sel', b.dataset.type === type));
}
function handleMatFileSelect(event) {
  const file = event.target.files[0];
  if (file) setMatFile(file);
}
function handleMatFileDrop(event) {
  event.preventDefault();
  document.getElementById('matFileDrop').classList.remove('drag');
  const file = event.dataTransfer.files[0];
  if (file) setMatFile(file);
}
function setMatFile(file) {
  pendingMatFile = file;
  const drop = document.getElementById('matFileDrop');
  drop.classList.add('has-file');
  const sizeMB = (file.size / 1048576).toFixed(1);
  document.getElementById('matFileLabel').textContent = `✅ ${file.name} (${sizeMB} MB)`;
  if (!document.getElementById('matNoteInput').value.trim()) {
    document.getElementById('matNoteInput').value = file.name.replace(/\.[^.]+$/, '');
  }
}
async function confirmAddMaterial() {
  if (!currentSongId || !songs[currentSongId]) return;
  const note = document.getElementById('matNoteInput').value.trim();
  const url = document.getElementById('matUrlInput').value.trim();
  if (!note && !url && !pendingMatFile) { showToast('Bitte Beschreibung, Link oder Datei angeben!', 'error'); return; }
  if (!songs[currentSongId].materials) songs[currentSongId].materials = [];
  const matId = 'mat_'+Date.now();
  const mat = { id: matId, type: selectedMatType, note: note || (pendingMatFile ? pendingMatFile.name : ''), url, createdAt: new Date().toISOString() };
  if (pendingMatFile) {
    mat.fileName = pendingMatFile.name;
    mat.fileType = pendingMatFile.type;
    mat.fileSize = pendingMatFile.size;
    await saveMatFileToIDB(matId, pendingMatFile);
  }
  songs[currentSongId].materials.push(mat);
  pendingMatFile = null;
  saveToStorage();
  debouncedCloudSync();
  closeMaterialModal();
  renderMaterials();
  showToast('Material hinzugefügt!', 'success');
}
function deleteMaterial(id) {
  if (!currentSongId || !songs[currentSongId]) return;
  const mat = (songs[currentSongId].materials || []).find(m => m.id === id);
  if (mat?.fileName) deleteMatFileFromIDB(id);
  songs[currentSongId].materials = (songs[currentSongId].materials || []).filter(m => m.id !== id);
  saveToStorage();
  renderMaterials();
  showToast('Material entfernt', 'info');
}
function renderMaterials() {
  const card = document.getElementById('materialsCard');
  const list = document.getElementById('materialsList');
  const noMsg = document.getElementById('noMaterialsMsg');
  if (!card || !list) return;
  const mats = (currentSongId && songs[currentSongId]?.materials) || [];
  card.style.display = 'block';
  if (mats.length === 0) {
    list.innerHTML = '';
    if (noMsg) noMsg.style.display = 'block';
    return;
  }
  if (noMsg) noMsg.style.display = 'none';
  const icons = { audio:'🎤', video:'🎬', bild:'🖼️', dokument:'📄' };
  list.innerHTML = '';
  mats.forEach(m => {
    const div = document.createElement('div');
    div.className = 'material-item';
    const sizeTxt = m.fileSize ? ` · ${(m.fileSize/1048576).toFixed(1)} MB` : '';
    div.innerHTML = `
      <div class="material-item-icon">${icons[m.type]||'📁'}</div>
      <div class="material-item-type">${m.type}</div>
      ${m.note ? `<div class="material-item-note">${escHtml(m.note)}</div>` : ''}
      ${m.url ? `<div class="material-item-url" onclick="window.open('${escHtml(m.url)}','_blank')" title="Link öffnen">🔗 ${escHtml(m.url.substring(0,40))}${m.url.length>40?'...':''}</div>` : ''}
      ${m.fileName ? `<div class="material-item-file" onclick="openMatFile('${m.id}')" title="Datei öffnen/abspielen">📂 ${escHtml(m.fileName)}${sizeTxt}</div>` : ''}
      <button class="material-item-del" onclick="deleteMaterial('${m.id}')" title="Entfernen">×</button>
    `;
    list.appendChild(div);
  });
}
function openDriveLink() {
  const link = document.getElementById('drive_link')?.value.trim();
  if (link) window.open(link, '_blank');
  else showToast('Kein Drive-Link gespeichert!', 'error');
}

// =============================
// YOUTUBE API
// =============================
function loadYtKey() {
  ytApiKey = localStorage.getItem('studio_yt_key') || '';
}
function openYtKeyModal() {
  document.getElementById('ytKeyInput').value = ytApiKey;
  document.getElementById('ytKeyModal').classList.remove('hidden');
}
function closeYtKeyModal() {
  document.getElementById('ytKeyModal').classList.add('hidden');
}
function saveYtKey() {
  const key = document.getElementById('ytKeyInput').value.trim();
  if (!key) { showToast('Bitte API Key eingeben!', 'error'); return; }
  ytApiKey = key;
  localStorage.setItem('studio_yt_key', key);
  closeYtKeyModal();
  showToast('YouTube API Key gespeichert!', 'success');
  loadYouTubeChannel();
}
async function loadYouTubeChannel() {
  const subEl = document.getElementById('ytChannelSub');
  const vidSection = document.getElementById('ytVideosSection');
  if (subEl) subEl.textContent = '⏳ Lade Videos...';
  try {
    // Kein API Key nötig – nutzt YouTube RSS + rss2json
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=8`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('RSS-Fehler ' + res.status);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'RSS-Fehler');

    const count = data.items?.length || 0;
    if (subEl) subEl.innerHTML = `<strong>${count}</strong> neueste Videos geladen · <a href="#" onclick="openYouTubeChannel();return false;" style="color:var(--blue);">Kanal öffnen</a>`;

    const grid = document.getElementById('ytVideoGrid');
    if (grid && data.items?.length) {
      grid.innerHTML = '';
      data.items.forEach(v => {
        const vidId = v.link?.split('v=')[1]?.split('&')[0] || '';
        const thumb = vidId ? `https://img.youtube.com/vi/${vidId}/mqdefault.jpg` : '';
        const date = new Date(v.pubDate).toLocaleDateString('de-DE');
        const div = document.createElement('div');
        div.className = 'yt-video-item';
        div.innerHTML = `
          <img class="yt-thumb" src="${escHtml(thumb)}" alt="" loading="lazy">
          <div class="yt-video-info">
            <div class="yt-video-title">${escHtml(v.title)}</div>
            <div class="yt-video-date">${date}</div>
          </div>
        `;
        div.onclick = () => window.open(v.link, '_blank');
        grid.appendChild(div);
      });
      if (vidSection) vidSection.style.display = 'block';
    }
    showToast('YouTube Videos geladen!', 'success');
  } catch(e) {
    if (subEl) subEl.textContent = '✗ Fehler: ' + e.message;
    showToast('YouTube Fehler: ' + e.message, 'error');
  }
}

// =============================
// SONG MANAGEMENT
// =============================
function getCurrentSongName() {
  if (!currentSongId || !songs[currentSongId]) return 'Unbekannter Song';
  return songs[currentSongId].name || 'Unbekannter Song';
}

function createNewSong() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const PREFIX = 'D_a_N - ';
  const baseName = `Song vom ${day}.${month}.`;

  // Check if a song with that name already exists, add counter if needed
  const existingNames = Object.values(songs).map(s => s.name);
  let name = PREFIX + baseName;
  let counter = 2;
  while (existingNames.includes(name)) {
    name = PREFIX + baseName + ' (' + counter + ')';
    counter++;
  }

  const id = 'song_' + Date.now();
  songs[id] = {
    id, name,
    createdAt: now.toISOString(),
    p1_thema: '', p1_emotion: '', p1_sprache: '', p1_tonalitaet: '', p1_zielgruppe: '', p1_stil: '', p1_ai_result: '',
    p1_song_format: 'solo', p1_female_voice: '', p1_duett_split: '', p1_sprache_split: '', p1_bez_modul: '',
    p2_konzept: '', p2_lyrics: '',
    p3_bpm: 140, p3_key: 'G minor', p3_stil: '', p3_mood: '', p3_instrumente: '', p3_ai_result: '', p3_suno_link: '', p3_feedback: '', p3_versions: [],
    p4_checklist: {}, p4_ai_result: '',
    p5_stimmung: '', p5_stil: '', p5_farben: '', p5_motiv: '', p5_ai_result: '',
    p6_konzept: '', p6_ai_result: '',
    p7_zusatz: '', p7_ai_result: '',
    song_notes: '',
    drive_link: '',
    materials: [],
    p8_audio_filename: '', p8_bpm: null, p8_transcription: '',
    p8_markers: [], p8_ai_result: '',
    p9_messages: []
  };

  saveToStorage();
  renderSongList();
  selectSong(id);
  showToast(`Song erstellt – gib ihm später einen Namen!`, 'success');
}

function newSongStep2() {
  const name = document.getElementById('newSongName').value.trim();
  if (!name) { showToast('Bitte Song-Namen eingeben!', 'error'); return; }
  document.getElementById('newSongStep1').style.display = 'none';
  document.getElementById('newSongStep2').style.display = 'block';
  document.getElementById('stepDot1').className = 'step-dot done';
  document.getElementById('stepDot2').className = 'step-dot active';
  document.getElementById('stepLine1').className = 'step-line done';
}

function closeNewSongModal() {
  document.getElementById('newSongModal').classList.add('hidden');
}

function confirmNewSong() {
  const raw = document.getElementById('newSongName').value.trim();
  if (!raw) { showToast('Bitte Song-Titel eingeben!', 'error'); return; }
  const PREFIX = 'D_a_N - ';
  const name = raw.startsWith(PREFIX) ? raw : PREFIX + raw;

  // Collect materials from step 2
  const materials = [];
  if (document.getElementById('matHasAudio')?.checked) {
    const note = document.getElementById('matAudioNote')?.value.trim();
    materials.push({ id:'mat_'+Date.now()+'a', type:'audio', note: note||'Audio-Aufnahmen vorhanden', url:'', createdAt: new Date().toISOString() });
  }
  if (document.getElementById('matHasVideo')?.checked) {
    const note = document.getElementById('matVideoNote')?.value.trim();
    materials.push({ id:'mat_'+Date.now()+'v', type:'video', note: note||'Video-Material vorhanden', url:'', createdAt: new Date().toISOString() });
  }
  if (document.getElementById('matHasImage')?.checked) {
    const note = document.getElementById('matImageNote')?.value.trim();
    materials.push({ id:'mat_'+Date.now()+'i', type:'bild', note: note||'Bild-Material vorhanden', url:'', createdAt: new Date().toISOString() });
  }
  const driveLink = document.getElementById('matHasDrive')?.checked ? (document.getElementById('matDriveLink')?.value.trim() || '') : '';

  const id = 'song_' + Date.now();
  songs[id] = {
    id, name,
    createdAt: new Date().toISOString(),
    p1_thema: '', p1_emotion: '', p1_sprache: '', p1_tonalitaet: '', p1_zielgruppe: '', p1_stil: '', p1_ai_result: '',
    p1_song_format: 'solo', p1_female_voice: '', p1_duett_split: '', p1_sprache_split: '', p1_bez_modul: '',
    p2_konzept: '', p2_lyrics: '',
    p3_bpm: 140, p3_key: 'G minor', p3_stil: '', p3_mood: '', p3_instrumente: '', p3_ai_result: '', p3_suno_link: '', p3_feedback: '', p3_versions: [],
    p4_checklist: {}, p4_ai_result: '',
    p5_stimmung: '', p5_stil: '', p5_farben: '', p5_motiv: '', p5_ai_result: '',
    p6_konzept: '', p6_ai_result: '',
    p7_zusatz: '', p7_ai_result: '',
    song_notes: '',
    drive_link: driveLink,
    materials,
    p8_audio_filename: '', p8_bpm: null, p8_transcription: '',
    p8_markers: [], p8_ai_result: '',
    p9_messages: []
  };

  saveToStorage();
  renderSongList();
  selectSong(id);
  closeNewSongModal();
  showToast(`Song "${name}" erstellt!`, 'success');
}

function selectSong(id) {
  if (!songs[id]) return;
  currentSongId = id;

  // Reset manager chat history on song switch to avoid bleeding between songs
  Object.keys(mgrMessages).forEach(k => { mgrMessages[k] = []; });

  // Update song list UI
  document.querySelectorAll('.song-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  // Load song data into fields
  loadSongData(id);
  showPhases();
  switchPhase(currentPhase);
}

function deleteSong(id, e) {
  e.stopPropagation();
  const song = songs[id];
  if (!song) return;
  if (!confirm(`Song "${song.name}" wirklich löschen?`)) return;

  delete songs[id];
  saveToStorage();
  renderSongList();
  deleteSongFromCloud(id);
  deleteAudioFromIDB(id);

  if (currentSongId === id) {
    currentSongId = null;
    const ids = Object.keys(songs);
    if (ids.length > 0) {
      selectSong(ids[0]);
    } else {
      hidePhases();
    }
  }
  showToast('Song gelöscht', 'info');
}

function renderSongList() {
  const list = document.getElementById('songList');
  list.innerHTML = '';

  const ids = Object.keys(songs);
  if (ids.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px;">Noch keine Songs</div>';
    return;
  }

  ids.forEach(id => {
    const song = songs[id];
    const div = document.createElement('div');
    div.className = 'song-item' + (id === currentSongId ? ' active' : '');
    div.dataset.id = id;
    div.onclick = () => selectSong(id);
    div.innerHTML = `
      <span class="song-item-name" ondblclick="openRenameSong('${id}', event)" title="Doppelklick zum Umbenennen">${escHtml(song.name)}</span>
      <button class="song-item-del" onclick="deleteSong('${id}', event)" title="Song löschen">×</button>
    `;
    list.appendChild(div);
  });
}

function showPhases() {
  document.getElementById('noSongView').style.display = 'none';
}

function hidePhases() {
  document.querySelectorAll('.phase-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('noSongView').style.display = 'flex';
}

// =============================
// PHASE NAVIGATION
// =============================
function isPhase1Complete() {
  if (!currentSongId) return false;
  const s = songs[currentSongId];
  return !!(s?.p1_thema?.trim() && s?.p1_emotion && s?.p1_sprache && s?.p1_tonalitaet);
}
function isPhase2Complete() {
  if (!currentSongId) return false;
  const s = songs[currentSongId];
  return !!(s?.p2_lyrics?.trim().length > 10);
}
function updateNavLocks() {
  const p1ok = isPhase1Complete();
  const p2ok = isPhase2Complete();
  document.querySelectorAll('.nav-item').forEach(el => {
    const ph = parseInt(el.dataset.phase);
    el.classList.remove('locked','done');
    if (ph === 1 && p1ok) el.classList.add('done');
    if (ph === 2) {
      if (!p1ok) el.classList.add('locked');
      else if (p2ok) el.classList.add('done');
    }
    if (ph === 3 && !p2ok) el.classList.add('locked');
  });
}
// =============================
// SONG FORMAT
// =============================
function setSongFormat(fmt, silent) {
  document.querySelectorAll('.sfmt-btn').forEach(b => b.classList.toggle('active', b.dataset.fmt === fmt));
  const fmtEl = document.getElementById('p1_song_format');
  if (fmtEl) fmtEl.value = fmt;
  const duettOpts = document.getElementById('duettOptions');
  if (duettOpts) duettOpts.style.display = fmt === 'duett' ? '' : 'none';
  if (!silent) autoSave();
}

// =============================
// SPRACHE CHANGE
// =============================
function onSpracheChange(silent) {
  const val = document.getElementById('p1_sprache')?.value || '';
  const mixOpts = document.getElementById('sprachMixOptions');
  if (mixOpts) mixOpts.style.display = val === 'Deutsch+Italiano' ? '' : 'none';
  if (!silent) { autoSave(); updateNavLocks(); }
}


function selectBezModul(btn, mod) {
  document.querySelectorAll('.bez-mod-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const el = document.getElementById('p1_bez_modul');
  if (el) el.value = mod;
  if (mod) {
    renderBezModulDetail(mod);
    applyBezModulPreset(mod);
  } else {
    document.getElementById('bezModulDetail').style.display = 'none';
  }
  autoSave();
}

function renderBezModulDetail(mod) {
  const m = BEZ_MODULE[mod];
  if (!m) return;
  const detail = document.getElementById('bezModulDetail');
  detail.style.display = '';
  detail.innerHTML = `
    <div class="bmd-title">${m.title}</div>
    <div class="bez-modul-sides">
      <div class="bez-side licht">
        <div class="bez-side-label">☀️ Lichtseite</div>
        <div class="bez-side-emo"><strong>${m.licht.label}</strong></div>
        <div class="bez-side-emo" style="margin-top:3px;">${m.licht.emo}</div>
        <div class="bez-side-tech">${m.licht.tech}</div>
      </div>
      <div class="bez-side schatten">
        <div class="bez-side-label">🌑 Schattenseite</div>
        <div class="bez-side-emo"><strong>${m.schatten.label}</strong></div>
        <div class="bez-side-emo" style="margin-top:3px;">${m.schatten.emo}</div>
        <div class="bez-side-tech">${m.schatten.tech}</div>
      </div>
    </div>
    <div class="bez-modul-meta">
      <span class="bez-meta-tag">🎚️ ~${m.bpm} BPM</span>
      ${m.instrumente.map(i => `<span class="bez-meta-tag">${i}</span>`).join('')}
      <span class="bez-meta-tag">Mood: ${m.mood}</span>
    </div>`;
}

function applyBezModulPreset(mod) {
  const m = BEZ_MODULE[mod];
  if (!m) return;
  // BPM in Phase 3 vorausfüllen (wenn noch leer oder default)
  const bpmEl = document.getElementById('p3_bpm');
  if (bpmEl && (!bpmEl.value || bpmEl.value == 140)) bpmEl.value = m.bpm;
  // Mood in Phase 3
  const moodEl = document.getElementById('p3_mood');
  if (moodEl) {
    const cur = moodEl.value || '';
    if (!cur) { moodEl.value = m.mood; }
  }
}

function switchPhase(num) {
  if (num === 0) { updateDashboard(); updateSunoCockpit(); }
  if (num === 3) { setTimeout(() => { initSunoPersonaPicker(); initBeatStudio(); updateBsBpm(); updateSunoLyricsCounter(); updateSunoCockpit(); }, 0); }

  if (!currentSongId) return;

  // Phase-Sperre: Lyrics nur wenn Konzept vollständig
  if (num === 2 && !isPhase1Complete()) {
    showToast('⚠️ Bitte erst Konzept vollständig ausfüllen (Thema, Emotion, Sprache, Tonalität).', 'error');
    return;
  }
  // Phase-Sperre: Beat nur wenn Lyrics vorhanden
  if (num === 3 && !isPhase2Complete()) {
    showToast('⚠️ Bitte erst die Lyrics schreiben.', 'error');
    return;
  }

  currentPhase = num;
  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 600) closeSidebar();

  // Nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.phase) === num);
  });
  updateNavLocks();

  // Panels
  document.querySelectorAll('.phase-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('phase' + num);
  if (panel) panel.classList.add('active');

  // Close sidebar on mobile
  if (window.innerWidth <= 600) {
    closeSidebar();
  }

  // Phase-specific init
  if (num === 1) { renderMaterials(); }
  if (num === 7) { loadYouTubeChannel(); }
  if (num === 8) { updateMarkerList(); }
  if (num === 9) { loadChatHistory(); }

  // Team card
  if (num >= 1 && num <= 9) injectTeamCard(num);
}

// =============================
// DATA PERSISTENCE
// =============================
function loadSongData(id) {
  const s = songs[id];
  if (!s) return;

  // Ideen-Werkstatt
  iwLoadState(s);

  // Phase 1 – custom selects
  setVal('p1_thema', s.p1_thema);
  buildSelect('p1_emotion','emotion', s.p1_emotion||'');
  setVal('p1_sprache', s.p1_sprache || '');
  buildSelect('p1_tonalitaet','tonalitaet', s.p1_tonalitaet||'');
  buildSelect('p1_zielgruppe','zielgruppe', s.p1_zielgruppe||'');
  buildSelect('p1_stil','stil', s.p1_stil||'');
  if (s.p1_ai_result) { showResult('p1_result', 'p1_result_content', s.p1_ai_result); }
  else { hideResult('p1_result'); }
  // Phase 1 – neue Felder
  setSongFormat(s.p1_song_format || 'solo', true);
  setVal('p1_female_voice', s.p1_female_voice || '');
  setVal('p1_duett_split', s.p1_duett_split || '');
  setVal('p1_sprache_split', s.p1_sprache_split || '');
  onSpracheChange(true);
  // Beziehungs-Modul
  const bzm = s.p1_bez_modul || '';
  document.getElementById('p1_bez_modul').value = bzm;
  document.querySelectorAll('.bez-mod-btn').forEach(b => b.classList.toggle('active', b.dataset.mod === bzm));
  if (bzm) renderBezModulDetail(bzm); else document.getElementById('bezModulDetail').style.display = 'none';

  // Phase 2
  setVal('p2_konzept', s.p2_konzept);
  setVal('p2_lyrics', s.p2_lyrics);
  updateLyricsCounter();

  // Phase 3 – custom selects
  const bpm = s.p3_bpm || 140;
  document.getElementById('p3_bpm').value = bpm;
  document.getElementById('p3_bpm_val').textContent = bpm;
  setSelectVal('p3_key', s.p3_key || 'G minor');
  buildSelect('p3_stil','genre', s.p3_stil||'');
  buildSelect('p3_mood','mood', s.p3_mood||'');
  buildSelect('p3_instrumente','instrumente', s.p3_instrumente||'');
  setVal('p3_suno_link', s.p3_suno_link);
  setVal('p3_feedback', s.p3_feedback);
  if (s.p3_ai_result) { showResult('p3_result', 'p3_result_content', s.p3_ai_result); }
  else { hideResult('p3_result'); }

  // Suno Cockpit
  setVal('suno_stile', s.suno_stile||'');
  setVal('suno_stile_exclude', s.suno_stile_exclude||'');
  const ssEl = document.getElementById('suno_seltsamkeit');
  if (ssEl) { ssEl.value = s.suno_seltsamkeit||50; const wv = document.getElementById('suno_weird_val'); if(wv) wv.textContent = (s.suno_seltsamkeit||50)+' %'; }
  const siflEl = document.getElementById('suno_stileinfluss');
  if (siflEl) { siflEl.value = s.suno_stileinfluss||50; const sv = document.getElementById('suno_stilinfl_val'); if(sv) sv.textContent = (s.suno_stileinfluss||50)+' %'; }
  setVal('suno_titel', s.suno_titel||s.name||'');
  if (s.suno_lyrics_text) setVal('suno_lyrics_text', s.suno_lyrics_text||'');
  if (s.suno_beschreibung) setVal('suno_beschreibung', s.suno_beschreibung||'');
  if (s.suno_geraeusch_desc) setVal('suno_geraeusch_desc', s.suno_geraeusch_desc||'');
  // Auto-populate suno_stile from Phase 3 if empty
  if (!s.suno_stile) {
    const parts = [s.p3_stil, s.p3_mood, s.p3_instrumente].filter(Boolean).join(', ');
    setVal('suno_stile', parts);
  }
  // Sync new UI v2 controls
  setSunoModus(s.suno_modus||'einfach');
  setSunoGeschlecht(s.suno_geschlecht||'maennlich');
  setSunoLyricsMode(s.suno_lyrics_mode||'handbuch');
  setSunoVersion(s.suno_version||'v5', null);
  updateSunoCockpit();
  updateDashboard();

  // Phase 4
  const chklist = s.p4_checklist || {};
  CHECKLIST_KEYS.forEach(k => {
    const chk = document.getElementById('chk_' + k);
    if (chk) chk.checked = !!chklist[k];
  });
  updateChecklist();
  if (s.p4_ai_result) { showResult('p4_result', 'p4_result_content', s.p4_ai_result); }
  else { hideResult('p4_result'); }

  // Phase 5 – custom selects
  buildSelect('p5_stimmung','stimmung', s.p5_stimmung||'');
  buildSelect('p5_stil','visual_stil', s.p5_stil||'');
  buildSelect('p5_farben','farben', s.p5_farben||'');
  buildSelect('p5_motiv','motiv', s.p5_motiv||'');
  if (s.p5_ai_result) { showResult('p5_result', 'p5_result_content', s.p5_ai_result); }
  else { hideResult('p5_result'); }

  // Phase 6
  setVal('p6_konzept', s.p6_konzept);
  if (s.p6_ai_result) { showResult('p6_result', 'p6_result_content', s.p6_ai_result); }
  else { hideResult('p6_result'); }

  // Phase 7
  setVal('p7_zusatz', s.p7_zusatz);
  if (s.p7_ai_result) { showResult('p7_result', 'p7_result_content', s.p7_ai_result); }
  else { hideResult('p7_result'); }

  // Notes + Drive
  setVal('song_notes', s.song_notes);
  setVal('drive_link', s.drive_link || '');

  // Materials
  renderMaterials();

  // Phase 8
  if (s.p8_audio_filename) {
    const nameEl = document.getElementById('audioFileName');
    if (nameEl) { nameEl.textContent = '📎 ' + s.p8_audio_filename + ' (Datei erneut laden um Player zu aktivieren)'; nameEl.style.display = 'block'; }
  } else {
    const nameEl = document.getElementById('audioFileName');
    if (nameEl) nameEl.style.display = 'none';
  }
  // Show audio cards if filename saved
  if (s.p8_audio_filename) {
    ['audioPlayerCard','bpmCard','transcriptionCard','timelineCard','audioAiCard'].forEach(cid => {
      const el = document.getElementById(cid); if(el) el.style.display = 'block';
    });
  } else {
    ['audioPlayerCard','bpmCard','transcriptionCard','timelineCard','audioAiCard'].forEach(cid => {
      const el = document.getElementById(cid); if(el) el.style.display = 'none';
    });
  }
  if (s.p8_bpm) {
    const bpmEl = document.getElementById('bpmValue');
    const infoEl = document.getElementById('bpmInfo');
    const manEl = document.getElementById('bpmManual');
    if (bpmEl) bpmEl.textContent = s.p8_bpm;
    if (infoEl) infoEl.textContent = 'Gespeichert';
    if (manEl) manEl.value = s.p8_bpm;
  }
  setVal('p8_transcription', s.p8_transcription);
  if (s.p8_ai_result) { showResult('p8_result', 'p8_result_content', s.p8_ai_result); }
  else { hideResult('p8_result'); }
  updateMarkerList();

  // Load audio from IndexedDB if available
  if (s.p8_audio_filename) {
    loadAudioFromIDB(id);
  }

  updateNavLocks();
  // Update Suno lyrics counter if suno_lyrics_text is loaded
  updateSunoLyricsCounter();
}

function autoSave() {
  if (!currentSongId || !songs[currentSongId]) return;
  const s = songs[currentSongId];

  s.p1_thema = getVal('p1_thema');
  // selects: read value directly
  s.p1_emotion = document.getElementById('p1_emotion')?.value || '';
  s.p1_sprache = document.getElementById('p1_sprache')?.value || '';
  s.p1_tonalitaet = document.getElementById('p1_tonalitaet')?.value || '';
  s.p1_zielgruppe = document.getElementById('p1_zielgruppe')?.value || '';
  s.p1_stil = document.getElementById('p1_stil')?.value || '';
  // neue Felder
  s.p1_song_format = getVal('p1_song_format') || 'solo';
  s.p1_female_voice = getVal('p1_female_voice');
  s.p1_duett_split = getVal('p1_duett_split');
  s.p1_sprache_split = getVal('p1_sprache_split');
  s.p1_bez_modul = getVal('p1_bez_modul');

  s.p2_konzept = getVal('p2_konzept');
  s.p2_lyrics = getVal('p2_lyrics');

  s.p3_bpm = document.getElementById('p3_bpm')?.value || 140;
  s.p3_key = document.getElementById('p3_key')?.value || 'G minor';
  s.p3_stil = document.getElementById('p3_stil')?.value || '';
  s.p3_mood = document.getElementById('p3_mood')?.value || '';
  s.p3_instrumente = document.getElementById('p3_instrumente')?.value || '';
  s.p3_suno_link = getVal('p3_suno_link');
  s.p3_feedback = getVal('p3_feedback');

  const chklist = {};
  CHECKLIST_KEYS.forEach(k => {
    const chk = document.getElementById('chk_' + k);
    if (chk) chklist[k] = chk.checked;
  });
  s.p4_checklist = chklist;

  s.p5_stimmung = document.getElementById('p5_stimmung')?.value || '';
  s.p5_stil = document.getElementById('p5_stil')?.value || '';
  s.p5_farben = document.getElementById('p5_farben')?.value || '';
  s.p5_motiv = document.getElementById('p5_motiv')?.value || '';

  s.p6_konzept = getVal('p6_konzept');
  s.p7_zusatz = getVal('p7_zusatz');
  s.song_notes = getVal('song_notes');
  s.drive_link = getVal('drive_link');

  s.p8_transcription = getVal('p8_transcription');

  // Suno Cockpit
  s.suno_modus = document.getElementById('suno_modus')?.value || 'einfach';
  s.suno_version = document.getElementById('suno_version')?.value || 'v5';
  s.suno_stile = document.getElementById('suno_stile')?.value || '';
  s.suno_stile_exclude = document.getElementById('suno_stile_exclude')?.value || '';
  s.suno_geschlecht = document.getElementById('suno_geschlecht')?.value || 'maennlich';
  s.suno_lyrics_mode = document.getElementById('suno_lyrics_mode')?.value || 'handbuch';
  s.suno_seltsamkeit = parseInt(document.getElementById('suno_seltsamkeit')?.value) || 50;
  s.suno_stileinfluss = parseInt(document.getElementById('suno_stileinfluss')?.value) || 50;
  s.suno_titel = document.getElementById('suno_titel')?.value || '';
  updateSunoCockpit();
  updateDashboard();

  s.updatedAt = new Date().toISOString();
  saveToStorage();
  debouncedCloudSync();
}

function saveField(field, value) {
  if (!currentSongId || !songs[currentSongId]) return;
  songs[currentSongId][field] = value;
  saveToStorage();
}

function saveSong() {
  autoSave();
}

function saveToStorage() {
  const pid = getActiveProfileId() || 'p_default';
  try {
    localStorage.setItem('studio_music_songs_' + pid, JSON.stringify(songs));
  } catch(e) {
    showToast('Speicher-Fehler: ' + e.message, 'error');
  }
}

function loadFromStorage() {
  const pid = getActiveProfileId() || 'p_default';
  try {
    const raw = localStorage.getItem('studio_music_songs_' + pid);
    songs = raw ? JSON.parse(raw) : {};
  } catch(e) {
    songs = {};
  }
}

// =============================
// EXPORT / IMPORT
// =============================
function exportSongs() {
  if (Object.keys(songs).length === 0) {
    showToast('Keine Songs zum Exportieren!', 'error');
    return;
  }
  autoSave();
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), songs }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'studio-songs-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Songs exportiert!', 'success');
}

function importSongs(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const imported = data.songs || data;
      if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Ungültiges Format');
      const count = Object.keys(imported).length;
      if (count === 0) throw new Error('Keine Songs gefunden');
      // Merge: imported songs are added, existing songs with same ID are overwritten
      Object.assign(songs, imported);
      saveToStorage();
      renderSongList();
      showToast(`${count} Song(s) importiert!`, 'success');
    } catch(err) {
      showToast('Import-Fehler: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// =============================
// SONG RENAME
// =============================
let renamingSongId = null;

function openRenameSong(id, event) {
  event.stopPropagation();
  renamingSongId = id;
  const song = songs[id];
  if (!song) return;
  document.getElementById('renameSongInput').value = song.name;
  document.getElementById('renameSongModal').classList.remove('hidden');
  document.getElementById('renameSongInput').focus();
  document.getElementById('renameSongInput').select();
}

function closeRenameSongModal() {
  document.getElementById('renameSongModal').classList.add('hidden');
  renamingSongId = null;
}

function confirmRenameSong() {
  const newName = document.getElementById('renameSongInput').value.trim();
  if (!newName) { showToast('Bitte Namen eingeben!', 'error'); return; }
  if (!renamingSongId || !songs[renamingSongId]) { closeRenameSongModal(); return; }
  songs[renamingSongId].name = newName;
  saveToStorage();
  renderSongList();
  closeRenameSongModal();
  showToast(`Song umbenannt zu "${newName}"`, 'success');
  debouncedCloudSync();
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  if (!currentSongId || !songs[currentSongId]) {
    showToast('Bitte erst einen Song auswählen!', 'error');
    return;
  }
  const useSearch = document.getElementById('useWebSearch').checked;
  input.value = '';
  appendChatMessage('user', msg);
  const sendBtn = document.getElementById('chatSendBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = '...';
  const thinkingId = 'thinking_' + Date.now();
  appendChatMessage('assistant', '🔍 Recherchiere...', thinkingId, true);
  try {
    const song = songs[currentSongId];
    let songCtx = `Song: "${song.name}"`;
    if (song.p1_thema) songCtx += `, Thema: ${song.p1_thema}`;
    if (song.p1_emotion) songCtx += `, Emotion: ${song.p1_emotion}`;
    if (song.p1_stil) songCtx += `, Stil: ${song.p1_stil}`;
    if (song.p8_bpm || song.p3_bpm) songCtx += `, BPM: ${song.p8_bpm || song.p3_bpm}`;
    if (song.p3_key) songCtx += `, Key: ${song.p3_key}`;
    if (song.p2_lyrics) songCtx += `\n\nLyrics (Ausschnitt):\n${song.p2_lyrics.substring(0, 400)}`;

    let searchCtx = '';
    if (useSearch && tavilyKey) {
      const results = await searchWeb(msg + ` deutsch rap musikproduktion ${new Date().getFullYear()}`);
      if (results) {
        if (results.answer) searchCtx = `\n\n## Aktuelle Web-Recherche:\n${results.answer}`;
        if (results.results?.length) searchCtx += '\n\nQuellen:\n' + results.results.slice(0,3).map(r => `- ${r.title}: ${r.content?.substring(0,200)}`).join('\n');
      }
    }

    const history = (song.p9_messages || []).slice(-8);
    const sysPrompt = `${PRODUCER_SYSTEM_PROMPT}

Aktueller Song-Kontext:
${songCtx}
Heutiges Datum: ${new Date().toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}${searchCtx}`;

    const messages = history.map(h => ({ role: h.role, content: h.content }));
    messages.push({ role: 'user', content: msg });
    const result = await callClaudeChat(messages, sysPrompt);

    const thinkEl = document.getElementById(thinkingId);
    if (thinkEl) thinkEl.remove();
    appendChatMessage('assistant', result);

    if (!songs[currentSongId].p9_messages) songs[currentSongId].p9_messages = [];
    songs[currentSongId].p9_messages.push(
      { role: 'user', content: msg, ts: new Date().toISOString() },
      { role: 'assistant', content: result, ts: new Date().toISOString() }
    );
    songs[currentSongId].p9_messages = songs[currentSongId].p9_messages.slice(-20);
    saveToStorage();
  } catch(e) {
    const thinkEl = document.getElementById(thinkingId);
    if (thinkEl) thinkEl.remove();
    appendChatMessage('assistant', 'Fehler: ' + e.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Senden';
  }
}

function appendChatMessage(role, content, id = null, isTemporary = false) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const emptyEl = document.getElementById('chatEmpty');
  if (emptyEl) emptyEl.style.display = 'none';
  const div = document.createElement('div');
  div.className = 'chat-message ' + role;
  if (id) div.id = id;
  const now = new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' });
  div.innerHTML = `<div>${isTemporary ? content : escHtml(content).replace(/\n/g,'<br>')}</div><div class="msg-time">${now}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendQuickMessage(msg) {
  document.getElementById('chatInput').value = msg;
  await sendChatMessage();
}

function clearChat() {
  if (!currentSongId || !songs[currentSongId]) return;
  if (!confirm('Chat-Verlauf löschen?')) return;
  songs[currentSongId].p9_messages = [];
  saveToStorage();
  const container = document.getElementById('chatMessages');
  if (container) container.innerHTML = '<div class="chat-empty" id="chatEmpty"><div class="chat-empty-icon">🎵</div><div style="font-size:15px;font-weight:600;color:var(--text);">Dein Producer ist bereit</div><div style="font-size:13px;">Stell eine Frage oder wähle eine Schnell-Anfrage oben</div></div>';
  showToast('Chat geleert', 'info');
}

function loadChatHistory() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.innerHTML = '';
  const messages = (currentSongId && songs[currentSongId]?.p9_messages) || [];
  if (messages.length === 0) {
    container.innerHTML = '<div class="chat-empty" id="chatEmpty"><div class="chat-empty-icon">🎵</div><div style="font-size:15px;font-weight:600;color:var(--text);">Dein Producer ist bereit</div><div style="font-size:13px;">Stell eine Frage oder wähle eine Schnell-Anfrage oben</div></div>';
    return;
  }
  messages.forEach(m => appendChatMessage(m.role, m.content));
}

// =============================

// =============================
// SUNO LYRICS TAG TOOLBAR
// =============================
function insertLyricsTag(tag) {
  const ta = document.getElementById('p2_lyrics');
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(end);
  // Insert tag on its own line
  const needsNewlineBefore = before.length > 0 && !before.endsWith('\n');
  const needsNewlineAfter = after.length > 0 && !after.startsWith('\n');
  const insert = (needsNewlineBefore ? '\n' : '') + tag + (needsNewlineAfter ? '\n' : '');
  ta.value = before + insert + after;
  const newPos = start + insert.length;
  ta.setSelectionRange(newPos, newPos);
  ta.focus();
  autoSave();
  updateNavLocks();
  updateLyricsCounter();
}

function updateLyricsCounter() {
  const ta = document.getElementById('p2_lyrics');
  const counter = document.getElementById('p2_char_counter');
  if (!ta || !counter) return;
  const len = ta.value.length;
  counter.textContent = len + ' / 3000 Zeichen';
  counter.className = 'suno-char-counter' + (len > 3000 ? ' over' : len > 2500 ? ' warn' : '');
}

function insertSunoStructure() {
  const ta = document.getElementById('p2_lyrics');
  if (!ta) return;
  const existing = ta.value.trim();
  const template = '[Intro]\n\n[Verse 1]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Verse 2]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Bridge]\n\n[Final Chorus]\n\n[Outro]';
  if (existing && !confirm('Bestehende Lyrics behalten und Struktur anhängen? OK = anhängen, Abbrechen = ersetzen')) {
    ta.value = template;
  } else if (existing) {
    ta.value = existing + '\n\n' + template;
  } else {
    ta.value = template;
  }
  autoSave();
  updateNavLocks();
  updateLyricsCounter();
  showToast('Song-Struktur eingefügt!', 'success');
}

// =============================
// SONG STRUKTUR PLANER (Phase 3)
// =============================
let sskpSections = [];

function sskpToggle(tag, btn) {
  const idx = sskpSections.indexOf(tag);
  if (idx === -1) {
    sskpSections.push(tag);
    btn.classList.add('active');
  } else {
    sskpSections.splice(idx, 1);
    btn.classList.remove('active');
  }
  sskpRender();
}

function sskpRender() {
  const plan = document.getElementById('sskpPlan');
  if (!plan) return;
  if (sskpSections.length === 0) {
    plan.innerHTML = '<span style="font-size:12px;color:rgba(148,163,184,0.3);padding:4px;">Noch keine Sektionen gewählt...</span>';
    return;
  }
  plan.innerHTML = sskpSections.map((tag, i) =>
    `<div class="sskp-section-chip" onclick="sskpRemove(${i})">${tag}</div>`
  ).join('');
}

function sskpRemove(idx) {
  const tag = sskpSections[idx];
  sskpSections.splice(idx, 1);
  // Deactivate the add button
  const addRow = document.getElementById('sskpAddRow');
  if (addRow) {
    addRow.querySelectorAll('.sskp-add-btn').forEach(b => {
      if (b.textContent.trim() === tag) b.classList.remove('active');
    });
  }
  sskpRender();
}

function sskpReset() {
  sskpSections = [];
  const addRow = document.getElementById('sskpAddRow');
  if (addRow) addRow.querySelectorAll('.sskp-add-btn').forEach(b => b.classList.remove('active'));
  sskpRender();
}

function sskpPreset(type) {
  sskpReset();
  let sections = [];
  if (type === 'standard') {
    sections = ['[Intro]','[Verse 1]','[Pre-Chorus]','[Chorus]','[Verse 2]','[Pre-Chorus]','[Chorus]','[Bridge]','[Final Chorus]','[Outro]'];
  } else if (type === 'extended') {
    sections = ['[Intro]','[Verse 1]','[Pre-Chorus]','[Chorus]','[Verse 2]','[Pre-Chorus]','[Chorus]','[Bridge]','[Breakdown]','[Build-Up]','[Final Chorus]','[Big Finish]','[Outro]'];
  } else if (type === 'duet') {
    sections = ['[Intro]','[Verse 1]','[Chorus]','[Verse 2]','[Chorus]','[Bridge]','[Final Chorus]','[Outro]'];
  }
  sskpSections = sections;
  // Mark active buttons
  const addRow = document.getElementById('sskpAddRow');
  if (addRow) {
    addRow.querySelectorAll('.sskp-add-btn').forEach(b => {
      b.classList.toggle('active', sections.includes(b.textContent.trim()));
    });
  }
  sskpRender();
  showToast('Preset geladen!', 'success');
}

function sskpApplyToLyrics() {
  if (sskpSections.length === 0) { showToast('Keine Sektionen im Plan!', 'error'); return; }
  const ta = document.getElementById('p2_lyrics');
  if (!ta) { showToast('Lyrics-Editor nicht gefunden (Phase 2)', 'error'); return; }
  const existing = ta.value.trim();
  const structure = sskpSections.join('\n\n');
  if (existing) {
    if (!confirm('Bestehende Lyrics behalten? OK = Struktur anhängen, Abbrechen = ersetzen')) {
      ta.value = structure;
    } else {
      ta.value = existing + '\n\n' + structure;
    }
  } else {
    ta.value = structure;
  }
  autoSave();
  updateNavLocks();
  updateLyricsCounter();
  showToast('Struktur in Lyrics eingefügt! (Phase 2)', 'success');
}

// =============================
// SUNO COCKPIT
// =============================
function setSunoToggle(fieldId, value, row) {
  const hidden = document.getElementById(fieldId);
  if (hidden) hidden.value = value;
  if (row) row.querySelectorAll('.suno-toggle-btn').forEach(b => b.classList.toggle('sel', b.dataset.val === value));
  autoSave();
}
function setSunoField(fieldId, value) {
  const hidden = document.getElementById(fieldId);
  if (!hidden) return;
  hidden.value = value;
  const row = document.getElementById(fieldId + '_row');
  if (row) row.querySelectorAll('.suno-toggle-btn').forEach(b => b.classList.toggle('sel', b.dataset.val === value));
}
function updateSunoCockpit() {
  if (!currentSongId || !songs[currentSongId]) return;
  const s = songs[currentSongId];
  // Auto-populate suno_stile from Phase 3 if user hasn't set it manually
  const stileEl = document.getElementById('suno_stile');
  if (stileEl && !stileEl.value.trim()) {
    const auto = [s.p3_stil, s.p3_mood, s.p3_instrumente].filter(Boolean).join(', ');
    stileEl.value = auto;
  }
  // Build live preview
  const stile = stileEl?.value || '';
  const exclude = document.getElementById('suno_stile_exclude')?.value || '';
  const bpm = s.p3_bpm || '';
  const key = s.p3_key || '';
  const weird = document.getElementById('suno_seltsamkeit')?.value || 50;
  const stilinfl = document.getElementById('suno_stileinfluss')?.value || 75;
  const titel = document.getElementById('suno_titel')?.value || s.name || '';
  const gender = document.getElementById('suno_geschlecht')?.value || 'auto';
  const parts = [];
  if (stile) parts.push(stile);
  if (bpm) parts.push(`${bpm} bpm`);
  if (key) parts.push(key);
  if (gender !== 'auto') parts.push(gender === 'maennlich' ? 'male vocals' : 'female vocals');
  const liveEl = document.getElementById('suno_live_stile');
  if (liveEl) liveEl.textContent = parts.join(', ') || '–';
  renderSunoStyleTags();
}

// ── SUNO UI v2 helpers ──────────────────────────────────────
function setSunoModus(mode) {
  const mEl = document.getElementById('suno_modus');
  if (mEl) mEl.value = mode;
  document.querySelectorAll('.suno-mode-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode));
  document.querySelectorAll('.suno-mode-content').forEach(c =>
    c.classList.toggle('active', c.id === 'suno_content_' + mode));
  autoSave();
}

function toggleSunoSection(id) {
  const sec = document.getElementById(id);
  if (!sec) return;
  sec.classList.toggle('collapsed');
  const body = sec.querySelector('.suno-section-body');
  if (body) body.style.display = sec.classList.contains('collapsed') ? 'none' : '';
}

function toggleSunoVersionDd(e) {
  e.stopPropagation();
  const dd = document.getElementById('suno_version_dd');
  if (dd) dd.classList.toggle('open');
  closeSunoAudioDd();
}

function setSunoVersion(val, el) {
  const vEl = document.getElementById('suno_version');
  if (vEl) vEl.value = val;
  const labels = {v5:'v5',v45plus:'4.5+',v45:'4.5',v45all:'v4.5-all',v4pro:'v4',v35:'3.5'};
  const lbl = document.getElementById('suno_version_label');
  if (lbl) lbl.textContent = labels[val] || val;
  document.querySelectorAll('[id^="vcheck_"]').forEach(c => c.style.display = 'none');
  const chk = document.getElementById('vcheck_' + val);
  if (chk) chk.style.display = '';
  document.querySelectorAll('.suno-version-option').forEach(o =>
    o.classList.toggle('selected', o.dataset.val === val));
  const dd = document.getElementById('suno_version_dd');
  if (dd) dd.classList.remove('open');
  autoSave();
}

function toggleSunoAudioDd(e, isAdv) {
  e.stopPropagation();
  const ddId = isAdv ? 'suno_audio_dd2' : 'suno_audio_dd';
  const dd = document.getElementById(ddId);
  if (dd) dd.classList.toggle('open');
  const vdd = document.getElementById('suno_version_dd');
  if (vdd) vdd.classList.remove('open');
  // close the other audio dd
  const otherId = isAdv ? 'suno_audio_dd' : 'suno_audio_dd2';
  const other = document.getElementById(otherId);
  if (other) other.classList.remove('open');
}

function closeSunoAudioDd() {
  ['suno_audio_dd','suno_audio_dd2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
}

function toggleSunoInstrumental() {
  const btn = document.getElementById('suno_instr_btn');
  if (btn) btn.classList.toggle('active');
  autoSave();
}

function setSunoGeschlecht(val) {
  const el = document.getElementById('suno_geschlecht');
  if (el) el.value = val;
  document.querySelectorAll('.suno-binary-btn[data-val="maennlich"],.suno-binary-btn[data-val="weiblich"]')
    .forEach(b => b.classList.toggle('active', b.dataset.val === val));
  autoSave();
}

function setSunoLyricsMode(val) {
  const el = document.getElementById('suno_lyrics_mode');
  if (el) el.value = val;
  document.querySelectorAll('.suno-binary-btn[data-val="handbuch"],.suno-binary-btn[data-val="auto"]')
    .forEach(b => b.classList.toggle('active', b.dataset.val === val));
  autoSave();
}

function sunoRandomDesc(isGeraeusche) {
  const descs = isGeraeusche
    ? ['Sanfter Regen auf einem Blechdach','Knisterndes Lagerfeuer im Wald','Meereswellen am felsigen Strand']
    : ['Beruhigende Power-Ballade über Freundschaftsbrüche','Epischer Trap-Hymne über den Aufstieg','Melancholischer Rap über Heimweh'];
  const taId = isGeraeusche ? 'suno_geraeusch_desc' : 'suno_beschreibung';
  const ta = document.getElementById(taId);
  if (ta) { ta.value = descs[Math.floor(Math.random()*descs.length)]; autoSave(); }
}

function sunoAddText() {
  setSunoModus('fortschrittlich');
  const ta = document.getElementById('suno_lyrics_text');
  if (ta) ta.focus();
}

function sunoAiLyrics() {
  if (typeof generatePhase2 === 'function') generatePhase2();
}

function sunoExpandLyrics() {
  const ta = document.getElementById('suno_lyrics_text');
  if (ta) ta.style.minHeight = ta.style.minHeight === '300px' ? '80px' : '300px';
}

function sunoRefreshStyleTags() { renderSunoStyleTags(); }

function renderSunoStyleTags() {
  const stile = document.getElementById('suno_stile')?.value || '';
  const display = document.getElementById('suno_stile_display');
  if (display) display.textContent = stile || 'rhythmischer Fluss, gefallener Engel, Stoner Rock, tragisch';
  const row = document.getElementById('suno_stile_tags_row');
  if (row) {
    row.querySelectorAll('.suno-style-chip').forEach(c => c.remove());
    const tags = stile ? stile.split(',').map(s=>s.trim()).filter(Boolean) : [];
    tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'suno-style-chip';
      chip.textContent = tag;
      row.appendChild(chip);
    });
  }
  const inspoRow = document.getElementById('suno_inspo_chips');
  if (inspoRow) {
    inspoRow.innerHTML = '';
    const tags = stile ? stile.split(',').map(s=>s.trim()).filter(Boolean)
                       : ['rhythmischer Fluss','gefallener Engel','Stoner Rock','tragisch'];
    tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'suno-chip';
      chip.textContent = tag;
      inspoRow.appendChild(chip);
    });
  }
}

function openSunoPersonaPanel() {
  // Scroll to the persona card in Phase 3
  const card = document.getElementById('sunoPersonaCard');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.style.outline = '2px solid rgba(124,58,237,0.6)';
    setTimeout(() => { card.style.outline = ''; }, 1500);
  }
}

function openSunoInspoPanel() {
  // Switch to einfach mode and highlight inspiration chips
  setSunoModus('einfach');
  const chips = document.getElementById('suno_inspo_chips');
  if (chips) {
    chips.style.outline = '2px solid rgba(124,58,237,0.5)';
    chips.style.borderRadius = '8px';
    chips.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => { chips.style.outline = ''; }, 1500);
  }
}

// ─── Suno Lyrics Tag Toolbar ───────────────────────────────
function insertSunoLyricsTag(tag) {
  const ta = document.getElementById('suno_lyrics_text');
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(end);
  const needsNewlineBefore = before.length > 0 && !before.endsWith('\n');
  const needsNewlineAfter = after.length > 0 && !after.startsWith('\n');
  const insert = (needsNewlineBefore ? '\n' : '') + tag + (needsNewlineAfter ? '\n' : '');
  ta.value = before + insert + after;
  const newPos = start + insert.length;
  ta.setSelectionRange(newPos, newPos);
  ta.focus();
  autoSave();
  updateSunoLyricsCounter();
}

function updateSunoLyricsCounter() {
  const ta = document.getElementById('suno_lyrics_text');
  const counter = document.getElementById('suno_lyrics_counter');
  if (!ta || !counter) return;
  const len = ta.value.length;
  counter.textContent = len + ' / 3000';
  counter.className = 'suno-char-counter-sm' + (len > 3000 ? ' over' : len > 2500 ? ' warn' : '');
}

function sunoInsertStructureTemplate() {
  const ta = document.getElementById('suno_lyrics_text');
  if (!ta) return;
  const template = '[Intro]\n\n[Verse 1]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Verse 2]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Bridge]\n\n[Final Chorus]\n\n[Outro]';
  const existing = ta.value.trim();
  if (existing && !confirm('Bestehenden Text behalten und Struktur anhängen?')) {
    ta.value = template;
  } else if (existing) {
    ta.value = existing + '\n\n' + template;
  } else {
    ta.value = template;
  }
  autoSave();
  updateSunoLyricsCounter();
  showToast('Rap-Struktur eingefügt!', 'success');
}

// ─── Audio Dropdown Handler ────────────────────────────────
function sunoOpenRemix() {
  showToast('Remix: Lade zuerst deinen Beat in Phase 8 hoch. Den Suno-Prompt aus dem Cockpit kopieren und auf Suno.com als Remix-Basis nutzen.', 'info');
}
function sunoOpenUpload() {
  showToast('Audio-Upload direkt auf Suno.com → "Upload Audio" nutzen. Beat aus Phase 8 exportieren und dort hochladen.', 'info');
}
function sunoOpenRecord() {
  switchPhase(8);
  showToast('Audio Studio geöffnet → hier aufnehmen oder hochladen!', 'success');
}

// ─── Suno Prompt kopieren ─────────────────────────────────
function copySunoPrompt() {
  const song = currentSongId ? songs[currentSongId] : null;
  const modus = document.getElementById('suno_modus')?.value || 'fortschrittlich';
  const version = document.getElementById('suno_version')?.value || 'v5';
  const titel = document.getElementById('suno_titel')?.value || (song?.name) || '';
  const stile = document.getElementById('suno_stile')?.value || '';
  const exclude = document.getElementById('suno_stile_exclude')?.value || '';
  const gender = document.getElementById('suno_geschlecht')?.value || 'auto';
  const lyricsMode = document.getElementById('suno_lyrics_mode')?.value || 'handbuch';
  const weird = document.getElementById('suno_seltsamkeit')?.value || 50;
  const stilinfl = document.getElementById('suno_stileinfluss')?.value || 75;
  const instrBtn = document.getElementById('suno_instr_btn');
  const isInstrumental = instrBtn?.classList.contains('active') || false;

  let lines = [];

  if (titel) lines.push('Title: ' + titel);
  if (version) lines.push('Version: ' + version);

  if (modus === 'einfach') {
    const desc = document.getElementById('suno_beschreibung')?.value || '';
    if (desc) lines.push('\nBeschreibung:\n' + desc);
  } else if (modus === 'geraeusche') {
    const desc = document.getElementById('suno_geraeusch_desc')?.value || '';
    if (desc) lines.push('\nGeräuschbeschreibung:\n' + desc);
  } else {
    // Fortschrittlich
    const lyrics = document.getElementById('suno_lyrics_text')?.value || '';
    if (lyrics && !isInstrumental) lines.push('\n[LYRICS]\n' + lyrics);
    if (isInstrumental) lines.push('\n[Instrumental]');
  }

  if (stile) {
    let styleStr = stile;
    if (song?.p3_bpm) styleStr += ', ' + song.p3_bpm + ' bpm';
    if (song?.p3_key) styleStr += ', ' + song.p3_key;
    if (gender === 'maennlich') styleStr += ', male vocals';
    else if (gender === 'weiblich') styleStr += ', female vocals';
    lines.push('\nStyle: ' + styleStr);
  }
  if (exclude) lines.push('Exclude: ' + exclude);

  // Suno Persona prompt
  const personaId = song?.suno_persona_id;
  if (personaId) {
    const persona = SUNO_PERSONAS.find(p => p.id === personaId);
    if (persona) {
      const fmt = song?.p1_song_format || 'solo';
      const fullPrompt = fmt === 'duett' && persona.duett
        ? persona.prompt + '\n\n' + persona.duett
        : persona.prompt;
      lines.push('\n[PERSONA PROMPT]\n' + fullPrompt);
    }
  }

  lines.push('\nSeltsamkeit: ' + weird + '% | Stileinfluss: ' + stilinfl + '%');
  lines.push('Lyrics Mode: ' + (lyricsMode === 'auto' ? 'Auto (Suno generiert)' : 'Handbuch'));

  const prompt = lines.join('\n').trim();
  if (!prompt) { showToast('Nichts zum Kopieren – füll erst die Felder aus!', 'error'); return; }

  navigator.clipboard.writeText(prompt).then(() => {
    showToast('Suno-Prompt kopiert! ✓', 'success');
  }).catch(() => {
    fallbackCopy(prompt);
    showToast('Suno-Prompt kopiert! ✓', 'success');
  });
}

// Close suno dropdowns + mobile menu on outside click
document.addEventListener('click', function(e) {
  const vdd = document.getElementById('suno_version_dd');
  if (vdd) vdd.classList.remove('open');
  closeSunoAudioDd();
  // Close mobile overflow menu if click is outside
  const mdd = document.getElementById('mobileMenuDropdown');
  if (mdd && !mdd.contains(e.target) && !e.target.closest('.mobile-more-btn')) {
    closeMobileMenu();
  }
});

// =============================
// OVERVIEW DASHBOARD
// =============================
function updateDashboard() {
  if (!currentSongId || !songs[currentSongId]) return;
  const s = songs[currentSongId];
  // Konzept
  const ovKonzept = document.getElementById('ov_konzept');
  if (ovKonzept) {
    const rows = [
      ['Thema', s.p1_thema],
      ['Emotion', s.p1_emotion],
      ['Zielgruppe', s.p1_zielgruppe],
      ['Stil / Einflüsse', s.p1_stil],
      ['BPM', s.p3_bpm ? s.p3_bpm + ' BPM' : ''],
      ['Key', s.p3_key],
      ['Mood', s.p3_mood],
      ['Genre', s.p3_stil],
    ];
    ovKonzept.innerHTML = rows.filter(r => r[1]).map(r => `
      <div class="ov-row">
        <div class="ov-label">${r[0]}</div>
        <div class="ov-value">${escHtml(r[1])}</div>
      </div>`).join('') || '<span style="color:var(--text-muted);font-size:12px;">Phase 1 noch nicht ausgefüllt</span>';
  }
  // Suno Settings
  const ovSuno = document.getElementById('ov_suno');
  if (ovSuno) {
    const versionLabels = {'v5pro':'V5 Pro','v45plus':'4.5+ Pro','v45':'4.5 Pro','v45all':'v4.5-all','v4pro':'V4 Pro','v35':'V3.5'};
    const modus = document.getElementById('suno_modus')?.value || s.suno_modus || 'einfach';
    const version = document.getElementById('suno_version')?.value || s.suno_version || 'v45';
    const geschlecht = document.getElementById('suno_geschlecht')?.value || s.suno_geschlecht || 'auto';
    const lyricsMode = document.getElementById('suno_lyrics_mode')?.value || s.suno_lyrics_mode || 'handbuch';
    const weird = document.getElementById('suno_seltsamkeit')?.value || s.suno_seltsamkeit || 50;
    const stilinfl = document.getElementById('suno_stileinfluss')?.value || s.suno_stileinfluss || 75;
    const titel = document.getElementById('suno_titel')?.value || s.suno_titel || s.name || '';
    const stile = document.getElementById('suno_stile')?.value || s.suno_stile || '';
    const geschlechtLabels = {'maennlich':'Männlich','weiblich':'Weiblich','auto':'Auto'};
    const modiLabels = {'einfach':'Einfach','fortschrittlich':'Fortschrittlich','geraeusche':'Geräusche'};
    ovSuno.innerHTML = [
      ['Modus', modiLabels[modus]||modus],
      ['Version', versionLabels[version]||version],
      ['Stile', stile],
      ['Geschlecht', geschlechtLabels[geschlecht]||geschlecht],
      ['Lyrics Mode', lyricsMode==='handbuch'?'Handbuch':'Auto'],
      ['Seltsamkeit', weird+'%'],
      ['Stileinfluss', stilinfl+'%'],
      ['Songtitel', titel],
    ].filter(r=>r[1]).map(r => `
      <div class="ov-row">
        <div class="ov-label">${r[0]}</div>
        <div class="ov-value">${escHtml(r[1])}</div>
      </div>`).join('');
  }
  // Progress
  const ovProgress = document.getElementById('ov_progress');
  if (ovProgress) {
    const chklist = s.p4_checklist || {};
    const done = CHECKLIST_KEYS.filter(k => chklist[k]).length;
    const total = CHECKLIST_KEYS.length;
    const pct = Math.round((done/total)*100);
    ovProgress.innerHTML = `
      <div style="font-size:22px;font-weight:700;color:var(--text);">${pct}%</div>
      <div class="ov-prog-bar-bg"><div class="ov-prog-bar" style="width:${pct}%"></div></div>
      <div style="font-size:12px;color:var(--text-muted);">${done} / ${total} Schritte abgeschlossen</div>`;
  }
  // Stile Prompt (for copy)
  const ovStylePrompt = document.getElementById('ov_style_prompt');
  if (ovStylePrompt) {
    const stile = document.getElementById('suno_stile')?.value || s.suno_stile || [s.p3_stil, s.p3_mood, s.p3_instrumente].filter(Boolean).join(', ');
    const bpm = s.p3_bpm ? s.p3_bpm+' bpm' : '';
    const key = s.p3_key || '';
    const gender = document.getElementById('suno_geschlecht')?.value || s.suno_geschlecht || 'auto';
    const parts = [stile, bpm, key].filter(Boolean);
    if (gender === 'maennlich') parts.push('male vocals');
    if (gender === 'weiblich') parts.push('female vocals');
    ovStylePrompt.textContent = parts.join(', ') || '–';
  }
  // Lyrics
  const ovLyrics = document.getElementById('ov_lyrics_prompt');
  if (ovLyrics) {
    ovLyrics.textContent = s.p2_lyrics || '– Noch keine Lyrics (Phase 2) –';
  }
  // Materials
  const ovMats = document.getElementById('ov_materials');
  if (ovMats) {
    const mats = s.materials || [];
    if (!mats.length) { ovMats.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">Keine Materialien</span>'; }
    else {
      const icons = {audio:'🎤',video:'🎬',bild:'🖼️',dokument:'📄'};
      ovMats.innerHTML = '<div class="ov-tags">'+mats.map(m => `<span class="ov-tag">${icons[m.type]||'📁'} ${escHtml(m.note||m.fileName||m.type)}</span>`).join('')+'</div>';
    }
  }
  // Suno Persona badge in dashboard
  const ovPersona = document.getElementById('ov_persona_badge');
  if (ovPersona) {
    const pid = s.suno_persona_id;
    const persona = pid ? SUNO_PERSONAS.find(p => p.id === pid) : null;
    ovPersona.innerHTML = persona
      ? `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;border:1px solid ${persona.color}33;background:${persona.color}11;margin-top:4px;"><span style="font-size:14px;">${persona.emoji}</span><div><div style="font-size:12px;font-weight:600;color:${persona.color};">${persona.name}</div><div style="font-size:10px;color:var(--text-muted);">${persona.bpm} BPM · ${persona.tag}</div></div>${persona.url?`<a href="${persona.url}" target="_blank" style="margin-left:auto;font-size:10px;color:var(--blue);text-decoration:none;padding:2px 6px;border:1px solid rgba(59,130,246,0.3);border-radius:3px;">↗ Suno</a>`:''}</div>`
      : '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;font-style:italic;">Keine Persona gewählt (Phase 3)</div>';
  }
}
function enterStudio() {
  const screen = document.getElementById('intro-screen');
  if (!screen) return;
  stopIntroBeat(() => {});
  screen.style.pointerEvents = 'none';

  // 1) Fade out all content fast
  ['.intro-content','#introVULeft','#introVURight','.intro-rec',
   '.intro-hline','.intro-corner'].forEach(sel => {
    screen.querySelectorAll(sel).forEach(el => {
      el.style.transition = 'opacity 0.15s ease-out';
      el.style.opacity = '0';
    });
  });

  // 2) Inject split panels after content gone
  setTimeout(() => {
    const top = document.createElement('div');
    top.className = 'intro-split-panel';
    top.style.cssText = 'top:0; height:50.5%; transform:translateY(0)';
    const bot = document.createElement('div');
    bot.className = 'intro-split-panel';
    bot.style.cssText = 'bottom:0; height:50.5%; transform:translateY(0)';
    screen.appendChild(top);
    screen.appendChild(bot);

    // 3) Trigger split after a single frame
    requestAnimationFrame(() => requestAnimationFrame(() => {
      top.style.transform = 'translateY(-101%)';
      bot.style.transform = 'translateY(101%)';
    }));
  }, 160);

  setTimeout(() => { screen.style.display = 'none'; }, 950);
}

function startEverything() {
  // Fade and remove the launch gate
  const gate = document.getElementById('intro-launch');
  if (gate) {
    gate.classList.add('gone');
    setTimeout(() => { try { gate.remove(); } catch(e) {} }, 1050);
  }

  // Force-restart letter drop animations so they play AFTER the gate closes
  // (they may have already run in the background – this resets them clean)
  document.querySelectorAll('.intro-letter').forEach(el => {
    el.classList.remove('lit');
    el.style.animation = 'none';
    void el.offsetWidth; // force browser reflow
    el.style.animation = ''; // restore CSS class animation with its animation-delay
  });
  initLetterGlow();

  // Start the beat – guaranteed to work because this IS the user gesture
  tryStartIntroBeat();

  // Voice starts 1.2s into the beat so it lands over the beat
  setTimeout(synthIntroVoice, 1200);
}

// Startup
window.addEventListener('DOMContentLoaded', () => {
  buildVUCol('introVULeft',  VU_LEFT);
  buildVUCol('introVURight', VU_RIGHT);
  // Don't init letters here – startEverything() handles it on gate click

  const gate = document.getElementById('intro-launch');
  if (gate) {
    // The launch gate IS the "click to start" – clean and intentional
    gate.addEventListener('pointerdown', startEverything, { once: true, passive: true });
  } else {
    // No gate (e.g. removed manually) – try immediate start
    initLetterGlow();
    tryStartIntroBeat();
    setTimeout(synthIntroVoice, 1200);
  }
});

// =============================
// ARTIST BIOGRAPHY
// =============================
function loadBioProfile() {
  try { return JSON.parse(localStorage.getItem('studio_bio_profile') || '{}'); }
  catch(e) { return {}; }
}
function saveBioProfile() {
  const bio = {
    name:     document.getElementById('bio_name')?.value.trim() || '',
    herkunft: document.getElementById('bio_herkunft')?.value.trim() || '',
    text:     document.getElementById('bio_text')?.value.trim() || '',
    ziele:    document.getElementById('bio_ziele')?.value.trim() || '',
    stil:     document.getElementById('bio_stil')?.value.trim() || ''
  };
  localStorage.setItem('studio_bio_profile', JSON.stringify(bio));
  renderBioDisplay(bio);
  toggleBioEdit(true); // close edit mode
  showToast('Profil gespeichert!', 'success');
}
function renderBioDisplay(bio) {
  const el = document.getElementById('bioDisplay');
  if (!el) return;
  if (!bio.name && !bio.text && !bio.ziele && !bio.stil) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:4px 0;">Noch kein Profil angelegt – klicke auf ✏️ Bearbeiten.</div>`;
    return;
  }
  el.innerHTML = `
    ${bio.name ? `<div class="bio-display-name">${escHtml(bio.name)}${bio.herkunft ? ` <span style="font-size:14px;color:var(--text-muted);font-weight:400;">aus ${escHtml(bio.herkunft)}</span>`:''}</div>` : ''}
    ${bio.text ? `<div class="bio-display-text">${escHtml(bio.text)}</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
      ${bio.ziele ? `<div class="bio-display-section"><div class="bio-display-label">🎯 Ziele / Vision</div><div class="bio-display-text" style="font-size:12px;">${escHtml(bio.ziele)}</div></div>` : ''}
      ${bio.stil  ? `<div class="bio-display-section"><div class="bio-display-label">🎵 Stil & Sound</div><div class="bio-display-text" style="font-size:12px;">${escHtml(bio.stil)}</div></div>` : ''}
    </div>`;
}
function toggleBioEdit(forceClose) {
  const editEl = document.getElementById('bioEdit');
  const dispEl = document.getElementById('bioDisplay');
  const btn    = document.getElementById('bioToggleBtn');
  const isEdit = editEl.style.display !== 'none';
  if (forceClose || isEdit) {
    editEl.style.display = 'none';
    dispEl.style.display = '';
    if(btn) btn.textContent = '✏️ Bearbeiten';
  } else {
    const bio = loadBioProfile();
    document.getElementById('bio_name').value     = bio.name     || '';
    document.getElementById('bio_herkunft').value = bio.herkunft || '';
    document.getElementById('bio_text').value     = bio.text     || '';
    document.getElementById('bio_ziele').value    = bio.ziele    || '';
    document.getElementById('bio_stil').value     = bio.stil     || '';
    editEl.style.display = '';
    dispEl.style.display = 'none';
    if(btn) btn.textContent = '✕ Schließen';
  }
}
function initBioCard() {
  renderBioDisplay(loadBioProfile());
}

// =============================
// VOICE PERSONA
// =============================
function loadVoicePersona() {
  try { return JSON.parse(localStorage.getItem('studio_voice_persona') || '{}'); }
  catch(e) { return {}; }
}
function openVoiceModal() {
  const vp = loadVoicePersona();
  document.getElementById('vp_name').value      = vp.name      || '';
  document.getElementById('vp_charakter').value = vp.charakter || '';
  document.getElementById('vp_flow').value      = vp.flow      || '';
  buildVpEmotionGrid(vp.defaultEmotion || '');
  document.getElementById('voiceModalOverlay').classList.add('open');
}
function closeVoiceModal() {
  document.getElementById('voiceModalOverlay').classList.remove('open');
}
function buildVpEmotionGrid(selected) {
  const grid = document.getElementById('vpEmotionGrid');
  if (!grid) return;
  grid.innerHTML = VOICE_EMOTIONS.map(e =>
    `<button class="voice-emotion-btn${e===selected?' sel':''}" onclick="selectVpEmotion(this,'${e}')">${e}</button>`
  ).join('');
}
function selectVpEmotion(btn, emotion) {
  document.querySelectorAll('#vpEmotionGrid .voice-emotion-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
}
function saveVoicePersona() {
  const selBtn = document.querySelector('#vpEmotionGrid .voice-emotion-btn.sel');
  const vp = {
    name:          document.getElementById('vp_name').value.trim(),
    charakter:     document.getElementById('vp_charakter').value.trim(),
    flow:          document.getElementById('vp_flow').value.trim(),
    defaultEmotion: selBtn ? selBtn.textContent.trim() : ''
  };
  localStorage.setItem('studio_voice_persona', JSON.stringify(vp));
  closeVoiceModal();
  updateVoicePersonaBadge();
  showToast('Voice Persona gespeichert!', 'success');
}
function updateVoicePersonaBadge() {
  const vp = loadVoicePersona();
  // Update topbar button label to show active persona
  const btn = document.querySelector('.btn-voice');
  if (btn) {
    btn.textContent = vp.name ? `🎤 ${vp.name}` : '🎤 Voice Persona';
  }
}

// =============================
// SUNO PERSONAS
// =============================

let currentSpId = null; // selected persona id for current song

function initSunoPersonaPicker() {
  const grid = document.getElementById('spGrid');
  if (!grid) return;
  const saved = (currentSongId && songs[currentSongId]?.suno_persona_id) || null;
  currentSpId = saved;
  grid.innerHTML = SUNO_PERSONAS.map(p => `
    <div class="sp-card${p.id===saved?' selected':''}" data-sp="${p.id}"
         style="--sp-color:${p.color}"
         onclick="selectSunoPersona('${p.id}')">
      <div class="sp-card-emoji">${p.emoji}</div>
      <div class="sp-card-name">${p.tag || p.id.toUpperCase()}</div>
      <div class="sp-card-bpm">${p.bpm} BPM</div>
      <div class="sp-card-tag" style="color:${p.color};border-color:${p.color}44;background:${p.color}11;">${p.tag}</div>
      <button class="sp-preview-btn" onclick="event.stopPropagation();previewPersonaVoice('${p.id}')" title="Stimme vorhören">▶</button>
    </div>`).join('');
  if (saved) renderSpDetail(saved);
}

function selectSunoPersona(id) {
  currentSpId = id;
  // Update card selection
  document.querySelectorAll('.sp-card').forEach(c => c.classList.toggle('selected', c.dataset.sp === id));
  // Save to song
  if (currentSongId && songs[currentSongId]) {
    songs[currentSongId].suno_persona_id = id;
    saveToStorage();
  }
  renderSpDetail(id);
  // Update badge
  const persona = SUNO_PERSONAS.find(p => p.id === id);
  const badge = document.getElementById('spSelectedBadge');
  if (badge && persona) {
    badge.textContent = persona.emoji + ' ' + persona.name;
    badge.style.display = '';
    badge.style.setProperty('color', persona.color);
    badge.style.setProperty('border-color', persona.color + '44');
    badge.style.setProperty('background', persona.color + '18');
  }
}

function renderSpDetail(id) {
  const persona = SUNO_PERSONAS.find(p => p.id === id);
  if (!persona) return;
  const detail = document.getElementById('spDetail');
  if (!detail) return;
  detail.style.display = '';
  detail.style.setProperty('--sp-color', persona.color);
  const fmt = (currentSongId && songs[currentSongId]?.p1_song_format) || 'solo';
  const isDuett = fmt === 'duett';
  document.getElementById('spDetailTitle').textContent = persona.emoji + '  ' + persona.name + '  ·  ' + persona.bpm + ' BPM' + (isDuett ? '  🎙️ DUETT' : '');
  const fullPrompt = isDuett && persona.duett
    ? persona.prompt + '\n\n' + persona.duett
    : persona.prompt;
  document.getElementById('spPromptBox').textContent = fullPrompt;
  const linkEl = document.getElementById('spSunoLink');
  if (linkEl) {
    linkEl.innerHTML = persona.url
      ? `<a href="${persona.url}" target="_blank" class="btn-copy" style="text-decoration:none;background:rgba(59,130,246,0.15);border-color:rgba(59,130,246,0.4);color:#60a5fa;">↗ In Suno öffnen</a>`
      : `<span class="sp-no-url">Noch keine Suno-URL</span>`;
  }
}


function previewPersonaVoice(id) {
  const settings = PERSONA_VOICE_LINES[id];
  const persona = SUNO_PERSONAS.find(p => p.id === id);
  if (!settings || !persona) return;
  if (!window.speechSynthesis) { showToast('Sprachausgabe nicht verfügbar', 'error'); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(settings.text);
  const voices = window.speechSynthesis.getVoices();
  const german = voices.find(v => v.lang === 'de-DE') || voices.find(v => v.lang.startsWith('de')) || voices.find(v => v.lang.startsWith('en'));
  if (german) u.voice = german;
  u.pitch = settings.pitch; u.rate = settings.rate; u.volume = 1; u.lang = 'de-DE';
  window.speechSynthesis.speak(u);
  showToast(`${persona.emoji} ${persona.name} – wird abgespielt…`, 'success');
}

function copySpPrompt() {
  const txt = document.getElementById('spPromptBox')?.textContent || '';
  navigator.clipboard.writeText(txt).then(() => showToast('Persona-Prompt kopiert!', 'success')).catch(() => fallbackCopy(txt));
}

function applySpToBeat() {
  const persona = SUNO_PERSONAS.find(p => p.id === currentSpId);
  if (!persona) return;
  // Apply BPM
  const bpmEl = document.getElementById('p3_bpm');
  const bpmValEl = document.getElementById('p3_bpm_val');
  if (bpmEl) { bpmEl.value = persona.bpm; if(bpmValEl) bpmValEl.textContent = persona.bpm; }
  // Apply mood tag to custom multi-select component
  const moodHidden = document.getElementById('p3_mood');
  if (moodHidden && persona.tag) {
    let current = moodHidden.value.split(',').map(v => v.trim()).filter(Boolean);
    if (!current.some(v => v.toLowerCase().includes(persona.tag.toLowerCase()))) {
      current.push(persona.tag);
      moodHidden.value = current.join(', ');
      renderMultiSelTags('p3_mood', current);
    }
  }
  autoSave();
  showToast(`BPM auf ${persona.bpm} gesetzt!`, 'success');
}

// =============================
// INIT
// =============================
window.addEventListener('DOMContentLoaded', () => {
  initBioCard();
  updateVoicePersonaBadge();
  buildIntroParticles();
});
