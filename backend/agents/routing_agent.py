import json
import sqlite3
from backend.config import Config
from backend.database import get_db_connection

# Department mapping for categories
CATEGORY_TO_DEPT = {
    'electrical': 'DEPT_MAINT',
    'plumbing':   'DEPT_MAINT',
    'hostel':     'DEPT_MAINT',
    'mess':       'DEPT_MESS',
    'wifi':       'DEPT_IT',
    'timetable':  'DEPT_ACAD',
    'academic':   'DEPT_ACAD',
    'security':   'DEPT_SEC',
    'other':      'DEPT_WARDEN'
}

def route_ticket(intake_result: dict, location: str = 'Campus') -> dict:
    """
    Agent 2: Routing Agent.
    Routes classified ticket to a REAL database staff member.
    Enforces zero-hallucination guarantee by querying SQLite for candidate staff and scoring them.
    """
    category = intake_result.get('category', 'other')
    urgency = intake_result.get('urgency', 'medium')
    title = intake_result.get('title', '')
    complaint_summary = intake_result.get('summary', '')

    target_dept_id = CATEGORY_TO_DEPT.get(category, 'DEPT_WARDEN')

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Query department details
        dept_row = cursor.execute("SELECT * FROM departments WHERE id = ?", (target_dept_id,)).fetchone()
        if not dept_row:
            dept_row = cursor.execute("SELECT * FROM departments LIMIT 1").fetchone()
            target_dept_id = dept_row['id']

        dept_name = dept_row['name']

        # Query all active staff in this department
        staff_rows = cursor.execute('''
            SELECT id, name, email, role, department_id, specializations, active,
                   current_open_ticket_count, total_resolved_count, avg_resolution_seconds
            FROM staff
            WHERE department_id = ? AND active = 1
            ORDER BY current_open_ticket_count ASC
        ''', (target_dept_id,)).fetchall()

        # If no staff in this dept, fallback to any active staff in database
        if not staff_rows:
            staff_rows = cursor.execute('''
                SELECT id, name, email, role, department_id, specializations, active,
                       current_open_ticket_count, total_resolved_count, avg_resolution_seconds
                FROM staff
                WHERE active = 1
                ORDER BY current_open_ticket_count ASC
            ''').fetchall()

        # Prepare candidate pool
        candidates = []
        for r in staff_rows:
            try:
                specs = json.loads(r['specializations']) if r['specializations'] else []
            except Exception:
                specs = [s.strip() for s in (r['specializations'] or '').split(',') if s.strip()]
                
            candidates.append({
                'id': r['id'],
                'name': r['name'],
                'role': r['role'],
                'department_id': r['department_id'],
                'specializations': specs,
                'workload': r['current_open_ticket_count'],
                'resolved_count': r['total_resolved_count'],
                'avg_resolution_seconds': r['avg_resolution_seconds']
            })
    finally:
        conn.close()

    if not candidates:
        return {
            'department_id': target_dept_id,
            'department_name': dept_name,
            'assigned_staff_id': None,
            'assigned_to': 'Unassigned (No active staff)',
            'routing_reasoning': f"Complaint categorized as {category}. Routed to {dept_name}, but no active staff were found in directory.",
            'avg_close_hours': 24
        }

    # Deterministic scoring algorithm:
    # 1. Specialization match (+6 for category keyword match, +4 for location match)
    # 2. Workload balance (-2 per open ticket)
    # 3. Track record (+1 per 10 resolved tickets)
    best_candidate = None
    best_score = -9999
    score_breakdown = {}

    loc_lower = (location or '').lower()
    cat_lower = category.lower()

    for cand in candidates:
        score = 0
        reasons = []

        spec_text = ' '.join(cand['specializations']).lower() + ' ' + cand['role'].lower()
        if cat_lower in spec_text or any(k in spec_text for k in [cat_lower, 'electric' if cat_lower == 'electrical' else cat_lower, 'plumb' if cat_lower == 'plumbing' else cat_lower]):
            score += 6
            reasons.append(f"role/specialization matches '{category}'")

        if loc_lower and loc_lower in spec_text:
            score += 4
            reasons.append(f"covers location '{location}'")

        workload = cand['workload']
        score -= workload * 2
        if workload == 0:
            reasons.append("has 0 active tickets")
        else:
            reasons.append(f"current workload: {workload} active tickets")

        if cand['resolved_count'] > 0:
            score += min(3, cand['resolved_count'] // 10)

        score_breakdown[cand['id']] = (score, reasons)

        if score > best_score:
            best_score = score
            best_candidate = cand

    selected_staff = best_candidate or candidates[0]
    staff_id = selected_staff['id']
    staff_name = selected_staff['name']
    staff_role = selected_staff['role']
    cand_reasons = score_breakdown.get(staff_id, (0, []))[1]
    reason_str = ', '.join(cand_reasons) if cand_reasons else f"assigned based on department availability and lowest current workload ({selected_staff['workload']} tickets)"

    routing_explanation = (
        f"Routing Agent assigned complaint to {dept_name} -> {staff_name} ({staff_role}) "
        f"because {reason_str}."
    )

    avg_close_hours = round(max(1.0, selected_staff.get('avg_resolution_seconds', 3600) / 3600.0), 1)

    return {
        'department_id': target_dept_id,
        'department_name': dept_name,
        'assigned_staff_id': staff_id,
        'assigned_to': staff_name,
        'staff_role': staff_role,
        'routing_reasoning': routing_explanation,
        'avg_close_hours': avg_close_hours
    }
