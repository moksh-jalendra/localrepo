// casio-right.js - Corrected Controls for Piano Studio

document.addEventListener('DOMContentLoaded', () => {
    
    // Ensure the core engine is available
    if (!window.CasioEngine || !window.DisplayModule) {
        console.error("CasioEngine or DisplayModule not initialized.");
        return;
    }

    const auth = firebase.auth();
    
    // --- 1. RECORD & PLAYBACK ---
    const playBtn = document.getElementById('play-toggle-btn');
    const recBtn = document.getElementById('record-toggle-btn');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            CasioEngine.resumeContext();
            
            // Toggle Stop
            if (CasioEngine.playbackTimeouts.length > 0) {
                CasioEngine.stopPlayback();
                playBtn.classList.remove('active');
                DisplayModule.tempMessage("STOPPED");
                return;
            }

            // A. START PLAYBACK (Track Mode Selection)
            if (DisplayModule.currentMode === 'TRACK') {
                const trackId = DisplayModule.getCurrentTrackId();
                const trackData = window.savedRecordings[trackId];
                
                if (trackData && trackData.data.length > 0) {
                    playBtn.classList.add('active');
                    DisplayModule.tempMessage("PLAYING");
                    CasioEngine.playSequence(trackData.data, () => {
                        playBtn.classList.remove('active');
                        DisplayModule.tempMessage("DONE");
                    });
                } else {
                    DisplayModule.tempMessage("NO TRACK SELECTED");
                }
            } else {
                DisplayModule.tempMessage("SWITCH TO TRACK MODE");
            }
        });
    }

    if (recBtn) {
        recBtn.addEventListener('click', () => {
            if (!auth.currentUser) return alert("Login required to record and save tracks.");
            
            CasioEngine.resumeContext();

            if (CasioEngine.isRecording) {
                // STOP RECORDING
                const seq = CasioEngine.stopRecording();
                recBtn.classList.remove('active');
                DisplayModule.setRec(false); 
                
                if (seq.length > 0) {
                    // Use DataManager.saveRecording (assuming DataManager is globally defined from casio-data.js)
                    if(window.DataManager) {
                         DataManager.saveRecording(seq)
                            .then(res => {
                                if(res.success) DisplayModule.tempMessage("SAVED: " + res.title);
                            });
                    }
                } else {
                    DisplayModule.tempMessage("NO NOTES RECORDED");
                }
            } else {
                // START RECORDING
                CasioEngine.startRecording();
                recBtn.classList.add('active');
                DisplayModule.setRec(true);
            }
        });
    }
    
    // --- 2. SUSTAIN ---
    const sustainBtn = document.getElementById('sustain-btn');
    const sustainIndicator = document.getElementById('label-sustain');
    
    if (sustainBtn) {
        sustainBtn.addEventListener('click', () => {
            const newState = !CasioEngine.getSustainState();
            CasioEngine.setSustain(newState);
            
            sustainBtn.classList.toggle('active', newState);
            sustainIndicator.style.opacity = newState ? '1' : '0.3';
            DisplayModule.tempMessage(newState ? "SUSTAIN ON" : "SUSTAIN OFF");
        });
    }

    // --- 3. LEARN / PRACTICE MODE (Toggle Display Mode) ---
    const practiceBtn = document.getElementById('practice-btn');
    if (practiceBtn) {
        practiceBtn.addEventListener('click', () => {
            if (!auth.currentUser) return alert("Login required for Learn mode.");
            
            if (DisplayModule.currentMode === 'PRACTICE') {
                DisplayModule.setMode('NORMAL');
                practiceBtn.classList.remove('active');
            } else {
                DisplayModule.setMode('PRACTICE');
                practiceBtn.classList.add('active');
                DisplayModule.tempMessage("SELECT LEVEL");
            }
        });
    }
    
    // --- 4. OCTAVE NAVIGATION (Up/Down) ---
    const navUpBtn = document.getElementById('screen-up-btn');
    const navDownBtn = document.getElementById('screen-down-btn');
    
    if(navUpBtn) navUpBtn.addEventListener('click', () => DisplayModule.navigate(-1));
    if(navDownBtn) navDownBtn.addEventListener('click', () => DisplayModule.navigate(1));

    // --- 5. ABC KEYS / LABELS ---
    const labelsBtn = document.getElementById('labels-btn');
    const mainKeys = document.querySelector('.main-keys');

    if(labelsBtn && mainKeys) {
        labelsBtn.addEventListener('click', () => {
            mainKeys.classList.toggle('show-labels');
            labelsBtn.classList.toggle('active', mainKeys.classList.contains('show-labels'));
        });
    }

});
