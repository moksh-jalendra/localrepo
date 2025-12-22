// octapad-left.js - Left Panel Mode Logic (Fixed to ensure setMode triggers render)

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. KIT MODE
    const kitBtn = document.getElementById('kit-mode-btn');
    if (kitBtn) {
        kitBtn.addEventListener('click', () => {
            if (window.DisplayModule) {
                window.DisplayModule.setMode('KIT');
                window.DisplayModule.renderCurrent(); // Ensure immediate text change
            }
        });
    }

    // 2. PATTERN MODE
    const patternBtn = document.getElementById('pattern-mode-btn');
    if (patternBtn) {
        patternBtn.addEventListener('click', () => {
            if (window.DisplayModule) {
                window.DisplayModule.setMode('PATTERN');
                window.DisplayModule.renderCurrent(); // Ensure immediate text change
            }
        });
    }
    
    // 3. FULLSCREEN 
    const fsBtn = document.getElementById('fullscreen-btn');
    if (fsBtn) {
        fsBtn.addEventListener('click', toggleFullScreen);
    }
});
