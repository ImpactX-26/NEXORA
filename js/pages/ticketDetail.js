// ============================================================
// CampusSOS v2 — Ticket Detail View
// Comprehensive timeline, agent reasoning, and actions
// ============================================================

import {
  getTickets, getCurrentRole, getCurrentFaculty,
  STATUS, STATUS_LABELS, STATUS_BADGE
} from '../state.js';
import {
  acceptTicketAction, startWorkAction, resolveTicketAction,
  verifyResolutionAction, rejectResolutionAction,
  onTicketChange
} from '../engine.js';
import { fetchTicketById } from '../api.js';
import { navigate } from '../router.js';
import {
  timeAgo, formatDateTime, formatCountdown, slaBarColor,
  categoryLabel, showToast, showPrompt, esc
} from '../utils.js';

export function renderTicketDetail(container, params = {}) {
  const ticketId = params.id;
  let unsubscribe;
  let ticketData = null;

  async function loadDetail() {
    try {
      ticketData = await fetchTicketById(ticketId);
    } catch (err) {
      console.warn('Failed to fetch live ticket details:', err);
    }
    render();
  }

  function render() {
    // Fallback to local cache if available
    const t = ticketData || getTickets().find(x => x.ticket_id === ticketId);

    if (!t) {
      container.innerHTML = `
        <div class="panel empty-state">
          <div class="empty-state-icon">🔍</div>
          <h2>Ticket Not Found</h2>
          <p>The grievance ID <strong>${esc(ticketId)}</strong> could not be located in the database.</p>
          <button class="btn btn-primary" id="btn-go-back" style="margin-top:16px;">← Back to Portal</button>
        </div>
      `;
      container.querySelector('#btn-go-back')?.addEventListener('click', () => navigate('/student'));
      return;
    }

    const currentRole = getCurrentRole();
    const currentFaculty = getCurrentFaculty();
    const statusBadge = STATUS_BADGE[t.status] || 'badge-submitted';
    const statusLabel = STATUS_LABELS[t.status] || t.status;
    const sla = t.sla_seconds || 60;
    const remaining = t.seconds_until_escalation ?? sla;
    const pct = Math.max(0, Math.min(100, (remaining / sla) * 100));
    const isEscalated = t.status === 'escalated' || (t.escalation_level || 0) > 0;
    const isReopened = t.status === 'reopened';
    const timeline = t.timeline || [];

    container.innerHTML = `
      <div class="ticket-detail">
        <a href="#/${currentRole}" class="btn-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to ${currentRole.toUpperCase()} Dashboard
        </a>

        <div class="ticket-detail-header">
          <span class="ticket-id" style="font-size:16px;font-weight:700;">${t.ticket_id}</span>
          <h1 class="ticket-title" style="font-size:22px;margin-top:4px;">${esc(t.title || t.complaint_text.slice(0, 60))}</h1>
          <div class="ticket-tags" style="margin-top:8px;">
            <span class="badge ${statusBadge}">${statusLabel}</span>
            ${t.urgency ? `<span class="badge badge-${t.urgency}">${t.urgency} urgency</span>` : ''}
            ${t.category ? `<span class="badge badge-cat">${categoryLabel(t.category)}</span>` : ''}
            ${isEscalated ? `<span class="badge badge-escalated">Escalated Level ${t.escalation_level || 1}</span>` : ''}
            ${isReopened ? `<span class="badge badge-reopened">Reopened (${t.reopened_count || 1}x)</span>` : ''}
          </div>
        </div>

        <div class="ticket-detail-body">
          <!-- MAIN CONTENT -->
          <div class="detail-main">
            <!-- ORIGINAL COMPLAINT -->
            <div class="panel">
              <div class="detail-section-title">Original Student Grievance</div>
              <div class="complaint-text-block">
                "${esc(t.complaint_text)}"
              </div>
              <div style="font-size:11px;color:var(--text-muted);display:flex;gap:16px;">
                <span>👤 Filed by: <strong>${esc(t.student_name || 'Student')}</strong></span>
                <span>📍 Location: <strong>${esc(t.location || 'Campus')}</strong></span>
                <span>📅 Filed: <strong>${formatDateTime(t.created_at * 1000 || t.created_at)}</strong></span>
              </div>
            </div>

            <!-- STUDENT VERIFICATION PROMPT (if awaiting) -->
            ${t.status === 'resolved_awaiting' ? `
              <div class="verification-box">
                <h3>Resolution Awaiting Student Verification</h3>
                <p>
                  <strong>${esc(t.assigned_to || 'Assigned Staff')}</strong> marked this complaint as resolved with note:
                  <br/><span style="color:var(--text-primary);display:inline-block;margin-top:6px;font-style:italic;">"${esc(t.resolution_note || 'Issue addressed.')}"</span>
                </p>
                <div class="verification-actions" style="margin-top:14px;">
                  <button class="btn btn-success" id="btn-verify-detail">✓ Confirm Resolution (Close Ticket)</button>
                  <button class="btn btn-danger" id="btn-reject-detail">✕ Reject Resolution (Reopen Issue)</button>
                </div>
              </div>
            ` : ''}

            <!-- REOPENED REASON (if present) -->
            ${isReopened && t.verification_reason ? `
              <div class="panel" style="border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.03);">
                <div class="detail-section-title" style="color:var(--red);">Student Rejection Reason</div>
                <div style="font-size:13px;color:var(--text-primary);">
                  "${esc(t.verification_reason)}"
                </div>
              </div>
            ` : ''}

            <!-- TIMELINE OF DECISIONS & ACTIONS -->
            <div class="panel">
              <div class="panel-header">
                <div class="panel-title">Audit Trail & Autonomous Event Timeline</div>
                <span class="text-xs text-muted">${timeline.length} events</span>
              </div>
              <div class="timeline">
                ${timeline.map(e => `
                  <div class="timeline-entry">
                    <div class="timeline-dot ${e.type || 'action'}"></div>
                    <div class="timeline-time">${formatDateTime(e.timestamp)} (${timeAgo(e.timestamp)})</div>
                    <div class="timeline-agent ${e.type || 'action'}">${esc(e.agent || 'System')}</div>
                    <div class="timeline-text">${esc(e.text)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- SIDEBAR METADATA & REASONING -->
          <aside class="detail-sidebar">
            <!-- AGENT REASONING -->
            <div class="panel">
              <div class="panel-title" style="margin-bottom:12px;">Autonomous Agent Reasoning</div>
              
              <div style="margin-bottom:14px;">
                <div style="font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;">Intake Agent</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.5;">
                  ${esc(t.intake_reasoning || 'Classified based on contextual grievance intent.')}
                </div>
              </div>

              <div style="margin-bottom:14px;">
                <div style="font-size:10px;font-weight:700;color:var(--cyan);text-transform:uppercase;">Routing Agent</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.5;">
                  ${esc(t.routing_reasoning || `Routed to ${t.department_name} -> ${t.assigned_to}`)}
                </div>
              </div>

              ${isEscalated ? `
                <div>
                  <div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;">Escalation Agent</div>
                  <div style="font-size:12px;color:var(--red);margin-top:4px;line-height:1.5;">
                    ${esc(t.escalation_note || `Auto-escalated to ${t.escalated_to}`)}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- SLA STATUS -->
            <div class="panel">
              <div class="panel-title" style="margin-bottom:12px;">SLA Status</div>
              <div class="detail-field">
                <span class="detail-field-label">Target SLA</span>
                <span class="detail-field-value">${t.sla_seconds || 60}s</span>
              </div>
              <div class="detail-field">
                <span class="detail-field-label">Department</span>
                <span class="detail-field-value">${esc(t.department_name || '--')}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field-label">Assigned Staff</span>
                <span class="detail-field-value">${esc(t.assigned_to || '--')}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field-label">Escalation Level</span>
                <span class="detail-field-value" style="color:${isEscalated ? 'var(--red)' : 'var(--text-primary)'};">
                  Level ${t.escalation_level || 0}
                </span>
              </div>

              ${t.status !== 'resolved_awaiting' && t.status !== 'closed' && !isEscalated ? `
                <div style="margin-top:14px;">
                  <div class="sla-bar-track">
                    <div class="sla-bar-fill" style="width:${pct}%;background:${slaBarColor(pct)}"></div>
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:6px;">
                    ${remaining > 0 ? formatCountdown(remaining) + ' remaining' : 'SLA Breached'}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- STAFF ACTIONS (if in faculty role or staff assigned) -->
            ${(currentRole === 'faculty' || currentRole === 'admin') && t.status !== 'closed' ? `
              <div class="panel">
                <div class="panel-title" style="margin-bottom:12px;">Staff Actions</div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  ${t.status === 'assigned' ? `
                    <button class="btn btn-secondary" id="btn-staff-start">▶ Start Work</button>
                  ` : ''}
                  ${['assigned', 'in_progress', 'reopened', 'escalated'].includes(t.status) ? `
                    <button class="btn btn-primary" id="btn-staff-resolve">✓ Mark Resolved (Submit Note)</button>
                  ` : ''}
                </div>
              </div>
            ` : ''}
          </aside>
        </div>
      </div>
    `;

    // Bind Verification in Detail View
    container.querySelector('#btn-verify-detail')?.addEventListener('click', async () => {
      await verifyResolutionAction(t.ticket_id);
      await loadDetail();
    });

    container.querySelector('#btn-reject-detail')?.addEventListener('click', async () => {
      const reason = await showPrompt(
        'Reject Resolution',
        'Specify why the issue is still unresolved.',
        'e.g. Socket still gives sparks when plugged in.'
      );
      if (reason !== null && reason.trim()) {
        await rejectResolutionAction(t.ticket_id, reason.trim());
        await loadDetail();
      }
    });

    // Bind Staff Actions
    container.querySelector('#btn-staff-start')?.addEventListener('click', async () => {
      await startWorkAction(t.ticket_id, currentFaculty);
      await loadDetail();
    });

    container.querySelector('#btn-staff-resolve')?.addEventListener('click', async () => {
      const note = await showPrompt(
        'Submit Resolution Note',
        'Describe the action taken to fix this grievance.',
        'e.g. Replaced faulty wiring and tested voltage.'
      );
      if (note !== null && note.trim()) {
        await resolveTicketAction(t.ticket_id, currentFaculty, note.trim());
        await loadDetail();
      }
    });
  }

  loadDetail();
  unsubscribe = onTicketChange(render);

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
