// =============================
// LOADING STATE HELPERS
// =============================
function setLoading(spinnerIconId, btnTextId, loading, originalIcon = '✨', originalText = 'Mit KI generieren') {
  const icon = document.getElementById(spinnerIconId);
  const btn = icon?.closest('button');
  const text = document.getElementById(btnTextId);
  if (loading) {
    if (icon) icon.innerHTML = '<span class="spinner"></span>';
    if (text) text.textContent = 'Generiere...';
    if (btn) btn.disabled = true;
  } else {
    if (icon) icon.textContent = originalIcon;
    if (text) text.textContent = originalText;
    if (btn) btn.disabled = false;
  }
}

function showResult(resultBoxId, contentId, text) {
  const box = document.getElementById(resultBoxId);
  const content = document.getElementById(contentId);
  if (box) box.classList.add('visible');
  if (content) content.textContent = text;
}

// =============================
// PHASE GENERATION FUNCTIONS
// =============================

// Builds context string about song format, language, and module for AI prompts
function hideResult(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('visible');
}

// =============================
// UTILITIES
// =============================
function getVal(id) {
  return document.getElementById(id)?.value || '';
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}
function setSelectVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function copyResult(contentId) {
  const text = document.getElementById(contentId)?.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    showToast('Kopiert!', 'success');
  }).catch(() => {
    fallbackCopy(text);
  });
}

function copyText(inputId) {
  const text = document.getElementById(inputId)?.value || '';
  navigator.clipboard.writeText(text).then(() => {
    showToast('Kopiert!', 'success');
  }).catch(() => {
    fallbackCopy(text);
  });
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('Kopiert!', 'success');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
  document.getElementById('sidebarBackdrop').classList.toggle('visible', sidebarOpen);
  closeMobileMenu();
}
function closeSidebar() {
  sidebarOpen = false;
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('visible');
}
function toggleMobileMenu() {
  document.getElementById('mobileMenuDropdown').classList.toggle('open');
}
function closeMobileMenu() {
  document.getElementById('mobileMenuDropdown').classList.remove('open');
}

function exportSongPDF() {
  if (!currentSongId || !songs[currentSongId]) {
    showToast('Kein Song ausgewählt!', 'error');
    return;
  }
  if (!window.jspdf) {
    showToast('PDF-Library lädt noch – bitte kurz warten.', 'error');
    return;
  }
  const { jsPDF } = window.jspdf;
  const song = songs[currentSongId];
  const profile = getProfile();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const W = 210, H = 297, ML = 18, MR = 18, TW = W - ML - MR;
  let y = 0;

  const C_PURPLE = [124, 58, 237];
  const C_DARK   = [12, 12, 22];
  const C_TEXT   = [28, 28, 45];
  const C_MUTED  = [110, 110, 145];
  const C_WHITE  = [255, 255, 255];
  const C_LIGHT  = [245, 243, 255];

  function footerOnPage() {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C_MUTED);
    doc.setDrawColor(...C_PURPLE);
    doc.setLineWidth(0.25);
    doc.line(ML, H - 12, W - MR, H - 12);
    doc.text('D_a_N Studio', ML, H - 7);
    doc.text(new Date().toLocaleDateString('de-DE'), W - MR, H - 7, { align: 'right' });
  }

  function checkPage(needed = 18) {
    if (y + needed > H - 18) {
      footerOnPage();
      doc.addPage();
      y = 22;
    }
  }

  function sectionBar(title) {
    checkPage(20);
    y += 4;
    doc.setFillColor(...C_PURPLE);
    doc.roundedRect(ML, y, TW, 7.5, 1.5, 1.5, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_WHITE);
    doc.text(title.toUpperCase(), ML + 4, y + 5.3);
    y += 12;
  }

  function twoColFields(fields) {
    const col2 = ML + TW / 2 + 2;
    for (let i = 0; i < fields.length; i += 2) {
      checkPage(12);
      const [l1, v1] = fields[i];
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C_MUTED);
      doc.text(l1.toUpperCase(), ML, y);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C_TEXT);
      const v1lines = doc.splitTextToSize(v1 || '—', TW / 2 - 4);
      doc.text(v1lines[0], ML, y + 4.5);

      if (fields[i + 1]) {
        const [l2, v2] = fields[i + 1];
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C_MUTED);
        doc.text(l2.toUpperCase(), col2, y);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C_TEXT);
        const v2lines = doc.splitTextToSize(v2 || '—', TW / 2 - 4);
        doc.text(v2lines[0], col2, y + 4.5);
      }
      y += 11;
    }
  }

  function addTextBlock(text) {
    if (!text) return;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C_TEXT);
    const lines = doc.splitTextToSize(text, TW);
    lines.forEach(line => {
      checkPage(6);
      doc.text(line, ML, y);
      y += 5.5;
    });
    y += 2;
  }

  function addLyrics(text) {
    if (!text) return;
    const rawLines = text.split('\n');
    rawLines.forEach(line => {
      if (line.trim() === '') { y += 3; return; }
      if (/^\[.+\]/.test(line.trim())) {
        checkPage(8);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C_PURPLE);
        doc.text(line.trim(), ML, y);
        y += 5.5;
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C_TEXT);
        const wrapped = doc.splitTextToSize(line, TW);
        wrapped.forEach(wl => { checkPage(6); doc.text(wl, ML, y); y += 5.2; });
      }
    });
    y += 2;
  }

  // ── PAGE 1 HEADER ──────────────────────────────────
  doc.setFillColor(...C_DARK);
  doc.rect(0, 0, W, 38, 'F');
  doc.setFillColor(...C_PURPLE);
  doc.rect(0, 36, W, 2.5, 'F');

  // Logo box
  doc.setFillColor(...C_PURPLE);
  doc.roundedRect(ML, 9, 22, 22, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C_WHITE);
  doc.text('D_a_N', ML + 1.5, 22.5);

  // Title & artist
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C_WHITE);
  doc.text('D_a_N Studio', ML + 26, 20);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 180, 255);
  const artistStr = profile.name + (profile.handle ? ' · ' + profile.handle : '');
  doc.text(artistStr, ML + 26, 28);

  // Date
  doc.setFontSize(8.5);
  doc.setTextColor(160, 150, 210);
  doc.text(new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'long', year:'numeric' }), W - MR, 28, { align: 'right' });

  // ── SONG TITLE ─────────────────────────────────────
  y = 50;
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C_TEXT);
  const titleLines = doc.splitTextToSize(song.name, TW);
  titleLines.forEach(tl => { doc.text(tl, ML, y); y += 10; });

  doc.setDrawColor(...C_PURPLE);
  doc.setLineWidth(0.5);
  doc.line(ML, y, W - MR, y);
  y += 8;

  // ── KONZEPT ────────────────────────────────────────
  const koncFields = [
    ['Thema', song.p1_thema], ['Emotion', song.p1_emotion],
    ['Sprache', song.p1_sprache], ['Tonalität', song.p1_tonalitaet],
    ['Stil', song.p1_stil], ['Zielgruppe', song.p1_zielgruppe],
  ].filter(([, v]) => v);
  if (koncFields.length) { sectionBar('Konzept'); twoColFields(koncFields); }

  // ── BESCHREIBUNG ───────────────────────────────────
  if (song.p2_konzept) { sectionBar('Beschreibung'); addTextBlock(song.p2_konzept); }

  // ── LYRICS ─────────────────────────────────────────
  if (song.p2_lyrics) { sectionBar('Lyrics'); addLyrics(song.p2_lyrics); }

  // ── BEAT & SOUND ───────────────────────────────────
  const beatFields = [
    ['BPM', song.p3_bpm ? String(song.p3_bpm) : ''],
    ['Tonart', song.p3_key],
    ['Stil', song.p3_stil],
    ['Mood', song.p3_mood],
    ['Instrumente', song.p3_instrumente],
  ].filter(([, v]) => v);
  if (beatFields.length) {
    sectionBar('Beat & Sound');
    twoColFields(beatFields);
    if (song.p3_suno_link) {
      checkPage(10);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C_MUTED);
      doc.text('SUNO LINK', ML, y);
      y += 4.5;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 220);
      doc.text(song.p3_suno_link.substring(0, 80), ML, y);
      y += 6;
    }
  }

  // ── NOTIZEN ────────────────────────────────────────
  if (song.song_notes) { sectionBar('Notizen'); addTextBlock(song.song_notes); }

  // ── FOOTER on all pages ────────────────────────────
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    footerOnPage();
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`${i} / ${total}`, W / 2, H - 7, { align: 'center' });
  }

  const filename = song.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_]/g, '').replace(/\s+/g, '-').toLowerCase() + '.pdf';
  doc.save(filename);
  showToast('PDF exportiert! 📄', 'success');
}

function copyOvField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent.trim()).then(() => showToast('Kopiert!', 'success'));
}
function copyEl(id) {
  copyOvField(id);
}

