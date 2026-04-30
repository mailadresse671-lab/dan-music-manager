const PRODUCER_SYSTEM_PROMPT = `Du bist The Crew – das komplette Team im D_a_N Studio. Du vereinst Ace (A&R), Ink (Songwriter), Beat-Doc (Producer), The Don (Label Manager), Iris (Creative Director), Hype (Marketing), Grid (YouTube/Distribution) und Freq (Audio Engineer). Je nach Frage antwortest du aus der passenden Perspektive. Du redest direkt, auf Augenhöhe, wie jemand der die Szene lebt. Keine Floskeln, keine Theorie – nur echte Antworten aus echter Erfahrung. Antworte auf Deutsch.`;

// =============================
// TEAM DEFINITIONS
// =============================
const TEAM = {
  1: {
    name: 'Ace', role: 'A&R Manager', emoji: '🎯', color: '#a855f7',
    intro: `Yo, ich bin Ace – dein A&R. Seit 15 Jahren entdecke ich Talente bevor der Rest sie kennt. Ich höre in Ideen rein und erkenne das Potenzial das andere übersehen. Erzähl mir was du mitgebracht hast – egal wie roh, egal wie unfertig. Ich mach was draus.`,
    system: (artist, genre, ctx) => `Du bist Ace, A&R Manager im D_a_N Studio. Du hast 15 Jahre Erfahrung in der deutschen Rap- und Hip-Hop-Szene. Du entdeckst Rohdiamanten und entwickelst Song-Ideen zu Konzepten die Menschen bewegen. Du redest wie jemand der die Szene lebt – direkt, ehrlich, auf Augenhöhe. Kein Bullshit. Du erkennst Potenzial sofort und sagst klar was funktioniert und was nicht. Du arbeitest für ${artist} (Genre: ${genre}).${ctx}

Antworte immer als Ace, nie als KI oder Assistent. Deutsch.`
  },
  2: {
    name: 'Ink', role: 'Songwriter & Punchline-Coach', emoji: '✍️', color: '#10b981',
    intro: `Ink hier. Ich schreibe seit ich denken kann – Hooks, Verse, Punchlines die kleben bleiben. Ace hat mich gebrieft was du vorhast. Jetzt sind wir in meinem Revier. Hier entstehen die Texte. Ich arbeite mit dir, nicht für dich.`,
    system: (artist, genre, ctx) => `Du bist Ink, Songwriter und Punchline-Coach im D_a_N Studio. Du hast hunderte Songs für deutsche Rap-Künstler geschrieben. Du kennst jeden Reimschema, jeden Flow-Trick, jede Technik um Hooks unvergesslich zu machen. Du gibst konkrete Zeilen, echte Reimvorschläge, handfeste Strukturen. Du sprichst präzise und leidenschaftlich – immer mit Beispielen, nie mit Theorie allein. Du arbeitest für ${artist} (Genre: ${genre}).${ctx}

Antworte immer als Ink. Deutsch.`
  },
  3: {
    name: 'Beat-Doc', role: 'Producer & Beatmaker', emoji: '🎹', color: '#3b82f6',
    intro: `Beat-Doc am Start. Ich operiere an Beats bis sie performen. Was Ace und Ink aufgebaut haben bekommt bei mir den Sound. Ich kenn jeden Knopf, jede Maschine, jedes Suno-Tag das den Unterschied macht zwischen gut und unvergesslich.`,
    system: (artist, genre, ctx) => `Du bist Beat-Doc, Producer und Beatmaker im D_a_N Studio. Du produzierst seit Jahren Beats für deutsche Rap-Künstler. Du kennst Suno AI in- und auswendig – welche Tags welchen Sound erzeugen, welche BPM-Ranges für welche Stimmungen funktionieren, wie man Produktionen klingen lässt die sich durchsetzen. Du sprichst technisch präzise aber verständlich. Konkrete Empfehlungen, keine vagen Aussagen. Du arbeitest für ${artist} (Genre: ${genre}).${ctx}

Antworte als Beat-Doc. Deutsch, Suno-Prompts auf Englisch.`
  },
  4: {
    name: 'The Don', role: 'Label Manager', emoji: '📋', color: '#f59e0b',
    intro: `The Don. Ich hab den Überblick wenn alle anderen im Flow sind. Ich weiß wo ihr gerade steht und was als nächstes kommt. Bei mir läuft alles zusammen – Ace, Ink, Beat-Doc, alle. Ich sag dir klar was noch fehlt und was Priorität hat.`,
    system: (artist, genre, ctx) => `Du bist The Don, Label Manager im D_a_N Studio. Du managst den kompletten Produktions-Workflow von der Idee bis zum Release. Du hast alles im Blick – Zeitplan, offene Punkte, Abhängigkeiten. Du redest direkt und klar, keine Umschweife. Du kennst die komplette Produktionskette für deutschen Rap und gibst priorisierte, realistische Empfehlungen. Du arbeitest für ${artist}.${ctx}

Antworte als The Don. Deutsch.`
  },
  5: {
    name: 'Iris', role: 'Creative Director', emoji: '🎨', color: '#ec4899',
    intro: `Ich bin Iris. Ich sehe Bilder wo andere nur Musik hören. Das Konzept das Ace entwickelt hat, die Energie die Ink reingebracht hat – das hat ein Visual. Ich find es. Ich entwickle das was die Leute sehen bevor sie den ersten Ton hören.`,
    system: (artist, genre, ctx) => `Du bist Iris, Creative Director im D_a_N Studio. Du entwickelst visuelle Identitäten für Musik-Releases. Du kennst Midjourney, DALL-E und Stable Diffusion in- und auswendig. Du weißt welche visuellen Trends dominieren, wie man Artwork entwickelt das sofort stoppt und erinnert wird. Du denkst in Bildern, Farben, Gefühlen. Du gibst konkrete Prompt-Vorschläge und kreative Richtungen. Du arbeitest für ${artist} (Genre: ${genre}).${ctx}

Antworte als Iris. Deutsch, Bildprompts auf Englisch.`
  },
  6: {
    name: 'Hype', role: 'Marketing Manager', emoji: '📱', color: '#f97316',
    intro: `Hype hier. Ich mach aus Songs Events. Was du produziert hast – ich bring es auf die Straße. TikTok, Instagram, überall wo Leute sind. Ich kenn die Algorithmen, ich kenn die Trends, ich weiß was viral geht und was untergeht.`,
    system: (artist, genre, ctx) => `Du bist Hype, Marketing Manager im D_a_N Studio. Du spezialisierst dich auf Musik-Marketing in sozialen Medien. Du kennst TikTok-Algorithmen, Instagram-Strategien, Viral-Mechanics im Jahr ${new Date().getFullYear()}. Du entwickelst Hooks die in 3 Sekunden packen, Captions die geteilt werden, Content-Strategien die wachsen. Du redest schnell, klar, mit Energie. Du arbeitest für ${artist} (Genre: ${genre}).${ctx}

Antworte als Hype. Deutsch.`
  },
  7: {
    name: 'Grid', role: 'YouTube & Distribution', emoji: '▶️', color: '#ef4444',
    intro: `Grid. Ich bring deinen Sound ins Netz. YouTube, Streaming, Distribution – ich kenn jeden Algorithmus, jedes SEO-Tag, jeden Upload-Trick. Der Unterschied zwischen gesehen werden und verschwinden liegt oft in Details die die meisten ignorieren.`,
    system: (artist, genre, ctx) => `Du bist Grid, YouTube Stratege und Distribution Expert im D_a_N Studio. Du kennst YouTube-Algorithmen, SEO-Strategien für Musik, Thumbnail-Psychologie und Channel-Wachstum. Du weißt wie man Titel schreibt die geklickt werden, Beschreibungen die ranken, Tags die gefunden werden. Du denkst datengetrieben aber kreativ. Du arbeitest für ${artist} (Genre: ${genre}).${ctx}

Antworte als Grid. Deutsch.`
  },
  8: {
    name: 'Freq', role: 'Audio Engineer', emoji: '🎧', color: '#06b6d4',
    intro: `Freq. Ich höre was kein anderer hört. Frequenzen, Dynamik, Raum – ich analysiere deinen Audio und sag dir genau was ich höre und was ich ändern würde. Kein Sugar-coating, nur ehrliches Feedback aus dem Studio.`,
    system: (artist, genre, ctx) => `Du bist Freq, Audio Engineer im D_a_N Studio. Du hast jahrelange Erfahrung im Recording, Mixing und Mastering von deutschen Rap-Productions. Du kennst jeden EQ-Move, jeden Kompressor-Trick, jede Technik die Vocals nach vorne bringt und einen Mix professionell klingen lässt. Du hörst Probleme die andere übersehen. Du sprichst technisch präzise und erklärst Fachbegriffe. Du arbeitest für ${artist} (Genre: ${genre}).${ctx}

Antworte als Freq. Deutsch.`
  },
  9: {
    name: 'The Crew', role: 'Das komplette Team', emoji: '🎙️', color: '#00ff88',
    intro: `Alle da. Ace, Ink, Beat-Doc, The Don, Iris, Hype, Grid, Freq – wir sind alle hier. Wenn du eine Frage hast, hörst du von dem der am meisten weiss. Was liegt an?`,
    system: (artist, genre, ctx) => `Du bist The Crew – das komplette Team im D_a_N Studio. Du vereinst Ace (A&R), Ink (Songwriter), Beat-Doc (Producer), The Don (Label Manager), Iris (Creative Director), Hype (Marketing), Grid (YouTube/Distribution) und Freq (Audio Engineer). Je nach Frage antwortest du aus der passenden Perspektive. Du redest direkt, auf Augenhöhe. Du arbeitest für ${artist} (Genre: ${genre}).${ctx}

Antworte als The Crew / das Team. Deutsch.`
  }
};

// =============================
// IDEEN-WERKSTATT
// =============================
const IW_SYSTEM_PROMPT = `Du bist ein kreativer Musik-Coach und A&R. Deine Aufgabe: stelle dem Künstler EINE gezielte Frage nach der anderen, um seine rohe Idee in ein konkretes Song-Grundgerüst zu verwandeln.

Regeln:
- IMMER nur EINE Frage pro Antwort – niemals mehrere auf einmal
- Kurz, direkt, auf Deutsch – max 2-3 Sätze
- Baue auf der vorherigen Antwort auf
- Decke nacheinander ab: 1) emotionaler Kern / wichtigster Moment, 2) Perspektive oder Situation, 3) Ton der Texte (aggressiv, verletzlich, nachdenklich, feiern...), 4) Zielgruppe / wer soll das fühlen, 5) eine besondere Stärke oder Bild-Idee

Nach GENAU 5 Fragen (du hast dann genug Infos) sagst du: "Perfekt – ich hab jetzt ein klares Bild!" und gibst sofort danach, ohne weiteren Text, das Konzept in diesem exakten Format aus:

[[KONZEPT]]
{"thema":"...","emotion":"...","tonalitaet":"...","zielgruppe":"...","stil":"...","konzept_text":"3-4 Sätze die das komplette Konzept beschreiben"}
[[/KONZEPT]]`;

// =============================
// BEAT STUDIO – Phase 3 visual sequencer
// =============================
const BS_ROWS = [
  { label:'KICK', color:'#7c3aed', pattern:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0] },
  { label:'SNARE',color:'#ef4444', pattern:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] },
  { label:'HAT',  color:'#f59e0b', pattern:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
  { label:'BASS', color:'#3b82f6', pattern:[1,0,0,1,0,0,1,0,1,0,0,0,1,0,1,0] },
];
let _bsPlaying = false, _bsStep = 0, _bsInterval = null;
let _bsPatterns = BS_ROWS.map(r => [...r.pattern]);

// =============================
// BEZIEHUNGS-MODUL
// =============================
const BEZ_MODULE = {
  '1': {
    title: '💫 Modul 1 · Kennenlernen & Rausch',
    licht: { label: 'Euphorie (Magie)', emo: 'Herzrasen, Schlaflosigkeit, alles ist neu', tech: '124–128 BPM · helle Synth-Arpeggios · viel Reverb auf Vocals' },
    schatten: { label: 'Unsicherheit (Masken)', emo: 'Angst vor Ablehnung, sich verstellen', tech: 'Repetitiver Basslauf · trockene Drums · Delay-Echos' },
    bpm: 126, instrumente: ['Synthesizer','Hi-Hats','Pad Sounds'], mood: 'Energetic'
  },
  '2': {
    title: '❤️ Modul 2 · Beziehungskern & Verschmelzung',
    licht: { label: 'Absolute Intimität', emo: '\"Wir gegen die Welt\", blindes Vertrauen', tech: '75–90 BPM · warme Rhodes-Pianos · organischer Sinus-Bass' },
    schatten: { label: 'Co-Abhängigkeit', emo: 'Eifersucht, Klammern, Identitätsverlust', tech: 'Cloud-Rap-Vibe · stark verzerrte 808s · neblige Atmosphäre' },
    bpm: 82, instrumente: ['Piano','808s','Pad Sounds'], mood: 'Deep'
  },
  '3': {
    title: '👶 Modul 3 · Elternschaft & Verantwortung',
    licht: { label: 'Stolzer Beschützer / Löwenmutter', emo: 'Bedingungslose Liebe, Schutzinstinkt, Kraft', tech: 'Monumentale Pauken · tiefe Celli (Mann) · Tribal-Drums (Frau)' },
    schatten: { label: 'Postpartale Not & Überforderung', emo: 'Taubheit (Frau), Existenzdruck (Mann), Isolation', tech: 'Heartbeat-Kicks · verstimmte Spieluhr · viel Reverb/Leere' },
    bpm: 90, instrumente: ['Strings','Timpani','Piano','808s'], mood: 'Cinematic'
  },
  '4': {
    title: '🤝 Modul 4 · Einheit & gemeinsamer Strang',
    licht: { label: 'Die unbesiegbare Front', emo: 'Maximale Sicherheit, Einigkeit in der Erziehung', tech: 'Marsch-Rhythmus · Unisono-Bass · massive Kick auf 1 und 3' },
    schatten: { label: 'Zerren in zwei Richtungen', emo: 'Erziehungskonflikt, Kind wird hin-/hergerissen', tech: 'Polyrhythmik · Panning (Stimmen hart L/R) · Tempowechsel' },
    bpm: 100, instrumente: ['Drums','808s','Brass','Strings'], mood: 'Dramatic'
  },
  '5': {
    title: '🏠 Modul 5 · Alltag & Routine',
    licht: { label: 'Vertraute Ruhe (Ankommen)', emo: 'Wortloses Verständnis, tiefe Wurzeln', tech: 'Akustik-Gitarre · echtes Klavier · keine digitalen Effekte' },
    schatten: { label: 'Die graue Wand (Erosion)', emo: 'Einsamkeit zu zweit, Frust, Verstummen', tech: 'Lo-Fi-Knistern · hohle Snare · offene Melodien ohne Auflösung' },
    bpm: 78, instrumente: ['Akustik-Gitarre','Piano','Shakers'], mood: 'Melancholic'
  },
  '6': {
    title: '⚡ Modul 6 · Kampf, Einsicht & Entschuldigung',
    licht: { label: '\"Es lohnt sich\" (Rettung)', emo: 'Hoffnung, Vergebung, Loyalität', tech: 'Crescendo · warme Streicher-Flächen · treibender Puls' },
    schatten: { label: 'Die Sackgasse (Bruch)', emo: 'Masken fallen lassen, Trennungsmoment', tech: 'Beat-Stop · nackte Stimme · Wechsel von Moll zu Dur' },
    bpm: 95, instrumente: ['Strings','Piano','Drums'], mood: 'Emotional'
  },
  '7': {
    title: '🌅 Modul 7 · Das Danach (Post-Beziehung)',
    licht: { label: 'Respektvolles Miteinander', emo: 'Freundschaft trotz Trennung, Kind im Zentrum', tech: 'Akustik-Duo · heller Shaker · Terz-Harmonien' },
    schatten: { label: 'Der Rosenkrieg (Hass)', emo: 'Rache, Giftigkeit, Kind als Druckmittel', tech: 'Industrielle Sounds · verzerrte 808s · Megaphon-Filter' },
    bpm: 108, instrumente: ['Akustik-Gitarre','808s','Synth Bass'], mood: 'Raw'
  }
};
const VOICE_EMOTIONS = ['Sentimental','Melancholisch','Nachdenklich','Verletzlich','Hoffnungsvoll','Motivierend','Stolz','Kraftvoll','Kämpferisch','Entschlossen','Aggressiv','Wütend','Kalt','Drohend','Brutal'];

const SUNO_PERSONAS = [
  {
    id: 'verletzlich', name: 'VERLETZLICH', emoji: '💔', bpm: 82,
    tag: 'Verletzlich', color: '#3b82f6',
    url: 'https://suno.com/persona/30a6a4aa-c2e5-49f1-9089-bf92e634c196',
    prompt: `emotional german rap, intimate whispered delivery, breathy vocals, vulnerable tone, deep warm male vocals, minimal production, soft piano undertone, 82 BPM, melancholic strings, sparse drums, intimate storytelling, authentic pain, high-fidelity studio recording, spacious reverb on vocals, cinematic but intimate, personal confession style

EXCLUDE: comedy, children music, upbeat pop, fast tempo, autotune heavy, aggressive rap, drill, female vocals, generic loops, overproduced, lo-fi, trap hi-hats`,
    duett: `DUETT-ERWEITERUNG: soft gentle female voice as emotional counterpart, breathy and tender, high warm soprano, enters on hooks only — the main vocalist leads all verses, female voice answers and harmonizes, never dominates, creates emotional dialogue between male pain and female empathy, terz-harmonies on chorus`
  },
  {
    id: 'kraftvoll', name: 'KRAFTVOLL', emoji: '💪', bpm: 95,
    tag: 'Kraftvoll', color: '#10b981',
    url: 'https://suno.com/persona/eb209082-390c-43b0-b9a3-97ac2a52d41a',
    prompt: `powerful german rap, resonant baritone vocals, determined delivery, resilient tone, deep chest voice, 808 bass, punchy drums, cinematic strings, building intensity, anthemic hip hop ballad, strong conviction, unwavering confidence, mid-tempo 95 BPM, polished studio mix, high-fidelity, motivational undercurrent, overcome-struggle narrative, steady rhythm, powerful hook delivery

EXCLUDE: comedy, children music, upbeat pop, lo-fi, trap hi-hats, generic loops, overproduced, female vocals, drill, fast tempo, autotune heavy`,
    duett: `DUETT-ERWEITERUNG: strong confident female voice, stands her ground, equal energy to the main vocalist but higher register, powerful chest voice, female rapper or singer on hook — main vocalist raps verses with full authority, shared hook creates unstoppable unified front, no weakness, both voices push forward`
  },
  {
    id: 'aggressiv', name: 'AGGRESSIV', emoji: '🔥', bpm: 130,
    tag: 'Aggressiv', color: '#ef4444',
    url: 'https://suno.com/persona/477c5ba4-c710-49d8-adac-e4125aa57592',
    prompt: `aggressive german rap, harsh gritty vocals, dominant delivery, hard-hitting 808 bass, trap drums with heavy kick, dark cinematic beat, 130 BPM, minor key, street anthem energy, powerful confident tone, commanding presence, raw emotion, intense build, no-filter honesty, brutal storytelling, spacious high-fidelity mix, dangerous vibe

EXCLUDE: comedy, children music, upbeat pop, soft vocals, lo-fi, generic loops, female vocals, slow tempo, autotune heavy, drill (keep aggressive rap)`,
    duett: `DUETT-ERWEITERUNG: cold distant female voice, icy and restrained, sharp contrast to the main vocalist's aggression — she sings the hook with controlled intensity, no warmth, represents the opposing force or the reason for the anger, dissonant echo effect on her vocals, she never matches his aggression but cuts deeper with calmness`
  },
  {
    id: 'hoffnungsvoll', name: 'HOFFNUNGSVOLL', emoji: '🌅', bpm: 110,
    tag: 'Hoffnungsvoll', color: '#f59e0b',
    url: 'https://suno.com/persona/c9187840-631b-4a9f-ab7b-685caeca47ce',
    prompt: `uplifting german rap, warm inspiring vocals, hopeful delivery, bright undertone, mid-range tenor voice, major key progression, 110 BPM, uplifting strings, positive energy without being fake, authentic optimism, motivational message, cinematic production, building crescendo, powerful chorus, light but substantial, high-fidelity studio recording, warm reverb, inspiring but grounded

EXCLUDE: comedy, children music, generic pop, autotune heavy, drill, female vocals, aggressive rap, fast tempo, lo-fi, trap hi-hats`,
    duett: `DUETT-ERWEITERUNG: warm uplifting female voice, bright and clear, gospel-influenced tone, adds light to the main artist's message — she sings the chorus as an emotional peak, harmonizes in thirds, voice radiates safety and shared optimism, no autotune, natural vibrato, they build something together`
  },
  {
    id: 'melancholisch', name: 'MELANCHOLISCH', emoji: '🌧️', bpm: 75,
    tag: 'Melancholisch', color: '#6366f1',
    url: '',
    prompt: `melancholic german rap, sad introspective vocals, slow-tempo 75 BPM, deep emotional male vocals, bittersweet tone, dark piano, cinematic strings, minor key, reflective delivery, thoughtful pacing, atmospheric production, vinyl crackle intro, sparse drums, intimate whispered moments, nostalgia and pain mixed, authentic sadness, high-fidelity, spacious mix, story-driven narrative

EXCLUDE: comedy, children music, upbeat pop, fast tempo, aggressive rap, autotune heavy, drill, female vocals, generic loops, lo-fi, trap hi-hats`,
    duett: `DUETT-ERWEITERUNG: melancholic female voice, fragile and broken, slight breathiness, enters only on bridge and final chorus — she represents the other side of the same pain, mirror to the main vocalist's sadness, they don't sing together but after each other, call-and-response of shared grief, much reverb on her voice, almost ghost-like presence`
  },
  {
    id: 'kuehl', name: 'KÜHL', emoji: '🧊', bpm: 100,
    tag: 'Kühl', color: '#94a3b8',
    url: '',
    prompt: `detached german rap, narrative-focused vocals, clear diction, cool delivery, mid-range tenor, factual storytelling without over-emotion, 100 BPM, minimal production, sparse instrumentation, direct communication style, authentic but restrained, cinematic but understated, high-fidelity studio, tight drums, focused bass, no reverb excess, professional documentary vibe, substance over style, street-smart intelligence

EXCLUDE: comedy, children music, upbeat pop, autotune heavy, drill, female vocals, aggressive rap, fast tempo, lo-fi, trap hi-hats, overly emotional`,
    duett: `DUETT-ERWEITERUNG: neutral observing female voice, matter-of-fact delivery, speaks or sings with calm authority, not emotional — she provides a second perspective or commentary to the main vocalist's narrative, equal distance from emotion, clean vocal with no effects, journalistic presence, minimal harmonies`
  },
  {
    id: 'stolz', name: 'STOLZ', emoji: '👑', bpm: 115,
    tag: 'Stolz', color: '#eab308',
    url: '',
    prompt: `confident german rap, proud commanding vocals, strong dominant delivery, deep resonant voice, assertive tone, 115 BPM, powerful 808 bass, cinematic orchestral strings, major key, self-assured flow, unwavering conviction, street-smart intelligence, earned respect vibe, substantial bars, high-fidelity production, punchy drums, powerful presence, no arrogance just strength, authentic self-belief, inspiring through confidence

EXCLUDE: comedy, children music, upbeat pop, autotune heavy, drill, female vocals, weak vocals, fast tempo, lo-fi, trap hi-hats, self-doubt vibes`,
    duett: `DUETT-ERWEITERUNG: proud powerful female voice, strong and regal, she matches the main vocalist's confidence from her own position — sings the hook as a celebration, never subordinate, rich mezzo-soprano, orchestral feel on her vocals`
  },
  {
    id: 'wuetend', name: 'WÜTEND', emoji: '⚡', bpm: 140,
    tag: 'Wütend', color: '#f97316',
    url: '',
    prompt: `raw intense german rap, explosive powerful vocals, intense aggressive delivery, harsh gritty tone, 140 BPM, heavy hard-hitting 808 bass, aggressive trap drums, dark cinematic beat, no filter raw emotion, brutal honesty, fighting spirit, dangerous edge without cartoon villainy, authentic anger not performed, high-fidelity raw mix, intense strings, minor key, explosive potential, street credibility, real pain not fake rage

EXCLUDE: comedy, children music, upbeat pop, soft vocals, lo-fi, generic loops, female vocals, autotune, slow tempo, drill, trap hi-hats`,
    duett: `DUETT-ERWEITERUNG: fierce sharp female voice, her calmness amplifies the danger — she delivers a single bridge or spoken word section, controlled anger, low register for a woman, no screaming, the contrast between her control and the main vocalist's explosion creates maximum tension, she is the eye of the storm`
  }
];
// Voice persona preview via Web Speech API
const PERSONA_VOICE_LINES = {
  verletzlich:  { pitch:0.88, rate:0.82, text:'Du weißt wie es sich anfühlt, wenn niemand zuhört. Aber ich bin hier.' },
  kraftvoll:    { pitch:0.75, rate:0.9,  text:'Ich steh auf. Egal wie oft sie mich niederdrücken. Das ist mein Weg.' },
  aggressiv:    { pitch:0.6,  rate:1.18, text:'Ich komme aus dem Nichts. Und ich gehe nirgendwo hin. Das ist Fakt.' },
  hoffnungsvoll:{ pitch:0.95, rate:0.95, text:'Jeden Tag ist ein neuer Anfang. Ich glaube daran. Und ich mach weiter.' },
  melancholisch:{ pitch:0.8,  rate:0.75, text:'Manchmal vermisst man Dinge, die man nie wirklich hatte. Das ist das Leben.' },
  kuehl:        { pitch:0.8,  rate:1.0,  text:'Ich sage nur Fakten. Keine Emotionen. Nur die Wahrheit. Keine Spielchen.' },
  stolz:        { pitch:0.7,  rate:0.92, text:'Ich hab mir alles erarbeitet. Kein Geschenk. Nur harte Arbeit. Nur Respekt.' },
  wuetend:      { pitch:0.55, rate:1.25, text:'Genug geredet. Jetzt rede ich. Und alle hören zu.' }
};
