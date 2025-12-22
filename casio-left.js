// casio-left.js - Left Panel & Fullscreen

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. TRACK BUTTON
    const trackBtn = document.getElementById('track-mode-btn');
    if (trackBtn) {
        trackBtn.addEventListener('click', () => {
            if (window.DisplayModule) window.DisplayModule.setMode('TRACK');
        });
    }

    // 2. TONE BUTTON
    const toneBtn = document.getElementById('tone-mode-btn');
    if (toneBtn) {
        toneBtn.addEventListener('click', () => {
            if (window.DisplayModule) window.DisplayModule.setMode('TONE');
        });
    }

    // 3. CUSTOM TONE (REMOVED: Logic moved to soundlab.html)
    // const customBtn = document.getElementById('custom-tone-btn');
    // const editor = document.getElementById('custom-tone-editor');
    // if (customBtn && editor) {
    //     customBtn.addEventListener('click', () => {
    //         editor.style.display = 'flex';
    //     });
    // }

    // 4. FULL SCREEN (FIXED)
    const fsBtn = document.getElementById('fullscreen-btn');
    if (fsBtn) {
        fsBtn.addEventListener('click', toggleFullScreen);
    }
});

function toggleFullScreen() {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    } else {
        cancelFullScreen.call(doc);
    }
}
