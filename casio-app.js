// casio-app.js - Fixed Data Loading with Auto-Demo

// --- UPDATED CONFIGURATION (music-2af50) ---
const firebaseConfig = {
  apiKey: "AIzaSyC2T_hrXC_RZvCvoLc9d9ldpLSb4z03Wyw",
  authDomain: "music-2af50.firebaseapp.com",
  projectId: "music-2af50",
  storageBucket: "music-2af50.firebasestorage.app",
  messagingSenderId: "607018974762",
  appId: "1:607018974762:web:d8ea53518e9bb6bd180d53",
  measurementId: "G-7F6RPG9N0L"
};

// Initialize only if not already initialized
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

window.currentUser = null;
window.savedRecordings = {}; 
window.customTones = {}; 

// --- BUILT-IN DEMO TRACK (Fallback) ---
const DEMO_TRACK = {
    'demo_01': {
        id: 'demo_01',
        title: "🎹 Demo Melody",
        data: [
            {note: "C4", time: 0, duration: 300}, {note: "E4", time: 250, duration: 300},
            {note: "G4", time: 500, duration: 300}, {note: "C5", time: 750, duration: 500},
            {note: "B4", time: 1000, duration: 300}, {note: "G4", time: 1250, duration: 300},
            {note: "E4", time: 1500, duration: 300}, {note: "C4", time: 1750, duration: 800}
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    
    auth.onAuthStateChanged(user => {
        window.currentUser = user;
        
        if (user) {
            // A. LOGGED IN: Load User Tracks
            db.ref('users/' + user.uid + '/savedKeys/').on('value', snapshot => {
                const val = snapshot.val();
                
                // Use User Data OR Fallback to Demo if empty
                window.savedRecordings = val || DEMO_TRACK;
                
                // Convert to Array for Display
                const sourceObj = val || DEMO_TRACK;
                const list = Object.keys(sourceObj).map(key => ({
                    id: key,
                    title: sourceObj[key].title || "Untitled Track", 
                    ...sourceObj[key]
                }));
                
                if (window.DisplayModule) {
                    DisplayModule.updateTracks(list);
                    if (!val) DisplayModule.tempMessage("DEMO MODE");
                }
            });

            // B. Load Custom Tones
            db.ref('users/' + user.uid + '/customTones/').on('value', snapshot => {
                const val = snapshot.val();
                window.customTones = val || {};
                if (window.DisplayModule) DisplayModule.updateTones(window.customTones);
            });

        } else {
            // C. GUEST MODE: Load Demo Track Only
            window.savedRecordings = DEMO_TRACK;
            const list = [{ id: 'demo_01', title: "🎹 Demo Melody" }];
            
            if (window.DisplayModule) {
                DisplayModule.updateTracks(list);
            }
        }
    });

    // --- CUSTOM TONE EDITOR ---
    const editor = document.getElementById('custom-tone-editor');
    const openBtn = document.getElementById('custom-tone-btn');
    const closeBtn = document.getElementById('close-editor-btn');
    const saveBtn = document.getElementById('save-tone-btn');
    const testBtn = document.getElementById('test-tone-btn');

    if (openBtn) openBtn.addEventListener('click', () => {
        if (!window.currentUser) return alert("Please Login to create custom synths!");
        editor.style.display = 'flex';
    });

    if (closeBtn) closeBtn.addEventListener('click', () => editor.style.display = 'none');

    function getSettings() {
        return {
            name: document.getElementById('ct-name').value || "My Synth",
            wave: document.getElementById('ct-wave').value,
            duration: parseFloat(document.getElementById('ct-duration').value),
            detune: parseInt(document.getElementById('ct-detune').value),
            gain: parseFloat(document.getElementById('ct-gain').value)
        };
    }

    if (testBtn) testBtn.addEventListener('click', () => {
        if(window.CasioEngine) CasioEngine.previewTone(getSettings());
    });

    if (saveBtn) saveBtn.addEventListener('click', () => {
        if (!window.currentUser) return;
        const settings = getSettings();
        saveBtn.innerText = "Saving...";
        db.ref('users/' + window.currentUser.uid + '/customTones/').push(settings)
            .then(() => {
                alert(`Tone "${settings.name}" Saved!`);
                editor.style.display = 'none';
                saveBtn.innerText = "💾 Save";
                if(window.DisplayModule) DisplayModule.setMode('TONE');
            });
    });
});
