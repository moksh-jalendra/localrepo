// notification.js - Notification History & Friend Requests

document.addEventListener('DOMContentLoaded', () => {
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
    
    const listContainer = document.getElementById('notification-list-container');
    const loginRequired = document.getElementById('login-required');
    let currentUID = null;
    let notificationRef = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUID = user.uid;
            loginRequired.style.display = 'none';
            listContainer.innerHTML = '<p style="text-align:center; color:#888;">Loading...</p>';
            
            notificationRef = db.ref(`notifications/${currentUID}`);
            notificationRef.on('value', snapshot => {
                renderNotifications(snapshot.val());
                markAllAsRead(snapshot);
            });

        } else {
            loginRequired.style.display = 'block';
            listContainer.innerHTML = '';
        }
    });

    function renderNotifications(data) {
        listContainer.innerHTML = '';
        if (!data) {
            listContainer.innerHTML = '<p style="text-align:center; color:#888;">No messages received yet.</p>';
            return;
        }

        const messages = Object.entries(data)
            .map(([key, msg]) => ({ key, ...msg }))
            .reverse();

        messages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'notification-item' + (msg.read === false ? ' unread' : '');
            
            const time = new Date(msg.timestamp || Date.now()).toLocaleString();
            
            // Check if it's a Friend Request
            let actionHtml = '';
            if (msg.type === 'friend_request' && !msg.actionTaken) {
                actionHtml = `
                    <div class="notification-actions" id="actions-${msg.key}" style="margin-top:10px; display:flex; gap:10px;">
                        <button onclick="window.acceptRequest('${msg.senderId}', '${msg.sender}', '${msg.key}')" style="background:var(--secondary-color); border:none; border-radius:4px; padding:5px 10px; cursor:pointer;">Accept</button>
                        <button onclick="window.declineRequest('${msg.senderId}', '${msg.key}')" style="background:#444; color:#ccc; border:none; border-radius:4px; padding:5px 10px; cursor:pointer;">Decline</button>
                    </div>
                `;
            } else if (msg.type === 'friend_request' && msg.actionTaken) {
                 actionHtml = `<div style="margin-top:5px; font-size:0.8em; color:#888;">${msg.actionTaken}</div>`;
            }

            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-source">FROM: ${msg.sender || 'System'}</span>
                    <span class="notification-time">${time}</span>
                </div>
                <div class="notification-content">${msg.message}</div>
                ${actionHtml}
                ${msg.read === false ? '<div class="notification-badge"></div>' : ''}
            `;
            listContainer.appendChild(item);
        });
    }

    function markAllAsRead(snapshot) {
        const updates = {};
        snapshot.forEach(child => {
            if (child.val().read === false) updates[child.key + '/read'] = true; 
        });
        if (Object.keys(updates).length > 0) notificationRef.update(updates);
    }

    // --- ACTIONS ---
    window.acceptRequest = (senderId, senderName, notifKey) => {
        if(!currentUID) return;

        // 1. Update Friends List (Bi-directional)
        const updates = {};
        updates[`users/${currentUID}/friends/${senderId}`] = true;
        updates[`users/${senderId}/friends/${currentUID}`] = true;
        
        // 2. Remove from Pending Requests
        updates[`friendRequests/${currentUID}/${senderId}`] = null;
        
        // 3. Mark notification as acted upon
        updates[`notifications/${currentUID}/${notifKey}/actionTaken`] = "Accepted ✅";

        db.ref().update(updates).then(() => {
            alert("Friend Request Accepted!");
            
            // 4. Notify the Sender
            db.ref(`notifications/${senderId}`).push({
                type: 'info',
                sender: 'System',
                message: `${auth.currentUser.displayName} accepted your friend request!`,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false
            });
        });
    };

    window.declineRequest = (senderId, notifKey) => {
        db.ref(`friendRequests/${currentUID}/${senderId}`).remove();
        db.ref(`notifications/${currentUID}/${notifKey}`).update({ actionTaken: "Declined ❌" });
    };
});
