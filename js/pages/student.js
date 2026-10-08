// ============================================================
// CampusSOS v2 — Student Portal
// Complaint filing + ticket tracking (smooth typing & dynamic updates)
// ============================================================

import { getTickets, STATUS, STATUS_LABELS, STATUS_BADGE, isDemoMode } from '../state.js';
import { fileComplaint, onTicketChange, verifyResolutionAction, rejectResolutionAction } from '../engine.js';
import { navigate } from '../router.js';
import {
  timeAgo, formatTime, formatCountdown, slaUrgencyClass,
  slaBarColor, categoryLabel, showToast, showPrompt, esc,
} from '../utils.js';

const EXAMPLES = [
  'The plug in my room sparked when I tried to charge my laptop',
  'Dinner dal smelled off again, second time this week',
  'WiFi in Block C keeps dropping every ten minutes',
  'My DBMS lecture and the DSA lab are scheduled in the same room at 2 PM',
  "There's no water supply in Hostel 2 washrooms since morning",
  'Someone broke the lock on the main gate of Block A',
];

const LOCATIONS = [
  'Block A', 'Block B', 'Block C', 'Block D',
  'Main Mess', 'Hostel 1', 'Hostel 2',
  'Common Room', 'Library', 'Academic Block',
];

export function renderStudentPortal(container) {
  let unsubscribe;

  function render() {
    const tickets = getTickets();

    // Split tickets into active, awaiting verification, and closed
    const active = tickets.filter(t =>
      ![STATUS.CLOSED, STATUS.VERIFIED].includes(t.status)
    );
    const awaitingVerification = tickets.filter(t =>
      t.status === STATUS.RESOLVED
    );
    const closed = tickets.filter(t =>
      [STATUS.CLOSED, STATUS.VERIFIED].includes(t.status)
    );

    // If the shell is already in the DOM, update ONLY dynamic sections
    // This PREVENTS user input in textarea/inputs/selects from ever disappearing!
    const shell = container.querySelector('#student-portal-shell');
    if (shell) {
      updateDynamicSections(container, tickets, active, awaitingVerification, closed);
      return;
    }

    // Initial page build
    container.innerHTML = `
      <div id="student-portal-shell">
        <div class="page-header">
          <h1>Student Portal</h1>
          <p>File grievances with AI classification, track live resolution SLAs, and verify outcomes.</p>
        </div>

        <div class="grid-2col">
          <div class="left-content">
            <!-- INTAKE FORM (Rendered once — never wiped by background sync) -->
            <section class="panel">
              <div class="panel-header">
                <div>
                  <div class="panel-title">File a Complaint</div>
                  <div class="panel-subtitle">Describe the issue in your own words. The Intake & Routing Agents classify and assign it to verified faculty in real-time.</div>
                </div>
              </div>
              <form id="complaint-form" novalidate>
                <div class="form-group">
                  <textarea id="complaint-text" class="form-textarea" placeholder="Describe what happened..." rows="3" required></textarea>
                </div>
                <div class="chips-row" id="example-chips">
                  ${EXAMPLES.map(ex => `
                    <button type="button" class="chip" data-text="${esc(ex)}" title="${esc(ex)}">
                      ${esc(ex.slice(0, 45))}${ex.length > 45 ? '...' : ''}
                    </button>
                  `).join('')}
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <input type="text" id="complaint-name" class="form-input" placeholder="Your name (e.g. Tatva)" />
                  </div>
                  <div class="form-group">
                    <select id="complaint-location" class="form-select">
                      <option value="">Select location...</option>
                      ${LOCATIONS.map(l => `<option value="${l}">${l}</option>`).join('')}
                    </select>
                  </div>
                  <button type="submit" class="btn btn-primary btn-lg" id="btn-file">Submit Complaint</button>
                </div>
              </form>
            </section>

            <!-- DYNAMIC SECTIONS (Updated on background sync) -->
            <div id="awaiting-verification-container"></div>
            <div id="active-tickets-container"></div>
            <div id="closed-tickets-container"></div>
          </div>

          <!-- RIGHT SIDEBAR -->
          <aside class="right-sidebar">
            <!-- QUICK STATS -->
            <div id="student-summary-container" class="panel"></div>

            <!-- AUTONOMOUS AGENT EXPLANATION -->
            <div class="panel">
              <div class="panel-title" style="margin-bottom: 12px;">Multi-Agent Pipeline</div>
              <div style="font-size: 11px; line-height: 1.8; color: var(--text-secondary);">
                <div style="margin-bottom:6px;"><strong style="color:var(--blue);">1. Intake Agent:</strong> Evaluates unstructured issue via Groq LLM & assigns category + urgency.</div>
                <div style="margin-bottom:6px;"><strong style="color:var(--cyan);">2. Routing Agent:</strong> Matches live staff directory without hallucinations.</div>
                <div style="margin-bottom:6px;"><strong style="color:var(--red);">3. Escalation Agent:</strong> Autonomously escalates overdue tickets if SLA timer expires.</div>
                <div><strong style="color:var(--green);">4. Verification:</strong> Ticket closes only when you verify the fix.</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;

    // Bind form submit
    const form = container.querySelector('#complaint-form');
    form?.addEventListener('submit', handleSubmit);

    // Bind chips
    container.querySelectorAll('.chip[data-text]').forEach(chip => {
      chip.addEventListener('click', () => {
        const textarea = container.querySelector('#complaint-text');
        textarea.value = chip.dataset.text;
        textarea.focus();
      });
    });

    updateDynamicSections(container, tickets, active, awaitingVerification, closed);
  }

  function updateDynamicSections(container, tickets, active, awaitingVerification, closed) {
    // 1. Awaiting Verification Section
    const awaitEl = container.querySelector('#awaiting-verification-container');
    if (awaitEl) {
      if (awaitingVerification.length > 0) {
        awaitEl.innerHTML = `
          <section class="panel" style="border-color: rgba(168,85,247,0.35); background: rgba(168,85,247,0.03); margin-bottom:20px;">
            <div class="panel-header">
              <div class="panel-title" style="color: #c084fc;">Action Required: Verify Resolution</div>
              <span class="badge badge-awaiting">${awaitingVerification.length} pending your confirmation</span>
            </div>
            ${awaitingVerification.map(t => renderVerificationCard(t)).join('')}
          </section>
        `;
      } else {
        awaitEl.innerHTML = '';
      }
    }

    // 2. Active Tickets Section
    const activeEl = container.querySelector('#active-tickets-container');
    if (activeEl) {
      const nonResolvedActive = active.filter(t => t.status !== STATUS.RESOLVED);
      activeEl.innerHTML = `
        <section style="margin-bottom:20px;">
          <div class="flex-between" style="margin-bottom: 14px;">
            <div class="panel-title">Your Active Tickets</div>
            <span class="text-xs text-muted">${active.length} active</span>
          </div>
          ${active.length === 0 && awaitingVerification.length === 0
            ? '<div class="empty-state">No active complaints. Use the form above to file one.</div>'
            : nonResolvedActive.map(t => renderTicketCard(t)).join('')
          }
        </section>
      `;
    }

    // 3. Closed Tickets Section
    const closedEl = container.querySelector('#closed-tickets-container');
    if (closedEl) {
      if (closed.length > 0) {
        closedEl.innerHTML = `
          <section style="margin-top: 24px;">
            <div class="panel-title" style="margin-bottom: 14px;">Resolution History</div>
            ${closed.slice(0, 8).map(t => renderClosedRow(t)).join('')}
          </section>
        `;
      } else {
        closedEl.innerHTML = '';
      }
    }

    // 4. Sidebar Summary
    const summaryEl = container.querySelector('#student-summary-container');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="panel-title" style="margin-bottom: 12px;">Your Summary</div>
        <div class="detail-field">
          <span class="detail-field-label">Total filed</span>
          <span class="detail-field-value">${tickets.length}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Active / In Progress</span>
          <span class="detail-field-value">${active.length}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Awaiting your verification</span>
          <span class="detail-field-value" style="color: #c084fc; font-weight:700;">${awaitingVerification.length}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Resolved & Closed</span>
          <span class="detail-field-value" style="color: var(--green);">${closed.length}</span>
        </div>
      `;
    }

    // Bind card navigation links
    container.querySelectorAll('[data-ticket-link]').forEach(el => {
      el.onclick = () => navigate(`/ticket/${el.dataset.ticketLink}`);
    });

    // Bind verification buttons
    container.querySelectorAll('[data-verify]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.verify;
        verifyResolutionAction(id);
      };
    });

    container.querySelectorAll('[data-reject]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.reject;
        showPrompt(
          'Issue Not Resolved',
          'Please explain why the issue is not fixed. Your feedback will reopen the ticket and notify the assigned staff.',
          'The issue persists because...'
        ).then(reason => {
          if (reason !== null && reason.trim()) {
            rejectResolutionAction(id, reason.trim());
          }
        });
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const text = container.querySelector('#complaint-text').value.trim();
    const name = container.querySelector('#complaint-name').value.trim();
    const location = container.querySelector('#complaint-location').value;

    if (!text) {
      showToast('Please describe the grievance before submitting.', 'warn');
      return;
    }

    const btn = container.querySelector('#btn-file');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span> Processing with AI Agents...';

    try {
      await fileComplaint(text, name, location);
      // Clear inputs only AFTER successful submission
      container.querySelector('#complaint-text').value = '';
      container.querySelector('#complaint-name').value = '';
      container.querySelector('#complaint-location').value = '';
    } catch (err) {
      showToast(`Submission failed: ${err.message}`, 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Submit Complaint';
  }

  render();
  unsubscribe = onTicketChange(render);

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

// ── Sub-renderers ───────────────────────────────────────────

function renderTicketCard(t) {
  const statusBadge = STATUS_BADGE[t.status] || 'badge-submitted';
  const statusLabel = STATUS_LABELS[t.status] || t.status;
  const sla = t.sla_seconds || 60;
  const remaining = t.seconds_until_escalation ?? sla;
  const pct = Math.max(0, Math.min(100, (remaining / sla) * 100));
  const isEscalated = t.status === STATUS.ESCALATED;

  return `
    <div class="ticket-card ${isEscalated ? 'escalated' : ''}" data-ticket-link="${t.ticket_id}">
      <div class="ticket-card-top">
        <span class="ticket-id">${t.ticket_id}</span>
        <div class="ticket-tags">
          <span class="badge ${statusBadge}">${statusLabel}</span>
          ${t.urgency ? `<span class="badge badge-${t.urgency}">${t.urgency}</span>` : ''}
          ${t.category ? `<span class="badge badge-cat">${categoryLabel(t.category)}</span>` : ''}
          ${(t.escalation_level || 0) > 0 ? `<span class="badge badge-escalated">Escalated Level ${t.escalation_level}</span>` : ''}
        </div>
        <span class="ticket-age">${timeAgo(t.created_at * 1000 || t.created_at)}</span>
      </div>
      <div class="ticket-title">${esc(t.title || t.complaint_text.slice(0, 60))}</div>
      <div class="ticket-excerpt">${esc(t.complaint_text.slice(0, 130))}${t.complaint_text.length > 130 ? '...' : ''}</div>
      <div class="ticket-meta">
        ${t.location ? `<span class="ticket-meta-item">📍 ${esc(t.location)}</span>` : ''}
        ${t.department_name ? `<span class="ticket-meta-item">🏛️ ${esc(t.department_name)}</span>` : ''}
        ${t.assigned_to ? `<span class="ticket-meta-item">👤 ${esc(t.assigned_to)}</span>` : ''}
      </div>
      ${t.status !== STATUS.RESOLVED && !isEscalated ? `
        <div class="sla-bar-container">
          <div class="sla-bar-track">
            <div class="sla-bar-fill" style="width:${pct}%;background:${slaBarColor(pct)}"></div>
          </div>
          <span class="sla-bar-label">${remaining > 0 ? formatCountdown(remaining) + ' until escalation' : 'SLA Breached'}</span>
        </div>
      ` : ''}
      ${isEscalated ? `
        <div style="margin-top:8px;font-size:11px;color:var(--red);font-weight:600;">
          ⚠️ Auto-escalated to ${esc(t.escalated_to || 'Higher Authority')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderVerificationCard(t) {
  return `
    <div class="verification-box">
      <h3>${esc(t.title || t.complaint_text.slice(0, 50))}</h3>
      <p>
        <strong>${esc(t.assigned_to || 'Assigned Staff')}</strong> marked this complaint as resolved.
        ${t.resolution_note ? `<br/><span style="color:var(--text-primary);display:inline-block;margin-top:4px;">Note: "${esc(t.resolution_note)}"</span>` : ''}
      </p>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">
        Ticket: ${t.ticket_id} | ${categoryLabel(t.category)} | Location: ${esc(t.location)}
      </div>
      <div class="verification-actions">
        <button class="btn btn-success" data-verify="${t.ticket_id}">✓ Confirm Resolution (Close Ticket)</button>
        <button class="btn btn-danger" data-reject="${t.ticket_id}">✕ Issue Not Resolved (Reopen)</button>
      </div>
    </div>
  `;
}

function renderClosedRow(t) {
  const ts = t.closed_at ? t.closed_at * 1000 : (t.resolved_at ? t.resolved_at * 1000 : t.created_at * 1000);
  return `
    <div class="ticket-card" data-ticket-link="${t.ticket_id}" style="padding:10px 16px;">
      <div class="flex-between">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="ticket-id">${t.ticket_id}</span>
          <span style="font-size:12px;color:var(--text-secondary);">${esc(t.title || t.complaint_text.slice(0, 50))}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge badge-closed">${t.student_verification === 'verified' ? 'Verified & Closed' : 'Closed'}</span>
          <span class="ticket-age">${timeAgo(ts)}</span>
        </div>
      </div>
    </div>
  `;
}
