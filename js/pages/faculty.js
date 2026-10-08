// ============================================================
// CampusSOS v2 — Faculty & Staff Portal
// Live grievance handling & resolution workflow
// ============================================================

import {
  getTickets, getFacultyList, getCurrentFaculty,
  setCurrentFaculty, STATUS, STATUS_LABELS, STATUS_BADGE
} from '../state.js';
import {
  acceptTicketAction, startWorkAction, resolveTicketAction,
  onTicketChange
} from '../engine.js';
import { navigate } from '../router.js';
import {
  timeAgo, formatCountdown, slaBarColor, categoryLabel,
  showToast, showPrompt, esc
} from '../utils.js';

export function renderFacultyPortal(container) {
  let unsubscribe;
  let activeTab = 'active'; // 'active' | 'inprogress' | 'awaiting' | 'escalated' | 'all'

  function render() {
    const allTickets = getTickets();
    const facultyList = getFacultyList();
    const currentFacultyName = getCurrentFaculty();

    // Find current staff object
    const currentStaff = facultyList.find(s => s.name === currentFacultyName) || facultyList[0] || {
      name: currentFacultyName || 'Suresh Nair',
      role: 'Electrician',
      department_name: 'Hostel Maintenance'
    };

    // Filter tickets assigned to this staff member
    const assignedTickets = allTickets.filter(t =>
      t.assigned_to === currentStaff.name || t.assigned_staff_id === currentStaff.id
    );

    const activeTickets = assignedTickets.filter(t =>
      ['assigned', 'in_progress', 'reopened'].includes(t.status)
    );
    const inProgressTickets = assignedTickets.filter(t => t.status === 'in_progress');
    const awaitingTickets = assignedTickets.filter(t => t.status === 'resolved_awaiting');
    const escalatedTickets = assignedTickets.filter(t => t.status === 'escalated' || (t.escalation_level || 0) > 0);
    const closedTickets = assignedTickets.filter(t => ['closed', 'verified'].includes(t.status));

    // Get filtered list for current tab
    let displayList = [];
    if (activeTab === 'active') displayList = activeTickets;
    else if (activeTab === 'inprogress') displayList = inProgressTickets;
    else if (activeTab === 'awaiting') displayList = awaitingTickets;
    else if (activeTab === 'escalated') displayList = escalatedTickets;
    else displayList = assignedTickets;

    const shell = container.querySelector('#faculty-portal-shell');
    if (shell) {
      updateDynamicFacultySections(container, currentStaff, activeTickets, inProgressTickets, awaitingTickets, escalatedTickets, assignedTickets, displayList);
      return;
    }

    container.innerHTML = `
      <div id="faculty-portal-shell">
        <div class="page-header flex-between">
          <div>
            <h1>Faculty & Staff Portal</h1>
            <p>Autonomous task dispatch, live SLA countdowns, and resolution logging.</p>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <label style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Active Account:</label>
            <select id="faculty-switcher" class="form-select" style="min-width:240px;">
              ${facultyList.map(f => `
                <option value="${esc(f.name)}" ${f.name === currentStaff.name ? 'selected' : ''}>
                  ${esc(f.name)} (${esc(f.role)})
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- STAFF INFO BAR -->
        <div id="faculty-stats-container" class="stats-bar"></div>

        <!-- TAB FILTER BAR -->
        <div id="faculty-tabs-container" class="tab-bar"></div>

        <!-- TICKET LIST -->
        <div id="faculty-tickets-container"></div>
      </div>
    `;

    // Bind faculty switcher once
    const switcher = container.querySelector('#faculty-switcher');
    switcher?.addEventListener('change', (e) => {
      setCurrentFaculty(e.target.value);
      render();
    });

    updateDynamicFacultySections(container, currentStaff, activeTickets, inProgressTickets, awaitingTickets, escalatedTickets, assignedTickets, displayList);
  }

  function updateDynamicFacultySections(container, currentStaff, activeTickets, inProgressTickets, awaitingTickets, escalatedTickets, assignedTickets, displayList) {
    // 1. Stats Bar
    const statsEl = container.querySelector('#faculty-stats-container');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Department</div>
          <div style="font-size:15px;font-weight:700;color:var(--cyan);">${esc(currentStaff.department_name || 'Campus Operations')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${esc(currentStaff.role || 'Staff')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Workload</div>
          <div class="stat-value ${activeTickets.length > 0 ? 'accent' : ''}">${activeTickets.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Awaiting Verification</div>
          <div class="stat-value" style="color:#c084fc;">${awaitingTickets.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">SLA Escalations</div>
          <div class="stat-value" style="color:${escalatedTickets.length > 0 ? 'var(--red)' : 'var(--green)'};">
            ${escalatedTickets.length}
          </div>
        </div>
      `;
    }

    // 2. Tabs Bar
    const tabsEl = container.querySelector('#faculty-tabs-container');
    if (tabsEl) {
      tabsEl.innerHTML = `
        <button class="tab-item ${activeTab === 'active' ? 'active' : ''}" data-tab="active">
          Active Tasks <span class="tab-count">${activeTickets.length}</span>
        </button>
        <button class="tab-item ${activeTab === 'inprogress' ? 'active' : ''}" data-tab="inprogress">
          In Progress <span class="tab-count">${inProgressTickets.length}</span>
        </button>
        <button class="tab-item ${activeTab === 'awaiting' ? 'active' : ''}" data-tab="awaiting">
          Awaiting Student Verification <span class="tab-count">${awaitingTickets.length}</span>
        </button>
        <button class="tab-item ${activeTab === 'escalated' ? 'active' : ''}" data-tab="escalated">
          Escalated <span class="tab-count">${escalatedTickets.length}</span>
        </button>
        <button class="tab-item ${activeTab === 'all' ? 'active' : ''}" data-tab="all">
          All History <span class="tab-count">${assignedTickets.length}</span>
        </button>
      `;

      tabsEl.querySelectorAll('[data-tab]').forEach(btn => {
        btn.onclick = () => {
          activeTab = btn.dataset.tab;
          render();
        };
      });
    }

    // 3. Ticket List
    const ticketsEl = container.querySelector('#faculty-tickets-container');
    if (ticketsEl) {
      ticketsEl.innerHTML = displayList.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div>No complaints found in this category for <strong>${esc(currentStaff.name)}</strong>.</div>
          </div>`
        : displayList.map(t => renderFacultyTicketCard(t, currentStaff.name)).join('');

      // Bind card links
      ticketsEl.querySelectorAll('[data-ticket-link]').forEach(el => {
        el.onclick = (e) => {
          if (e.target.closest('button') || e.target.closest('input')) return;
          navigate(`/ticket/${el.dataset.ticketLink}`);
        };
      });

      // Bind actions
      ticketsEl.querySelectorAll('[data-accept]').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const id = btn.dataset.accept;
          btn.disabled = true;
          await acceptTicketAction(id, currentStaff.name);
        };
      });

      ticketsEl.querySelectorAll('[data-start-work]').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const id = btn.dataset.startWork;
          btn.disabled = true;
          await startWorkAction(id, currentStaff.name);
        };
      });

      ticketsEl.querySelectorAll('[data-resolve]').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const id = btn.dataset.resolve;
          const note = await showPrompt(
            'Mark Grievance Resolved',
            'Explain the resolution steps taken. The student will be prompted to verify this before the ticket is officially closed.',
            'e.g. Replaced burnt socket and restored circuit connection in Room 204.'
          );
          if (note !== null && note.trim()) {
            btn.disabled = true;
            await resolveTicketAction(id, currentStaff.name, note.trim());
          }
        };
      });
    }
  }

  render();
  unsubscribe = onTicketChange(render);

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

function renderFacultyTicketCard(t, facultyName) {
  const statusBadge = STATUS_BADGE[t.status] || 'badge-submitted';
  const statusLabel = STATUS_LABELS[t.status] || t.status;
  const sla = t.sla_seconds || 60;
  const remaining = t.seconds_until_escalation ?? sla;
  const pct = Math.max(0, Math.min(100, (remaining / sla) * 100));
  const isEscalated = t.status === 'escalated' || (t.escalation_level || 0) > 0;
  const isReopened = t.status === 'reopened';

  return `
    <div class="panel ticket-card ${isEscalated ? 'escalated' : ''} ${isReopened ? 'border-red' : ''}" data-ticket-link="${t.ticket_id}" style="margin-bottom:14px;cursor:pointer;">
      <div class="flex-between" style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="ticket-id" style="font-size:14px;">${t.ticket_id}</span>
          <span class="badge ${statusBadge}">${statusLabel}</span>
          ${t.urgency ? `<span class="badge badge-${t.urgency}">${t.urgency} urgency</span>` : ''}
          ${t.category ? `<span class="badge badge-cat">${categoryLabel(t.category)}</span>` : ''}
          ${isReopened ? `<span class="badge badge-reopened">Reopened (${t.reopened_count || 1}x)</span>` : ''}
        </div>
        <span class="ticket-age">${timeAgo(t.created_at * 1000 || t.created_at)}</span>
      </div>

      <div class="ticket-title" style="font-size:15px;margin-bottom:6px;">
        ${esc(t.title || t.complaint_text.slice(0, 60))}
      </div>

      <div class="complaint-text-block" style="margin-bottom:10px;padding:10px 14px;">
        <strong>Student Complaint:</strong> "${esc(t.complaint_text)}"
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
          Filed by: ${esc(t.student_name || 'Student')} | Location: <strong>${esc(t.location || 'Campus')}</strong>
        </div>
      </div>

      ${isReopened && t.verification_reason ? `
        <div style="background:var(--red-dim);border:1px solid rgba(239,68,68,0.2);padding:10px 14px;border-radius:var(--radius-md);margin-bottom:10px;font-size:12px;color:var(--red);">
          <strong>Student Rejection Feedback:</strong> "${esc(t.verification_reason)}"
        </div>
      ` : ''}

      ${t.routing_reasoning ? `
        <div style="font-size:11px;color:var(--cyan);background:var(--cyan-dim);padding:6px 12px;border-radius:var(--radius-sm);margin-bottom:10px;">
          🤖 <strong>Routing Agent:</strong> ${esc(t.routing_reasoning)}
        </div>
      ` : ''}

      ${t.status !== 'resolved_awaiting' && t.status !== 'closed' && !isEscalated ? `
        <div class="sla-bar-container" style="margin-bottom:12px;">
          <div class="sla-bar-track">
            <div class="sla-bar-fill" style="width:${pct}%;background:${slaBarColor(pct)}"></div>
          </div>
          <span class="sla-bar-label">${remaining > 0 ? formatCountdown(remaining) + ' SLA remaining' : 'SLA Breached'}</span>
        </div>
      ` : ''}

      ${isEscalated ? `
        <div style="font-size:12px;color:var(--red);background:var(--red-dim);padding:8px 12px;border-radius:var(--radius-sm);margin-bottom:12px;font-weight:600;">
          ⚠️ Escalated to: ${esc(t.escalated_to || 'Department Head')} | ${esc(t.escalation_note || 'SLA expired')}
        </div>
      ` : ''}

      ${t.resolution_note ? `
        <div style="font-size:12px;color:var(--text-secondary);background:var(--surface-3);padding:8px 12px;border-radius:var(--radius-sm);margin-bottom:12px;">
          <strong>Submitted Resolution:</strong> "${esc(t.resolution_note)}"
        </div>
      ` : ''}

      <!-- FACULTY ACTIONS -->
      <div class="action-bar" style="border-top:1px solid var(--border);padding-top:10px;margin-top:6px;">
        ${t.status === 'assigned' ? `
          <button class="btn btn-secondary btn-sm" data-start-work="${t.ticket_id}">▶ Start Work (In Progress)</button>
        ` : ''}
        ${t.status === 'in_progress' || t.status === 'reopened' || t.status === 'assigned' || t.status === 'escalated' ? `
          <button class="btn btn-primary btn-sm" data-resolve="${t.ticket_id}">✓ Mark Resolved (Submit Note)</button>
        ` : ''}
        ${t.status === 'resolved_awaiting' ? `
          <span style="font-size:12px;color:#c084fc;font-weight:600;display:flex;align-items:center;gap:6px;">
            <span class="spinner spinner-sm"></span> Awaiting Student Confirmation
          </span>
        ` : ''}
        ${t.status === 'closed' ? `
          <span style="font-size:12px;color:var(--green);font-weight:600;">✓ Verified & Closed by Student</span>
        ` : ''}
      </div>
    </div>
  `;
}
