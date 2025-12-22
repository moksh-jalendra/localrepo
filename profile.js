// profile.js - Complete Logic (Firestore Only)
// DEPENDENCY: This file assumes config.js is loaded before it.

// Globals
let currentUser = null;
let myTracks = {};
let myCustomAssets = {}; 
let currentPostCount = 0;

// Limits (To prevent spam)
const USER_LIMITS = { posts: 5, tracks: 10, tones: 10 };

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. AUTH STATE LISTENER (Fixes Login Loop) ---
    auth.onAuthStateChanged(user => {
        // HIDE THE LOADER (Critical Step)
        const loader = document.getElementById('loading-state');
        if(loader) loader.style.display = 'none';

        if (user) {
            currentUser = user;
            // UI: Show Profile
            document.getElementById('login-prompt').style.display = 'none';
            document.getElementById('profile-content').style.display = 'block';
            
            // UI: Set Limits Text
            if(document.getElementById('post-limit')) document.getElementById('post-limit').innerText = USER_LIMITS.posts;
            if(document.getElementById('track-limit')) document.getElementById('track-limit').innerText = USER_LIMITS.tracks;
            if(document.getElementById('tone-limit')) document.getElementById('tone-limit').innerText = USER_LIMITS.tones;

            // Load Data
            loadUserProfile(user.uid);
            loadUserData(user.uid);
            loadFriendsList(user.uid);
        } else {
            // UI: Show Login
            document.getElementById('login-prompt').style.display = 'block';
            document.getElementById('profile-content').style.display = 'none';
        }
    });

    // --- 2. USER PROFILE (Firestore) ---
    function loadUserProfile(uid) {
        db.collection('users').doc(uid).onSnapshot(doc => {
            const d = doc.exists ? doc.data() : {};
            const dbName = d.displayName || currentUser.displayName || "User";
            
            document.getElementById('profile-display-name').innerText = dbName;
            document.querySelector('.profile-avatar').innerText = dbName[0].toUpperCase();
            document.getElementById('profile-display-bio').innerText = d.bio || "No bio yet.";
            
            // Verification Badge
            const badge = document.getElementById('verified-badge');
            if(badge) badge.style.display = d.isVerified ? 'inline-block' : 'none';
        });
    }

    // --- 3. USER DATA: Tracks, Assets, Posts (Firestore) ---
    function loadUserData(uid) {
        // A. Tracks
        db.collection('users').doc(uid).collection('tracks')
            .orderBy('timestamp', 'desc')
            .onSnapshot(snap => {
                myTracks = {};
                snap.forEach(doc => myTracks[doc.id] = doc.data());
                document.getElementById('track-count').innerText = snap.size;
                renderList('play-list', myTracks, 'track');
            });

        // B. Assets (Tones & Kits)
        const tonesRef = db.collection('customTones').where('userId', '==', uid);
        const kitsRef = db.collection('customKits').where('userId', '==', uid);

        Promise.all([tonesRef.get(), kitsRef.get()]).then(([tonesSnap, kitsSnap]) => {
            myCustomAssets = {};
            tonesSnap.forEach(doc => { myCustomAssets[doc.id] = { ...doc.data(), _type: 'tone' }; });
            kitsSnap.forEach(doc => { myCustomAssets[doc.id] = { ...doc.data(), _type: 'kit' }; });
            
            document.getElementById('tone-count').innerText = Object.keys(myCustomAssets).length;
            renderList('tone-list', myCustomAssets, 'asset');
        });
        
        // C. Posts
        db.collection('posts').where('authorId', '==', uid).onSnapshot(snap => {
            currentPostCount = snap.size;
            document.getElementById('post-count').innerText = currentPostCount;
            const posts = {}; 
            snap.forEach(d => posts[d.id] = d.data());
            renderList('post-list', posts, 'post');
        });
    }

    // --- 4. FRIENDS LIST (Firestore) ---
    function loadFriendsList(uid) {
        const container = document.getElementById('friends-list-container');
        
        // Listening to Firestore subcollection 'friends'
        db.collection('users').doc(uid).collection('friends').onSnapshot(snap => {
            container.innerHTML = '';
            if (snap.empty) {
                container.innerHTML = '<div style="font-size:0.8em; color:#666; padding:10px;">No friends yet.</div>';
                return;
            }
            
            snap.forEach(doc => {
                const friendId = doc.id;
                // Fetch friend's display name details
                db.collection('users').doc(friendId).get().then(fDoc => {
                    if(fDoc.exists) {
                        const u = fDoc.data();
                        const name = u.displayName || "Friend";
                        container.innerHTML += `
                            <div class="friend-item" onclick="location.href='profileview.html?uid=${friendId}'">
                                <div class="friend-avatar">${name[0]}</div>
                                <div class="friend-name">${name}</div>
                            </div>`;
                    }
                });
            });
        });
    }

    // --- HELPER: Render List Items ---
    function renderList(elementId, data, type) {
        const container = document.getElementById(elementId);
        container.innerHTML = '';
        const keys = Object.keys(data);
        
        if (keys.length === 0) { 
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Nothing here.</div>'; 
            return; 
        }

        keys.forEach(key => {
            const item = data[key];
            let title = "Untitled", icon = "📄";

            if(type === 'track') {
                title = item.title;
                icon = item.type === 'drum_recording' ? '🥁' : '🎵';
            } else if (type === 'asset') {
                title = item.name;
                icon = item.type === 'kit' ? '📦' : (item.type === 'octapad' ? '🥁' : '🎹');
            } else if (type === 'post') {
                title = item.asset.title;
                icon = '📢';
            }
            
            container.innerHTML += `
                <div class="list-card">
                    <div class="card-left">
                        <span class="card-icon">${icon}</span>
                        <div class="card-info">
                            <span class="card-title">${title}</span>
                            <span class="card-meta">${type.toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="icon-btn del" onclick="deleteItem('${key}', '${type}', '${item._type}')">🗑</button>
                    </div>
                </div>`;
        });
    }
    
    // --- ACTIONS: Delete ---
    window.deleteItem = (key, listType, subType) => {
        if(!confirm("Are you sure you want to delete this?")) return;
        
        if(listType === 'track') {
            db.collection('users').doc(currentUser.uid).collection('tracks').doc(key).delete();
        }
        else if (listType === 'asset') {
            const col = subType === 'kit' ? 'customKits' : 'customTones';
            db.collection(col).doc(key).delete().then(() => loadUserData(currentUser.uid));
        }
        else if (listType === 'post') {
            db.collection('posts').doc(key).delete();
        }
    };

    // --- SETTINGS SIDEBAR ---
    const sidebar = document.getElementById('settings-sidebar');
    
    const settingsBtn = document.getElementById('settings-toggle-btn');
    if(settingsBtn) settingsBtn.addEventListener('click', () => sidebar.classList.add('open'));
    
    const closeBtn = document.getElementById('sidebar-close-btn');
    if(closeBtn) closeBtn.addEventListener('click', () => sidebar.classList.remove('open'));
    
    const logoutBtn = document.getElementById('sidebar-logout');
    if(logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

    // Edit Profile Logic
    const editBtn = document.getElementById('sidebar-edit-profile');
    if(editBtn) {
        editBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
            document.getElementById('edit-form').style.display = 'block';
            document.getElementById('edit-name').value = document.getElementById('profile-display-name').innerText;
        });
    }

    const saveProfileBtn = document.getElementById('save-profile-btn');
    if(saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const newName = document.getElementById('edit-name').value.trim();
            const newBio = document.getElementById('edit-bio').value.trim();
            if(!newName) return alert("Name required");
            
            saveProfileBtn.innerText = "Saving...";
            
            try {
                await currentUser.updateProfile({ displayName: newName });
                await db.collection('users').doc(currentUser.uid).set({ displayName: newName, bio: newBio }, {merge:true});
                alert("Profile Updated!");
                document.getElementById('edit-form').style.display = 'none';
            } catch(e) {
                alert("Error: " + e.message);
            } finally {
                saveProfileBtn.innerText = "Save Changes";
            }
        });
    }

    // --- SHARE POST LOGIC ---
    const shareOverlay = document.getElementById('share-overlay');
    const assetSelector = document.getElementById('asset-selector');
    const tonePreviewSel = document.getElementById('preview-tone-selector');
    
    const openShareBtn = document.getElementById('open-share-btn');
    if(openShareBtn) openShareBtn.addEventListener('click', () => { 
        shareOverlay.style.display='block'; 
        updateShareSelector(); 
    });
    
    const closeShareBtn = document.getElementById('close-share-btn');
    if(closeShareBtn) closeShareBtn.addEventListener('click', () => shareOverlay.style.display='none');
    
    document.querySelectorAll('input[name="shareType"]').forEach(r => r.addEventListener('change', updateShareSelector));

    function updateShareSelector() {
        const mode = document.querySelector('input[name="shareType"]:checked').value;
        assetSelector.innerHTML = '<option value="">-- Select Item --</option>';
        tonePreviewSel.style.display = 'none'; 

        if (mode === 'track') {
            Object.keys(myTracks).forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                const item = myTracks[key];
                opt.innerText = item.title;
                if(item.type === 'drum_recording') opt.innerText += " (Drums)";
                else opt.innerText += " (Piano)";
                assetSelector.appendChild(opt);
            });
        } else {
            Object.keys(myCustomAssets).forEach(key => {
                const item = myCustomAssets[key];
                const opt = document.createElement('option');
                opt.value = key;
                opt.innerText = item.name + (item._type === 'kit' ? " (Kit)" : " (Tone)");
                assetSelector.appendChild(opt);
            });
        }
    }
    
    if(assetSelector) {
        assetSelector.addEventListener('change', () => {
            const id = assetSelector.value;
            const pubBtn = document.getElementById('publish-post-btn');
            if(pubBtn) pubBtn.disabled = !id;
            
            // Show Tone Selector only if selected item is a Piano Track
            if (myTracks[id] && myTracks[id].type === 'recording') {
                tonePreviewSel.style.display = 'block';
            } else {
                tonePreviewSel.style.display = 'none';
            }
        });
    }

    const pubBtn = document.getElementById('publish-post-btn');
    if(pubBtn) {
        pubBtn.addEventListener('click', () => {
            if (currentPostCount >= USER_LIMITS.posts) return alert(`Post limit reached (${USER_LIMITS.posts}). Delete old posts.`);
            
            const key = assetSelector.value;
            const mode = document.querySelector('input[name="shareType"]:checked').value;
            const item = mode === 'track' ? myTracks[key] : myCustomAssets[key];
            
            if(!item) return alert("Select an item first.");

            let finalType = item.type;
            if(mode === 'tone') {
                finalType = item._type === 'kit' ? 'custom_kit' : 'custom_tone';
            }

            // Verify Badge Security (NOTE: Real verification must be done via Security Rules, this is just UI)
            const isVerifiedUI = (document.getElementById('verified-badge').style.display !== 'none');

            db.collection('posts').add({
                authorId: currentUser.uid,
                authorName: currentUser.displayName,
                authorVerified: isVerifiedUI, 
                content: document.getElementById('post-content').value.trim(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: [], 
                saves: 0,
                type: finalType,
                isVerified: false, // Default to false for Game Hunt
                asset: {
                    title: item.title || item.name,
                    data: mode === 'tone' ? item : item.data,
                    kit: item.kit || null,
                    previewTone: (finalType === 'recording') ? tonePreviewSel.value : null
                }
            }).then(() => { 
                alert("Posted to Feed!"); 
                shareOverlay.style.display='none'; 
            }).catch(e => alert("Error: " + e.message));
        });
    }

    // --- TABS LOGIC ---
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
});
