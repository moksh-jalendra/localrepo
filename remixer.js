// remixer.js - Multi-track Layering Logic

const firebaseConfig = {
    apiKey: "AIzaSyC2T_hrXC_RZvCvoLc9d9ldpLSb4z03Wyw",
    authDomain: "music-2af50.firebaseapp.com",
    databaseURL: "https://music-2af50-default-rtdb.firebaseio.com",
    projectId: "music-2af50",
    storageBucket: "music-2af50.firebasestorage.app",
    messagingSenderId: "607018974762",
    appId: "1:607018974762:web:d8ea53518e9bb6bd180d53"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let userTracks = [];
let audioCtx = null;
let playbackTimeouts = [];

document.addEventListener('DOMContentLoaded', () => {
    const layersList = document.getElementById('layers-list');
    const addLayerBtn = document.getElementById('add-layer-btn');
    const playBtn = document.getElementById('master-play');
    const stopBtn = document.getElementById('master-stop');

    auth.onAuthStateChanged(user => {
        if (user) {
            fetchUserTracks(user.uid);
        } else {
            document.getElementById('empty-state').innerHTML = `<p style="color:red;">Please Login to remix your tracks.</p>`;
        }
    });

    addLayerBtn.addEventListener('click', () => createLayer());
    
    playBtn.addEventListener('click', () => {
        initAudio();
        playAllLayers();
    });

    stopBtn.addEventListener('click', stopAll);
});

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function fetchUserTracks(uid) {
    db.ref(`users/${uid}/savedKeys`).on('value', snap => {
        userTracks = [];
        snap.forEach(child => {
            userTracks.push({ id: child.key, ...child.val() });
        });
        
        document.getElementById('empty-state').style.display = userTracks.length > 0 ? 'none' : 'block';
        if (userTracks.length === 0) {
            document.getElementById('empty-state').innerText = "No saved tracks found. Go to Piano or Octapad studio first!";
        }

        // Auto-add first layer
        if (userTracks.length > 0 && document.getElementById('layers-list').children.length === 0) {
            createLayer();
        }
    });
}

function createLayer() {
    const container = document.getElementById('layers-list');
    const id = Date.now();
    const div = document.createElement('div');
    div.className = 'layer-card';
    
    const options = userTracks.map(t => `
        <option value="${t.id}">${t.type === 'drum_recording' ? '🥁' : '🎹'} ${t.title || 'Untitled'}</option>
    `).join('');

    div.innerHTML = `
        <div class="layer-header">
            <strong>Layer ${container.children.length + 1}</strong>
            <button onclick="this.closest('.layer-card').remove()" style="background:none; border:none; color:#ff3366; cursor:pointer;">✕ Remove</button>
        </div>
        <select class="track-select">
            <option value="">-- Select a Track --</option>
            ${options}
        </select>
        <div class="layer-meta">
            <span>Type: Auto-detect</span>
            <span id="stat-${id}">Ready</span>
        </div>
    `;
    container.appendChild(div);
}

function playAllLayers() {
    stopAll();
    const selects = document.querySelectorAll('.track-select');
    const startTime = audioCtx.currentTime;

    selects.forEach(select => {
        const trackId = select.value;
        if (!trackId) return;

        const track = userTracks.find(t => t.id === trackId);
        if (track && track.data) {
            scheduleTrack(track.data, track.type, startTime);
        }
    });
}

function scheduleTrack(data, type, masterStart) {
    data.forEach(evt => {
        const timeOffset = (evt.time || 0) / 1000;
        const playTime = masterStart + timeOffset;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // Synth for Piano, Sine/Noise for Drum logic
        osc.type = (type === 'drum_recording') ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(getFreq(evt.note || 'C4'), playTime);

        gain.gain.setValueAtTime(0, playTime);
        gain.gain.linearRampToValueAtTime(0.15, playTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, playTime + 0.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(playTime);
        osc.stop(playTime + 0.6);
        
        // Keep track of timeouts to stop if needed
        playbackTimeouts.push(osc);
    });
}

function stopAll() {
    playbackTimeouts.forEach(osc => {
        try { osc.stop(); } catch(e) {}
    });
    playbackTimeouts = [];
}

function getFreq(n) {
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = parseInt(n.slice(-1)) || 4;
    const name = n.slice(0, -1);
    const index = NOTES.indexOf(name);
    return 440 * Math.pow(2, (octave - 4) + (index - 9) / 12);
}