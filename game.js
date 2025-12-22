// game.js - Weekly Tournament Logic (Fixed for Admin Security Rules)

// --- FIXED FIREBASE CONFIGURATION ---
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
const db = firebase.database();
const auth = firebase.auth();

let currentUser = null;

// --- 1. WEEK GENERATOR (UTC) ---
// Generates a unique ID for the current week (e.g., "Y2025_W48") to reset leaderboard weekly
function getWeekID() {
    const d = new Date();
    d.setUTCHours(0,0,0,0);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return `Y${d.getUTCFullYear()}_W${weekNo}`;
}

const CURRENT_WEEK = getWeekID();

const Game = {
    verifiedTracks: [],
    currentTrack: null,
    
    isPlayingDemo: false,
    isRankedAttempt: false, 
    userIndex: 0,
    correctNotes: 0,
    totalScore: 0,
    
    init() {
        // 1. Lock Button Initially
        const startBtn = document.getElementById('start-game-btn');
        if(startBtn) {
            startBtn.disabled = true;
            startBtn.innerText = "LOADING TRACKS...";
            startBtn.style.opacity = "0.5";
            startBtn.style.cursor = "wait";
        }

        // 2. Auth Check
        auth.onAuthStateChanged(user => {
            currentUser = user;
            if(!user) location.href = 'auth.html';
            else this.loadUserData();
        });

        // 3. Fetch Data (THE FIX: Bypass 'users' node, check 'posts' directly)
        db.ref('posts').once('value', postSnap => {
            const data = postSnap.val() || {};
            
            // Filter for tracks that are explicitly verified (Hunt Ready)
            this.verifiedTracks = Object.values(data).filter(p => 
                p.isVerified === true && 
                p.asset && p.asset.data && p.asset.data.length > 0
            );
            
            // 4. Update UI based on results
            if(startBtn) {
                if(this.verifiedTracks.length > 0) {
                    startBtn.disabled = false;
                    startBtn.innerText = "ENTER ARENA";
                    startBtn.style.opacity = "1";
                    startBtn.style.cursor = "pointer";
                } else {
                    startBtn.innerText = "NO VERIFIED TRACKS";
                    startBtn.style.background = "#333";
                    startBtn.style.color = "#888";
                    startBtn.style.boxShadow = "none";
                    startBtn.style.animation = "none";
                }
            }
        });

        // 5. Setup Event Listeners
        if(startBtn) startBtn.addEventListener('click', () => this.enterArena());
        document.getElementById('demo-btn').addEventListener('click', () => this.playDemo());
        document.getElementById('round-start-btn').addEventListener('click', () => {
            if(!this.isPlayingDemo) this.startRankedRound();
        });
        document.getElementById('toggle-labels-btn').addEventListener('click', () => 
            document.querySelector('.main-keys').classList.toggle('show-labels')
        );
        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            if(!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
        });

        // 6. Keyboard Input
        const keyboard = document.querySelector('.main-keyboard-area');
        if(keyboard) {
            keyboard.addEventListener('mousedown', e => this.handleInput(e));
            keyboard.addEventListener('touchstart', e => this.handleInput(e));
        }
    },

    loadUserData() {
        if(!currentUser) return;
        // Load the user's current score for this week
        db.ref(`leaderboard/${CURRENT_WEEK}/${currentUser.uid}/score`).once('value', s => {
            this.totalScore = s.val() || 0;
            this.updateLCD();
        });
    },

    enterArena() {
        if(this.verifiedTracks.length === 0) return;
        
        // Hide overlay, show Casio
        document.getElementById('game-overlay').style.display = 'none';
        const wrapper = document.querySelector('.casio-wrapper');
        wrapper.style.opacity = '1';
        
        // Force resize to fix layout
        window.dispatchEvent(new Event('resize')); 
        
        // Resume Audio Context if blocked by browser
        if(window.CasioEngine) CasioEngine.resumeContext();
        
        this.loadRandomSong();
    },

    loadRandomSong() {
        // Pick a random song from the verified list
        const rand = Math.floor(Math.random() * this.verifiedTracks.length);
        const trackObj = this.verifiedTracks[rand];
        this.currentTrack = trackObj.asset.data;
        
        const songName = (trackObj.asset.title || "Unknown").substring(0, 10);
        this.setStatus(`SONG: ${songName}`);
        document.getElementById('note-display').innerText = "--";
        
        // Reset Round State
        this.isRankedAttempt = false;
        this.userIndex = 0;
        this.correctNotes = 0;
        
        // Reset Buttons
        document.getElementById('demo-btn').disabled = false;
        document.getElementById('round-start-btn').disabled = false;
        document.getElementById('round-start-btn').style.opacity = "1";
    },

    playDemo() {
        if(this.isPlayingDemo || this.isRankedAttempt) return;
        this.isPlayingDemo = true;
        this.setStatus("LISTEN...");
        
        let delay = 0;
        this.currentTrack.forEach(item => {
            setTimeout(() => {
                // Visual & Audio Preview
                if(window.CasioEngine) CasioEngine.previewTone({ duration: 0.3 });
                this.highlightKey(item.note, 'game-target');
                document.getElementById('note-display').innerText = item.note;
            }, delay);
            delay += 500; // Speed of demo
        });

        setTimeout(() => {
            this.isPlayingDemo = false;
            this.setStatus("READY");
            document.getElementById('note-display').innerText = "--";
        }, delay + 200);
    },

    startRankedRound() {
        this.isRankedAttempt = true;
        this.userIndex = 0;
        this.correctNotes = 0;
        
        // Disable buttons during play
        document.getElementById('demo-btn').disabled = true;
        document.getElementById('round-start-btn').disabled = true;
        document.getElementById('round-start-btn').style.opacity = "0.5";
        
        this.setStatus("YOUR TURN!");
    },

    handleInput(e) {
        if(!this.isRankedAttempt) return;
        
        // Find the key element
        const target = e.target.closest('.key');
        if(!target) return;
        
        const note = target.dataset.note;

        // Play feedback sound
        if(window.CasioEngine) CasioEngine.previewTone({ duration: 0.2 });
        
        // Visual feedback
        target.classList.add('game-hit');
        setTimeout(()=>target.classList.remove('game-hit'), 150);

        // Check accuracy
        const expected = this.currentTrack[this.userIndex].note;
        
        if(note === expected) {
            this.correctNotes++;
            this.userIndex++;
            this.setStatus("GOOD!");
            if(this.userIndex >= this.currentTrack.length) this.endRound();
        } else {
            this.userIndex++;
            this.setStatus("MISS!");
            if(this.userIndex >= this.currentTrack.length) this.endRound();
        }
    },

    highlightKey(note, cls) {
        const k = document.querySelector(`.key[data-note="${note}"]`);
        if(k) { k.classList.add(cls); setTimeout(()=>k.classList.remove(cls), 300); }
        // Also highlight reference key if visible
        const r = document.querySelector(`.ref-key[data-note="${note}"]`);
        if(r) { r.classList.add(cls); setTimeout(()=>r.classList.remove(cls), 300); }
    },

    endRound() {
        this.isRankedAttempt = false;
        
        // Calculate Score
        const accuracy = this.correctNotes / this.currentTrack.length;
        const points = Math.floor(accuracy * 100);
        
        // Safe Transaction to update Leaderboard
        const userRef = db.ref(`leaderboard/${CURRENT_WEEK}/${currentUser.uid}`);
        
        userRef.transaction((data) => {
            if (data) {
                data.score = (data.score || 0) + points;
                data.name = currentUser.displayName; // Keep name fresh
                data.timestamp = firebase.database.ServerValue.TIMESTAMP;
            } else {
                data = {
                    name: currentUser.displayName,
                    score: points,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };
            }
            return data;
        }, (error, committed, snapshot) => {
            if (committed) {
                const val = snapshot.val();
                this.totalScore = val.score;
                this.updateLCD();
                
                // Show Result Screen
                document.getElementById('game-overlay').style.display = 'flex';
                document.getElementById('start-game-btn').style.display = 'none'; // Hide enter button
                document.getElementById('game-stats').style.display = 'block';    // Show stats
                
                document.getElementById('final-score').innerText = points + "pts";
                document.getElementById('points-awarded').innerText = `Total Score: ${this.totalScore}`;

                // Auto-restart after 3 seconds
                setTimeout(() => {
                    document.getElementById('game-overlay').style.display = 'none';
                    this.loadRandomSong();
                }, 3000);
            }
        });
    },

    setStatus(text) { 
        if(text.length > 12) text = text.substring(0, 12);
        document.getElementById('status-display').innerText = text; 
    },
    
    updateLCD() {
        document.getElementById('game-score-display').innerText = this.totalScore;
    }
};

// Start the game logic when the DOM is ready
window.addEventListener('load', () => Game.init());
