// auth.js - Fixed Google Sign-In & Firestore Creation

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
const db = firebase.firestore(); // Use Firestore for User Data
const googleProvider = new firebase.auth.GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {
    const statusMessage = document.getElementById('auth-status');
    const googleBtn = document.getElementById('google-btn');

    // --- GOOGLE SIGN IN ---
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            if(statusMessage) statusMessage.textContent = "Connecting to Google...";
            
            auth.signInWithPopup(googleProvider)
                .then((result) => {
                    if(statusMessage) statusMessage.textContent = "Setting up profile...";
                    // CRITICAL: Return the promise so we WAIT for Firestore
                    return updateUserData(result.user); 
                })
                .then(() => {
                    if(statusMessage) statusMessage.textContent = "Success!";
                    // Only redirect AFTER database write is confirmed
                    window.location.href = 'profile.html';
                })
                .catch(err => {
                    console.error(err);
                    if(statusMessage) {
                        statusMessage.textContent = "Error: " + err.message;
                        statusMessage.className = "auth-status-message error";
                    }
                });
        });
    }

    // --- EMAIL SIGNUP ---
    const signupBtn = document.getElementById('signup-btn');
    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            const email = document.getElementById('signup-email').value;
            const pass = document.getElementById('signup-password').value;
            const name = document.getElementById('signup-name').value;
            
            if (!email || !pass || !name) return alert("Please fill all fields");
            if (statusMessage) statusMessage.textContent = "Creating account...";
            
            try {
                const cred = await auth.createUserWithEmailAndPassword(email, pass);
                // 1. Update Auth Profile
                await cred.user.updateProfile({ displayName: name });
                // 2. Create Firestore Doc
                await updateUserData(cred.user); 
                // 3. Send Verification
                await cred.user.sendEmailVerification();

                document.getElementById('main-auth-card').style.display = 'none';
                document.getElementById('verification-overlay').style.display = 'block';
                document.getElementById('verify-email-display').textContent = email;
            } catch (error) {
                if (statusMessage) {
                    statusMessage.textContent = error.message;
                    statusMessage.className = "auth-status-message error";
                }
            }
        });
    }

    // --- LOGIN ---
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            if (!email || !pass) return alert("Enter email/pass");
            try {
                if(statusMessage) statusMessage.textContent = "Logging in...";
                await auth.signInWithEmailAndPassword(email, pass);
                window.location.href = 'profile.html';
            } catch (e) {
                if(statusMessage) statusMessage.textContent = e.message;
            }
        });
    }

    // --- DATABASE SYNC (The Fix) ---
    function updateUserData(user) {
        const userRef = db.collection('users').doc(user.uid);
        
        return userRef.get().then((doc) => {
            if (!doc.exists) {
                // CREATE NEW USER DOCUMENT
                return userRef.set({
                    email: user.email,
                    displayName: user.displayName || "Musician",
                    bio: 'New PianoMitra member!',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isVerified: false
                });
            } else {
                // UPDATE EXISTING (Sync Name)
                return userRef.set({ 
                    displayName: user.displayName || doc.data().displayName 
                }, { merge: true });
            }
        });
    }

    // --- TABS ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
});
