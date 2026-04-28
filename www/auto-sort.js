const SORT = {
  download: '/storage/emulated/0/Download',
  musik:    '/storage/emulated/0/DaN_Vibe/DaN_Musik',
  video:    '/storage/emulated/0/DaN_Vibe/DaN_Video'
};
const AUDIO = ['mp3','wav','ogg','flac','aac','m4a','opus','wma','oga'];
const VIDEO = ['mp4','webm','mov','avi','mkv','m4v','wmv','3gp'];

async function danAutoSort() {
  if (!window.Capacitor) return;
  const FS = window.Capacitor.Plugins.Filesystem;

  // Berechtigung anfragen
  try {
    const perm = await FS.requestPermissions();
    if (perm.publicStorage !== 'granted') {
      danSortToast('⚠️ Speicherzugriff fehlt – bitte in Einstellungen erlauben');
      return;
    }
  } catch(e) {}

  // Ziel-Ordner anlegen
  for (const dir of [SORT.musik, SORT.video]) {
    try { await FS.mkdir({ path: dir, recursive: true }); } catch(e) {}
  }

  // Download-Ordner scannen
  let dateien = [];
  try {
    const r = await FS.readdir({ path: SORT.download });
    dateien = r.files || [];
  } catch(e) { danSortToast('Download-Ordner nicht lesbar'); return; }

  let verschoben = 0;
  for (const f of dateien) {
    const name = typeof f === 'string' ? f : f.name;
    if (!name || name.startsWith('.')) continue;
    const ext = name.split('.').pop().toLowerCase();

    let ziel = null;
    if (AUDIO.includes(ext)) ziel = SORT.musik;
    else if (VIDEO.includes(ext)) ziel = SORT.video;

    if (ziel) {
      try {
        await FS.rename({ from: `${SORT.download}/${name}`, to: `${ziel}/${name}` });
        verschoben++;
      } catch(e) { console.warn('Fehler:', name, e); }
    }
  }

  if (verschoben > 0) {
    danSortToast(`✓ ${verschoben} Datei(en) nach DaN_Vibe sortiert`);
    if (typeof rpRescan === 'function') setTimeout(rpRescan, 500);
  }
}

function danSortToast(msg) {
  let t = document.getElementById('rpToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'rpSortToast';
    Object.assign(t.style, {
      position:'fixed', bottom:'80px', left:'50%',
      transform:'translateX(-50%)',
      background:'rgba(212,160,23,0.95)', color:'#0d0b08',
      padding:'8px 18px', borderRadius:'20px',
      fontFamily:"'Bebas Neue',sans-serif", fontSize:'14px',
      zIndex:'200', pointerEvents:'none', transition:'opacity 0.4s'
    });
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._to);
  t._to = setTimeout(() => t.style.opacity = '0', 3500);
}

document.addEventListener('DOMContentLoaded', danAutoSort);
