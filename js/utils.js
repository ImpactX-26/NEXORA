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

/** High-priority campus facility keywords for electrical & network issues */
export const HIGH_PRIORITY_FACILITIES = [
  'lab', 'labs', 'computer lab', 'physics lab', 'chemistry lab',
  'faculty room', 'staff room', 'server room', 'library', 'central library',
  'seminar hall', 'study hall', 'exam hall', 'data center', 'academic block'
];

/** Check if a grievance is in a high-priority campus facility (especially electrical/network) */
export function isHighPriorityFacility(locationStr = '', textStr = '', category = '') {
  const combined = `${locationStr || ''} ${textStr || ''}`.toLowerCase();
  const hasKeyword = HIGH_PRIORITY_FACILITIES.some(k => combined.includes(k));
  const cat = (category || '').toLowerCase();
  const isTech = ['electrical', 'wifi', 'network'].includes(cat) || !cat;
  return hasKeyword && isTech;
}

/** Compute numerical priority ranking score for sorting tickets on staff portal */
export function getPriorityRankScore(ticket) {
  let score = 0;
  const status = (ticket.status || '').toLowerCase();
  const isEscalated = status === 'escalated' || (ticket.escalation_level || 0) > 0;
  const isReopened = status === 'reopened';
  const isHighLoc = isHighPriorityFacility(ticket.location, ticket.complaint_text, ticket.category);
  const urg = (ticket.urgency || '').toLowerCase();

  // 1. Escalated tickets come first
  if (isEscalated) score += 100000 + (ticket.escalation_level || 1) * 20000;
  // 2. Reopened tickets come next
  if (isReopened) score += 50000;
  // 3. High-priority facility (Staff room, Labs, Server room, Library)
  if (isHighLoc) score += 30000;
  // 4. Urgency levels
  if (urg === 'critical') score += 15000;
  else if (urg === 'high') score += 8000;
  else if (urg === 'medium') score += 3000;
  else if (urg === 'low') score += 1000;

  return score;
}

/** Live real-time SLA countdown DOM updater (runs every 1000ms) */
export function updateDomSlaTimers() {
  const now = Date.now() / 1000;
  const timerElements = document.querySelectorAll('[data-sla-deadline]');

  timerElements.forEach(el => {
    const deadline = parseFloat(el.getAttribute('data-sla-deadline'));
    const total = parseFloat(el.getAttribute('data-sla-total')) || 60;
    const status = (el.getAttribute('data-sla-status') || '').toLowerCase();

    // Skip closed or awaiting verification tickets
    if (!deadline || ['closed', 'verified', 'resolved_awaiting'].includes(status)) return;

    const remaining = Math.max(0, Math.round(deadline - now));
    const pct = Math.max(0, Math.min(100, (remaining / total) * 100));

    // Update bar fill
    const fill = el.querySelector('.sla-bar-fill');
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.style.background = slaBarColor(pct);
    }

    // Update text labels
    const label = el.querySelector('.sla-bar-label');
    if (label) {
      const mode = el.getAttribute('data-sla-label-mode') || 'standard';
      if (remaining > 0) {
        if (mode === 'until') {
          label.textContent = `${formatCountdown(remaining)} until escalation`;
        } else if (mode === 'remaining') {
          label.textContent = `${formatCountdown(remaining)} SLA remaining`;
        } else if (mode === 'compact') {
          label.textContent = formatCountdown(remaining);
        } else {
          label.textContent = `${formatCountdown(remaining)} remaining`;
        }
        label.style.color = (pct <= 25) ? 'var(--red)' : '';
      } else {
        label.textContent = 'SLA Breached';
        label.style.color = 'var(--red)';
      }
    }
  });

  // Also update relative timestamps (e.g. "12s ago")
  const ageElements = document.querySelectorAll('[data-created-at]');
  ageElements.forEach(el => {
    const ts = parseFloat(el.getAttribute('data-created-at'));
    if (ts) {
      el.textContent = timeAgo(ts * 1000 > Date.now() * 10 ? ts : ts * 1000);
    }
  });
}

let _liveTickerInterval = null;
export function startLiveSlaTicker() {
  if (_liveTickerInterval) return;
  _liveTickerInterval = setInterval(updateDomSlaTimers, 1000);
}

/** Category label */
export function categoryLabel(cat) {
  const labels = {
    electrical: '⚡ Electrical Issue',
    wifi: '📶 WiFi & Network',
    network: '📶 WiFi & Network',
    bullying_crime: '🛡️ Anti-Ragging & Discipline',
    bullying: '🛡️ Anti-Ragging & Discipline',
    ragging: '🛡️ Anti-Ragging & Discipline',
    crime: '🛡️ Campus Discipline',
    grievance_redressal: '⚖️ Grievance Redressal',
    academic: '⚖️ Academic Grievance',
    harassment: '⚖️ Harassment Grievance',
    administrative: '⚖️ Administrative Grievance',
    other: '📌 General Grievance',
  };
  return labels[cat] || cat || 'General Grievance';
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
