// casio-upper.js - Screen Logic (Normal, Track, Tone, Practice)

window.DisplayModule = {
    currentMode: 'NORMAL', // NORMAL, TRACK, TONE, PRACTICE
    
    trackList: [],
    toneList: [
        { id: 'PIANO', title: 'PIANO' },
        { id: 'FLUTE', title: 'FLUTE' },
        { id: 'SYNTH', title: 'SYNTH' }
    ],
    customTonesList: [],
    
    // UPDATED: New chunk sizes for Memory Mode
    practiceLevels: [
        { id: 1, title: "EASY (1 KEY)" },
        { id: 4, title: "MED (4 KEYS)" },
        { id: 7, title: "PRO (7 KEYS)" }
    ],
    
    currentIndex: 0,
    selectedTrackId: null,
    selectedLevel: 1, 

    ui: {
        get text() { return document.getElementById('lcd-text'); },
        get icon() { return document.getElementById('lcd-status-icon'); },
        get lblTrack() { return document.getElementById('label-track'); },
        get lblTone() { return document.getElementById('label-tone'); },
        get lblPractice() { return document.getElementById('label-practice'); }
    },

    init() {
        this.setMode('NORMAL');
    },

    setMode(mode) {
        this.currentMode = mode;
        this.currentIndex = 0;
        this.updateLabels();
        
        const list = this.getFullList();
        
        // Auto-select logic
        if (list.length > 0) {
            if (mode === 'TRACK') this.selectedTrackId = list[0].id;
            if (mode === 'PRACTICE') this.selectedLevel = list[0].id;
        }

        this.renderCurrent();
    },

    updateLabels() {
        if (!this.ui.lblTrack) return;
        
        // Reset All (Dim everything)
        this.ui.lblTrack.classList.remove('active');
        this.ui.lblTone.classList.remove('active');
        if(this.ui.lblPractice) this.ui.lblPractice.classList.remove('active');

        // Light up active mode
        if (this.currentMode === 'TRACK') {
            this.ui.lblTrack.classList.add('active');
        } else if (this.currentMode === 'TONE') {
            this.ui.lblTone.classList.add('active');
        } else if (this.currentMode === 'PRACTICE') {
            if(this.ui.lblPractice) this.ui.lblPractice.classList.add('active');
        }
    },

    getFullList() {
        if (this.currentMode === 'TRACK') return this.trackList;
        if (this.currentMode === 'TONE') return [...this.toneList, ...this.customTonesList];
        if (this.currentMode === 'PRACTICE') return this.practiceLevels;
        return []; // NORMAL mode has no list
    },

    navigate(dir) {
        const list = this.getFullList();
        if (list.length === 0) return; // Do nothing in NORMAL mode

        this.currentIndex += dir;
        if (this.currentIndex < 0) this.currentIndex = list.length - 1;
        if (this.currentIndex >= list.length) this.currentIndex = 0;

        this.renderCurrent();

        const item = list[this.currentIndex];
        
        // Update selection state
        if (this.currentMode === 'TONE') {
            if (window.CasioEngine) CasioEngine.setInstrument(item.data || item.id);
        } else if (this.currentMode === 'TRACK') {
            this.selectedTrackId = item.id;
        } else if (this.currentMode === 'PRACTICE') {
            this.selectedLevel = item.id; 
        }
    },

    renderCurrent() {
        if (this.currentMode === 'NORMAL') {
            this.ui.text.innerText = "READY";
            return;
        }

        const list = this.getFullList();
        if (list.length === 0) {
            this.ui.text.innerText = "EMPTY";
            return;
        }
        const item = list[this.currentIndex];
        let name = (item.title || item.name || "Untitled").toUpperCase();
        if (name.length > 12) name = name.substring(0, 11) + "..";
        this.ui.text.innerText = name;
    },

    updateTracks(list) { 
        this.trackList = list || []; 
        if(this.currentMode === 'TRACK') {
            this.currentIndex = 0; 
            if (this.trackList.length > 0) {
                this.selectedTrackId = this.trackList[0].id;
            } else {
                this.selectedTrackId = null;
            }
            this.renderCurrent();
        } 
    },

    updateTones(map) { 
        this.customTonesList = Object.keys(map).map(k=>({id:k, title:map[k].name, data:map[k]})); 
    },

    tempMessage(msg, duration=1500) {
        const prev = this.ui.text.innerText;
        this.ui.text.innerText = msg;
        setTimeout(() => {
            if(!this.ui.icon.classList.contains('recording') && this.ui.text.innerText === msg) {
                // If we were in NORMAL mode, revert to "READY"
                if(this.currentMode === 'NORMAL') {
                     this.ui.text.innerText = "READY";
                } else {
                     this.renderCurrent();
                }
            }
        }, duration);
    },

    setRec(active) {
        if(active) { this.ui.icon.classList.add('recording'); this.ui.text.innerText="REC..."; }
        else { this.ui.icon.classList.remove('recording'); this.renderCurrent(); }
    },

    getCurrentTrackId() { return this.selectedTrackId; },
    getCurrentLevel() { return this.selectedLevel; },
    
    // Switch to Normal Mode explicitly
    showNormal() {
        this.setMode('NORMAL');
    }
};

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>window.DisplayModule.init());
else window.DisplayModule.init();
