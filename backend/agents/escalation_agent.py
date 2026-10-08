import time
import json
from backend.database import get_db_connection

# Escalation Hierarchy configuration
ESCALATION_CHAIN = {
    'DEPT_MAINT': ['Maintenance Officer in Charge', 'Chief Warden', 'Estate Officer & Dean'],
    'DEPT_MESS':  ['Mess Committee Convenor', 'Dean of Student Affairs', 'Director Office'],
    'DEPT_IT':    ['Head of Computer Centre', 'Dean of Infrastructure', 'Director Office'],
    'DEPT_ACAD':  ['Department HOD', 'Dean of Academics', 'Director Office'],
    'DEPT_SEC':   ['Chief Security Officer', 'Dean of Student Affairs', 'Campus Director'],
    'DEPT_WARDEN':['Chief Warden', 'Dean of Student Affairs', 'Campus Director'],
    'DEFAULT':    ['Department Head', 'Dean of Student Affairs', 'Campus Director']
}

def check_and_escalate_tickets() -> list:
    """
    Agent 3: Escalation Agent.
    Periodically checks all active, unresolved tickets.
    If current_time > sla_deadline and escalation_level < MAX,
    it automatically increases escalation level, assigns escalation target, updates status to 'escalated',
    and records an activity log event.
    Returns list of escalated tickets in this pass.
    """
    now = time.time()
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Query active tickets that have breached SLA and are not closed/verified/resolved_awaiting
        # and have not reached maximum escalation level (max level = 3)
        cursor.execute('''
            SELECT t.id, t.ticket_id, t.title, t.complaint_text, t.category, t.urgency,
                   t.department_id, t.department_name, t.assigned_to, t.status,
                   t.sla_deadline, t.sla_seconds, t.escalation_level, t.escalated_to,
                   d.escalation_target as dept_escalation_target
            FROM tickets t
            LEFT JOIN departments d ON t.department_id = d.id
            WHERE t.status NOT IN ('resolved_awaiting', 'verified', 'closed')
              AND ? > t.sla_deadline
              AND t.escalation_level < 3
        ''', (now,))

        breached_tickets = cursor.fetchall()
        escalated_results = []

        for t in breached_tickets:
            ticket_id = t['ticket_id']
            current_level = t['escalation_level'] or 0
            new_level = current_level + 1
            dept_id = t['department_id'] or 'DEFAULT'

            # Determine escalation target from chain
            chain = ESCALATION_CHAIN.get(dept_id, ESCALATION_CHAIN['DEFAULT'])
            target_idx = min(new_level - 1, len(chain) - 1)
            escalate_to = chain[target_idx]

            # Generate escalation reason note
            seconds_overdue = int(now - t['sla_deadline'])
            escalation_note = (
                f"Autonomous Escalation [Level {new_level}]: SLA deadline of {t['sla_seconds']}s exceeded by "
                f"{seconds_overdue}s. Ticket escalated from {t['assigned_to'] or 'Department'} "
                f"to {escalate_to} for priority intervention."
            )

            # Update database
            cursor.execute('''
                UPDATE tickets
                SET status = 'escalated',
                    escalation_level = ?,
                    escalated_to = ?,
                    escalation_note = ?,
                    updated_at = ?
                WHERE ticket_id = ?
            ''', (new_level, escalate_to, escalation_note, now, ticket_id))

            # Log decision event using same cursor
            details_str = json.dumps({
                'new_level': new_level,
                'escalated_to': escalate_to,
                'seconds_overdue': seconds_overdue,
                'previous_handler': t['assigned_to']
            })

            cursor.execute('''
                INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
                VALUES (?, 'ESCALATED', 'Escalation Agent', ?, ?, ?)
            ''', (ticket_id, escalation_note, details_str, now))

            escalated_results.append({
                'ticket_id': ticket_id,
                'new_level': new_level,
                'escalated_to': escalate_to,
                'message': escalation_note
            })
            print(f"[Escalation Agent] {ticket_id} automatically escalated to {escalate_to} (Level {new_level})")

        conn.commit()
        return escalated_results
    finally:
        conn.close()
