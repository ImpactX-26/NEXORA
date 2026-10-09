import time
import json
from backend.database import get_db_connection, init_db, log_ticket_event, set_demo_mode

def seed_database():
    """Seed initial data with departments, staff directory, demo users, and realistic sample tickets without personal names."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute('DELETE FROM ticket_events;')
    cursor.execute('DELETE FROM tickets;')
    cursor.execute('DELETE FROM users;')
    cursor.execute('DELETE FROM staff;')
    cursor.execute('DELETE FROM departments;')
    cursor.execute('DELETE FROM insights;')

    now = time.time()

    # 1. Seed 4 Core Departments
    departments = [
        ('DEPT_ELEC', 'Electrical Maintenance', 60, 'Chief Electrical Engineer'),
        ('DEPT_IT', 'IT & Network Operations', 60, 'Head of Computer Centre'),
        ('DEPT_EXEC', 'Office of the Vice Principal', 15, 'Disciplinary Governing Council'),
        ('DEPT_GRO', 'Grievance Redressal Cell', 120, 'Institutional Ombudsperson'),
    ]
    cursor.executemany('''
        INSERT INTO departments (id, name, default_sla_minutes, escalation_target, created_at)
        VALUES (?, ?, ?, ?, ?)
    ''', [(d[0], d[1], d[2], d[3], now) for d in departments])

    # 2. Seed 4 Official Staff Designations (No personal names)
    staff_members = [
        (
            'STF-ELEC', 'Campus Electrician', 'electrician@campus.edu', 'Campus Electrician',
            'DEPT_ELEC',
            json.dumps(["electrical", "wiring", "sockets", "sparking", "lighting", "appliances", "power cut", "voltage", "blackout", "circuit breaker", "Block A", "Block B", "Block C", "Block D", "Hostel 1", "Hostel 2"]),
            1, 1, 28, 1200.0
        ),
        (
            'STF-NET', 'Network Engineer', 'network.engineer@campus.edu', 'Network Engineer',
            'DEPT_IT',
            json.dumps(["wifi", "network", "internet", "router", "switch", "ethernet", "lan", "bandwidth", "disconnect", "gateway", "dns", "Block A", "Block B", "Block C", "Block D", "Lab"]),
            1, 1, 42, 800.0
        ),
        (
            'STF-VP', 'Vice Principal', 'viceprincipal@campus.edu', 'Vice Principal (Discipline & Anti-Ragging)',
            'DEPT_EXEC',
            json.dumps(["bullying", "ragging", "campus crime", "assault", "violence", "threat", "harassment", "extortion", "student discipline", "anti-ragging", "safety", "Hostel 1", "Hostel 2", "Block A", "Block B", "Block C", "Block D"]),
            1, 1, 32, 600.0
        ),
        (
            'STF-GRO', 'Grievance Redressal Officer', 'grievance.officer@campus.edu', 'Grievance Redressal Officer',
            'DEPT_GRO',
            json.dumps(["unfair treatment", "academic problems", "harassment", "administrative failures", "unresolved disputes", "discrimination", "evaluation bias", "scholarship delay", "faculty misconduct", "grading dispute", "arbitrary penalty", "attendance dispute"]),
            1, 1, 25, 1800.0
        ),
    ]
    cursor.executemany('''
        INSERT INTO staff (id, name, email, role, department_id, specializations, active, current_open_ticket_count, total_resolved_count, avg_resolution_seconds, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', [(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9], now) for s in staff_members])

    # 3. Seed Users with fixed login credentials (No personal names)
    users = [
        # Student Portal Accounts (Password: student123)
        ('USR_STU_01', 'student', 'student123', 'Student #101', 'student', None, None, now),
        ('USR_STU_02', 'student2', 'student123', 'Student #102', 'student', None, None, now),
        ('USR_STU_03', 'student3', 'student123', 'Student #103', 'student', None, None, now),
        ('USR_STU_04', 'student4', 'student123', 'Student #104', 'student', None, None, now),

        # Staff Portal Accounts (Password: staff123)
        ('USR_FAC_01', 'electrician', 'staff123', 'Campus Electrician', 'faculty', 'DEPT_ELEC', 'STF-ELEC', now),
        ('USR_FAC_02', 'staff', 'staff123', 'Campus Electrician', 'faculty', 'DEPT_ELEC', 'STF-ELEC', now),
        ('USR_FAC_03', 'network', 'staff123', 'Network Engineer', 'faculty', 'DEPT_IT', 'STF-NET', now),
        ('USR_FAC_04', 'viceprincipal', 'staff123', 'Vice Principal', 'faculty', 'DEPT_EXEC', 'STF-VP', now),
        ('USR_FAC_05', 'grievance', 'staff123', 'Grievance Redressal Officer', 'faculty', 'DEPT_GRO', 'STF-GRO', now),

        # Admin Portal Account (Password: admin123)
        ('USR_ADM_01', 'admin', 'admin123', 'Dean of Student Welfare (Admin)', 'admin', None, None, now),
    ]
    cursor.executemany('''
        INSERT INTO users (id, username, password, name, role, department_id, staff_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', users)

    # 4. Seed Realistic Sample Tickets representing the 4 core categories and workflows
    sample_tickets = [
        {
            'ticket_id': 'CMP-100741',
            'student_id': 'USR_STU_02',
            'student_name': 'Student #102',
            'complaint_text': 'The electrical socket in Room 204 sparked and tripped the main circuit breaker when plugging in a laptop charger.',
            'title': 'Sparks from electrical socket',
            'category': 'electrical',
            'urgency': 'high',
            'priority': 'high',
            'location': 'Hostel 2',
            'department_id': 'DEPT_ELEC',
            'department_name': 'Electrical Maintenance',
            'assigned_staff_id': 'STF-ELEC',
            'assigned_to': 'Campus Electrician',
            'status': 'assigned',
            'sla_seconds': 30,
            'sla_deadline': now + 25, # 25s remaining
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'Electrical short circuit risk posing safety hazard in student living quarters.',
            'routing_reasoning': 'Assigned to Electrical Maintenance -> Campus Electrician with immediate response protocol.',
            'created_at': now - 5,
            'updated_at': now - 5,
        },
        {
            'ticket_id': 'CMP-100742',
            'student_id': 'USR_STU_03',
            'student_name': 'Student #103',
            'complaint_text': 'Campus Wi-Fi in Block C keeps dropping every ten minutes during online lecture and laboratory hours.',
            'title': 'Frequent Wi-Fi disconnection in Block C',
            'category': 'wifi',
            'urgency': 'medium',
            'priority': 'medium',
            'location': 'Block C',
            'department_id': 'DEPT_IT',
            'department_name': 'IT & Network Operations',
            'assigned_staff_id': 'STF-NET',
            'assigned_to': 'Network Engineer',
            'status': 'in_progress',
            'sla_seconds': 60,
            'sla_deadline': now + 40,
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'Network instability affecting academic connectivity in classroom block.',
            'routing_reasoning': 'Routed to IT & Network Operations -> Network Engineer who manages campus access points.',
            'created_at': now - 20,
            'updated_at': now - 10,
        },
        {
            'ticket_id': 'CMP-100743',
            'student_id': 'USR_STU_04',
            'student_name': 'Student #104',
            'complaint_text': 'Core distribution switch in the Campus Server Room experienced a power surge and primary fiber uplink disconnected.',
            'title': 'Core switch fault in Server Room',
            'category': 'wifi',
            'urgency': 'critical',
            'priority': 'critical',
            'location': 'Server Room',
            'department_id': 'DEPT_IT',
            'department_name': 'IT & Network Operations',
            'assigned_staff_id': 'STF-NET',
            'assigned_to': 'Network Engineer',
            'status': 'escalated',
            'sla_seconds': 20,
            'sla_deadline': now - 45, # Overdue
            'escalation_level': 1,
            'escalated_to': 'Head of Computer Centre',
            'escalation_note': 'SLA exceeded without resolution. Escalated to Head of Computer Centre for priority network restoration.',
            'intake_reasoning': 'High-priority network infrastructure failure impacting campus-wide connectivity.',
            'routing_reasoning': 'Direct Routing: High-priority server facility. Assigned to Network Engineer.',
            'created_at': now - 65,
            'updated_at': now - 5,
        },
        {
            'ticket_id': 'CMP-100744',
            'student_id': 'USR_STU_01',
            'student_name': 'Student #101',
            'complaint_text': 'Air conditioning unit and digital display projectors in Central Library Computer Lab are malfunctioning during study hours.',
            'title': 'AC & display repair in Library Computer Lab',
            'category': 'electrical',
            'urgency': 'high',
            'priority': 'high',
            'location': 'Library',
            'department_id': 'DEPT_ELEC',
            'department_name': 'Electrical Maintenance',
            'assigned_staff_id': 'STF-ELEC',
            'assigned_to': 'Campus Electrician',
            'status': 'resolved_awaiting',
            'sla_seconds': 30,
            'sla_deadline': now + 100,
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'High-priority academic facility electrical issue affecting laboratory workstation equipment.',
            'routing_reasoning': 'Routed to Electrical Maintenance -> Campus Electrician for expedited maintenance.',
            'resolution_note': 'Inspected HVAC circuit board and replaced faulty capacitor. Display projector power supplies calibrated and functioning.',
            'resolved_at': now - 15,
            'created_at': now - 120,
            'updated_at': now - 15,
        },
        {
            'ticket_id': 'CMP-100745',
            'student_id': 'USR_STU_01',
            'student_name': 'Student #101',
            'complaint_text': 'Course registration portal session timeout glitch resolved after database index maintenance by academic systems team.',
            'title': 'Course portal session timeout resolved',
            'category': 'grievance_redressal',
            'urgency': 'medium',
            'priority': 'medium',
            'location': 'Academic Block',
            'department_id': 'DEPT_GRO',
            'department_name': 'Grievance Redressal Cell',
            'assigned_staff_id': 'STF-GRO',
            'assigned_to': 'Grievance Redressal Officer',
            'status': 'verified',
            'sla_seconds': 60,
            'sla_deadline': now - 600,
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'Academic systems support grievance regarding digital portal accessibility.',
            'routing_reasoning': 'Assigned to Grievance Redressal Officer for academic coordination.',
            'resolution_note': 'Academic systems team cleared cached session locks and optimized database connection pool. Portal operating normally.',
            'resolved_at': now - 400,
            'student_verification': 'verified',
            'closed_at': now - 350,
            'created_at': now - 1200,
            'updated_at': now - 350,
        },
        {
            'ticket_id': 'CMP-100746',
            'student_id': 'USR_STU_02',
            'student_name': 'Student #102',
            'complaint_text': 'Ceiling fan regulator shorted out and produced burning odor in the common study hall.',
            'title': 'Shorted fan regulator & burning odor',
            'category': 'electrical',
            'urgency': 'medium',
            'priority': 'medium',
            'location': 'Hostel 1',
            'department_id': 'DEPT_ELEC',
            'department_name': 'Electrical Maintenance',
            'assigned_staff_id': 'STF-ELEC',
            'assigned_to': 'Campus Electrician',
            'status': 'reopened',
            'sla_seconds': 60,
            'sla_deadline': now + 35,
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'Electrical component fault in hostel facility.',
            'routing_reasoning': 'Assigned to Electrical Maintenance -> Campus Electrician.',
            'student_verification': 'rejected',
            'verification_reason': 'Technician inspected the switchboard but the regulator is still sparking when turned to speed 4.',
            'reopened_count': 1,
            'created_at': now - 300,
            'updated_at': now - 25,
        }
    ]

    for t in sample_tickets:
        cursor.execute('''
            INSERT INTO tickets (
                ticket_id, student_id, student_name, complaint_text, title, category,
                urgency, priority, location, department_id, department_name,
                assigned_staff_id, assigned_to, status, sla_deadline, sla_seconds,
                escalation_level, escalated_to, escalation_note, intake_reasoning,
                routing_reasoning, resolution_note, student_verification, verification_reason,
                reopened_count, created_at, updated_at, resolved_at, closed_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?
            )
        ''', (
            t['ticket_id'], t['student_id'], t['student_name'], t['complaint_text'], t.get('title'), t.get('category'),
            t.get('urgency'), t.get('priority'), t.get('location'), t.get('department_id'), t.get('department_name'),
            t.get('assigned_staff_id'), t.get('assigned_to'), t['status'], t['sla_deadline'], t['sla_seconds'],
            t.get('escalation_level', 0), t.get('escalated_to'), t.get('escalation_note'), t.get('intake_reasoning'),
            t.get('routing_reasoning'), t.get('resolution_note'), t.get('student_verification'), t.get('verification_reason'),
            t.get('reopened_count', 0), t['created_at'], t['updated_at'], t.get('resolved_at'), t.get('closed_at')
        ))

        # Add timeline events for each ticket
        cursor.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES (?, 'INTAKE', 'Intake Agent', ?, '{}', ?)
        ''', (t['ticket_id'], f"Classified as {t['category']} / {t['urgency']} urgency: {t.get('intake_reasoning')}", t['created_at']))

        if t.get('assigned_to'):
            cursor.execute('''
                INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
                VALUES (?, 'ROUTED', 'Routing Agent', ?, '{}', ?)
            ''', (t['ticket_id'], t.get('routing_reasoning', f"Assigned to {t['department_name']} -> {t['assigned_to']}"), t['created_at'] + 1))

        if t['status'] == 'escalated':
            cursor.execute('''
                INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
                VALUES (?, 'ESCALATED', 'Escalation Agent', ?, '{}', ?)
            ''', (t['ticket_id'], t.get('escalation_note', 'Auto-escalated due to SLA deadline expiration.'), t['updated_at']))

        if t.get('resolution_note'):
            cursor.execute('''
                INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
                VALUES (?, 'RESOLVED', ?, ?, '{}', ?)
            ''', (t['ticket_id'], t.get('assigned_to', 'Faculty Staff'), f"Marked resolved: {t.get('resolution_note')}", t.get('resolved_at', t['updated_at'])))

        if t.get('student_verification') == 'verified':
            cursor.execute('''
                INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
                VALUES (?, 'VERIFIED', 'Student', 'Student confirmed resolution. Ticket closed successfully.', '{}', ?)
            ''', (t['ticket_id'], t.get('closed_at', t['updated_at'])))

        if t.get('student_verification') == 'rejected':
            cursor.execute('''
                INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
                VALUES (?, 'REOPENED', 'Student', ?, '{}', ?)
            ''', (t['ticket_id'], f"Student rejected resolution: {t.get('verification_reason')}", t['updated_at']))

    # 5. Seed initial Insight report
    cursor.execute('''
        INSERT INTO insights (headline, body, tags_json, metrics_json, created_at)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        "Electrical & Academic Grievance Cluster Identified",
        "Autonomous analysis detected high volume of electrical maintenance inquiries across Hostel residential blocks alongside persistent administrative follow-ups in the Grievance Redressal Cell. Anti-ragging protocols remain actively monitored under executive escalation.",
        json.dumps(["electrical-maintenance", "academic-grievance", "anti-ragging", "sla-surveillance"]),
        json.dumps({"active_tickets": 4, "escalation_rate": "16.7%", "top_location": "Hostel 2", "top_category": "electrical"}),
        now - 300
    ))

    # Set default demo mode
    cursor.execute('''
        INSERT INTO system_config (key, value, updated_at)
        VALUES ('demo_mode', 'true', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    ''', (now,))

    conn.commit()
    conn.close()
    print("[CampusSOS] Database seeded successfully with 4 core roles.")

if __name__ == '__main__':
    seed_database()
