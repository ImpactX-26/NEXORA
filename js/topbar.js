// ============================================================
// CampusSOS v2 — Topbar Navigation
// Sticky header with brand, authenticated user pill, logout, and status
// ============================================================

import {
  getCurrentRole, setCurrentRole, isDemoMode,
  isBackendConnected, getState, subscribe,
  getAuthUser, isAuthenticated, clearAuthUser
} from './state.js';
import { toggleDemoMode } from './engine.js';
import { currentRoute, navigate } from './router.js';
import { showToast, esc } from './utils.js';

export function renderTopbar() {
  const el = document.getElementById('topbar');
  if (!el) return;

  function update() {
    const route = currentRoute();
    const demo = isDemoMode();
    const isConnected = isBackendConnected();
    const state = getState();
    const authed = isAuthenticated();
    const user = getAuthUser();

    // Determine brand destination
    const brandLink = authed ? `#/${user.role || 'student'}` : '#/login';

    // Role-specific badge styling
    const roleBadges = {
      student: { label: 'Student', class: 'badge-submitted', icon: '🎓' },
      faculty: { label: 'Staff / Faculty', class: 'badge-classified', icon: '🔧' },
      admin: { label: 'Administrator', class: 'badge-cat', icon: '🏛️' },
    };
    const userRoleInfo = user ? (roleBadges[user.role] || { label: user.role, class: 'badge-submitted', icon: '👤' }) : null;

    el.innerHTML = `
      <div class="topbar-left">
        <a href="${brandLink}" class="topbar-brand">
          <div class="topbar-brand-dot"></div>
          <div>
            <div class="topbar-brand-name">CampusSOS</div>
            <div class="topbar-brand-sub">Autonomous Grievance System</div>
          </div>
        </a>

        ${authed ? `
          <nav class="topbar-nav">
            ${user.role === 'student' ? `
              <a href="#/student" class="topbar-nav-link ${route.startsWith('/student') ? 'active' : ''}">
                🎓 My Grievances
              </a>
            ` : ''}

            ${user.role === 'faculty' ? `
              <a href="#/faculty" class="topbar-nav-link ${route.startsWith('/faculty') ? 'active' : ''}">
                🔧 Staff Workspace
              </a>
            ` : ''}

            ${user.role === 'admin' ? `
              <a href="#/admin" class="topbar-nav-link ${route.startsWith('/admin') ? 'active' : ''}">
                🏛️ Institutional Governance
              </a>
              <a href="#/faculty" class="topbar-nav-link ${route.startsWith('/faculty') ? 'active' : ''}">
                🔧 Staff Directory
              </a>
              <a href="#/student" class="topbar-nav-link ${route.startsWith('/student') ? 'active' : ''}">
                🎓 Student View
              </a>
            ` : ''}
          </nav>
        ` : `
          <nav class="topbar-nav">
            <span class="topbar-logged-out-hint">🔒 Authentication Required</span>
          </nav>
        `}
      </div>

      <div class="topbar-right">
        <!-- SLA DEMO SWITCH -->
        <div class="demo-indicator" title="Switch between fast demonstration cycles and 24h real SLA">
          <label>
            <span class="toggle-switch">
              <input type="checkbox" id="demo-mode-toggle" ${demo ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </span>
            <span class="demo-badge" style="background:${demo ? 'var(--orange-dim)' : 'var(--surface-3)'}; color:${demo ? 'var(--orange)' : 'var(--text-muted)'};">
              ${demo ? '⚡ Demo SLA' : '🕒 Real SLA'}
            </span>
          </label>
        </div>

        <!-- BACKEND HEALTH BADGE -->
        <div class="topbar-status ${isConnected ? 'ok' : 'err'}" title="${isConnected ? 'Flask backend connected & SQLite active' : 'Connecting to Flask backend...'}">
          ${isConnected ? '● Live' : '○ Offline'}
        </div>

        <!-- AUTHENTICATED USER PILL & LOGOUT -->
        ${authed && user ? `
          <div class="user-pill" title="Logged in as ${esc(user.name)} (${esc(user.username)})">
            <div class="user-avatar">${userRoleInfo.icon}</div>
            <div class="user-info">
              <span class="user-name">${esc(user.name)}</span>
              <span class="badge ${userRoleInfo.class} user-role-badge">${userRoleInfo.label}</span>
            </div>
            <button type="button" class="btn-logout" id="btn-logout" title="Sign out of CampusSOS">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Logout</span>
            </button>
          </div>
        ` : `
          <a href="#/login" class="btn btn-secondary btn-sm" style="display:flex;align-items:center;gap:6px;">
            <span>🔑 Sign In</span>
          </a>
        `}
      </div>
    `;

    // Bind Demo Toggle
    const toggle = el.querySelector('#demo-mode-toggle');
    toggle?.addEventListener('change', (e) => {
      toggleDemoMode(e.target.checked);
    });

    // Bind Logout
    const btnLogout = el.querySelector('#btn-logout');
    btnLogout?.addEventListener('click', () => {
      clearAuthUser();
      showToast('You have been signed out.', 'info');
      navigate('/login');
    });
  }

  update();
  window.addEventListener('hashchange', update);
  subscribe(update);
}
