// feed.js - Fixed Profile Link, Likes & Counters

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

let currentUser = null;
let audioCtx = null;
let activeNodes = [];
let progressTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(u => {
        currentUser = u;
        fetchPosts();
        if(u) checkNotifications(u.uid);
    });
});

function checkNotifications(uid) {
    rtdb.ref(`notifications/${uid}`).orderByChild('read').equalTo(false).on('value', snap => {
        const dot = document.getElementById('notify-dot');
        if(dot) dot.style.display = snap.exists() ? 'block' : 'none';
    });
}

function fetchPosts() {
    const container = document.getElementById('posts-feed');
    if (!container) return;

    db.collection('posts')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .onSnapshot(snap => { // Real-time listener for Likes/Saves updates
            container.innerHTML = '';
            
            if (snap.empty) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No posts yet! 🏜️</h3>
                        <p>Be the first to share a melody or beat.</p>
                        <a href="instrument.html" class="control-btn" style="display:inline-block; margin-top:10px; background:var(--secondary-color); color:black;">Create Music</a>
                    </div>`;
                return;
            }

            snap.forEach(doc => {
                const data = doc.data();
                if (data.asset) {
                    renderPost({ id: doc.id, ...data }, container);
                }
            });
        });
}

function renderPost(post, container) {
    let icon = '🎵'; 
    let typeLabel = 'Piano Track';
    let saveLabel = 'Track';
    let previewInfo = '';

    // 1. Determine Type
    if(post.type === 'drum_recording') { 
        icon = '🥁'; typeLabel = 'Drum Beat'; 
    } else if (post.type === 'custom_tone') {
        icon = '🎛️'; typeLabel = 'Custom Tone'; saveLabel = 'Tone';
    } else if (post.type === 'custom_kit') {
        icon = '📦'; typeLabel = 'Custom Kit'; saveLabel = 'Kit';
    }

    if (post.asset.previewTone && post.asset.previewTone !== 'PIANO') {
        previewInfo = `<span class="track-tag">${post.asset.previewTone}</span>`;
    }

    const safeData = encodeURIComponent(JSON.stringify(post));
    const title = post.asset.title || "Untitled";
    const dateStr = post.timestamp?.toDate ? post.timestamp.toDate().toLocaleDateString() : 'Just now';
    
    // 2. Counts & Status
    const likesCount = post.likes ? post.likes.length : 0;
    const savesCount = post.saves || 0;
    const isLiked = currentUser && post.likes && post.likes.includes(currentUser.uid);
    const likeClass = isLiked ? 'active-like' : '';
    const heartIcon = isLiked ? '❤️' : '🤍';

    // 3. Profile Link (The Fix)
    const profileUrl = `profileview.html?uid=${post.authorId}`;

    const html = `
        <article class="post">
            <a href="${profileUrl}" class="post-header-link">
                <div class="post-header">
                    <div class="user-avatar">${(post.authorName||'U')[0].toUpperCase()}</div>
                    <div class="header-info">
                        <div class="username">
                            ${post.authorName} 
                            ${post.authorVerified ? '<span style="color:#00bfff">✓</span>' : ''}
                        </div>
                        <div class="time">${typeLabel} • ${dateStr}</div>
                    </div>
                </div>
            </a>

            <div class="post-content">
                <p class="post-caption">${post.content || ''}</p>
                <div class="audio-card">
                    <div class="track-info">
                        <span class="music-icon">${icon}</span>
                        <span class="track-title">${title}</span>
                        ${previewInfo}
                    </div>
                    <div class="audio-progress-container" id="prog-${post.id}">
                        <div class="audio-progress-bar-inner"></div>
                    </div>
                </div>
            </div>

            <div class="post-actions">
                <button class="action-btn listen-btn" id="btn-${post.id}" onclick="window.toggleListen('${post.id}', '${safeData}')">
                    ▶ Listen
                </button>
                
                <div class="social-group">
                    <button class="action-btn like-btn ${likeClass}" onclick="window.toggleLike('${post.id}')">
                        ${heartIcon} ${likesCount}
                    </button>
                    <button class="action-btn save-btn" onclick="window.saveItem('${post.id}', '${safeData}')">
                        💾 ${saveLabel} <span style="font-size:0.8em; opacity:0.7; margin-left:4px;">(${savesCount})</span>
                    </button>
                </div>
            </div>
        </article>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

// --- ACTIONS ---

window.toggleLike = (pid) => {
    if(!currentUser) return alert("Login to like posts.");
    const ref = db.collection('posts').doc(pid);
    
    // We can't easily know current state inside onclick without passing it, 
    // but Firestore 'arrayUnion' / 'arrayRemove' handles logic safely if we check local state via UI class
    // Ideally we read the doc, but for speed we toggle based on UI or try both.
    // Better approach: Read doc inside transaction, OR simple toggle check:
    
    // Check if button currently has 'active-like' class to guess state
    // (This is optimistic UI update, real update happens via onSnapshot listener in fetchPosts)
    
    db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (!doc.exists) return;
        const data = doc.data();
        const likes = data.likes || [];
        
        if (likes.includes(currentUser.uid)) {
            t.update(ref, { likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        } else {
            t.update(ref, { likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
        }
    });
};

window.saveItem = (pid, json) => {
    if(!currentUser) return alert("Login required.");
    const post = JSON.parse(decodeURIComponent(json));
    
    let collection = 'tracks'; 
    let isRoot = false; 
    let dataToSave = {};

    if (post.type === 'custom_tone') {
        collection = 'customTones';
        isRoot = true;
        dataToSave = post.asset.data; 
    } else if (post.type === 'custom_kit') {
        collection = 'customKits';
        isRoot = true;
        dataToSave = post.asset.data; 
    } else {
        dataToSave = {
            title: post.asset.title,
            type: post.type,
            data: post.asset.data,
            kit: post.asset.kit || null,
            savedFrom: post.authorName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    if(isRoot) {
        dataToSave.userId = currentUser.uid;
        dataToSave.name = post.asset.title;
        dataToSave.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    }

    const targetRef = isRoot 
        ? db.collection(collection) 
        : db.collection('users').doc(currentUser.uid).collection(collection);

    targetRef.add(dataToSave)
        .then(() => {
            // Increment Global Save Count
            db.collection('posts').doc(pid).update({
                saves: firebase.firestore.FieldValue.increment(1)
            });
            alert("Saved to your profile!");
        })
        .catch(e => alert("Error: " + e.message));
};

// --- AUDIO PLAYBACK (Same as before) ---
window.toggleListen = (pid, json) => {
    if(!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    stopAll();

    const post = JSON.parse(decodeURIComponent(json));
    const btn = document.getElementById(`btn-${pid}`);
    
    if(btn.classList.contains('playing')) {
        btn.classList.remove('playing');
        btn.innerText = "▶ Listen";
        return;
    }
    
    btn.classList.add('playing');
    btn.innerText = "⏹ Stop";
    
    if(post.type === 'drum_recording') playDrumTrack(post, pid);
    else playPianoTrack(post, pid); 
};

function playPianoTrack(post, pid) {
    const seq = (post.type === 'custom_tone' || !post.asset.data) ? 
        [{note:'C4',time:0,duration:400},{note:'E4',time:400,duration:400},{note:'G4',time:800,duration:400}] : 
        post.asset.data;
    const inst = post.asset.previewTone || 'PIANO';
    const toneConfig = (post.type === 'custom_tone') ? post.asset.data : inst;
    const now = audioCtx.currentTime;
    let maxTime = 0;

    seq.forEach(evt => {
        const t = now + (evt.time / 1000);
        const dur = (evt.duration || 400) / 1000;
        playTone(evt.note, t, dur, toneConfig);
        const end = evt.time + (evt.duration || 400);
        if(end > maxTime) maxTime = end;
    });
    animateProgress(pid, maxTime);
}

function playTone(note, t, dur, type) {
    const freq = getFreq(note);
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    
    if (typeof type === 'object') {
        o.type = type.wave || 'triangle';
        try { if(type.detune) o.detune.value = type.detune; } catch(e){}
    } else {
        o.type = (type === 'SYNTH') ? 'sawtooth' : (type === 'FLUTE' ? 'sine' : 'triangle');
    }
    
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.1);
    activeNodes.push(o);
}

const DrumSynth = {
    play(ctx, dest, type, pitch, time) {
        if(type === 'Kick') this.kick(ctx, dest, pitch, time);
        else if(type === 'Snare') this.snare(ctx, dest, pitch, time);
        else if(type === 'HiHat') this.hihat(ctx, dest, time);
        else if(type === 'Tom1' || type === 'Tom2') this.tom(ctx, dest, pitch, time);
        else if(type === 'Crash' || type === 'Ride') this.cymbal(ctx, dest, time);
        else this.snare(ctx, dest, 800, time);
    },
    kick(ctx, dest, pitch, t) {
        const o=ctx.createOscillator(); const g=ctx.createGain();
        o.connect(g); g.connect(dest);
        o.frequency.setValueAtTime(pitch,t); o.frequency.exponentialRampToValueAtTime(0.01,t+0.5);
        g.gain.setValueAtTime(1,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.5);
        o.start(t); o.stop(t+0.5); activeNodes.push(o);
    },
    snare(ctx, dest, pitch, t) {
        const o=ctx.createOscillator(); const g=ctx.createGain(); o.type='triangle';
        o.connect(g); g.connect(dest);
        o.frequency.setValueAtTime(pitch,t); 
        g.gain.setValueAtTime(0.5,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.2);
        o.start(t); o.stop(t+0.2); activeNodes.push(o);
        
        const b=ctx.createBuffer(1,ctx.sampleRate*0.2,ctx.sampleRate);
        const d=b.getChannelData(0); for(let i=0;i<b.length;i++) d[i]=Math.random()*2-1;
        const n=ctx.createBufferSource(); n.buffer=b; const ng=ctx.createGain();
        n.connect(ng); ng.connect(dest);
        ng.gain.setValueAtTime(0.8,t); ng.gain.exponentialRampToValueAtTime(0.01,t+0.2);
        n.start(t); activeNodes.push(n);
    },
    hihat(ctx, dest, t) {
        const b=ctx.createBuffer(1,ctx.sampleRate*0.05,ctx.sampleRate);
        const d=b.getChannelData(0); for(let i=0;i<b.length;i++) d[i]=Math.random()*2-1;
        const n=ctx.createBufferSource(); n.buffer=b;
        const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=7000;
        const g=ctx.createGain();
        g.gain.setValueAtTime(0.6,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.05);
        n.connect(f); f.connect(g); g.connect(dest); n.start(t); activeNodes.push(n);
    },
    tom(ctx, dest, pitch, t) {
        const o=ctx.createOscillator(); const g=ctx.createGain();
        o.connect(g); g.connect(dest);
        o.frequency.setValueAtTime(pitch,t); o.frequency.exponentialRampToValueAtTime(pitch/2, t+0.3);
        g.gain.setValueAtTime(0.8,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.3);
        o.start(t); o.stop(t+0.3); activeNodes.push(o);
    },
    cymbal(ctx, dest, t) {
        const b=ctx.createBuffer(1,ctx.sampleRate*0.5,ctx.sampleRate);
        const d=b.getChannelData(0); for(let i=0;i<b.length;i++) d[i]=Math.random()*2-1;
        const n=ctx.createBufferSource(); n.buffer=b;
        const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=5000;
        const g=ctx.createGain();
        g.gain.setValueAtTime(0.5,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.5);
        n.connect(f); f.connect(g); g.connect(dest); n.start(t); activeNodes.push(n);
    }
};

function playDrumTrack(post, pid) {
    const seq = post.asset.data;
    const kit = post.asset.kit || {};
    const now = audioCtx.currentTime;
    let maxTime = 0;
    if (!Array.isArray(seq)) return;
    seq.forEach(evt => {
        const t = now + (evt.time / 1000);
        const padAssign = kit[evt.padId];
        if(padAssign) {
            DrumSynth.play(audioCtx, audioCtx.destination, padAssign.octaKit, padAssign.drumPitch || 150, t);
        }
        if(evt.time > maxTime) maxTime = evt.time;
    });
    animateProgress(pid, maxTime);
}

function getFreq(n) { if(!n) return 440; const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; const oct = parseInt(n.slice(-1)); const idx = NOTES.indexOf(n.slice(0,-1)); return 27.5 * Math.pow(2, (oct*12+idx)/12); }

function stopAll() {
    activeNodes.forEach(n => { try{n.stop()}catch(e){} });
    activeNodes = [];
    clearInterval(progressTimer);
    document.querySelectorAll('.audio-progress-bar-inner').forEach(b => b.style.width = '0%');
    document.querySelectorAll('.listen-btn').forEach(b => { b.classList.remove('playing'); b.innerText = "▶ Listen"; });
}

function animateProgress(pid, durationMs) {
    const bar = document.getElementById(`prog-${pid}`)?.querySelector('div');
    if(!bar) return;
    const start = Date.now();
    progressTimer = setInterval(() => {
        const p = Math.min(100, ((Date.now() - start) / durationMs) * 100);
        bar.style.width = p + '%';
        if(p >= 100) stopAll();
    }, 50);
}
