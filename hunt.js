// hunt.js - Complete Logic (Search, Player, Leaderboard)

// --- FIXED FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyC2T_hrXC_RZvCvoLc9d9ldpLSb4z03Wyw", // Assuming this is the correct key from the system context
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

// GLOBAL STATE
let allPosts = []; 
let postsMap = {}; 
let currentUser = null; 

// AUDIO STATE
let audioCtx = null;
let activeOscillators = [];
let currentPlayingId = null;
let playbackStartTime = 0;
let playbackDuration = 0;
let progressInterval = null;

// UTC Week ID (Must match game.js logic)
function getWeekID() {
    const d = new Date();
    d.setUTCHours(0,0,0,0);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return `Y${d.getUTCFullYear()}_W${weekNo}`;
}
const CURRENT_WEEK = getWeekID();

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resultsWrapper = document.getElementById('results-wrapper');
    const resultsContainer = document.getElementById('results-container');
    const gameCenter = document.getElementById('game-center');
    
    // --- AUTH & INIT ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if(user) loadMyStats(user.uid);
        fetchAllPosts();
        loadLeaderboard();
    });

    // --- DATA FETCHING ---
    function fetchAllPosts() {
        // Listen to 'posts' node in real-time
        db.ref('posts').on('value', snapshot => {
            allPosts = [];
            postsMap = {};
            const data = snapshot.val();
            
            if (data) {
                Object.entries(data).forEach(([key, post]) => {
                    // Flatten data structure for easier filtering
                    const postObj = { id: key, ...post };
                    allPosts.push(postObj);
                    postsMap[key] = postObj; 
                });
            }
            
            // If user was already searching, refresh the results automatically
            if(searchInput.value.trim() !== "") {
                performSearch(searchInput.value);
            }
        });
    }

    // --- SEARCH LISTENERS ---
    if(searchBtn) searchBtn.addEventListener('click', () => performSearch(searchInput.value));
    if(searchInput) searchInput.addEventListener('keypress', (e) => { 
        if(e.key==='Enter') performSearch(searchInput.value); 
    });

    // --- SEARCH LOGIC (STRICT FILTER) ---
    function performSearch(term) {
        const query = term.toLowerCase().trim();
        
        // Toggle Views
        if (!query) {
            gameCenter.style.display = 'block';
            resultsWrapper.style.display = 'none';
            return;
        }

        gameCenter.style.display = 'none';
        resultsWrapper.style.display = 'block';

        // FILTER: Track Title matches Query AND Post is Verified by Admin
        const filtered = allPosts.filter(post => {
            const trackName = (post.asset?.title || "").toLowerCase();
            return trackName.includes(query) && post.isVerified === true;
        });

        displayResults(filtered, query);
    }

    function displayResults(posts, query) {
        resultsContainer.innerHTML = '';
        
        if (posts.length === 0) {
            resultsContainer.innerHTML = `
                <div style="padding:40px; text-align:center; color:#888;">
                    <p>No verified tracks found named "<b>${query}</b>"</p>
                    <small>Note: Only Admin-verified tracks appear in Challenge mode.</small>
                </div>`;
            return;
        }

        // Show newest verified tracks first
        posts.reverse().forEach(post => {
            const isLiked = currentUser && post.likes && post.likes[currentUser.uid];
            const likesCount = post.likes ? Object.keys(post.likes).length : 0;
            const savesCount = post.saves || 0;
            
            // Special Badge for Hunt/Verified Tracks
            const badge = '<span style="color:#00bfff; font-size:0.8em; font-weight:bold; margin-left:5px;">🏆 OFFICIAL</span>';

            const html = `
                <div class="search-result-post" id="card-${post.id}">
                    <div style="font-weight:bold; color:var(--text-color);">
                        ${post.authorName} ${badge}
                    </div>
                    <div style="font-size:0.8em; color:#00bfff; margin-top:5px;">
                        🎵 ${post.asset.title}
                    </div>
                    
                    <div class="progress-bg">
                        <div class="progress-fill" id="bar-${post.id}"></div>
                    </div>
                    
                    <div class="result-actions">
                        <button class="btn-action btn-play" id="btn-${post.id}" onclick="previewTrack('${post.id}')">
                            ▶ Listen
                        </button>
                        
                        <button class="btn-action btn-like ${isLiked?'active':''}" onclick="doLike('${post.id}', this)">
                            ${isLiked?'❤️':'🤍'} <span>${likesCount}</span>
                        </button>
                        
                        <button class="btn-action btn-save" onclick="doSave('${post.id}')">
                            💾 <span>${savesCount}</span>
                        </button>
                    </div>
                </div>
            `;
            resultsContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    // --- LEADERBOARD LOGIC ---
    function loadLeaderboard() {
        db.ref(`leaderboard/${CURRENT_WEEK}`).orderByChild('score').limitToLast(10).on('value', snap => {
            const tbody = document.getElementById('leaderboard-body');
            tbody.innerHTML = '';
            const list = [];
            
            snap.forEach(c => {
                if(c.val().score !== undefined) list.push(c.val());
            });
            
            // Sort High to Low
            list.sort((a, b) => b.score - a.score);

            list.forEach((entry, idx) => {
                const tr = document.createElement('tr');
                let medal = idx===0?'🥇':(idx===1?'🥈':(idx===2?'🥉':''));
                tr.innerHTML = `
                    <td>${medal} ${idx+1}</td>
                    <td style="font-weight:bold; color:var(--text-color);">${entry.name}</td>
                    <td style="color:var(--secondary-color); font-weight:bold;">${entry.score}</td>
                `;
                tbody.appendChild(tr);
            });
            
            if(list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px; color:#888;">New Week! Be the first to play.</td></tr>`;
            }
        });
    }

    function loadMyStats(uid) {
        db.ref(`leaderboard/${CURRENT_WEEK}/${uid}`).on('value', s => {
            const d = s.val();
            document.getElementById('my-points').innerText = d ? d.score : 0;
            document.getElementById('my-rank').innerText = d ? "Active" : "-";
        });
    }
});

// --- ACTIONS (Global Functions) ---

window.doLike = (pid, btn) => {
    if(!currentUser) return alert("Login required");
    const ref = db.ref(`posts/${pid}/likes/${currentUser.uid}`);
    
    // Optimistic UI Toggle
    if(btn.classList.contains('active')) {
        ref.remove();
        btn.classList.remove('active');
    } else {
        ref.set(true);
        btn.classList.add('active');
    }
};

window.doSave = (pid) => {
    if(!currentUser) return alert("Login required");
    const post = postsMap[pid];
    if(!post) return;

    // 1. Increment global count
    db.ref(`posts/${pid}/saves`).transaction(count => (count || 0) + 1);
    
    // 2. Save to user profile
    db.ref(`users/${currentUser.uid}/savedKeys`).push({
        title: post.asset.title, 
        data: post.asset.data, 
        origin: 'hunt',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => alert("Saved to your Profile!"));
};

// --- AUDIO PLAYER ENGINE ---

window.previewTrack = (pid) => {
    // Logic to toggle: If clicking the same button, stop.
    if (currentPlayingId === pid) {
        stopAudio();
        return;
    }

    stopAudio(); // Clean up any previous track

    const post = postsMap[pid];
    if(!post || !post.asset || !post.asset.data) return alert("Audio data missing.");
    const seq = post.asset.data;

    // Initialize Audio Context
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    
    const now = audioCtx.currentTime;
    currentPlayingId = pid;
    playbackStartTime = Date.now();

    // Calculate total duration
    let maxTime = 0;
    seq.forEach(e => {
        const end = e.time + (e.duration || 400);
        if(end > maxTime) maxTime = end;
    });
    playbackDuration = maxTime + 200;

    // Update UI
    const btn = document.getElementById(`btn-${pid}`);
    if(btn) {
        btn.innerText = "⏹ Stop";
        btn.classList.add('playing');
    }

    // Schedule Sounds (Oscillators)
    seq.forEach(evt => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = getFreq(evt.note);
        osc.connect(gain); gain.connect(audioCtx.destination);
        
        const t = now + (evt.time/1000);
        const dur = (evt.duration || 400) / 1000;
        
        // Envelope for smoother sound
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        
        osc.start(t); 
        osc.stop(t + dur + 0.1);
        activeOscillators.push(osc);
    });

    // Start Progress Bar Animation
    const bar = document.getElementById(`bar-${pid}`);
    progressInterval = setInterval(() => {
        const elapsed = Date.now() - playbackStartTime;
        const percent = Math.min(100, (elapsed / playbackDuration) * 100);
        
        if(bar) bar.style.width = percent + "%";

        if(percent >= 100) stopAudio();
    }, 50);
};

function stopAudio() { 
    // Stop all active notes
    activeOscillators.forEach(o => { try{o.stop()}catch(e){} }); 
    activeOscillators = []; 
    
    if(progressInterval) clearInterval(progressInterval);

    // Reset UI for the track that was playing
    if (currentPlayingId) {
        const btn = document.getElementById(`btn-${currentPlayingId}`);
        const bar = document.getElementById(`bar-${currentPlayingId}`);
        if(btn) {
            btn.innerText = "▶ Listen";
            btn.classList.remove('playing');
        }
        if(bar) bar.style.width = "0%";
    }
    currentPlayingId = null;
}

// Frequency Helper (Note -> Hz)
function getFreq(n) { 
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; 
    const oct = parseInt(n.slice(-1)); 
    const idx = NOTES.indexOf(n.slice(0,-1)); 
    if(idx === -1) return 440; // Fallback
    return 27.5 * Math.pow(2, (oct*12+idx)/12); 
}
