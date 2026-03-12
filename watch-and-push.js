// Auto-Push Watcher – DaN Music Manager
// Startet mit: node watch-and-push.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIR = __dirname;
const DEBOUNCE_MS = 3000; // 3 Sekunden warten nach letzter Änderung

let timer = null;
let pending = false;

function updateTimestamp() {
  const file = path.join(DIR, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const now = new Date().toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  html = html.replace(/✅ Stand: [^"]+/, `✅ Stand: ${now}`);
  fs.writeFileSync(file, html, 'utf8');
}

function push() {
  try {
    console.log('\n⏳ Änderungen erkannt – pushe zu GitHub...');
    updateTimestamp();
    execSync('git add .', { cwd: DIR, stdio: 'inherit' });
    execSync(`git commit -m "auto: ${new Date().toLocaleString('de-DE')}"`, { cwd: DIR, stdio: 'inherit' });
    execSync('git push origin main', { cwd: DIR, stdio: 'inherit' });
    console.log('✅ Online! https://mailadresse671-lab.github.io/dan-music-manager/\n');
  } catch (e) {
    // Kein Commit nötig (keine Änderungen) – ignorieren
    if (!e.message.includes('nothing to commit')) {
      console.error('❌ Push-Fehler:', e.message);
    }
  }
  pending = false;
}

function onFileChange(filename) {
  if (filename.includes('node_modules') || filename.includes('.git')) return;
  if (pending) return;
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(push, DEBOUNCE_MS);
}

console.log('👀 Watcher gestartet – speichere eine Datei um automatisch zu pushen.');
console.log('🌐 URL: https://mailadresse671-lab.github.io/dan-music-manager/');
console.log('🔴 Beenden mit: Ctrl+C\n');

fs.watch(DIR, { recursive: true }, (event, filename) => {
  if (filename) onFileChange(filename);
});
