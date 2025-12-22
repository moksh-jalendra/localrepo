// profileview.js - View Profile, Friends & Messages

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

const urlParams = new URLSearchParams(window.location.search);
const targetUid = urlParams.get('uid');

let currentUser = null;
let audioCtx = null;
let currentTimers = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!targetUid) { alert("User not found."); window.location.href = 'feed.html'; return; }

    auth.onAuthStateChanged(user => {
        currentUser = user;
        loadUserProfile();
        loadUserPosts();
        if(user && user.uid !== targetUid) {
            checkFriendStatus(user.uid, targetUid);
        }
    });

    // Enable Audio
    document.body.addEventListener('click', unlockAudio, { once: true });
    document.body.addEventListener('touchstart', unlockAudio, { once: true });
});

// --- FRIEND LOGIC ---
function checkFriendStatus(myUid, theirUid) {
    const btnAdd = document.getElementById('btn-add-friend');
    const btnSent = document.getElementById('btn-req-sent');
    const btnMsg = document.getElementById('btn-message');

    // 1. Check if already friends
    db.ref(`users/${myUid}/friends/${theirUid}`).once('value', snapshot => {
        if(snapshot.exists()) {
            // Is Friend
            btnMsg.style.display = 'block';
            btnMsg.onclick = () => window.location.href = `message.html?uid=${theirUid}`;
        } else {
            // Not Friend, Check if Request Sent
            db.ref(`friendRequests/${theirUid}/${myUid}`).once('value', reqSnap => {
                if(reqSnap.exists()) {
                    btnSent.style.display = 'block';
                } else {
                    // Check if *they* sent *me* a request (Optional: Show "Accept" here, but for now just show Add)
                    btnAdd.style.display = 'block';
                }
            });
        }
    });

    btnAdd.addEventListener('click', () => {
        if(!currentUser) return alert("Login required");
        btnAdd.disabled = true;
        btnAdd.innerText = "Sending...";

        const reqData = {
            senderId: currentUser.uid,
            senderName: currentUser.displayName || "Musician",
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            status: 'pending'
        };

        // 1. Add to Requests Node
        db.ref(`friendRequests/${targetUid}/${currentUser.uid}`).set(reqData);

        // 2. Send Notification
        db.ref(`notifications/${targetUid}`).push({
            type: 'friend_request',
            sender: currentUser.displayName || "Musician",
            senderId: currentUser.uid,
            message: `${currentUser.displayName} wants to be friends!`,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false
        }).then(() => {
            btnAdd.style.display = 'none';
            btnSent.style.display = 'block';
        });
    });
}

// ... (Existing loadUserProfile, loadUserPosts, Audio Engine logic remains exactly the same as previous profileview.js) ...
// Copy the rest of the original profileview.js content here
function loadUserProfile() {
    db.ref('users/' + targetUid).once('value', snapshot => {
        document.getElementById('loading-indicator').style.display = 'none';
        document.getElementById('profile-content').style.display = 'block';

        const user = snapshot.val();
        if (!user) {
            document.getElementById('pv-name').innerText = "Unknown User";
            return;
        }

        const name = user.displayName || "User";
        document.getElementById('pv-name').innerText = name;
        document.getElementById('pv-avatar').innerText = name[0].toUpperCase();
        document.getElementById('pv-bio').innerText = user.bio || "No bio available.";
        
        if (user.createdAt) {
            document.getElementById('pv-joined').innerText = new Date(user.createdAt).toLocaleDateString();
        }

        if (user.isVerified) {
            document.getElementById('pv-verified').style.display = 'inline-block';
        }
    });
}

function loadUserPosts() {
    const list = document.getElementById('pv-posts-list');
    
    // Query 'posts' where 'authorId' matches targetUid
    db.ref('posts').orderByChild('authorId').equalTo(targetUid).once('value', snapshot => {
        list.innerHTML = '';
        if (!snapshot.exists()) {
            list.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">No public posts yet.</p>';
            return;
        }

        const posts = [];
        snapshot.forEach(child => posts.push({ id: child.key, ...child.val() }));
        posts.reverse(); // Newest first

        posts.forEach(post => {
            const title = post.asset.title || post.asset.name || "Untitled";
            const date = new Date(post.timestamp).toLocaleDateString();
            const icon = post.type === 'tone' ? '🎛️' : '🎵';
            const safeData = encodeURIComponent(JSON.stringify(post));

            const div = document.createElement('div');
            div.className = 'pv-post-card';
            div.innerHTML = `
                <div class="pv-post-info">
                    <div class="pv-post-icon">${icon}</div>
                    <div class="pv-post-details">
                        <span class="pv-post-title">${title}</span>
                        <span class="pv-post-date">${date}</span>
                    </div>
                </div>
                <button id="btn-${post.id}" class="pv-action-btn" onclick="previewTrack('${post.id}', '${safeData}', this)">
                    ▶ Play
                </button>
            `;
            list.appendChild(div);
        });
    });
}

// --- MINIMAL AUDIO ENGINE (Read-Only) ---
function unlockAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

window.previewTrack = (pid, json, btn) => {
    unlockAudio();
    stopPlayback();

    const postData = JSON.parse(decodeURIComponent(json));
    const isPlaying = btn.classList.contains('playing');

    // Reset all buttons
    document.querySelectorAll('.pv-action-btn').forEach(b => {
        b.classList.remove('playing');
        b.innerText = "▶ Play";
    });

    if (isPlaying) return; // Just stop

    btn.classList.add('playing');
    btn.innerText = "⏹ Stop";

    const seq = postData.asset.data;
    const toneType = postData.asset.previewTone || (postData.type === 'tone' ? postData.asset.data : 'PIANO');
    
    const sequenceToPlay = postData.type === 'tone' ? 
        [{note:'C4',time:0,duration:400},{note:'E4',time:400,duration:400},{note:'G4',time:800,duration:400}] : 
        seq;

    if (!Array.isArray(sequenceToPlay)) {
        alert("Cannot play this track format.");
        stopPlayback();
        return;
    }

    let maxTime = 0;
    const now = audioCtx.currentTime;

    sequenceToPlay.forEach(evt => {
        const time = (evt.time || 0) / 1000;
        const dur = (evt.duration || 400) / 1000;
        
        const t = setTimeout(() => {}, evt.time); 
        currentTimers.push(t);

        playTone(getFreq(evt.note), now + time, dur, toneType);
        maxTime = Math.max(maxTime, evt.time + (evt.duration || 400));
    });

    currentTimers.push(setTimeout(stopPlayback, maxTime + 500));
};

function stopPlayback() {
    currentTimers.forEach(clearTimeout);
    currentTimers = [];
    document.querySelectorAll('.pv-action-btn').forEach(b => {
        b.classList.remove('playing');
        b.innerText = "▶ Play";
    });
}

function playTone(freq, time, dur, config) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = (config === 'SYNTH' || (config && config.wave === 'sawtooth')) ? 'sawtooth' : 'triangle';
    if(config === 'FLUTE' || (config && config.wave === 'sine')) o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.3, time + 0.05);
    g.gain.exponentialRampToValueAtTime(0.01, time + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(time); o.stop(time + dur + 0.1);
}

function getFreq(n) { if(!n) return 440; const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; const oct = parseInt(n.slice(-1)); const idx = NOTES.indexOf(n.slice(0,-1)); if(isNaN(oct)||idx===-1) return 440; return 27.5 * Math.pow(2, (oct*12+idx)/12); }
