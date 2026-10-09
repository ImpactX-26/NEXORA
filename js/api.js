// ============================================================
// CampusSOS v2 — API Service Layer
// All backend calls go through here.
// API key stays strictly on the server — never in browser.
// ============================================================

const BASE = (typeof window !== 'undefined' && window.location.origin.includes(':'))
  ? window.location.origin
  : 'http://localhost:5500';

async function apiPost(endpoint, body = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status} from ${endpoint}`);
  }
  return res.json();
}

async function apiGet(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status} from ${endpoint}`);
  }
  return res.json();
}

// ── Authentication Endpoints ────────────────────────────────
export async function loginApi(username, password, portal = '') {
  return apiPost('/api/auth/login', {
    username,
    password,
    portal,
  });
}

export async function fetchDemoAccounts() {
  return apiGet('/api/auth/demo-accounts');
}

// ── System & Health Endpoints ───────────────────────────────
export async function checkHealth() {
  return apiGet('/api/health');
}

export async function getConfig() {
  return apiGet('/api/config');
}

export async function setDemoModeApi(enabled) {
  return apiPost('/api/demo/mode', { demo_mode: enabled });
}

export async function resetDemoDataApi() {
  return apiPost('/api/demo/reset', {});
}

// ── Ticket Endpoints ─────────────────────────────────────────
export async function fetchTickets(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiGet(`/api/tickets${query ? `?${query}` : ''}`);
}

export async function fetchTicketById(ticketId) {
  return apiGet(`/api/tickets/${encodeURIComponent(ticketId)}`);
}

export async function submitComplaintTicket({ complaint_text, student_name, location, student_id }) {
  return apiPost('/api/tickets', {
    complaint_text,
    student_name,
    location,
    student_id: student_id || 'USR_STU_01',
  });
}

// ── Faculty / Staff Workflow Endpoints ──────────────────────
export async function fetchFacultyList() {
  return apiGet('/api/faculty/list');
}

export async function fetchFacultyTickets(staffNameOrId) {
  return apiGet(`/api/faculty/${encodeURIComponent(staffNameOrId)}/tickets`);
}

export async function acceptTicketApi(ticketId, actorName) {
  return apiPost(`/api/tickets/${encodeURIComponent(ticketId)}/accept`, {
    actor_name: actorName,
  });
}

export async function startWorkApi(ticketId, actorName) {
  return apiPost(`/api/tickets/${encodeURIComponent(ticketId)}/start_work`, {
    actor_name: actorName,
  });
}

export async function resolveTicketApi(ticketId, actorName, resolutionNote) {
  return apiPost(`/api/tickets/${encodeURIComponent(ticketId)}/resolve`, {
    actor_name: actorName,
    resolution_note: resolutionNote,
  });
}

// ── Student Verification Endpoints ──────────────────────────
export async function verifyResolutionApi(ticketId) {
  return apiPost(`/api/tickets/${encodeURIComponent(ticketId)}/verify`, {});
}

export async function rejectResolutionApi(ticketId, reason) {
  return apiPost(`/api/tickets/${encodeURIComponent(ticketId)}/reject`, {
    verification_reason: reason,
  });
}

// ── Admin Dashboard & Insight Endpoints ─────────────────────
export async function fetchAdminDashboard() {
  return apiGet('/api/admin/dashboard');
}

export async function fetchAdminActivity() {
  return apiGet('/api/admin/activity');
}

export async function fetchInsightsHistory() {
  return apiGet('/api/admin/insights');
}

export async function triggerInsightReportApi() {
  return apiPost('/api/admin/insight', {});
}

// ── Individual Agent Direct Endpoints (Compatibility) ───────
export async function intakeAgent(complaintText) {
  return apiPost('/api/intake', { text: complaintText });
}

export async function routingAgent(intakeResult, location) {
  return apiPost('/api/route', { intake: intakeResult, location });
}

export async function escalationAgent() {
  return apiPost('/api/escalate', {});
}

export async function insightAgent() {
  return apiPost('/api/insight', {});
}
