// casio-data.js - Data Layer (Final Fix)

const DataManager = {
    auth: null,
    db: null,
    user: null,
    userRecordings: [],

    init() {
        const config = {
            apiKey: "AIzaSyBxodD7iSH0JdXypNNcb7XXw_iP21IhYTI",
            authDomain: "chronoglow-nwtxo.firebaseapp.com",
            databaseURL: "https://chronoglow-nwtxo-default-rtdb.firebaseio.com",
            projectId: "chronoglow-nwtxo",
            storageBucket: "chronoglow-nwtxo.firebasestorage.app",
            messagingSenderId: "688060228830",
            appId: "1:688060228830:web:3049a4a87495909e074e4f"
        };

        if (!firebase.apps.length) firebase.initializeApp(config);
        this.auth = firebase.auth();
        this.db = firebase.database();

        this.auth.onAuthStateChanged(user => {
            this.user = user;
            this.updateScreenState();
        });
    },

    updateScreenState() {
        if (!window.DisplayModule) return;

        if (this.user) {
            DisplayModule.update("LOADING DATA...");
            this.fetchUserRecordings();
        } else {
            DisplayModule.showGuestMode();
        }
    },

    fetchUserRecordings() {
        if (!this.user) return;
        
        const ref = this.db.ref('users/' + this.user.uid + '/savedKeys/');
        
        ref.on('value', (snapshot) => {
            this.userRecordings = [];
            const data = snapshot.val();
            
            // Parse Data if it exists
            if (data) {
                Object.keys(data).forEach(key => {
                    const item = data[key];
                    if (item.data) {
                        this.userRecordings.push({
                            id: key,
                            title: item.title || "Untitled",
                            data: item.data
                        });
                    }
                });
            }
            
            // IMPORTANT: Call this even if list is empty to clear "LOADING..."
            if(window.DisplayModule) {
                DisplayModule.populateRecordings(this.userRecordings);
            }
        });
    },

    async saveRecording(seq) {
        if(!this.user) return { error: "Login required." };
        const title = prompt("Name your recording:", "My Synth Jam");
        if(!title) return { cancelled: true };

        try {
            await this.db.ref('users/' + this.user.uid + '/savedKeys/').push({
                type: 'recording',
                title: title,
                data: seq,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true, title: title };
        } catch(e) {
            return { error: e.message };
        }
    }
};

// Run
window.addEventListener('load', () => {
    DataManager.init();
});
