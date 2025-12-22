// casio.js - Final Audio Engine (Physics, Sustain, Input Bridge)

// --- DOM ELEMENTS ---
const refContainer = document.getElementById('ref-keys');
const refScroller = document.getElementById('ref-scroller');
const mainContainer = document.getElementById('main-keys');
const mainScroller = document.querySelector('.main-keyboard-area');
const topPanel = document.getElementById('top-panel');
const panelToggle = document.getElementById('panel-toggle');
const wrapper = document.querySelector('.casio-wrapper');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');

let audioContext = null;
let currentInstrument = 'PIANO'; 
let liveVoice = { osc: null, gain: null, note: null };
let isSustain = false; // SUSTAIN STATE

// --- 1. GENERATE KEYS (Full Range for Scrolling) ---
const NOTES = [];
const OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let start = false;

// Generate notes from A0 to C8
OCTAVES.forEach(oct => {
    NAMES.forEach(name => {
        const note = name + oct;
        if (note === 'A0') start = true;
        if (start) NOTES.push(note);
        if (note === 'C8') start = false;
    });
});

function createKey(note, type) {
    const el = document.createElement('div');
    const isBlack = note.includes('#');
    el.className = `${type} ${isBlack ? 'black' : 'white'}`;
    el.dataset.note = note;
    if (type === 'key') {
        const span = document.createElement('span'); 
        span.className = 'key-label'; 
        span.innerText = note; 
        el.appendChild(span);
    }
    return el;
}

function createBoundary() { 
    const el = document.createElement('div'); 
    el.className = 'boundary-block'; 
    return el; 
}

function initKeys() {
    if(!refContainer || !mainContainer) return;
    refContainer.innerHTML = ''; mainContainer.innerHTML = '';
    
    // Add left boundary
    mainContainer.appendChild(createBoundary());
    
    NOTES.forEach(note => {
        refContainer.appendChild(createKey(note, 'ref-key'));
        mainContainer.appendChild(createKey(note, 'key'));
    });
    
    // Add right boundary
    mainContainer.appendChild(createBoundary());
}
initKeys();

// --- 2. PHYSICS ENGINE (SCROLLING FIX) ---
let currentTranslate = 0; 
let isDragging = false; 
let startPos = 0; 
let prevTranslate = 0;
let maxRefScroll = 0; 
let maxMainScroll = 0; 
let syncRatio = 1;

function calculateBounds() {
    if(!refScroller || !mainScroller) return;
    maxRefScroll = Math.min(0, refScroller.clientWidth - refContainer.scrollWidth);
    maxMainScroll = Math.min(0, mainScroller.clientWidth - mainContainer.scrollWidth);
    syncRatio = (maxRefScroll !== 0) ? maxMainScroll / maxRefScroll : 1;
}

function applyTransform(x) {
    if(refContainer) refContainer.style.transform = `translateX(${x}px)`;
    if(mainContainer) mainContainer.style.transform = `translateX(${x * syncRatio}px)`;
}

function getPosition(e) {
    if (e.type.includes('mouse')) return e.pageX;
    // Handle rotation coordinate flip
    const isRotated = window.innerWidth < window.innerHeight;
    return isRotated ? e.touches[0].clientY : e.touches[0].clientX;
}

function dragStart(e) { 
    isDragging = true; 
    startPos = getPosition(e); 
    refContainer.style.transition = 'none'; 
    mainContainer.style.transition = 'none'; 
}

function dragMove(e) {
    if (!isDragging) return; 
    e.preventDefault();
    const diff = getPosition(e) - startPos;
    let newPos = prevTranslate + diff;
    
    // Constraints
    if (newPos > 0) newPos = 0; 
    if (newPos < maxRefScroll) newPos = maxRefScroll;
    
    currentTranslate = newPos; 
    applyTransform(currentTranslate);
}

function dragEnd() { 
    isDragging = false; 
    prevTranslate = currentTranslate; 
}

// Bind Physics Listeners
if(refScroller) { 
    refScroller.addEventListener('mousedown', dragStart); 
    refScroller.addEventListener('touchstart', dragStart, { passive: false }); 
}
window.addEventListener('mousemove', dragMove); 
window.addEventListener('touchmove', dragMove, { passive: false });
window.addEventListener('mouseup', dragEnd); 
window.addEventListener('touchend', dragEnd);
window.addEventListener('resize', calculateBounds);

if(panelToggle) panelToggle.addEventListener('click', () => topPanel.classList.toggle('closed'));

// --- 3. AUDIO ENGINE ---
function initAudio() {
    if (!audioContext) { 
        try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} 
    }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
}

function getFreq(n) { 
    const idx = NOTES.indexOf(n); 
    return (idx === -1) ? 440 : 27.5 * Math.pow(2, idx/12); 
}

function startLiveTone(n) {
    if (!audioContext) initAudio(); 
    if (!audioContext) return;
    
    // Monophonic touch logic: Stop previous note if sliding
    stopLiveTone();

    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    const now = audioContext.currentTime;
    const freq = getFreq(n);

    o.frequency.value = freq;
    g.gain.setValueAtTime(0, now);

    let maxDur = 1.0; 
    let attackTime = 0.05; 
    let peakGain = 0.4;

    // Instrument Config
    if (typeof currentInstrument === 'object') {
        // Custom Tone
        o.type = currentInstrument.wave || 'sine';
        maxDur = parseFloat(currentInstrument.duration || 0.5);
        peakGain = parseFloat(currentInstrument.gain || 0.3);
        if(currentInstrument.detune) o.detune.value = currentInstrument.detune;
    } else if (currentInstrument === 'FLUTE') {
        o.type = 'sine'; maxDur = 1.5; peakGain = 0.5; attackTime = 0.1;
    } else if (currentInstrument === 'SYNTH') {
        o.type = 'sawtooth'; maxDur = 0.4; peakGain = 0.15; attackTime = 0.02;
    } else {
        // PIANO
        o.type = 'triangle'; maxDur = 0.8; peakGain = 0.5; attackTime = 0.02;
    }

    g.gain.linearRampToValueAtTime(peakGain, now + attackTime);
    // If Sustain is ON, delay decay
    const holdTime = isSustain ? 2.0 : maxDur;
    g.gain.exponentialRampToValueAtTime(0.001, now + holdTime);

    o.start(now); 
    // Safety stop
    o.stop(now + holdTime + 1.0); 
    
    o.connect(g); 
    g.connect(audioContext.destination);
    
    liveVoice = { osc: o, gain: g, note: n };
    
    // Log for Recording
    CasioEngine.logNote(n);
}

function stopLiveTone() {
    if (liveVoice.osc && liveVoice.gain) {
        const now = audioContext.currentTime;
        const g = liveVoice.gain.gain;
        
        // --- SUSTAIN LOGIC ---
        let release = isSustain ? 1.5 : 0.1;
        if(currentInstrument === 'FLUTE') release = isSustain ? 2.0 : 0.3;
        
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.exponentialRampToValueAtTime(0.001, now + release);
        
        liveVoice.osc.stop(now + release + 0.1);
        
        // Remove active class from previous note
        if(liveVoice.note) toggleVis(liveVoice.note, false);
        
        liveVoice = { osc: null, gain: null, note: null };
    }
}

// Used by Sequencer
function playDurationTone(n, durationMs = 400) {
    if (!audioContext) initAudio(); if(!audioContext) return;
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    const now = audioContext.currentTime;
    const durationSec = durationMs / 1000;

    o.frequency.value = getFreq(n);
    g.gain.setValueAtTime(0, now);

    // Simple Instrument Logic for Playback
    let type = 'triangle';
    if(typeof currentInstrument === 'object') type = currentInstrument.wave;
    else if(currentInstrument === 'SYNTH') type = 'sawtooth';
    else if(currentInstrument === 'FLUTE') type = 'sine';
    
    o.type = type;
    g.gain.linearRampToValueAtTime(0.5, now+0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now+durationSec);

    o.connect(g); g.connect(audioContext.destination);
    o.start(); o.stop(now + durationSec + 0.1);
}

// --- 4. GLOBAL CONTROLLER (Bridge to Right Panel) ---
window.CasioEngine = {
    isRecording: false, 
    recordedSequence: [], 
    startTime: 0, 
    playbackTimeouts: [],
    
    // Expose Sustain Setter
    setSustain(state) { isSustain = state; },
    
    // NOTE: Added getSustainState getter (required by casio-right.js)
    getSustainState() { return isSustain; },

    resumeContext() {
        if(!audioContext) initAudio();
        if(audioContext && audioContext.state === 'suspended') audioContext.resume();
    },

    setInstrument(inst) { currentInstrument = inst; },
    
    previewTone(settings) { 
        this.resumeContext(); 
        currentInstrument = settings; // Set temp for preview
        playDurationTone('C4', settings.duration * 1000); 
    },
    
    startRecording() { 
        this.isRecording = true; 
        this.recordedSequence = []; 
        this.startTime = Date.now(); 
    },
    
    stopRecording() { 
        this.isRecording = false; 
        return this.recordedSequence; 
    },
    
    logNote(note) { 
        if (this.isRecording) { 
            if (!this.recordedSequence.length) this.startTime = Date.now(); 
            this.recordedSequence.push({ note, time: Date.now() - this.startTime }); 
        } 
    },
    
    playSequence(seq, cb) {
        this.stopPlayback();
        if (!seq) return;
        this.resumeContext();
        
        let maxTime = 0;
        
        seq.forEach(evt => {
            let t = (evt.time!==undefined)?evt.time : 0;
            const dur = evt.duration || 400;
            
            this.playbackTimeouts.push(setTimeout(() => {
                playDurationTone(evt.note, dur); 
                toggleVis(evt.note, true); 
                setTimeout(() => toggleVis(evt.note, false), Math.min(dur, 300));
            }, t));
            
            maxTime = Math.max(maxTime, t + dur);
        });
        
        if(cb) this.playbackTimeouts.push(setTimeout(cb, maxTime + 500));
    },
    
    stopPlayback() { 
        this.playbackTimeouts.forEach(clearTimeout); 
        this.playbackTimeouts = []; 
        document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active')); 
        document.querySelectorAll('.active-ref').forEach(k => k.classList.remove('active-ref')); 
    },

    // Expose Single Note Play/Stop for Practice Mode
    playNote(n) {
        // Just trigger visual/audio without touch logic
        const o = audioContext.createOscillator();
        const g = audioContext.createGain();
        o.frequency.value = getFreq(n);
        o.type = 'triangle';
        g.gain.value = 0.5;
        o.connect(g); g.connect(audioContext.destination);
        o.start();
        
        // Return stop function
        return () => { 
            g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
            o.stop(audioContext.currentTime + 0.1); 
        };
    },
    
    stopNote(n) {
        // Simplified stop for external calls if needed
    }
};

// --- INPUT HANDLING ---
let currNote = null;

function hInput(e) {
    if(audioContext && audioContext.state === 'suspended') audioContext.resume();
    const t = e.touches ? e.touches[0] : e;
    const el = document.elementFromPoint(t.clientX, t.clientY);
    
    // CHECK PRACTICE MODE STATUS (Requires PracticeManager to be a global object)
    const isPracticeActive = window.PracticeManager && window.PracticeManager.isActive; 

    if (el && el.classList.contains('key')) {
        const n = el.dataset.note;
        if (n !== currNote) {
            // Sliding to new key: Stop old, Start new
            
            // 1. STOP OLD TONE (Only stop if the previous note was actively played)
            if (currNote && !isPracticeActive) { stopLiveTone(); toggleVis(currNote, false); }
            
            // 2. PLAY NEW TONE (Conditional Logic)
            if (!isPracticeActive) {
                // NORMAL MODE: Play the full live tone with sustain/envelope logic
                startLiveTone(n); 
            } else {
                // PRACTICE MODE: Only play a short, immediate sound (like the demo sound)
                playDurationTone(n, 300); // 300ms duration for feedback
            }
            
            // 3. Game/Visual Logic (Always run)
            if(window.onCasioKeyPress) window.onCasioKeyPress(n);
            toggleVis(n, true);
            currNote = n;
        }
    } else if (currNote) {
        // Finger moved off keyboard
        // Only stop the live tone if we weren't in Practice Mode (Practice mode uses non-live tones)
        if (!isPracticeActive) { 
            stopLiveTone();
        }
        toggleVis(currNote, false);
        currNote = null;
    }
}

function toggleVis(n, a) {
    const k = document.querySelector(`.key[data-note="${n}"]`); 
    const r = document.querySelector(`.ref-key[data-note="${n}"]`);
    if (k) a ? k.classList.add('active') : k.classList.remove('active');
    if (r) a ? r.classList.add('active-ref') : r.classList.remove('active-ref');
}

// --- INITIALIZATION EVENT ---
if(startBtn) {
    startBtn.addEventListener('click', () => {
        startOverlay.style.display = 'none'; 
        wrapper.style.opacity = '1';
        
        // Center the keyboard
        calculateBounds(); 
        const centerPos = maxRefScroll/2;
        applyTransform(centerPos);
        prevTranslate = centerPos; 
        currentTranslate = centerPos;
        
        initAudio();
        
        const d = document.documentElement;
        if (d.requestFullscreen) d.requestFullscreen();
        else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen();
    });
}

// Input Listeners
if(mainScroller) {
    mainScroller.addEventListener('touchstart', e => { e.preventDefault(); hInput(e) }, { passive: false });
    mainScroller.addEventListener('touchmove', e => { e.preventDefault(); hInput(e) }, { passive: false });
    // Modified touch end to respect practice mode
    mainScroller.addEventListener('touchend', () => { 
        if(!window.PracticeManager || !window.PracticeManager.isActive) {
            stopLiveTone(); 
        }
        if (currNote) toggleVis(currNote, false); 
        currNote = null; 
    });
    
    let md = false;
    mainScroller.addEventListener('mousedown', e => { md = true; hInput(e) });
    mainScroller.addEventListener('mousemove', e => { if (md) hInput(e) });
    // Modified mouse up/leave to respect practice mode
    mainScroller.addEventListener('mouseup', e => { 
        md = false; 
        if(!window.PracticeManager || !window.PracticeManager.isActive) { 
            stopLiveTone(); 
        }
        if(currNote) toggleVis(currNote,false); 
        currNote=null; 
    });
    mainScroller.addEventListener('mouseleave', e => { 
        if (md) { 
            md = false; 
            if(!window.PracticeManager || !window.PracticeManager.isActive) {
                stopLiveTone(); 
            }
            if(currNote)toggleVis(currNote,false); 
            currNote=null; 
        } 
    });
}
