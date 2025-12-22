// message.js - Real-time Chat

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
const friendUid = urlParams.get('uid');

let currentUser = null;
let chatId = null;

document.addEventListener('DOMContentLoaded', () => {
    if(!friendUid) { alert("Invalid chat."); window.location.href = 'profile.html'; return; }

    const headerName = document.getElementById('chat-header-name');
    const container = document.getElementById('chat-messages-container');
    const input = document.getElementById('msg-input');
    const sendBtn = document.getElementById('msg-send-btn');

    auth.onAuthStateChanged(user => {
        if(user) {
            currentUser = user;
            
            // 1. Verify Friendship
            db.ref(`users/${currentUser.uid}/friends/${friendUid}`).once('value', s => {
                if(!s.exists()) {
                    alert("You must be friends to message.");
                    window.location.href = `profileview.html?uid=${friendUid}`;
                } else {
                    initChat();
                }
            });

            // 2. Load Header
            db.ref(`users/${friendUid}/displayName`).once('value', s => {
                headerName.innerText = s.val() || "Chat";
            });

        } else {
            window.location.href = 'auth.html';
        }
    });

    function initChat() {
        // Generate Unique Chat ID (Alphabetical sort prevents duplicates: A_B is same as B_A)
        const uids = [currentUser.uid, friendUid].sort();
        chatId = `${uids[0]}_${uids[1]}`;

        const messagesRef = db.ref(`messages/${chatId}`).limitToLast(50);

        container.innerHTML = ''; // Clear loading text

        messagesRef.on('child_added', snapshot => {
            const msg = snapshot.val();
            renderMessage(msg);
            container.scrollTop = container.scrollHeight; // Auto-scroll
        });
    }

    function renderMessage(msg) {
        const div = document.createElement('div');
        const isMe = msg.sender === currentUser.uid;
        div.className = `chat-bubble ${isMe ? 'sent' : 'received'}`;
        
        const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        div.innerHTML = `
            ${msg.text}
            <span class="chat-time">${time}</span>
        `;
        container.appendChild(div);
    }

    // Send Logic
    function sendMessage() {
        const text = input.value.trim();
        if(!text || !chatId) return;

        db.ref(`messages/${chatId}`).push({
            sender: currentUser.uid,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        input.value = '';
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });
});
