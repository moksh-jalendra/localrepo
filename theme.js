// theme.js - Dark Mode & Cookie Consent

// 1. Apply Theme Immediately (Prevent Flash)
(function() {
    const savedTheme = localStorage.getItem('synthflow_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    
    // --- THEME TOGGLE LOGIC ---
    const toggleBtn = document.getElementById('theme-toggle-btn');
    
    // Initialize Button Text/Icon
    if (toggleBtn) {
        updateButtonLabel(toggleBtn);

        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('synthflow_theme', isLight ? 'light' : 'dark');
            
            updateButtonLabel(toggleBtn);
        });
    }

    function updateButtonLabel(btn) {
        const isLight = document.body.classList.contains('light-mode');
        // Change icon based on state
        btn.innerText = isLight ? "🌙" : "☀️"; 
        // If it's a text button (like in sidebar), update text
        if(btn.classList.contains('setting-item')) {
            btn.innerText = isLight ? "🌙 Dark Mode" : "☀️ Light Mode";
        }
    }

    // --- COOKIE CONSENT LOGIC ---
    const banner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('accept-cookies');

    // Check if previously accepted
    if (!localStorage.getItem('synthflow_cookies_accepted')) {
        if(banner) {
            // Show after small delay for attention
            setTimeout(() => {
                banner.style.display = 'block';
            }, 1000);
        }
    }

    // Handle Accept Click
    if(acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            localStorage.setItem('synthflow_cookies_accepted', 'true');
            if(banner) banner.style.display = 'none';
        });
    }
});
