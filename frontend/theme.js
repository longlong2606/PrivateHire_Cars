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

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (document.body) document.body.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (document.body) document.body.removeAttribute('data-theme');
    }
  }

  var currentTheme = getPreferredTheme();
  applyTheme(currentTheme);

  // 2. Global Toggle Function
  window.toggleTheme = function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var nextTheme = isDark ? 'light' : 'dark';

    applyTheme(nextTheme);

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

  // 4. Mobile Navigation Toggles (Universal for Customer & Staff Portals)
  window.toggleMobileNav = function () {
    var menu = document.querySelector('.nav-menu');
    var btn = document.querySelector('.mobile-nav-toggle');
    if (!menu) return;
    var isOpen = menu.classList.toggle('mobile-open');
    if (btn) {
      var icon = btn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    }
  };

  window.toggleStaffSidebar = function () {
    var sidebar = document.querySelector('.app-sidebar');
    var backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;
    var isOpen = sidebar.classList.toggle('sidebar-open');
    if (backdrop) backdrop.classList.toggle('active', isOpen);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  };

  window.closeStaffSidebar = function () {
    var sidebar = document.querySelector('.app-sidebar');
    var backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  };

  // 5. Staff Portal Visibility Based on User Role & Admin Identity
  window.updateStaffPortalAccess = function () {
    var isAdmin = false;
    try {
      var saved = localStorage.getItem('currentUser');
      if (saved) {
        var user = JSON.parse(saved);
        if (user) {
          var role = (user.role || '').toUpperCase().trim();
          var email = (user.email || '').toLowerCase().trim();
          var adminEmails = [
            'longhvn2006@gmail.com',
            'nguyennhanduc20345@gmail.com',
            'staff@privatehirecars.com',
            'staff@privatehirecars.co.uk'
          ];
          if (role === 'ADMIN' || role === 'STAFF' || adminEmails.indexOf(email) !== -1) {
            isAdmin = true;
          }
        }
      }
    } catch (e) {
      console.warn('Error checking user admin role:', e);
    }

    if (isAdmin) {
      document.documentElement.setAttribute('data-user-role', 'ADMIN');
      if (document.body) document.body.setAttribute('data-user-role', 'ADMIN');
    } else {
      document.documentElement.removeAttribute('data-user-role');
      if (document.body) document.body.removeAttribute('data-user-role');
    }

    var staffLinks = document.querySelectorAll(
      'a[href*="staff.html"], a[href*="staff-portal.html"], .staff-portal-btn'
    );

    staffLinks.forEach(function (el) {
      // Do not hide elements if already inside staff portal pages
      var path = window.location.pathname.toLowerCase();
      if (path.indexOf('staff') !== -1) {
        return;
      }
      if (isAdmin) {
        el.style.removeProperty('display');
        el.style.display = 'inline-flex';
      } else {
        el.style.setProperty('display', 'none', 'important');
      }
    });
  };

  function syncDomTheme() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark && document.body) {
      document.body.setAttribute('data-theme', 'dark');
    }
    window.updateThemeUI();
    window.updateStaffPortalAccess();
  }

  // 6. Update UI once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncDomTheme);
  } else {
    syncDomTheme();
  }
})();

