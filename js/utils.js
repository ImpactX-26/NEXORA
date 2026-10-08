// ============================================================
// CampusSOS v2 — Shared Utilities
// ============================================================

/** Relative time label from timestamp */
export function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 10) return 'just now';
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

/** Format timestamp to HH:MM */
export function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Format timestamp to date string */
export function formatDate(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format timestamp to date + time */
export function formatDateTime(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  return d.toLocaleString([], {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

/** Format seconds into human readable SLA countdown */
export function formatCountdown(secs) {
  if (secs <= 0) return 'BREACHED';
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

/** SLA urgency class based on remaining percentage */
export function slaUrgencyClass(remainingPct) {
  if (remainingPct <= 0) return 'breached';
  if (remainingPct <= 25) return 'danger';
  if (remainingPct <= 60) return 'warn';
  return 'safe';
}

/** SLA bar color */
export function slaBarColor(remainingPct) {
  if (remainingPct <= 0) return 'var(--red)';
  if (remainingPct <= 25) return 'var(--red)';
  if (remainingPct <= 60) return 'var(--orange)';
  return 'var(--green)';
}

/** Category label */
export function categoryLabel(cat) {
  const labels = {
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    mess: 'Mess / Food',
    wifi: 'WiFi / Network',
    timetable: 'Timetable',
    safety: 'Safety',
    other: 'Other',
  };
  return labels[cat] || cat || 'Unclassified';
}

/** Show toast notification */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/** Show confirmation modal, returns promise<boolean> */
export function showConfirm(title, text, confirmLabel = 'Confirm', danger = false) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-overlay');
    const box = document.getElementById('modal-box');

    box.innerHTML = `
      <div class="modal-title">${title}</div>
      <div class="modal-text">${text}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">${confirmLabel}</button>
      </div>
    `;

    overlay.classList.add('visible');

    const close = (result) => {
      overlay.classList.remove('visible');
      resolve(result);
    };

    box.querySelector('#modal-cancel').onclick = () => close(false);
    box.querySelector('#modal-confirm').onclick = () => close(true);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

/** Show modal with textarea input, returns promise<string|null> */
export function showPrompt(title, text, placeholder = '') {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-overlay');
    const box = document.getElementById('modal-box');

    box.innerHTML = `
      <div class="modal-title">${title}</div>
      <div class="modal-text">${text}</div>
      <textarea class="form-textarea" id="modal-input" placeholder="${placeholder}" rows="3"></textarea>
      <div class="modal-actions" style="margin-top:14px">
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-confirm">Submit</button>
      </div>
    `;

    overlay.classList.add('visible');
    box.querySelector('#modal-input').focus();

    const close = (result) => {
      overlay.classList.remove('visible');
      resolve(result);
    };

    box.querySelector('#modal-cancel').onclick = () => close(null);
    box.querySelector('#modal-confirm').onclick = () => {
      close(box.querySelector('#modal-input').value.trim());
    };
    overlay.onclick = (e) => { if (e.target === overlay) close(null); };
  });
}

/** Sanitize text for HTML insertion */
export function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
