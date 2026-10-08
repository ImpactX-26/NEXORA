// ============================================================
// CampusSOS v2 — Topbar Navigation
// Sticky header with brand, portal tabs, demo toggle, and status
// ============================================================

import {
  getCurrentRole, setCurrentRole, isDemoMode,
  isBackendConnected, getState, subscribe
} from './state.js';
import { toggleDemoMode } from './engine.js';
import { currentRoute, navigate } from './router.js';

export function renderTopbar() {
  const el = document.getElementById('topbar');
  if (!el) return;

  function update() {
    const route = currentRoute();
    const demo = isDemoMode();
    const isConnected = isBackendConnected();
    const state = getState();

    el.innerHTML = `
      <div class="topbar-left">
        <a href="#/student" class="topbar-brand">
          <div class="topbar-brand-dot"></div>
          <div>
            <div class="topbar-brand-name">CampusSOS</div>
            <div class="topbar-brand-sub">Autonomous Grievance System</div>
          </div>
        </a>

        <nav class="topbar-nav">
          <a href="#/student" class="topbar-nav-link ${route.startsWith('/student') ? 'active' : ''}">
            Student Portal
          </a>
          <a href="#/faculty" class="topbar-nav-link ${route.startsWith('/faculty') ? 'active' : ''}">
            Faculty / Staff
          </a>
          <a href="#/admin" class="topbar-nav-link ${route.startsWith('/admin') ? 'active' : ''}">
            Admin Dashboard
          </a>
        </nav>
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
              ${demo ? '⚡ Demo SLA Mode' : '🕒 Real SLA Mode'}
            </span>
          </label>
        </div>

        <!-- BACKEND HEALTH BADGE -->
        <div class="topbar-status ${isConnected ? 'ok' : 'err'}" title="${isConnected ? 'Flask backend connected & SQLite active' : 'Connecting to Flask backend...'}">
          ${isConnected ? '● Backend Live' : '○ Connecting...'}
        </div>
      </div>
    `;

    // Bind Demo Toggle
    const toggle = el.querySelector('#demo-mode-toggle');
    toggle?.addEventListener('change', (e) => {
      toggleDemoMode(e.target.checked);
    });
  }

  update();
  window.addEventListener('hashchange', update);
  subscribe(update);
}
