// ai.js - Mitra Bot (Smart Refusal & Titled Tracks)

const firebaseConfig = { apiKey: "AIzaSyBxodD7iSH0JdXypNNcb7XXw_iP21IhYTI", authDomain: "chronoglow-nwtxo.firebaseapp.com", databaseURL: "https://chronoglow-nwtxo-default-rtdb.firebaseio.com", projectId: "chronoglow-nwtxo", storageBucket: "chronoglow-nwtxo.firebasestorage.app", messagingSenderId: "688060228830", appId: "1:688060228830:web:3049a4a87495909e074e4f" };

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// --- CONFIG ---
const AI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// --- MITRA BOT PERSONA ---
const PROMPT_TEMPLATE = `
You are "Mitra Bot", a friendly music tutor. 
Your capabilities: You can generate simple piano melodies (monophonic) for the web engine.

RULES FOR INTERACTION:
1. If the user asks for a complex/copyrighted song you cannot render perfectly, DO NOT say "I can't".
   Instead, say: "I can't give that exact recording, but I can play simple melodies like Nursery Rhymes, Folk Songs, Anime Themes, or basic Pop riffs. Shall I try a simplified version?"
2. If the user agrees (says "ok", "yes", "try"), generate the JSON.

RULES FOR GENERATION:
1. Output JSON ONLY when explicitly asked to generate/play a song.
2. Format must be a JSON Object: 
   {
     "title": "Song Name",
     "notes": [{"note": "C4", "duration": 400, "time": 0}, {"note": "D4", "duration": 400, "time": 500}]
   }
3. Use notes C3 to C6. Time must be sequential in ms.
4. Do not put any text outside the JSON block if generating music.

Previous Context: `;

let currentUser = null;
let isWaiting = false;
let audioCtx = null;
let lastAiMessage = ""; 

// --- 1. SECURE KEY FETCHER ---
async function getApiKey() {
    let finalKey = null;
    if (currentUser) {
        try {
            const userSnap = await db.ref('users/' + currentUser.uid + '/api_key').once('value');
            if (userSnap.exists() && userSnap.val().length > 10) return userSnap.val();
        } catch(e) {}
    }
    try {
        const globalSnap = await db.ref('config/gemini_api_key').once('value');
        finalKey = globalSnap.val();
    } catch(e) {}
    return finalKey;
}

// --- 2. CHAT HISTORY ---
const ChatHistory = {
    dbRef: null,
    init(uid) {
        this.disconnect();
        this.dbRef = db.ref('users/' + uid + '/chatHistory');
        const container = document.getElementById('chat-messages');
        if(container) container.innerHTML = '';

        this.dbRef.limitToLast(20).on('child_added', (snapshot) => {
            const val = snapshot.val();
            renderChatBubble(val);
            if(val.role === 'ai') lastAiMessage = val.text;
        });
    },
    add(role, text, keyData) {
        if(this.dbRef) {
            this.dbRef.push({ 
                role, text, hasKeys: !!keyData, keyData: keyData || null, 
                timestamp: firebase.database.ServerValue.TIMESTAMP 
            });
        }
    },
    disconnect() {
        if (this.dbRef) this.dbRef.off();
        document.getElementById('chat-messages').innerHTML = `<div class="ai-message" style="padding:15px;">Please login to chat with Mitra Bot.</div>`;
    }
};

function renderChatBubble(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = msg.role === 'user' ? 'user-message' : 'ai-message';
    
    let content = msg.text;
    
    // Highlight refusal/suggestion messages
    if (content.includes("I can't give that exact song")) {
        div.style.borderLeft = "3px solid #ff9900"; // Orange warning
        div.style.backgroundColor = "#2a2a2a";
    }

    // If message has music data
    if (msg.hasKeys && msg.keyData) {
        // Handle both new Object format and old Array format
        const rawData = msg.keyData;
        const sequence = Array.isArray(rawData) ? rawData : rawData.notes;
        const title = rawData.title || "Mitra Melody";
        
        // We verify we actually have notes
        if (sequence && sequence.length > 0) {
            // Re-encode specifically the sequence for the player
            const safeSeq = encodeURIComponent(JSON.stringify(sequence));
            const safeTitle = title.replace(/'/g, "\\'"); // Escape quotes for HTML

            content += `
            <div style="margin-top:8px; padding-top:8px; border-top:1px solid #444;">
                <div style="font-size:0.8em; color:#00bfff; margin-bottom:5px;">🎵 ${title}</div>
                <div style="display:flex; gap:10px;">
                    <button onclick="previewAiSong('${safeSeq}', this)" class="control-btn" style="padding:5px 12px; font-size:0.8em; background:#4af626; color:black;">▶ Play</button>
                    <button onclick="saveAiSong('${safeSeq}', '${safeTitle}')" class="control-btn" style="padding:5px 12px; font-size:0.8em;">💾 Save</button>
                </div>
            </div>`;
        }
    }
    
    div.innerHTML = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// --- 3. API COMMUNICATOR ---
async function sendToAI(prompt) {
    if (isWaiting) return;
    isWaiting = true;
    const sendBtn = document.getElementById('send-btn');
    if(sendBtn) sendBtn.innerText = "...";

    const apiKey = await getApiKey();
    
    if (!apiKey) {
        ChatHistory.add('ai', "System: API Key missing.", null);
        isWaiting = false;
        if(sendBtn) sendBtn.innerText = "Send";
        return;
    }

    const finalPrompt = `${PROMPT_TEMPLATE} "${lastAiMessage}"\nUser Request: ${prompt}`;

    try {
        const response = await fetch(`${AI_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: finalPrompt }] }] })
        });

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
        
        // PARSING LOGIC
        // 1. Look for JSON Object { ... }
        // 2. Fallback to JSON Array [ ... ]
        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        
        let songData = null;
        let displayText = rawText;

        if (jsonStart !== -1 && jsonEnd !== -1) {
            try {
                const jsonStr = rawText.substring(jsonStart, jsonEnd + 1);
                songData = JSON.parse(jsonStr);
                // Remove JSON from text to show only the chat part
                displayText = rawText.replace(jsonStr, "").trim();
                if(!displayText) displayText = `Here is "${songData.title || 'the song'}":`;
            } catch(e) { 
                console.log("JSON Object Parse Failed, trying Array..."); 
            }
        }
        
        // Fallback: Try finding array if object failed
        if (!songData) {
            const arrStart = rawText.indexOf('[');
            const arrEnd = rawText.lastIndexOf(']');
            if (arrStart !== -1 && arrEnd !== -1) {
                try {
                    const arrStr = rawText.substring(arrStart, arrEnd + 1);
                    const seq = JSON.parse(arrStr);
                    songData = { title: "Generated Melody", notes: seq }; // Wrap in object
                    displayText = rawText.replace(arrStr, "").trim() || "Here is the melody:";
                } catch(e) {}
            }
        }

        ChatHistory.add('ai', displayText, songData);

    } catch (error) {
        ChatHistory.add('ai', "Connection weak. Try again.", null);
    } finally {
        isWaiting = false;
        if(sendBtn) sendBtn.innerText = "Send";
    }
}

// --- 4. AUDIO ENGINE ---
window.previewAiSong = (safeData, btn) => {
    const seq = JSON.parse(decodeURIComponent(safeData));
    if(!seq || !Array.isArray(seq)) return alert("Invalid Audio Data");

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();

    if(btn) {
        const oldText = btn.innerText;
        btn.innerText = "⏹ Playing...";
        btn.disabled = true;
        btn.style.background = "#ff3366"; // Red while playing
        
        let maxTime = 0;
        seq.forEach(n => { if((n.time + 500) > maxTime) maxTime = n.time + 500; });
        setTimeout(() => {
            btn.innerText = oldText;
            btn.disabled = false;
            btn.style.background = "#4af626"; // Green again
        }, maxTime);
    }

    const now = audioCtx.currentTime;

    seq.forEach(evt => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = getFreq(evt.note || "C4");
        osc.type = 'triangle'; 
        osc.connect(gain); gain.connect(audioCtx.destination);
        
        const startTime = evt.time !== undefined ? evt.time / 1000 : 0;
        const duration = (evt.duration || 400) / 1000;
        const t = now + startTime;
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        
        osc.start(t); osc.stop(t + duration + 0.1);
    });
};

function getFreq(note) {
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const oct = parseInt(note.slice(-1));
    const idx = NOTES.indexOf(note.slice(0,-1));
    if(idx === -1) return 440;
    return 27.5 * Math.pow(2, (oct*12+idx)/12);
}

window.saveAiSong = (safeData, title) => {
    if(!currentUser) return alert("Login required");
    const seq = JSON.parse(decodeURIComponent(safeData));
    
    // Check if limit reached (Optional but good practice)
    db.ref(`users/${currentUser.uid}/savedKeys`).once('value', s => {
        if(s.numChildren() >= 20) return alert("Storage full (20/20). Delete old tracks.");
        
        db.ref(`users/${currentUser.uid}/savedKeys/`).push({
            title: "AI: " + title,
            type: 'ai-generated',
            data: seq,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => alert("Track Saved to Profile!"));
    });
};

// --- 5. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-chat-btn');

    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            ChatHistory.init(user.uid);
            if(sendBtn) sendBtn.disabled = false;
        } else {
            ChatHistory.disconnect();
            if(sendBtn) sendBtn.disabled = true;
        }
    });

    if(sendBtn) sendBtn.addEventListener('click', () => {
        const txt = input.value.trim();
        if(txt && currentUser) {
            ChatHistory.add('user', txt, null);
            input.value = '';
            sendToAI(txt);
        }
    });
    
    if(input) input.addEventListener('keypress', (e) => {
        if(e.key==='Enter') sendBtn.click();
    });

    if(clearBtn) clearBtn.addEventListener('click', () => {
        if(currentUser && confirm("Clear chat history?")) {
            db.ref('users/' + currentUser.uid + '/chatHistory').remove();
            document.getElementById('chat-messages').innerHTML = '';
            lastAiMessage = "";
        }
    });
});
