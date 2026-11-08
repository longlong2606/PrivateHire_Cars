/**
 * PrivateHire Cars — Dark / Light Theme Manager
 * Persistent state via localStorage with zero-flash rendering
 */

(function () {
  // 1. Immediately apply saved theme to avoid white flash
  function getPreferredTheme() {
    try {
      var saved = localStorage.getItem('appTheme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {
      console.warn('Theme storage access error:', e);
    }
    return 'light';
  }

  var currentTheme = getPreferredTheme();
  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // 2. Global Toggle Function
  window.toggleTheme = function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var nextTheme = isDark ? 'light' : 'dark';

    if (nextTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    try {
      localStorage.setItem('appTheme', nextTheme);
    } catch (e) {
      console.warn('Unable to persist theme in localStorage:', e);
    }

    window.updateThemeUI();
  };

  // 3. UI Synchronization for theme toggle buttons
  window.updateThemeUI = function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var buttons = document.querySelectorAll('.theme-toggle-btn');

    buttons.forEach(function (btn) {
      var icon = btn.querySelector('.theme-toggle-icon');
      var label = btn.querySelector('.theme-toggle-label');

      if (isDark) {
        if (icon) {
          icon.setAttribute('data-lucide', 'sun');
          icon.style.color = '#F59E0B';
        }
        if (label) label.textContent = 'Light';
        btn.setAttribute('title', 'Switch to Light Theme');
        btn.setAttribute('aria-label', 'Switch to Light Theme');
      } else {
        if (icon) {
          icon.setAttribute('data-lucide', 'moon');
          icon.style.color = '';
        }
        if (label) label.textContent = 'Dark';
        btn.setAttribute('title', 'Switch to Dark Theme');
        btn.setAttribute('aria-label', 'Switch to Dark Theme');
      }
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  };

  // 4. Update UI once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.updateThemeUI);
  } else {
    window.updateThemeUI();
  }
})();
