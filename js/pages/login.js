// ============================================================
// CampusSOS v2 — Login & Access Control Portal
// Dummy authentication for Student, Staff, and Admin portals
// Enforces strict student grievance confidentiality
// ============================================================

import { setAuthUser, getAuthUser, isAuthenticated } from '../state.js';
import { loginApi } from '../api.js';
import { navigate } from '../router.js';
import { showToast, esc } from '../utils.js';

const DEMO_CREDENTIALS = {
  student: [
    { username: 'student', password: 'student123', label: 'Student #101', desc: 'Hostel Resident Account' },
    { username: 'student2', password: 'student123', label: 'Student #102', desc: 'Day Scholar Account' },
    { username: 'student3', password: 'student123', label: 'Student #103', desc: 'Lab Assistant Account' },
  ],
  faculty: [
    { username: 'electrician', password: 'staff123', label: 'Campus Electrician', desc: 'Electrical Maintenance' },
    { username: 'network', password: 'staff123', label: 'Network Engineer', desc: 'IT & Network Operations' },
    { username: 'viceprincipal', password: 'staff123', label: 'Vice Principal', desc: 'Anti-Ragging & Campus Discipline' },
    { username: 'grievance', password: 'staff123', label: 'Grievance Redressal Officer', desc: 'Academic, Harassment & Admin Redressal' },
  ],
  admin: [
    { username: 'admin', password: 'admin123', label: 'Dean of Student Welfare', desc: 'Institutional Admin Oversight' },
  ]
};

export function renderLoginPage(container) {
  // If already authenticated, redirect to their home portal
  const currentUser = getAuthUser();
  if (currentUser) {
    navigate(`/${currentUser.role || 'student'}`);
    return;
  }

  let selectedPortal = 'student'; // 'student' | 'faculty' | 'admin'

  function render() {
    container.innerHTML = `
      <div class="login-wrapper">
        <div class="login-container">
          <!-- LOGIN BRAND HEADER -->
          <div class="login-header">
            <div class="login-brand">
              <div class="login-brand-dot"></div>
              <span class="login-brand-title">CampusSOS</span>
            </div>
            <h1 class="login-heading">Institutional Access Portal</h1>
            <p class="login-subheading">Select your role and authenticate to access your dedicated grievance workflow.</p>
          </div>

          <!-- PORTAL TAB SELECTOR -->
          <div class="login-portal-tabs" id="portal-tabs">
            <button type="button" class="portal-tab-btn ${selectedPortal === 'student' ? 'active' : ''}" data-portal="student">
              <span class="portal-tab-icon">🎓</span>
              <div>
                <div class="portal-tab-title">Student Portal</div>
                <div class="portal-tab-desc">File & track private grievances</div>
              </div>
            </button>

            <button type="button" class="portal-tab-btn ${selectedPortal === 'faculty' ? 'active' : ''}" data-portal="faculty">
              <span class="portal-tab-icon">🔧</span>
              <div>
                <div class="portal-tab-title">Staff / Faculty</div>
                <div class="portal-tab-desc">Resolve assigned tasks & SLAs</div>
              </div>
            </button>

            <button type="button" class="portal-tab-btn ${selectedPortal === 'admin' ? 'active' : ''}" data-portal="admin">
              <span class="portal-tab-icon">🏛️</span>
              <div>
                <div class="portal-tab-title">Admin Dashboard</div>
                <div class="portal-tab-desc">Governance & agent intelligence</div>
              </div>
            </button>
          </div>

          <!-- PRIVACY ASSURANCE CALLOUT -->
          <div class="privacy-banner ${selectedPortal}">
            <div class="privacy-icon">🔒</div>
            <div class="privacy-text">
              ${selectedPortal === 'student'
                ? '<strong>Strict Student Privacy Guaranteed:</strong> Under Campus Security Protocol, students are strictly restricted to their own grievances. No student can view complaints submitted by others.'
                : (selectedPortal === 'faculty'
                  ? '<strong>Staff Verification:</strong> Faculty access is restricted to department work queues and assigned complaints.'
                  : '<strong>Executive Clearance:</strong> Institutional administrators have oversight of all campus department scorecards and SLA surveillance.'
                )
              }
            </div>
          </div>

          <!-- LOGIN FORM -->
          <form id="login-form" class="login-form" novalidate>
            <div class="form-group">
              <label for="login-username" class="form-label">
                ${selectedPortal === 'student' ? 'Student Username / Roll No.' : (selectedPortal === 'faculty' ? 'Staff Username' : 'Administrator Username')}
              </label>
              <div class="input-with-icon">
                <span class="input-icon">👤</span>
                <input
                  type="text"
                  id="login-username"
                  class="form-input"
                  placeholder="${selectedPortal === 'student' ? 'e.g. student or student2' : (selectedPortal === 'faculty' ? 'e.g. staff or suresh' : 'e.g. admin')}"
                  autocomplete="username"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label for="login-password" class="form-label">Password</label>
              <div class="input-with-icon">
                <span class="input-icon">🔑</span>
                <input
                  type="password"
                  id="login-password"
                  class="form-input"
                  placeholder="Enter portal password..."
                  autocomplete="current-password"
                  required
                />
                <button type="button" class="btn-toggle-pwd" id="btn-toggle-pwd" title="Show/Hide Password">👁️</button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-submit-login">
              Sign In to ${selectedPortal === 'student' ? 'Student Portal' : (selectedPortal === 'faculty' ? 'Faculty Portal' : 'Admin Dashboard')}
            </button>
          </form>

          <!-- QUICK DEMO FILL BUTTONS -->
          <div class="quick-fill-section">
            <div class="quick-fill-header">
              <span>⚡ Quick Demo Credentials (${selectedPortal.toUpperCase()})</span>
              <span class="quick-fill-hint">Click to auto-fill</span>
            </div>
            <div class="quick-fill-chips" id="quick-fill-chips">
              ${DEMO_CREDENTIALS[selectedPortal].map(cred => `
                <button
                  type="button"
                  class="quick-fill-chip"
                  data-user="${cred.username}"
                  data-pass="${cred.password}"
                  title="${cred.desc}"
                >
                  <span class="chip-name">${cred.label}</span>
                  <span class="chip-cred">${cred.username} / ${cred.password}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- CREDENTIAL REFERENCE CHEATSHEET -->
          <div class="login-footer-info">
            <div class="footer-info-title">Fixed Credentials Reference:</div>
            <div class="footer-info-grid">
              <div><strong>🎓 Student:</strong> <code>student</code> / <code>student123</code> (or <code>student2</code>)</div>
              <div><strong>🔧 Staff:</strong> <code>staff</code> / <code>staff123</code> (or <code>suresh</code>, <code>anita</code>)</div>
              <div><strong>🏛️ Admin:</strong> <code>admin</code> / <code>admin123</code></div>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Tab switching
    container.querySelectorAll('.portal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedPortal = btn.dataset.portal;
        render();
      });
    });

    // Quick fill chips
    container.querySelectorAll('.quick-fill-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const uInput = container.querySelector('#login-username');
        const pInput = container.querySelector('#login-password');
        if (uInput && pInput) {
          uInput.value = chip.dataset.user;
          pInput.value = chip.dataset.pass;
          uInput.focus();
        }
      });
    });

    // Show/Hide password toggle
    const pwdToggle = container.querySelector('#btn-toggle-pwd');
    const pwdInput = container.querySelector('#login-password');
    pwdToggle?.addEventListener('click', () => {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        pwdToggle.textContent = '🙈';
      } else {
        pwdInput.type = 'password';
        pwdToggle.textContent = '👁️';
      }
    });

    // Form submit
    const form = container.querySelector('#login-form');
    form?.addEventListener('submit', handleLoginSubmit);
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const uInput = container.querySelector('#login-username');
    const pInput = container.querySelector('#login-password');
    const btn = container.querySelector('#btn-submit-login');

    const username = uInput.value.trim();
    const password = pInput.value.trim();

    if (!username || !password) {
      showToast('Please enter both username and password.', 'warn');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span> Authenticating...';

    try {
      const res = await loginApi(username, password, selectedPortal);
      if (res.success && res.user) {
        setAuthUser(res.user);
        showToast(res.message || `Signed in as ${res.user.name}`, 'success');
        
        // Navigate to appropriate role page
        if (res.user.role === 'student') {
          navigate('/student');
        } else if (res.user.role === 'faculty') {
          navigate('/faculty');
        } else if (res.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/student');
        }
      } else {
        showToast('Login failed. Please check your credentials.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Invalid username or password for this portal.', 'error');
      // Shake effect on error
      const box = container.querySelector('.login-container');
      box?.classList.add('shake-anim');
      setTimeout(() => box?.classList.remove('shake-anim'), 600);
    } finally {
      btn.disabled = false;
      btn.textContent = `Sign In to ${selectedPortal === 'student' ? 'Student Portal' : (selectedPortal === 'faculty' ? 'Faculty Portal' : 'Admin Dashboard')}`;
    }
  }

  render();
}
