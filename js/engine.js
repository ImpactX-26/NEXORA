// ============================================================
// CampusSOS v2 — Ticket Engine
// Connects frontend actions to Flask REST backend
// ============================================================

import {
  setTickets, updateLocalTicket, setFacultyList,
  setAgentLog, setInsightCache, setBackendStatus,
  pushLog, getState, STATUS
} from './state.js';
import {
  fetchTickets, fetchTicketById, submitComplaintTicket,
  acceptTicketApi, startWorkApi, resolveTicketApi,
  verifyResolutionApi, rejectResolutionApi,
  fetchFacultyList, fetchAdminActivity, triggerInsightReportApi,
  checkHealth, setDemoModeApi, resetDemoDataApi
} from './api.js';
import { showToast } from './utils.js';

const listeners = new Set();
export function onTicketChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function emitChange() {
  listeners.forEach(fn => fn());
}

// ── Background Sync Loop ────────────────────────────────────
let syncTimer = null;

export async function syncFromBackend() {
  try {
    const [health, tickets, faculty, logs] = await Promise.all([
      checkHealth().catch(() => ({ status: 'down', groq_key_set: false })),
      fetchTickets().catch(() => []),
      fetchFacultyList().catch(() => []),
      fetchAdminActivity().catch(() => []),
    ]);

    const isUp = health && health.status === 'ok';
    setBackendStatus(isUp, health?.groq_key_set || false);

    if (tickets && tickets.length >= 0) {
      setTickets(tickets);
    }
    if (faculty && faculty.length > 0) {
      setFacultyList(faculty);
    }
    if (logs && logs.length > 0) {
      setAgentLog(logs);
    }

    emitChange();
  } catch (err) {
    console.warn('[CampusSOS Sync Error]', err);
    setBackendStatus(false, false);
    emitChange();
  }
}

export function startBackgroundSync(intervalMs = 2500) {
  if (syncTimer) clearInterval(syncTimer);
  syncFromBackend();
  syncTimer = setInterval(syncFromBackend, intervalMs);
}

// ── Student Complaint Filing ────────────────────────────────
export async function fileComplaint(text, name, location) {
  showToast('Intake Agent analyzing grievance...', 'info');
  const user = getState().currentUser;
  
  try {
    const createdTicket = await submitComplaintTicket({
      complaint_text: text,
      student_name: name || user?.name || 'Student',
      location: location || 'Campus',
      student_id: user?.id || 'USR_STU_01',
    });

    updateLocalTicket(createdTicket);
    pushLog('INTAKE', createdTicket.ticket_id, `Classified as ${createdTicket.category} / ${createdTicket.urgency}`);
    pushLog('ROUTED', createdTicket.ticket_id, createdTicket.routing_reasoning || `Routed to ${createdTicket.department_name}`);
    
    showToast(`${createdTicket.ticket_id} routed to ${createdTicket.assigned_to}`, 'success');
    emitChange();
    return createdTicket;
  } catch (err) {
    showToast(`Filing error: ${err.message}`, 'error');
    throw err;
  }
}

// ── Faculty Actions ─────────────────────────────────────────
export async function acceptTicketAction(ticketId, facultyName) {
  try {
    await acceptTicketApi(ticketId, facultyName);
    showToast(`${ticketId} accepted`, 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Error accepting ticket: ${err.message}`, 'error');
  }
}

export async function startWorkAction(ticketId, facultyName) {
  try {
    await startWorkApi(ticketId, facultyName);
    showToast(`${ticketId} marked In Progress`, 'info');
    await syncFromBackend();
  } catch (err) {
    showToast(`Error updating status: ${err.message}`, 'error');
  }
}

export async function resolveTicketAction(ticketId, facultyName, resolutionNote) {
  try {
    const res = await resolveTicketApi(ticketId, facultyName, resolutionNote);
    showToast(`${ticketId} marked resolved — Awaiting student verification`, 'success');
    await syncFromBackend();
    return res;
  } catch (err) {
    showToast(`Error resolving ticket: ${err.message}`, 'error');
    throw err;
  }
}

// ── Student Verification ────────────────────────────────────
export async function verifyResolutionAction(ticketId) {
  try {
    await verifyResolutionApi(ticketId);
    showToast(`${ticketId} verified and closed!`, 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Verification error: ${err.message}`, 'error');
  }
}

export async function rejectResolutionAction(ticketId, reason) {
  try {
    await rejectResolutionApi(ticketId, reason);
    showToast(`${ticketId} reopened and returned to active workflow`, 'warn');
    await syncFromBackend();
  } catch (err) {
    showToast(`Rejection error: ${err.message}`, 'error');
  }
}

// ── Insights & Demo Actions ─────────────────────────────────
export async function runInsightDigest() {
  showToast('Insight Agent analyzing campus grievance patterns...', 'info');
  try {
    const result = await triggerInsightReportApi();
    setInsightCache(result);
    showToast('Campus intelligence report generated', 'success');
    emitChange();
    return result;
  } catch (err) {
    showToast(`Insight Agent error: ${err.message}`, 'error');
    throw err;
  }
}

export async function toggleDemoMode(enabled) {
  try {
    const res = await setDemoModeApi(enabled);
    showToast(res.message || 'SLA mode updated', 'info');
    await syncFromBackend();
  } catch (err) {
    showToast(`Mode switch error: ${err.message}`, 'error');
  }
}

export async function resetDemoData() {
  try {
    await resetDemoDataApi();
    showToast('Database reset with sample demo scenarios', 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Reset error: ${err.message}`, 'error');
  }
}
