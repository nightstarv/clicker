// menu toggle logic
document.getElementById('toggle-settings').onclick = function() {
    const menu = document.getElementById('menu');
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
};

// reset button logic
document.getElementById('reset-game').onclick = function() {
    if (confirm("rip your progress 2026-2026. i hope that 1 coin was worth it!")) {
        localStorage.clear();
        // Force a full reload to ensure all data is wiped and not repopulated
        location.reload();
    }
};
