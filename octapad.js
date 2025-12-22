// octapad.js - Core Audio Engine, Recording, Playback, and Practice Bridge

const firebaseConfig = {
  apiKey: "AIzaSyC2T_hrXC_RZvCvoLc9d9ldpLSb4z03Wyw",
  authDomain: "music-2af50.firebaseapp.com",
  databaseURL: "https://music-2af50-default-rtdb.firebaseio.com",
  projectId: "music-2af50",
  storageBucket: "music-2af50.firebasestorage.app",
  messagingSenderId: "607018974762",
  appId: "1:607018974762:web:d8ea53518e9bb6bd180d53",
  measurementId: "G-7F6RPG9N0L"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const DRUM_PADS = ['crash', 'ride', 'tom1', 'tom2', 'hihat', 'snare', 'kick', 'clap'];

// --- DRUM KIT DEFINITIONS (3 Default Kits + Labels) ---
const DRUM_KITS = {
    'STANDARD': { 
        title: 'STANDARD', 
        labels: ['CRASH', 'RIDE', 'TOM 1', 'TOM 2', 'HI-HAT', 'SNARE', 'KICK', 'CLAP'],
        kick: { freq: 150, dur: 0.5 }, snare: { freq: 250, noise: true }, hihat: { highpass: 5000 }, tom1: { pitch: 200 }, tom2: { pitch: 100 }, clap: { bandpass: 900 } 
    },
    'TECHNO': { 
        title: 'TECHNO', 
        labels: ['PERC 1', 'CYMBAL', 'SUB TOM', 'CLAVE', 'CLOSED H', 'RIMSHOT', 'KICK DEEP', 'FX HIT'],
        kick: { freq: 80, dur: 0.3 }, snare: { freq: 350, noise: true, short: true }, hihat: { highpass: 8000 }, tom1: { pitch: 150 }, tom2: { pitch: 70 }, clap: { bandpass: 1500 } 
    },
    'VINTAGE': { 
        title: 'VINTAGE', 
        labels: ['HIGH HAT', 'SNARE LO', 'FLOOR', 'MID TOM', 'PEDAL H', 'SIDE STICK', 'KICK WARM', 'CLAP LO'],
        kick: { freq: 100, dur: 0.6 }, snare: { freq: 200, noise: true, low: true }, hihat: { highpass: 3500 }, tom1: { pitch: 250 }, tom2: { pitch: 120 }, clap: { bandpass: 600 } 
    }
};


// --- AUDIO ENGINE (Rewritten for Recording/Playback) ---
const AudioEngine = {
    ctx: null, masterGain: null, volume: 0.8, currentKit: 'STANDARD',
    
    isRecording: false,
    recordedSequence: [],
    startTime: 0,
    playbackTimeouts: [],

    init() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
    },
    
    // --- UTILITY ---
    resumeContext() {
        if(!this.ctx) this.init();
        if(this.ctx.state === 'suspended') this.ctx.resume();
    },
    setVolume(val) {
        this.volume = Math.max(0.1, Math.min(1, val)); 
        if(this.masterGain) this.masterGain.gain.value = this.volume;
        const v = Math.round(this.volume * 100);
        if(window.DisplayModule) DisplayModule.tempMessage(`VOL: ${v}%`, 800);
        return v;
    },
    setCurrentKit(kitId) {
        this.currentKit = kitId;
    },
    
    // --- Kit Label Retrieval ---
    getPadLabels() {
        const kit = DRUM_KITS[this.currentKit] || DRUM_KITS['STANDARD'];
        return {
            pads: DRUM_PADS, 
            names: kit.labels
        };
    },
    
    // --- RECORDING ---
    startRecording() { 
        this.isRecording = true; 
        this.recordedSequence = []; 
        this.startTime = this.ctx.currentTime * 1000; 
    },
    
    stopRecording() { 
        this.isRecording = false; 
        return this.recordedSequence; 
    },
    
    logHit(padType) {
        if (this.isRecording) { 
            this.recordedSequence.push({ 
                pad: padType, 
                time: (this.ctx.currentTime * 1000) - this.startTime // Timestamp in ms
            }); 
        }
        // Bridge to Learn Mode (defined in octapad-right.js)
        if (window.onOctapadHit) window.onOctapadHit(padType);
    },
    
    // --- PLAYBACK ---
    stopPlayback() {
        this.playbackTimeouts.forEach(clearTimeout); 
        this.playbackTimeouts = [];
    },
    
    playSequence(seq, cb) {
        this.stopPlayback();
        if (!seq || seq.length === 0) return;
        this.resumeContext();
        
        let maxTime = 0;
        
        seq.forEach(evt => {
            const t = evt.time || 0; // ms
            
            this.playbackTimeouts.push(setTimeout(() => {
                this.triggerSound(evt.pad); 
            }, t));
            
            // Assume max sound duration of 1.5s for calculation
            maxTime = Math.max(maxTime, t + 1500); 
        });
        
        // Callback after sequence is done
        if(cb) this.playbackTimeouts.push(setTimeout(cb, maxTime + 500));
    },

    // --- SOUND GENERATION (Uses Current Kit) ---
    triggerSound(type) {
        const kit = DRUM_KITS[this.currentKit] || DRUM_KITS['STANDARD'];
        const t = this.ctx.currentTime;
        
        switch(type) {
            case 'kick': this._generateKick(t, kit.kick); break;
            case 'snare': this._generateSnare(t, kit.snare); break;
            case 'hihat': this._generateHiHat(t, kit.hihat); break;
            case 'tom1': this._generateTom(t, kit.tom1); break;
            case 'tom2': this._generateTom(t, kit.tom2, 'low'); break;
            case 'crash': this._generateCymbal(t, 'crash'); break;
            case 'ride': this._generateCymbal(t, 'ride'); break;
            case 'clap': this._generateClap(t, kit.clap); break;
        }
    },
    
    // Generative sound functions (defined based on kit config)
    _generateKick(t, cfg) { 
        const o=this.ctx.createOscillator(); const g=this.ctx.createGain(); o.connect(g); g.connect(this.masterGain); 
        o.frequency.setValueAtTime(cfg.freq || 150,t); 
        o.frequency.exponentialRampToValueAtTime(0.01,t+(cfg.dur||0.5)); 
        g.gain.setValueAtTime(1,t); 
        g.gain.exponentialRampToValueAtTime(0.01,t+(cfg.dur||0.5)); 
        o.start(t); o.stop(t+(cfg.dur||0.5)); 
    },
    _generateSnare(t, cfg) {
        const o=this.ctx.createOscillator(); const og=this.ctx.createGain(); 
        o.type='triangle'; o.connect(og); og.connect(this.masterGain); 
        o.frequency.setValueAtTime(cfg.freq || 250,t); og.gain.setValueAtTime(0.5,t); 
        og.gain.exponentialRampToValueAtTime(0.01,t+0.1); 
        o.start(t); o.stop(t+0.2); 
        const dur = cfg.short ? 0.05 : 0.2;
        const b=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate); 
        const d=b.getChannelData(0); for(let i=0;i<b.length;i++) d[i]=Math.random()*2-1; 
        const n=this.ctx.createBufferSource(); n.buffer=b; const ng=this.ctx.createGain(); 
        n.connect(ng); ng.connect(this.masterGain); ng.gain.setValueAtTime(1,t); 
        ng.gain.exponentialRampToValueAtTime(0.01,t+dur); n.start(t);
    },
    _generateHiHat(t, cfg) {
        const dur=0.1; 
        const b=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate); 
        const d=b.getChannelData(0); for(let i=0;i<b.length;i++) d[i]=Math.random()*2-1; 
        const n=this.ctx.createBufferSource(); n.buffer=b; 
        const f=this.ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=cfg.highpass || 5000; 
        const g=this.ctx.createGain(); g.gain.setValueAtTime(0.7,t); g.gain.exponentialRampToValueAtTime(0.01,t+dur); 
        n.connect(f); f.connect(g); g.connect(this.masterGain); n.start(t);
    },
    _generateTom(t, cfg, type) { 
        const o=this.ctx.createOscillator(); const g=this.ctx.createGain(); o.connect(g); g.connect(this.masterGain); 
        o.frequency.setValueAtTime(cfg.pitch || 100,t); 
        o.frequency.exponentialRampToValueAtTime(20,t+0.5); 
        g.gain.setValueAtTime(0.8,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.5); 
        o.start(t); o.stop(t+0.5); 
    },
    _generateCymbal(t, type) { 
        const dur=type==='crash'?1.5:0.8; 
        const b=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate); 
        const d=b.getChannelData(0); for(let i=0;i<b.length;i++) d[i]=Math.random()*2-1; 
        const n=this.ctx.createBufferSource(); n.buffer=b; 
        const f=this.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=type==='crash'?3000:5000; f.Q.value=0.5; 
        const g=this.ctx.createGain(); g.gain.setValueAtTime(0.6,t); g.gain.exponentialRampToValueAtTime(0.01,t+dur); 
        n.connect(f); f.connect(g); g.connect(this.masterGain); n.start(t); 
    },
    _generateClap(t, cfg) { 
        const dur=0.2; 
        const b=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate); 
        const d=b.getChannelData(0); for(let i=0;i<b.length;i++) d[i]=Math.random()*2-1; 
        const n=this.ctx.createBufferSource(); n.buffer=b; 
        const f=this.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=cfg.bandpass || 900; 
        const g=this.ctx.createGain(); 
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.8,t+0.01); g.gain.exponentialRampToValueAtTime(0.01,t+0.15); 
        n.connect(f); f.connect(g); g.connect(this.masterGain); n.start(t); 
    }
};

// --- UTILITY FUNCTIONS ---
function toggleFullScreen() {
    const doc = window.document;
    const docEl = doc.documentElement;
    const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    
    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    } else {
        cancelFullScreen.call(doc);
    }
}

function triggerPad(type) {
    AudioEngine.resumeContext();
    AudioEngine.triggerSound(type); // Triggers sound based on current kit
    AudioEngine.logHit(type);      // Logs hit if recording
}

// --- DOM READY BINDINGS ---
document.addEventListener('DOMContentLoaded', () => {
    
    AudioEngine.init(); // Initialize context early
    AudioEngine.setVolume(AudioEngine.volume); 
    
    // FIX: Use a retry loop to ensure DisplayModule init runs when all UI elements are available
    function tryInitDisplay() {
        if(window.DisplayModule) {
            // Check if essential elements are available before calling init
            if(document.getElementById('label-kit') && document.getElementById('lcd-text')) {
                window.DisplayModule.init(); // This calls setMode('KIT'), overriding "READY"
            } else {
                // Retry in 50ms if DOM is not fully ready (race condition fix)
                setTimeout(tryInitDisplay, 50);
            }
        }
    }
    tryInitDisplay();

    // Firebase Status Dot
    auth.onAuthStateChanged(user => {
        const dot = document.getElementById('lcd-status-icon');
        if(dot) dot.style.background = user ? '#4af626' : '#ff4444';
    });

    // --- Panel Toggle ---
    const topPanel = document.getElementById('top-panel');
    const panelToggle = document.getElementById('panel-toggle');
    if(panelToggle) panelToggle.addEventListener('click', () => topPanel.classList.toggle('closed'));

    // --- Overlay & Fullscreen ---
    const overlay = document.getElementById('start-overlay');
    const startBtn = document.getElementById('start-btn');
    const wrapper = document.querySelector('.casio-wrapper');

    startBtn.addEventListener('click', () => {
        toggleFullScreen();
        overlay.style.display = 'none';
        wrapper.style.opacity = '1';
    });
    
    // --- PAD INPUT ---
    const pads = document.querySelectorAll('.pad');
    pads.forEach(pad => {
        const sound = pad.dataset.sound;
        const hit = (e) => {
            if(e.type === 'touchstart') e.preventDefault();
            triggerPad(sound);
            pad.classList.add('hit');
            setTimeout(() => pad.classList.remove('hit'), 100);
            
            // Manual display update for pad hits
            if(window.DisplayModule) DisplayModule.tempMessage("PAD: " + sound.toUpperCase(), 500); 
        };
        pad.addEventListener('mousedown', hit);
        pad.addEventListener('touchstart', hit, { passive: false });
    });
});
