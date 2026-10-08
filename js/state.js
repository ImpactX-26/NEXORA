// ============================================================
// CampusSOS v2 — State Management
// Central store for tickets, logs, role context, and app state
// Synchronized with Flask backend
// ============================================================

const STORAGE_KEY = 'campussos_v2_prefs';

// Status flow constants
export const STATUS = {
  SUBMITTED:   'submitted',
  CLASSIFIED:  'classified',
  ASSIGNED:    'assigned',
  IN_PROGRESS: 'in_progress',
  RESOLVED:    'resolved_awaiting',
  VERIFIED:    'verified',
  CLOSED:      'closed',
  REOPENED:    'reopened',
  ESCALATED:   'escalated',
};

export const STATUS_LABELS = {
  [STATUS.SUBMITTED]:   'Submitted',
  [STATUS.CLASSIFIED]:  'Classified',
  [STATUS.ASSIGNED]:    'Assigned',
  [STATUS.IN_PROGRESS]: 'In Progress',
  [STATUS.RESOLVED]:    'Awaiting Verification',
  [STATUS.VERIFIED]:    'Verified',
  [STATUS.CLOSED]:      'Closed',
  [STATUS.REOPENED]:    'Reopened',
  [STATUS.ESCALATED]:   'Escalated',
};

export const STATUS_BADGE = {
  [STATUS.SUBMITTED]:   'badge-submitted',
  [STATUS.CLASSIFIED]:  'badge-classified',
  [STATUS.ASSIGNED]:    'badge-assigned',
  [STATUS.IN_PROGRESS]: 'badge-inprogress',
  [STATUS.RESOLVED]:    'badge-awaiting',
  [STATUS.VERIFIED]:    'badge-verified',
  [STATUS.CLOSED]:      'badge-closed',
  [STATUS.REOPENED]:    'badge-reopened',
  [STATUS.ESCALATED]:   'badge-escalated',
};

let state = {
  tickets: [],
  facultyList: [],
  currentFaculty: 'Suresh Nair', // default demo faculty
  currentFacultyId: 'STF-002',
  currentRole: 'student',        // 'student' | 'faculty' | 'admin'
  demoMode: true,
  agentLog: [],
  insightCache: null,
  backendConnected: false,
  groqKeySet: false,
};

// Listeners for state change
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notify() {
  listeners.forEach(fn => fn(state));
}

// ── Getters ─────────────────────────────────────────────────
export function getState() { return state; }
export function getTickets() { return state.tickets; }
export function getTicketById(id) {
  return state.tickets.find(t => t.ticket_id === id || String(t.id) === String(id));
}
export function getFacultyList() { return state.facultyList; }
export function getCurrentFaculty() { return state.currentFaculty; }
export function getCurrentFacultyId() { return state.currentFacultyId; }
export function getCurrentRole() { return state.currentRole; }
export function isDemoMode() { return state.demoMode; }
export function getAgentLog() { return state.agentLog; }
export function getInsightCache() { return state.insightCache; }
export function isBackendConnected() { return state.backendConnected; }

// ── Setters ─────────────────────────────────────────────────
export function setTickets(tickets) {
  state.tickets = tickets || [];
  notify();
}

export function updateLocalTicket(ticket) {
  const idx = state.tickets.findIndex(t => t.ticket_id === ticket.ticket_id);
  if (idx >= 0) {
    state.tickets[idx] = { ...state.tickets[idx], ...ticket };
  } else {
    state.tickets.unshift(ticket);
  }
  notify();
}

export function setFacultyList(list) {
  state.facultyList = list || [];
  notify();
}

export function setCurrentFaculty(name, id = null) {
  state.currentFaculty = name;
  if (id) state.currentFacultyId = id;
  else {
    const f = state.facultyList.find(s => s.name === name);
    if (f) state.currentFacultyId = f.id;
  }
  savePrefs();
  notify();
}

export function setCurrentRole(role) {
  state.currentRole = role;
  savePrefs();
  notify();
}

export function setDemoMode(on) {
  state.demoMode = on;
  savePrefs();
  notify();
}

export function setAgentLog(logs) {
  state.agentLog = logs || [];
  notify();
}

export function pushLog(type, ticketId, text) {
  state.agentLog.unshift({
    type,
    ticket_id: ticketId,
    text,
    ts: Date.now()
  });
  if (state.agentLog.length > 100) state.agentLog.pop();
  notify();
}

export function setInsightCache(data) {
  state.insightCache = data;
  notify();
}

export function setBackendStatus(connected, groqKeySet = false) {
  state.backendConnected = connected;
  state.groqKeySet = groqKeySet;
  notify();
}

// ── Persistence for preferences ─────────────────────────────
function savePrefs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      currentRole: state.currentRole,
      currentFaculty: state.currentFaculty,
      currentFacultyId: state.currentFacultyId,
      demoMode: state.demoMode,
    }));
  } catch (e) {}
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.currentRole) state.currentRole = parsed.currentRole;
      if (parsed.currentFaculty) state.currentFaculty = parsed.currentFaculty;
      if (parsed.currentFacultyId) state.currentFacultyId = parsed.currentFacultyId;
      if (typeof parsed.demoMode === 'boolean') state.demoMode = parsed.demoMode;
    }
  } catch (e) {}
}
