// soundlab.js - Custom Tones & Kits

// --- CONFIG ---
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
const db = firebase.firestore();
const rtdb = firebase.database();

// --- STATE ---
let currentUser = null;
let currentMode = 'pitch'; // pitch, drum, kit
let audioCtx = null;
let userDrumElements = []; // Store fetched custom drum sounds
let currentKitConfig = {}; // Stores pad mapping for the kit editor

const PADS = ['Pad 1 (Crash)', 'Pad 2 (Ride)', 'Pad 3 (Tom 1)', 'Pad 4 (Tom 2)', 'Pad 5 (HiHat)', 'Pad 6 (Snare)', 'Pad 7 (Kick)', 'Pad 8 (Clap)'];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Auth Listener
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if(user) fetchUserDrumElements();
        else renderKitGrid(); // Render defaults
    });

    // 1. INPUT BINDINGS (Update Badges)
    bindSlider('ct-duration', 'val-duration', 's');
    bindSlider('ct-detune', 'val-detune', '');
    bindSlider('ct-gain', 'val-gain', '');
    bindSlider('ct-drum-pitch', 'val-drum-pitch', 'Hz');

    function bindSlider(id, valId, unit) {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', e => document.getElementById(valId).innerText = e.target.value + unit);
    }

    // 2. MODE SWITCHING
    const modes = {
        'mode-pitch-btn': 'editor-pitch',
        'mode-drum-btn': 'editor-drum',
        'mode-kit-btn': 'editor-kit'
    };

    Object.keys(modes).forEach(btnId => {
        document.getElementById(btnId).addEventListener('click', () => {
            // UI Update
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(btnId).classList.add('active');
            
            document.querySelectorAll('.editor-section').forEach(e => e.classList.remove('active'));
            document.getElementById(modes[btnId]).classList.add('active');
            
            // State Update
            if (btnId.includes('pitch')) currentMode = 'pitch';
            if (btnId.includes('drum')) currentMode = 'drum';
            if (btnId.includes('kit')) {
                currentMode = 'kit';
                renderKitGrid(); // Refresh dropdowns
            }
        });
    });

    // 3. ACTION BUTTONS
    document.getElementById('test-btn').addEventListener('click', testSound);
    document.getElementById('save-btn').addEventListener('click', saveItem);
    document.getElementById('set-temp-kit-btn').addEventListener('click', setTempKit);
});

// --- AUDIO ENGINE (Preview) ---
function initAudio() {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
}

function testSound() {
    initAudio();
    const data = getFormData();
    
    if (currentMode === 'kit') {
        showStatus("Tap a pad in Octapad to test.");
        return;
    }

    if (currentMode === 'pitch') {
        playTone(data.wave, 440, data.duration, data.gain, data.detune);
    } else {
        playDrum(data.octaKit, data.drumPitch);
    }
}

function playTone(type, freq, dur, gain, detune) {
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.1);
}

function playDrum(type, pitch) {
    const t = audioCtx.currentTime;
    const g = audioCtx.createGain(); g.connect(audioCtx.destination); g.gain.value = 0.8;
    
    if (type === 'Kick') {
        const o = audioCtx.createOscillator(); o.connect(g);
        o.frequency.setValueAtTime(pitch, t);
        o.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        o.start(t); o.stop(t + 0.5);
    } else {
        // Simple Snare/Tom generic
        const o = audioCtx.createOscillator(); o.type='triangle'; o.connect(g);
        o.frequency.setValueAtTime(pitch, t);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        o.start(t); o.stop(t + 0.2);
    }
}

// --- DATA MANAGEMENT ---

function getFormData() {
    if (currentMode === 'pitch') {
        return {
            type: 'pitch',
            name: document.getElementById('ct-name-pitch').value,
            wave: document.getElementById('ct-wave-pitch').value,
            duration: parseFloat(document.getElementById('ct-duration').value),
            detune: parseInt(document.getElementById('ct-detune').value),
            gain: parseFloat(document.getElementById('ct-gain').value)
        };
    } else if (currentMode === 'drum') {
        return {
            type: 'octapad', // Stored as octapad element
            name: document.getElementById('ct-name-drum').value,
            octaKit: document.getElementById('ct-octa-kit').value,
            drumPitch: parseInt(document.getElementById('ct-drum-pitch').value)
        };
    } else {
        // Kit Data
        return {
            type: 'kit',
            name: document.getElementById('ct-name-kit').value,
            pads: currentKitConfig
        };
    }
}

function saveItem() {
    if(!currentUser) return alert("Login required to save.");
    const data = getFormData();
    const btn = document.getElementById('save-btn');
    
    btn.innerText = "Saving...";
    
    // Choose Collection based on type
    const collection = (data.type === 'kit') ? 'customKits' : 'customTones';
    
    db.collection(collection).add({
        userId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ...data
    }).then(() => {
        showStatus("Saved!");
        btn.innerText = "💾 Save";
        if(data.type === 'octapad') fetchUserDrumElements(); // Refresh kit options
    }).catch(err => {
        alert(err.message);
        btn.innerText = "💾 Save";
    });
}

function setTempKit() {
    if(!currentUser) return alert("Login required.");
    // Save to RTDB for immediate access in Octapad
    rtdb.ref(`users/${currentUser.uid}/tempKit`).set(currentKitConfig)
        .then(() => showStatus("Sent to Octapad!"));
}

// --- KIT EDITOR LOGIC ---

function fetchUserDrumElements() {
    // Get custom 'octapad' sounds created by user
    db.collection('customTones')
        .where('userId', '==', currentUser.uid)
        .where('type', '==', 'octapad')
        .get().then(snap => {
            userDrumElements = snap.docs.map(d => ({id: d.id, ...d.data()}));
            if(currentMode === 'kit') renderKitGrid();
        });
}

function renderKitGrid() {
    const container = document.getElementById('kit-pads-container');
    container.innerHTML = '';

    // Default Pad IDs
    const padIds = ['pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6', 'pad7', 'pad8'];
    
    // Default Options
    const defaults = [
        {id:'def_kick', name:'Kick (Default)', type:'octapad', octaKit:'Kick', drumPitch:150},
        {id:'def_snare', name:'Snare (Default)', type:'octapad', octaKit:'Snare', drumPitch:250},
        {id:'def_hihat', name:'HiHat (Default)', type:'octapad', octaKit:'HiHat'},
        {id:'def_crash', name:'Crash (Default)', type:'octapad', octaKit:'Crash'},
        {id:'def_ride', name:'Ride (Default)', type:'octapad', octaKit:'Ride'},
        {id:'def_tom1', name:'Tom 1 (Default)', type:'octapad', octaKit:'Tom1', drumPitch:200},
        {id:'def_tom2', name:'Tom 2 (Default)', type:'octapad', octaKit:'Tom2', drumPitch:100},
        {id:'def_clap', name:'Clap (Default)', type:'octapad', octaKit:'Clap'}
    ];

    // Merge Defaults + Custom
    const allOptions = [...defaults, ...userDrumElements];

    padIds.forEach((padId, index) => {
        // Determine current value
        if (!currentKitConfig[padId]) {
            // Init with default based on index mapping
            currentKitConfig[padId] = defaults[index] || defaults[0];
        }

        const div = document.createElement('div');
        div.className = 'kit-pad-row';
        
        const label = PADS[index];
        
        // Generate Dropdown
        let optionsHtml = allOptions.map(opt => {
            const isSel = (currentKitConfig[padId].id === opt.id) || 
                          (currentKitConfig[padId].name === opt.name);
            // We serialize the whole object into value for easy retrieval
            return `<option value='${JSON.stringify(opt)}' ${isSel?'selected':''}>${opt.name}</option>`;
        }).join('');

        div.innerHTML = `
            <span class="kit-pad-label">${label}</span>
            <select class="kit-pad-select" onchange="updateKitConfig('${padId}', this)">
                ${optionsHtml}
            </select>
        `;
        container.appendChild(div);
    });
}

// Global scope for HTML onchange attribute
window.updateKitConfig = (padId, selectEl) => {
    const val = JSON.parse(selectEl.value);
    currentKitConfig[padId] = val;
};

function showStatus(msg) {
    const el = document.getElementById('status-msg');
    el.innerText = msg;
    el.style.opacity = 1;
    setTimeout(() => el.style.opacity = 0, 2000);
}
