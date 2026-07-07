// ===== Audio procédural : musique d'ambiance + SFX, 100% WebAudio =====

export type MusicMode = "none" | "menu" | "explore" | "night" | "combat" | "boss";

class AudioSys {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  musicVol = 0.7;
  sfxVol = 0.8;

  private mode: MusicMode = "none";       // mode du séquenceur procédural (silence si une piste MP3 joue)
  private desiredMode: MusicMode = "none"; // mode demandé par le jeu
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private noiseBuf: AudioBuffer | null = null;

  // ===== Pistes MP3 (embarquées en base64 par build.mjs dans window.__MUSIC__) =====
  private buffers: Record<string, AudioBuffer> = {}; // pistes décodées
  private declared = new Set<string>();               // pistes présentes (même pas encore décodées)
  private trackSource: AudioBufferSourceNode | null = null;
  private trackGain: GainNode | null = null;
  private trackKey: string | null = null;             // piste en cours de lecture

  ensure() {
    if (this.ac) { if (this.ac.state === "suspended") this.ac.resume(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain(); this.master.gain.value = 0.9;
    this.master.connect(this.ac.destination);
    this.musicBus = this.ac.createGain(); this.musicBus.gain.value = this.musicVol * 0.5;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ac.createGain(); this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(this.master);
    // buffer de bruit partagé
    const len = this.ac.sampleRate;
    this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startScheduler();
    this.loadTracks();
  }

  // Décode les MP3 embarqués. La nuit retombe sur la piste d'exploration si nuit.mp3 manque.
  private loadTracks() {
    const MUSIC: Record<string, string> = (typeof window !== "undefined" && (window as any).__MUSIC__) || {};
    for (const key of Object.keys(MUSIC)) this.declared.add(key);
    this.applyMode(); // coupe le procédural là où une piste va prendre le relais
    for (const key of Object.keys(MUSIC)) {
      fetch(MUSIC[key])
        .then(r => r.arrayBuffer())
        .then(buf => this.ac!.decodeAudioData(buf))
        .then(decoded => { this.buffers[key] = decoded; this.applyMode(); })
        .catch(() => {});
    }
  }

  setMusicVol(v: number) { this.musicVol = v; if (this.ac) this.musicBus.gain.value = v * 0.5; }
  setSfxVol(v: number) { this.sfxVol = v; if (this.ac) this.sfxBus.gain.value = v; }

  setMode(m: MusicMode) {
    if (this.desiredMode === m) return;
    this.desiredMode = m;
    this.applyMode();
  }

  // Quelle piste MP3 correspond à un mode (avec repli nuit → exploration)
  private trackKeyFor(m: MusicMode): string | null {
    if (m === "none") return null;
    if (this.declared.has(m)) return m;
    if (m === "night" && this.declared.has("explore")) return "explore";
    return null;
  }

  // Arbitre entre piste MP3 et synthé procédural pour le mode demandé
  private applyMode() {
    if (!this.ac) return;
    const key = this.trackKeyFor(this.desiredMode);
    if (key) {
      // une piste est prévue : on fait taire le procédural
      if (this.mode !== "none") { this.mode = "none"; }
      if (this.buffers[key]) this.startTrack(key); // sinon on attend le décodage
      else this.fadeOutTrack();                    // silence pendant le chargement
    } else {
      // pas de piste : synthé procédural
      this.fadeOutTrack();
      if (this.mode !== this.desiredMode) { this.mode = this.desiredMode; this.step = 0; }
    }
  }

  private startTrack(key: string) {
    if (!this.ac) return;
    if (this.trackKey === key && this.trackSource) return; // déjà en cours
    this.fadeOutTrack();
    const src = this.ac.createBufferSource();
    src.buffer = this.buffers[key];
    src.loop = true; // boucle sans coupure (précision échantillon, contrairement à un <audio> loop)
    const g = this.ac.createGain();
    const now = this.ac.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + 0.7); // fondu entrant
    src.connect(g); g.connect(this.musicBus);
    try { src.start(); } catch {}
    this.trackSource = src; this.trackGain = g; this.trackKey = key;
  }

  private fadeOutTrack() {
    if (!this.ac || !this.trackSource || !this.trackGain) { this.trackSource = null; this.trackGain = null; this.trackKey = null; return; }
    const s = this.trackSource, g = this.trackGain, now = this.ac.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0, now + 0.5); // fondu sortant → crossfade
    setTimeout(() => { try { s.stop(); } catch {} }, 650);
    this.trackSource = null; this.trackGain = null; this.trackKey = null;
  }

  // ============ Séquenceur ============
  private startScheduler() {
    if (!this.ac || this.timer !== null) return;
    this.nextTime = this.ac.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private schedule() {
    if (!this.ac || this.mode === "none") return;
    const bpm = this.mode === "combat" ? 138 : this.mode === "boss" ? 116 : 66;
    const stepDur = 60 / bpm / 2; // croches
    while (this.nextTime < this.ac.currentTime + 0.18) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  // D mineur : D F G A C
  private N(semi: number, base = 73.42) { return base * Math.pow(2, semi / 12); } // D2

  private playStep(s: number, t: number, dur: number) {
    const m = this.mode;
    if (m === "menu" || m === "explore" || m === "night") {
      // Pad lugubre toutes les 16 croches
      if (s % 16 === 0) {
        const chords = [[0, 3, 7], [-2, 1, 5], [0, 3, 7], [-4, 0, 3]];
        const ch = chords[(s / 16) % 4 | 0];
        for (const semi of ch) this.pad(this.N(semi, 146.83), t, dur * 16, 0.05);
      }
      // Basse
      if (s % 8 === 0) {
        const bassline = [0, 0, -2, -4, 0, 0, 3, -2];
        this.bass(this.N(bassline[(s / 8) % 8 | 0]), t, dur * 6, 0.10);
      }
      // Cloche éparse
      if (m !== "menu" && s % 32 === 24) this.bell(this.N(12 + [0, 3, 7, 10][(s / 32) % 4 | 0], 293.66), t, 0.045);
      // Nuit : arpège de tension
      if (m === "night" && s % 4 === 2) {
        const arp = [0, 3, 7, 10, 12, 10, 7, 3];
        this.pluck(this.N(arp[(s / 4) % 8 | 0], 293.66), t, dur * 1.5, 0.03);
      }
    } else if (m === "combat") {
      // ===== Combat : cavalcade héroïque =====
      // Batterie martiale
      if (s % 4 === 0) this.kick(t, 0.24);
      if (s % 8 === 4) this.snare(t, 0.11);
      if (s % 2 === 1) this.hat(t, 0.05);
      if (s % 16 === 14) this.tom(t, 160, 0.12);
      if (s % 16 === 15) this.tom(t, 110, 0.13);
      // Ostinato de basse galopant
      const bl = [0, 0, 3, 0, -2, 0, 5, 3];
      if (s % 2 === 0) this.bass(this.N(bl[(s / 2) % 8 | 0]), t, dur * 1.6, 0.12);
      // Nappe de tension
      if (s % 32 === 0) {
        for (const semi of [0, 3, 7]) this.pad(this.N(semi, 146.83), t, dur * 32, 0.035);
      }
      // Lead + arpège rapide (l'élan "épique")
      if (s % 8 === 4) this.pluck(this.N([12, 10, 7, 15][(s / 8) % 4 | 0], 293.66), t, dur * 2, 0.04);
      const arp = [12, 15, 19, 24];
      if (s % 4 === 2) this.pluck(this.N(arp[(s / 4) % 4 | 0], 293.66), t, dur, 0.028);
      // Stab de cuivres à la relance de la boucle
      if (s % 64 === 32) this.stab([0, 7, 12], t, dur * 3, 0.07);
    } else if (m === "boss") {
      // ===== Boss : marche funèbre écrasante, seconde mineure + triton =====
      // Grosse artillerie : double kick syncopé, snare lourde, toms descendants
      if (s % 8 === 0 || s % 8 === 5) this.kick(t, 0.34);
      if (s % 8 === 4) this.snare(t, 0.14);
      if (s % 2 === 1) this.hat(t, 0.045);
      if (s % 32 === 28) this.tom(t, 180, 0.14);
      if (s % 32 === 29) this.tom(t, 140, 0.15);
      if (s % 32 === 30) this.tom(t, 100, 0.16);
      if (s % 32 === 31) this.tom(t, 75, 0.18);
      // Ostinato de doubles-croches menaçant (Ré / Mib : seconde mineure)
      const ost = [0, 0, 1, 0, 0, 0, 3, 1];
      this.bass(this.N(ost[s % 8]), t, dur * 0.9, 0.10);
      // Chœur d'orgue dissonant
      if (s % 32 === 0) {
        const ch = (s % 64 === 0) ? [0, 1, 7, 12] : [0, 1, 6, 12]; // triton un cycle sur deux
        for (const semi of ch) this.pad(this.N(semi, 146.83), t, dur * 32, 0.032);
      }
      // Stabs de cuivres — l'Abîme répond
      if (s % 32 === 16) this.stab([0, 1, 7], t, dur * 2.5, 0.10);
      if (s % 64 === 48) this.stab([-2, 4, 10], t, dur * 4, 0.08);
      // Glas
      if (s % 16 === 6) this.bell(this.N([0, 1, 0, -2][(s / 16) % 4 | 0], 587.33), t, 0.035);
      if (s % 64 === 0) this.bell(this.N(0, 146.83), t, 0.06);
    }
  }

  // ============ Instruments ============
  private pad(freq: number, t: number, dur: number, vol: number) {
    if (!this.ac) return;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const f = this.ac.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 900; f.Q.value = 0.8;
    f.connect(g); g.connect(this.musicBus);
    for (const det of [-6, 5]) {
      const o = this.ac.createOscillator();
      o.type = "sawtooth"; o.frequency.value = freq; o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
  }

  private bass(freq: number, t: number, dur: number, vol: number) {
    if (!this.ac) return;
    const o = this.ac.createOscillator();
    o.type = "triangle"; o.frequency.value = freq;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private pluck(freq: number, t: number, dur: number, vol: number) {
    if (!this.ac) return;
    const o = this.ac.createOscillator();
    o.type = "square"; o.frequency.value = freq;
    const f = this.ac.createBiquadFilter();
    f.type = "lowpass"; f.frequency.setValueAtTime(freq * 4, t);
    f.frequency.exponentialRampToValueAtTime(freq, t + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private bell(freq: number, t: number, vol: number) {
    if (!this.ac) return;
    for (const [mult, v] of [[1, vol], [2.76, vol * 0.3]] as [number, number][]) {
      const o = this.ac.createOscillator();
      o.type = "sine"; o.frequency.value = freq * mult;
      const g = this.ac.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      o.connect(g); g.connect(this.musicBus);
      o.start(t); o.stop(t + 1.5);
    }
  }

  private kick(t: number, vol: number) {
    if (!this.ac) return;
    const o = this.ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + 0.2);
  }

  private snare(t: number, vol: number) {
    if (!this.ac || !this.noiseBuf) return;
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ac.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1900; f.Q.value = 0.7;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(f); f.connect(g); g.connect(this.musicBus);
    src.start(t); src.stop(t + 0.15);
    const o = this.ac.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.06);
    const g2 = this.ac.createGain();
    g2.gain.setValueAtTime(vol * 0.6, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g2); g2.connect(this.musicBus);
    o.start(t); o.stop(t + 0.1);
  }

  // Stab "cuivres" : accord bref de saws saturées, attaque sèche
  private stab(semis: number[], t: number, dur: number, vol: number) {
    if (!this.ac) return;
    const f = this.ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    f.connect(g); g.connect(this.musicBus);
    for (const semi of semis) {
      for (const det of [-8, 7]) {
        const o = this.ac.createOscillator();
        o.type = "sawtooth"; o.frequency.value = this.N(semi, 146.83); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.05);
      }
    }
  }

  private tom(t: number, freq: number, vol: number) {
    if (!this.ac) return;
    const o = this.ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.16);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + 0.26);
  }

  private hat(t: number, vol: number) {
    if (!this.ac || !this.noiseBuf) return;
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ac.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 7000;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(f); f.connect(g); g.connect(this.musicBus);
    src.start(t); src.stop(t + 0.05);
  }

  // ============ SFX ============
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0) {
    if (!this.ac) return;
    const t = this.ac.currentTime + when;
    const o = this.ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  private noise(dur: number, vol: number, hp = 1000, when = 0) {
    if (!this.ac || !this.noiseBuf) return;
    const t = this.ac.currentTime + when;
    const src = this.ac.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t); src.stop(t + dur + 0.03);
  }

  sfx(name: string) {
    if (!this.ac) return;
    switch (name) {
      case "step": this.noise(0.05, 0.06, 2500); break;
      case "bump": this.tone("triangle", 90, 60, 0.08, 0.12); break;
      case "ui": this.tone("square", 700, 700, 0.04, 0.05); break;
      case "confirm": this.tone("square", 520, 880, 0.09, 0.08); break;
      case "back": this.tone("square", 500, 300, 0.08, 0.06); break;
      case "pickup": this.tone("square", 660, 990, 0.07, 0.08); this.tone("square", 990, 1320, 0.09, 0.07, 0.07); break;
      case "chest": this.tone("triangle", 200, 140, 0.12, 0.12); this.tone("square", 660, 1320, 0.16, 0.08, 0.12); break;
      case "door": this.tone("triangle", 140, 90, 0.25, 0.14); this.noise(0.2, 0.06, 400, 0.02); break;
      case "doorsOpen": this.tone("triangle", 110, 60, 0.5, 0.18); this.noise(0.4, 0.09, 200, 0.05); this.bellPub(440, 0.35, 0.06); break;
      case "locked": this.tone("square", 220, 180, 0.07, 0.1); this.tone("square", 180, 150, 0.09, 0.1, 0.09); break;
      case "guard": this.tone("sawtooth", 200, 160, 0.14, 0.09); break;
      case "talk": this.tone("triangle", 440, 520, 0.05, 0.06); this.tone("triangle", 520, 460, 0.05, 0.05, 0.06); break;
      case "seal": this.bellPub(220, 1.4, 0.16); this.tone("sine", 110, 55, 0.8, 0.14, 0.02); break;
      case "hit": this.noise(0.09, 0.16, 900); this.tone("square", 240, 110, 0.1, 0.13); break;
      case "crit": this.noise(0.12, 0.2, 700); this.tone("square", 880, 220, 0.16, 0.15); this.tone("square", 1320, 1760, 0.1, 0.08, 0.03); break;
      case "hurt": this.tone("sawtooth", 300, 90, 0.2, 0.16); this.noise(0.12, 0.1, 500); break;
      case "trap": this.tone("square", 500, 120, 0.14, 0.14); this.noise(0.18, 0.16, 400); this.tone("sawtooth", 160, 70, 0.25, 0.12, 0.05); break;
      case "heal": this.tone("sine", 520, 780, 0.18, 0.1); this.tone("sine", 780, 1040, 0.2, 0.08, 0.12); break;
      case "dodge": this.noise(0.1, 0.08, 3000); this.tone("sine", 900, 1400, 0.08, 0.05); break;
      case "flee": this.tone("square", 400, 800, 0.15, 0.07); this.noise(0.15, 0.06, 2000, 0.05); break;
      case "die": this.tone("sawtooth", 220, 40, 0.5, 0.16); this.noise(0.4, 0.12, 300, 0.05); break;
      case "levelup": { const seq = [523, 659, 784, 1047]; seq.forEach((f, i) => this.tone("square", f, f, 0.12, 0.09, i * 0.09)); break; }
      case "exit": this.tone("sine", 300, 600, 0.3, 0.1); this.tone("sine", 450, 900, 0.35, 0.08, 0.1); break;
      case "night": this.tone("sine", 220, 110, 0.9, 0.09); this.bellPub(146.8, 1.2, 0.05, 0.2); break;
      case "day": this.tone("sine", 220, 440, 0.7, 0.07); this.bellPub(293.7, 1, 0.05, 0.15); break;
      case "spawn": this.tone("sawtooth", 90, 200, 0.3, 0.08); this.noise(0.2, 0.05, 600); break;
      case "warden": this.tone("sawtooth", 70, 180, 0.7, 0.2); this.noise(0.6, 0.12, 150, 0.1); this.bellPub(110, 1.8, 0.1, 0.3); break;
      case "roar": this.tone("sawtooth", 55, 160, 1.1, 0.26); this.noise(0.9, 0.16, 100, 0.15); break;
      case "phase2": this.tone("sawtooth", 40, 240, 1.3, 0.24); this.bellPub(587, 1.5, 0.07, 0.4); this.noise(1, 0.14, 120, 0.2); break;
      case "sword": { const seq = [392, 523, 659, 784, 1047, 1319]; seq.forEach((f, i) => this.bellPub(f, 1, 0.06, i * 0.13)); this.tone("sawtooth", 60, 30, 1.6, 0.14); break; }
      case "victory": { const seq = [523, 659, 784, 1047, 784, 1047]; seq.forEach((f, i) => this.tone("square", f, f, 0.18, 0.08, i * 0.16)); break; }
      case "defeat": { const seq = [392, 370, 349, 330]; seq.forEach((f, i) => this.tone("sawtooth", f, f * 0.97, 0.4, 0.09, i * 0.35)); break; }
      case "coin": this.tone("square", 990, 990, 0.05, 0.07); this.tone("square", 1320, 1320, 0.12, 0.07, 0.05); break;
    }
  }

  private bellPub(freq: number, dur: number, vol: number, when = 0) {
    if (!this.ac) return;
    const t = this.ac.currentTime + when;
    for (const [mult, v] of [[1, vol], [2.76, vol * 0.25]] as [number, number][]) {
      const o = this.ac.createOscillator();
      o.type = "sine"; o.frequency.value = freq * mult;
      const g = this.ac.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }
}

export const Audio = new AudioSys();
