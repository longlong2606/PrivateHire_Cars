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
    var btn = document.querySelector('.mobile-nav-toggle') || document.querySelector('.mobile-hamburger-btn');
    if (!menu) return;
    var isOpen = menu.classList.toggle('mobile-open');
    if (btn) {
      var icon = btn.querySelector('i') || btn.querySelector('svg');
      if (icon) {
        icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    }
  };

  // Auto-close mobile menu when clicking outside or clicking any nav link
  document.addEventListener('click', function (e) {
    var menu = document.querySelector('.nav-menu');
    var btn = document.querySelector('.mobile-nav-toggle') || document.querySelector('.mobile-hamburger-btn');
    if (!menu || !menu.classList.contains('mobile-open')) return;

    if (e.target.closest('.nav-menu a')) {
      menu.classList.remove('mobile-open');
      if (btn) {
        var icon = btn.querySelector('i') || btn.querySelector('svg');
        if (icon) icon.setAttribute('data-lucide', 'menu');
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    } else if (!menu.contains(e.target) && btn && !btn.contains(e.target)) {
      menu.classList.remove('mobile-open');
      if (btn) {
        var icon = btn.querySelector('i') || btn.querySelector('svg');
        if (icon) icon.setAttribute('data-lucide', 'menu');
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    }
  });

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

  // 4b. Synchronize Customer / Staff Sidebar User Info
  window.syncSidebarUserInfo = function () {
    try {
      var saved = localStorage.getItem('currentUser');
      var nameEl = document.getElementById('sidebar-customer-name');
      var roleEl = document.getElementById('sidebar-customer-role');
      var authLink = document.getElementById('sidebar-auth-link');
      var authText = document.getElementById('sidebar-auth-text');

      if (saved) {
        var user = JSON.parse(saved);
        if (nameEl) nameEl.textContent = user.name || 'Passenger';
        if (roleEl) roleEl.innerHTML = '<span class="status-dot"></span> ' + (user.role || 'Passenger');
        if (authLink) {
          authLink.href = 'javascript:void(0)';
          authLink.onclick = function (e) {
            e.preventDefault();
            if (typeof window.logout === 'function') window.logout();
            else if (typeof window.handleUserProfileLogout === 'function') window.handleUserProfileLogout();
            else if (typeof window.handleAuthAction === 'function') window.handleAuthAction();
          };
          authLink.style.color = '#F87171';
        }
        if (authText) authText.textContent = 'Sign Out';
      } else {
        if (nameEl) nameEl.textContent = 'Guest Visitor';
        if (roleEl) roleEl.innerHTML = '<span class="status-dot" style="background:#84988F;"></span> Not Signed In';
        if (authLink) {
          authLink.href = 'login.html';
          authLink.onclick = null;
          authLink.style.color = '';
        }
        if (authText) authText.textContent = 'Sign In';
      }
    } catch (_) {}
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

  // 6. User Profile Dropdown System (Click user pill -> Show account info -> Change Profile CTA)
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.handleUserProfileLogout = function () {
    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('sessionToken');
    } catch (_) {}
    window.location.href = 'login.html';
  };

  window.initUserProfileDropdown = function () {
    // Permanently hide or remove obsolete standalone profile buttons
    document.querySelectorAll('#btn-profile').forEach(function (el) {
      el.style.setProperty('display', 'none', 'important');
    });

    var userDisplay = document.getElementById('user-display');
    if (!userDisplay) return;

    userDisplay.style.cursor = 'pointer';

    // Add chevron icon to user-display if not present
    if (!userDisplay.querySelector('.user-pill-chevron')) {
      var chevron = document.createElement('i');
      chevron.setAttribute('data-lucide', 'chevron-down');
      chevron.className = 'user-pill-chevron';
      chevron.style.width = '13px';
      chevron.style.height = '13px';
      chevron.style.marginLeft = '4px';
      userDisplay.appendChild(chevron);
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }

    // Ensure dropdown container exists in DOM
    var dropdown = document.getElementById('user-profile-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'user-profile-dropdown';
      dropdown.className = 'user-profile-dropdown';

      var parent = userDisplay.parentElement;
      if (parent) {
        if (getComputedStyle(parent).position === 'static') {
          parent.style.position = 'relative';
        }
        parent.appendChild(dropdown);
      }
    }

    function renderDropdownContent() {
      var dd = document.getElementById('user-profile-dropdown');
      if (!dd) return;

      var user = null;
      try {
        var saved = localStorage.getItem('currentUser');
        if (saved) user = JSON.parse(saved);
      } catch (_) {}

      if (!user) {
        dd.classList.remove('open');
        userDisplay.classList.remove('active');
        return;
      }

      var name = user.name || 'Valued Customer';
      var email = user.email || 'customer@example.com';
      var phone = user.telephone || user.phone || '+44 20 7946 0912';
      var address = user.address || 'London, United Kingdom';
      var accountCode = user.accountCode || user.account_code || ('ACC-' + (user.id || '001'));
      var cardRef = user.mockCardRef || user.mock_card_ref || '•••• •••• •••• 4242 (Visa Test Card)';

      var role = (user.role || '').toUpperCase().trim();
      var emailLower = email.toLowerCase().trim();
      var isAdmin = role === 'ADMIN' || emailLower === 'longhvn2006@gmail.com' || emailLower === 'nguyennhanduc20345@gmail.com';

      var initials = name.split(' ').filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() || 'CU';

      var isProfilePage = window.location.pathname.toLowerCase().indexOf('profile.html') !== -1;

      dd.innerHTML =
        '<div class="user-dropdown-header">' +
          '<div class="user-dropdown-avatar">' + initials + '</div>' +
          '<div class="user-dropdown-info">' +
            '<div class="user-dropdown-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</div>' +
            '<div class="user-dropdown-email" title="' + escapeHtml(email) + '">' + escapeHtml(email) + '</div>' +
            '<span class="user-dropdown-role-badge ' + (isAdmin ? 'user-role-admin' : 'user-role-customer') + '">' +
              (isAdmin ? '★ Administrator' : '● Customer Account') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="user-dropdown-body">' +
          '<div class="user-dropdown-item">' +
            '<i data-lucide="hash"></i>' +
            '<div class="user-dropdown-item-content">' +
              '<div class="user-dropdown-item-label">Account Code</div>' +
              '<div class="user-dropdown-item-value" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary);">' + escapeHtml(accountCode) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="user-dropdown-item">' +
            '<i data-lucide="phone"></i>' +
            '<div class="user-dropdown-item-content">' +
              '<div class="user-dropdown-item-label">Telephone Number</div>' +
              '<div class="user-dropdown-item-value">' + escapeHtml(phone) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="user-dropdown-item">' +
            '<i data-lucide="map-pin"></i>' +
            '<div class="user-dropdown-item-content">' +
              '<div class="user-dropdown-item-label">Billing / Contact Address</div>' +
              '<div class="user-dropdown-item-value">' + escapeHtml(address) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="user-dropdown-item">' +
            '<i data-lucide="credit-card"></i>' +
            '<div class="user-dropdown-item-content">' +
              '<div class="user-dropdown-item-label">Payment Card Reference</div>' +
              '<div class="user-dropdown-item-value" style="font-size: 11.5px;">' + escapeHtml(cardRef) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="user-dropdown-footer">' +
          '<a href="profile.html" id="btn-dropdown-change-profile" class="btn-change-profile" title="Change Profile">' +
            '<i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>' +
            '<span>Change Profile</span>' +
          '</a>' +
          '<button type="button" class="btn-dropdown-logout" onclick="window.handleUserProfileLogout()">' +
            '<i data-lucide="log-out" style="width: 13px; height: 13px;"></i>' +
            '<span>Sign Out</span>' +
          '</button>' +
        '</div>';

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }

      var changeBtn = document.getElementById('btn-dropdown-change-profile');
      if (changeBtn && isProfilePage) {
        changeBtn.onclick = function (e) {
          e.preventDefault();
          dd.classList.remove('open');
          userDisplay.classList.remove('active');
          var nameInput = document.getElementById('prof-name');
          if (nameInput) {
            nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nameInput.focus();
          }
        };
      }
    }

    userDisplay.onclick = function (e) {
      e.stopPropagation();
      var dd = document.getElementById('user-profile-dropdown');
      if (!dd) return;

      var isOpen = dd.classList.contains('open');
      if (isOpen) {
        dd.classList.remove('open');
        userDisplay.classList.remove('active');
      } else {
        renderDropdownContent();
        dd.classList.add('open');
        userDisplay.classList.add('active');
      }
    };

    if (!window._userDropdownListenersBound) {
      window._userDropdownListenersBound = true;

      document.addEventListener('click', function (e) {
        var dd = document.getElementById('user-profile-dropdown');
        var ud = document.getElementById('user-display');
        if (!dd || !ud) return;
        if (!dd.contains(e.target) && !ud.contains(e.target)) {
          dd.classList.remove('open');
          ud.classList.remove('active');
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var dd = document.getElementById('user-profile-dropdown');
          var ud = document.getElementById('user-display');
          if (dd && ud) {
            dd.classList.remove('open');
            ud.classList.remove('active');
          }
        }
      });
    }
  };

  // 7. Dynamic Hero CTA Switcher based on Authentication State
  window.syncHeroCTA = function () {
    var savedUser = null;
    try {
      var saved = localStorage.getItem('currentUser');
      var token = localStorage.getItem('sessionToken');
      if (saved && token) savedUser = JSON.parse(saved);
    } catch (_) {}

    var heroGuest = document.getElementById('hero-cta-guest');
    var heroUser = document.getElementById('hero-cta-user');
    var heroWelcome = document.getElementById('hero-user-welcome');
    var heroWelcomeName = document.getElementById('hero-user-welcome-name');
    var bookingHeroGuest = document.getElementById('booking-hero-guest');

    if (savedUser) {
      if (heroGuest) heroGuest.style.setProperty('display', 'none', 'important');
      if (heroUser) {
        heroUser.style.removeProperty('display');
        heroUser.style.display = 'flex';
      }
      if (heroWelcome) {
        heroWelcome.style.removeProperty('display');
        heroWelcome.style.display = 'block';
      }
      if (heroWelcomeName) {
        heroWelcomeName.textContent = savedUser.name || 'Customer';
      }
      if (bookingHeroGuest) {
        bookingHeroGuest.style.setProperty('display', 'none', 'important');
      }
    } else {
      if (heroGuest) {
        heroGuest.style.removeProperty('display');
        heroGuest.style.display = 'flex';
      }
      if (heroUser) heroUser.style.setProperty('display', 'none', 'important');
      if (heroWelcome) heroWelcome.style.setProperty('display', 'none', 'important');
      if (bookingHeroGuest) {
        bookingHeroGuest.style.removeProperty('display');
        bookingHeroGuest.style.display = 'flex';
      }
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  };

  function syncDomTheme() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark && document.body) {
      document.body.setAttribute('data-theme', 'dark');
    }
    window.updateThemeUI();
    window.updateStaffPortalAccess();
    if (typeof window.initUserProfileDropdown === 'function') {
      window.initUserProfileDropdown();
    }
    if (typeof window.syncHeroCTA === 'function') {
      window.syncHeroCTA();
    }
    if (typeof window.syncSidebarUserInfo === 'function') {
      window.syncSidebarUserInfo();
    }
  }

  // 8. Update UI once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncDomTheme);
  } else {
    syncDomTheme();
  }
})();

