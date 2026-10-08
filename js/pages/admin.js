// ============================================================
// CampusSOS v2 — Admin Dashboard & Insight Hub
// Real metrics from SQLite + Insight Agent analysis
// ============================================================

import {
  getTickets, getAgentLog, getInsightCache,
  isDemoMode, STATUS, STATUS_LABELS, STATUS_BADGE
} from '../state.js';
import {
  runInsightDigest, toggleDemoMode, resetDemoData,
  onTicketChange
} from '../engine.js';
import { fetchAdminDashboard } from '../api.js';
import { navigate } from '../router.js';
import {
  timeAgo, formatDateTime, categoryLabel,
  showToast, showConfirm, esc
} from '../utils.js';

export function renderAdminDashboard(container) {
  let unsubscribe;
  let dashboardData = null;
  let isLoading = false;
  let statusFilter = 'all';

  async function loadData() {
    try {
      dashboardData = await fetchAdminDashboard();
    } catch (err) {
      console.warn('Dashboard fetch fallback:', err);
    }
    render();
  }

  function render() {
    const tickets = getTickets();
    const liveLogs = getAgentLog();
    const insight = getInsightCache() || (dashboardData?.latest_insight);
    const metrics = dashboardData?.metrics || {
      total: tickets.length,
      active: tickets.filter(t => !['closed', 'verified'].includes(t.status)).length,
      escalated: tickets.filter(t => t.status === 'escalated' || (t.escalation_level || 0) > 0).length,
      resolved_awaiting: tickets.filter(t => t.status === 'resolved_awaiting').length,
      closed: tickets.filter(t => ['closed', 'verified'].includes(t.status)).length,
      reopened: tickets.filter(t => (t.reopened_count || 0) > 0).length,
      breach_rate: '0%'
    };

    const departments = dashboardData?.departments || [];

    // Filter tickets
    let filteredTickets = tickets;
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') filteredTickets = tickets.filter(t => !['closed', 'verified'].includes(t.status));
      else if (statusFilter === 'escalated') filteredTickets = tickets.filter(t => t.status === 'escalated' || (t.escalation_level || 0) > 0);
      else if (statusFilter === 'reopened') filteredTickets = tickets.filter(t => (t.reopened_count || 0) > 0);
      else filteredTickets = tickets.filter(t => t.status === statusFilter);
    }

    const shell = container.querySelector('#admin-dashboard-shell');
    if (shell) {
      updateDynamicAdminSections(container, metrics, insight, departments, filteredTickets, liveLogs);
      return;
    }

    container.innerHTML = `
      <div id="admin-dashboard-shell">
        <div class="page-header flex-between">
          <div>
            <h1>Institutional Governance & Admin Dashboard</h1>
            <p>Real-time SLA surveillance, multi-agent activity log, and autonomous pattern intelligence.</p>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <button class="btn btn-secondary btn-sm" id="btn-reset-demo">↺ Reset Demo Data</button>
            <button class="btn btn-primary btn-sm" id="btn-run-insight">
              ✨ Run Insight Agent
            </button>
          </div>
        </div>

        <!-- METRIC CARDS -->
        <div id="admin-metrics-container" class="stats-bar"></div>

        <!-- INSIGHT AGENT REPORT -->
        <div id="admin-insight-container"></div>

        <div class="grid-2col">
          <!-- LEFT COLUMN: TICKET DIRECTORY & SCORECARDS -->
          <div class="left-content">
            <!-- DEPARTMENT SCORECARD -->
            <section class="panel">
              <div class="panel-header">
                <div class="panel-title">Department SLA Scorecard</div>
                <span class="text-xs text-muted" id="dept-count-badge">${departments.length} Units</span>
              </div>
              <div id="admin-scorecard-container"></div>
            </section>

            <!-- TICKET DIRECTORY TABLE -->
            <section class="panel">
              <div class="panel-header">
                <div class="panel-title">Master Ticket Directory</div>
                <div style="display:flex;gap:6px;">
                  <select id="status-filter-select" class="form-select" style="padding:4px 24px 4px 8px;font-size:11px;">
                    <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Tickets</option>
                    <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>Active Only</option>
                    <option value="escalated" ${statusFilter === 'escalated' ? 'selected' : ''}>Escalated Only</option>
                    <option value="reopened" ${statusFilter === 'reopened' ? 'selected' : ''}>Reopened Only</option>
                    <option value="resolved_awaiting" ${statusFilter === 'resolved_awaiting' ? 'selected' : ''}>Awaiting Verification</option>
                    <option value="closed" ${statusFilter === 'closed' ? 'selected' : ''}>Closed</option>
                  </select>
                </div>
              </div>

              <div style="overflow-x:auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Issue</th>
                      <th>Location</th>
                      <th>Department & Staff</th>
                      <th>Status</th>
                      <th>SLA</th>
                    </tr>
                  </thead>
                  <tbody id="admin-tbody-container"></tbody>
                </table>
              </div>
            </section>
          </div>

          <!-- RIGHT COLUMN: REAL-TIME AGENT ACTIVITY LOG STREAM -->
          <aside class="right-sidebar">
            <div class="panel">
              <div class="panel-header">
                <div class="panel-title">Real-Time Autonomous Agent Stream</div>
                <span class="badge badge-classified">Live Feed</span>
              </div>
              <div id="admin-logs-container" style="max-height: 580px; overflow-y: auto; padding-right: 4px;"></div>
            </div>
          </aside>
        </div>
      </div>
    `;

    // Bind Filter
    const filterSelect = container.querySelector('#status-filter-select');
    filterSelect?.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      render();
    });

    // Bind Reset Demo
    container.querySelector('#btn-reset-demo')?.addEventListener('click', async () => {
      const ok = await showConfirm(
        'Reset Demo Data?',
        'This will restore clean seed tickets (covering electrical, plumbing, mess, wifi, timetable, and security scenarios).',
        'Reset Database',
        true
      );
      if (ok) {
        await resetDemoData();
        await loadData();
      }
    });

    // Bind Run Insight Agent
    const btnInsight = container.querySelector('#btn-run-insight');
    btnInsight?.addEventListener('click', async () => {
      btnInsight.disabled = true;
      btnInsight.innerHTML = '<span class="spinner spinner-sm"></span> Analyzing...';
      try {
        await runInsightDigest();
        await loadData();
      } catch (e) {
        showToast(`Insight error: ${e.message}`, 'error');
      }
      btnInsight.disabled = false;
      btnInsight.textContent = '✨ Run Insight Agent';
    });

    updateDynamicAdminSections(container, metrics, insight, departments, filteredTickets, liveLogs);
  }

  function updateDynamicAdminSections(container, metrics, insight, departments, filteredTickets, liveLogs) {
    // 1. Metrics
    const metricsEl = container.querySelector('#admin-metrics-container');
    if (metricsEl) {
      metricsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Total Grievances</div>
          <div class="stat-value">${metrics.total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Workload</div>
          <div class="stat-value accent">${metrics.active}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">SLA Breach Rate</div>
          <div class="stat-value" style="color:${metrics.escalated > 0 ? 'var(--red)' : 'var(--green)'};">
            ${metrics.breach_rate}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Escalated Tickets</div>
          <div class="stat-value" style="color:var(--red);">${metrics.escalated}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Awaiting Verification</div>
          <div class="stat-value" style="color:#c084fc;">${metrics.resolved_awaiting}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Reopened by Students</div>
          <div class="stat-value" style="color:var(--orange);">${metrics.reopened}</div>
        </div>
      `;
    }

    // 2. Insight
    const insightEl = container.querySelector('#admin-insight-container');
    if (insightEl) {
      insightEl.innerHTML = `
        <section class="panel" style="border-color: rgba(0,200,150,0.3); background: rgba(0,200,150,0.02); margin-bottom: 20px;">
          <div class="panel-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:16px;">🤖</span>
              <div class="panel-title" style="color:var(--cyan);">Autonomous Insight Agent Report</div>
            </div>
            <span class="text-xs text-muted">
              ${insight ? timeAgo(insight.created_at) : 'Not yet generated'}
            </span>
          </div>
          ${insight ? `
            <div class="insight-headline">${esc(insight.headline)}</div>
            <div class="insight-body" style="white-space:pre-line;">${esc(insight.body)}</div>
            <div class="insight-tags">
              ${(insight.tags || []).map(t => `<span class="insight-tag">#${esc(t)}</span>`).join('')}
            </div>
          ` : `
            <div class="empty-state" style="padding:20px 0;">
              <div>Click <strong>Run Insight Agent</strong> to autonomously analyze database grievance hotspots and SLA trends using Groq LLM.</div>
            </div>
          `}
        </section>
      `;
    }

    // 3. Scorecard
    const scorecardEl = container.querySelector('#admin-scorecard-container');
    const deptCountEl = container.querySelector('#dept-count-badge');
    if (deptCountEl) deptCountEl.textContent = `${departments.length} Units`;
    if (scorecardEl) {
      scorecardEl.innerHTML = departments.map(d => {
        const total = d.total || 1;
        const escPct = Math.round((d.escalated / total) * 100);
        const color = escPct > 20 ? 'var(--red)' : (escPct > 0 ? 'var(--orange)' : 'var(--green)');
        return `
          <div class="scorecard-row">
            <div class="flex-between">
              <div class="scorecard-dept">${esc(d.name)}</div>
              <span style="font-size:12px;font-weight:600;color:${color};">${d.breach_rate} breach</span>
            </div>
            <div class="scorecard-avg">Escalation target: <strong>${esc(d.escalation_target)}</strong></div>
            <div class="scorecard-bar-wrap">
              <div class="scorecard-bar" style="width:${Math.max(5, escPct)}%;background:${color};"></div>
            </div>
            <div class="scorecard-meta">
              <span>Total: <strong>${d.total}</strong></span>
              <span>Active: <strong>${d.open}</strong></span>
              <span>Resolved: <strong>${d.resolved}</strong></span>
              <span>Escalated: <strong>${d.escalated}</strong></span>
            </div>
          </div>
        `;
      }).join('');
    }

    // 4. Table body
    const tbodyEl = container.querySelector('#admin-tbody-container');
    if (tbodyEl) {
      tbodyEl.innerHTML = filteredTickets.length === 0
        ? `<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">No tickets match filter.</td></tr>`
        : filteredTickets.map(t => {
          const statusBadge = STATUS_BADGE[t.status] || 'badge-submitted';
          const statusLabel = STATUS_LABELS[t.status] || t.status;
          const remaining = t.seconds_until_escalation ?? t.sla_seconds ?? 60;
          return `
            <tr style="cursor:pointer;" data-ticket-link="${t.ticket_id}">
              <td class="cell-id">${t.ticket_id}</td>
              <td>
                <div style="font-weight:600;color:var(--text-primary);">${esc(t.title || t.complaint_text.slice(0, 35))}</div>
                <div style="font-size:10px;color:var(--text-muted);">${categoryLabel(t.category)} | ${t.urgency}</div>
              </td>
              <td>${esc(t.location || 'Campus')}</td>
              <td>
                <div style="font-size:11px;font-weight:500;">${esc(t.department_name || '--')}</div>
                <div style="font-size:10px;color:var(--text-muted);">${esc(t.assigned_to || 'Unassigned')}</div>
              </td>
              <td>
                <span class="badge ${statusBadge}">${statusLabel}</span>
              </td>
              <td>
                ${t.status === 'escalated' || (t.escalation_level || 0) > 0
                  ? `<span style="color:var(--red);font-weight:700;font-size:11px;">⚠️ Level ${t.escalation_level}</span>`
                  : (['closed', 'verified', 'resolved_awaiting'].includes(t.status)
                    ? `<span style="color:var(--text-muted);font-size:11px;">Completed</span>`
                    : `<span style="font-family:var(--font-mono);font-size:11px;color:${remaining <= 10 ? 'var(--red)' : 'var(--green)'};">${remaining}s</span>`
                  )
                }
              </td>
            </tr>
          `;
        }).join('');
    }

    // 5. Activity Log Stream
    const logsEl = container.querySelector('#admin-logs-container');
    if (logsEl) {
      logsEl.innerHTML = liveLogs.length === 0
        ? '<div class="empty-state">No activity logged yet.</div>'
        : liveLogs.map(l => {
          const tagClass = `log-tag-${(l.type || '').toLowerCase()}`;
          return `
            <div class="log-entry">
              <span class="log-tag ${tagClass}">${esc(l.type || 'EVENT')}</span>
              ${l.ticket_id && l.ticket_id !== 'SYSTEM' ? `<span class="log-ticket-id" data-ticket-link="${l.ticket_id}" style="cursor:pointer;">${l.ticket_id}</span>` : ''}
              <span class="log-text" title="${esc(l.text)}">${esc(l.text)}</span>
              <span class="log-ts">${timeAgo(l.ts || Date.now())}</span>
            </div>
          `;
        }).join('');
    }

    // Bind Ticket Link clicks
    container.querySelectorAll('[data-ticket-link]').forEach(el => {
      el.onclick = () => {
        navigate(`/ticket/${el.dataset.ticketLink}`);
      };
    });
  }

  loadData();
  unsubscribe = onTicketChange(render);

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
