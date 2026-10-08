import time
import json
from backend.database import get_db_connection, init_db, log_ticket_event, set_demo_mode

def seed_database():
    """Seed initial data with departments, staff directory, demo users, and realistic sample tickets."""
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

    # 1. Seed Departments
    departments = [
        ('DEPT_MAINT', 'Hostel Maintenance', 120, 'Chief Warden'),
        ('DEPT_MESS', 'Mess Committee', 90, 'Dean of Student Affairs'),
        ('DEPT_IT', 'IT & Networking', 60, 'Head of Computer Centre'),
        ('DEPT_ACAD', 'Academic Office', 240, 'Dean of Academics'),
        ('DEPT_SEC', 'Campus Security', 30, 'Chief Security Officer'),
        ('DEPT_WARDEN', 'Warden Office', 180, 'Dean of Student Affairs'),
    ]
    cursor.executemany('''
        INSERT INTO departments (id, name, default_sla_minutes, escalation_target, created_at)
        VALUES (?, ?, ?, ?, ?)
    ''', [(d[0], d[1], d[2], d[3], now) for d in departments])

    # 2. Seed Staff Directory
    staff_members = [
        ('STF-001', 'Ramesh Kumar', 'ramesh.maint@campus.edu', 'Maintenance Officer', 'DEPT_MAINT', json.dumps(["general maintenance", "appliances", "furniture", "Hostel 1", "Hostel 2"]), 1, 1, 14, 1800.0),
        ('STF-002', 'Suresh Nair', 'suresh.elec@campus.edu', 'Electrician', 'DEPT_MAINT', json.dumps(["electrical", "wiring", "plugs", "lighting", "appliances", "Hostel 1", "Hostel 2", "Block A", "Block B"]), 1, 1, 28, 1200.0),
        ('STF-003', 'Priya Sharma', 'priya.plumb@campus.edu', 'Plumbing Specialist', 'DEPT_MAINT', json.dumps(["plumbing", "water supply", "leakage", "washrooms", "Hostel 1", "Hostel 2", "Block C", "Block D"]), 1, 1, 19, 2100.0),
        ('STF-004', 'Anita Desai', 'anita.mess@campus.edu', 'Mess Supervisor', 'DEPT_MESS', json.dumps(["mess", "food quality", "hygiene", "catering", "Main Mess"]), 1, 1, 35, 950.0),
        ('STF-005', 'Vikram Iyer', 'vikram.food@campus.edu', 'Food Quality Officer', 'DEPT_MESS', json.dumps(["mess", "food safety", "nutrition", "dietary", "Main Mess"]), 1, 0, 12, 1400.0),
        ('STF-006', 'Arjun Mehta', 'arjun.net@campus.edu', 'Network Engineer', 'DEPT_IT', json.dumps(["wifi", "network", "internet", "router", "switch", "Block A", "Block B", "Block C", "Block D"]), 1, 1, 42, 800.0),
        ('STF-007', 'Sneha Patel', 'sneha.it@campus.edu', 'IT Support Specialist', 'DEPT_IT', json.dumps(["software", "portal", "hardware", "lab", "Library", "Academic Block"]), 1, 0, 22, 1100.0),
        ('STF-008', 'Dr. Kavitha Rao', 'kavitha.acad@campus.edu', 'Academic Coordinator', 'DEPT_ACAD', json.dumps(["academic", "grading", "courses", "examinations", "Academic Block"]), 1, 0, 16, 3600.0),
        ('STF-009', 'Prof. Sunil Bhat', 'sunil.sched@campus.edu', 'Scheduling Officer', 'DEPT_ACAD', json.dumps(["timetable", "classroom allocation", "clash", "scheduling", "Academic Block"]), 1, 1, 20, 2400.0),
        ('STF-010', 'Kavya Reddy', 'kavya.warden@campus.edu', 'Chief Warden', 'DEPT_WARDEN', json.dumps(["hostel discipline", "room allocation", "general warden", "safety"]), 1, 1, 8, 4800.0),
        ('STF-011', 'Capt. Rajeev Verma', 'rajeev.sec@campus.edu', 'Security Officer', 'DEPT_SEC', json.dumps(["security", "safety", "gate lock", "surveillance", "night patrol"]), 1, 0, 15, 600.0),
    ]
    cursor.executemany('''
        INSERT INTO staff (id, name, email, role, department_id, specializations, active, current_open_ticket_count, total_resolved_count, avg_resolution_seconds, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', [(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9], now) for s in staff_members])

    # 3. Seed Users
    users = [
        ('USR_STU_01', 'student_demo', 'Tatva (Student Demo)', 'student', None, None, now),
        ('USR_FAC_01', 'suresh_nair', 'Suresh Nair (Electrician)', 'faculty', 'DEPT_MAINT', 'STF-002', now),
        ('USR_FAC_02', 'anita_desai', 'Anita Desai (Mess Supervisor)', 'faculty', 'DEPT_MESS', 'STF-004', now),
        ('USR_FAC_03', 'arjun_mehta', 'Arjun Mehta (Network Engineer)', 'faculty', 'DEPT_IT', 'STF-006', now),
        ('USR_ADM_01', 'admin_demo', 'Dean of Student Affairs (Admin)', 'admin', None, None, now),
    ]
    cursor.executemany('''
        INSERT INTO users (id, username, name, role, department_id, staff_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', users)

    # 4. Seed Realistic Sample Tickets representing all 6 states
    # Note: timestamps are calculated relative to `now` for active demonstration
    sample_tickets = [
        {
            'ticket_id': 'CMP-100741',
            'student_id': 'STU-DEMO',
            'student_name': 'Aarav Sharma',
            'complaint_text': 'The plug in my room sparked when I tried to charge my laptop.',
            'title': 'Sparks from electrical socket',
            'category': 'electrical',
            'urgency': 'high',
            'priority': 'high',
            'location': 'Hostel 2',
            'department_id': 'DEPT_MAINT',
            'department_name': 'Hostel Maintenance',
            'assigned_staff_id': 'STF-002',
            'assigned_to': 'Suresh Nair',
            'status': 'assigned',
            'sla_seconds': 30,
            'sla_deadline': now + 25, # 25s remaining
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'Electrical hazard posing immediate shock/fire risk in student living quarters.',
            'routing_reasoning': 'Assigned to Hostel Maintenance -> Suresh Nair (Electrician) covering Hostel 2 with lowest active workload.',
            'created_at': now - 5,
            'updated_at': now - 5,
        },
        {
            'ticket_id': 'CMP-100742',
            'student_id': 'STU-DEMO',
            'student_name': 'Rohan Gupta',
            'complaint_text': 'WiFi in Block C keeps dropping every ten minutes during lecture hours.',
            'title': 'Frequent WiFi disconnection in Block C',
            'category': 'wifi',
            'urgency': 'medium',
            'priority': 'medium',
            'location': 'Block C',
            'department_id': 'DEPT_IT',
            'department_name': 'IT & Networking',
            'assigned_staff_id': 'STF-006',
            'assigned_to': 'Arjun Mehta',
            'status': 'in_progress',
            'sla_seconds': 60,
            'sla_deadline': now + 40,
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'Network instability affecting academic connectivity in classroom block.',
            'routing_reasoning': 'Routed to IT & Networking -> Arjun Mehta (Network Engineer) who manages Block C access points.',
            'created_at': now - 20,
            'updated_at': now - 10,
        },
        {
            'ticket_id': 'CMP-100743',
            'student_id': 'STU-DEMO',
            'student_name': 'Ananya Roy',
            'complaint_text': 'No water supply in Hostel 2 washrooms since morning. Morning routine severely impacted.',
            'title': 'No water supply in Hostel 2 washrooms',
            'category': 'plumbing',
            'urgency': 'critical',
            'priority': 'critical',
            'location': 'Hostel 2',
            'department_id': 'DEPT_MAINT',
            'department_name': 'Hostel Maintenance',
            'assigned_staff_id': 'STF-003',
            'assigned_to': 'Priya Sharma',
            'status': 'escalated',
            'sla_seconds': 20,
            'sla_deadline': now - 45, # Overdue
            'escalation_level': 1,
            'escalated_to': 'Chief Warden',
            'escalation_note': 'SLA exceeded without resolution. Escalated to Chief Warden for emergency intervention.',
            'intake_reasoning': 'Critical hygiene and living utility failure affecting multiple hostel residents.',
            'routing_reasoning': 'Assigned to Priya Sharma (Plumbing Specialist). Automatically escalated due to SLA breach.',
            'created_at': now - 65,
            'updated_at': now - 5,
        },
        {
            'ticket_id': 'CMP-100744',
            'student_id': 'STU-DEMO',
            'student_name': 'Meera Pillai',
            'complaint_text': 'Dinner dal smelled off again, second time this week at the Main Mess.',
            'title': 'Spoiled food in Main Mess dinner',
            'category': 'mess',
            'urgency': 'high',
            'priority': 'high',
            'location': 'Main Mess',
            'department_id': 'DEPT_MESS',
            'department_name': 'Mess Committee',
            'assigned_staff_id': 'STF-004',
            'assigned_to': 'Anita Desai',
            'status': 'resolved_awaiting',
            'sla_seconds': 30,
            'sla_deadline': now + 100,
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'Food quality issue in campus dining facility requiring supervisor inspection.',
            'routing_reasoning': 'Routed to Mess Committee -> Anita Desai (Mess Supervisor).',
            'resolution_note': 'Mess vendor inspected and discarded the compromised lentils batch. Head chef reprimanded and quality checklist enforced.',
            'resolved_at': now - 15,
            'created_at': now - 120,
            'updated_at': now - 15,
        },
        {
            'ticket_id': 'CMP-100745',
            'student_id': 'STU-DEMO',
            'student_name': 'Aditya Verma',
            'complaint_text': 'My DBMS lecture and the DSA lab are scheduled in the same room at 2 PM on Thursday.',
            'title': 'Timetable collision: DBMS & DSA lab',
            'category': 'timetable',
            'urgency': 'medium',
            'priority': 'medium',
            'location': 'Academic Block',
            'department_id': 'DEPT_ACAD',
            'department_name': 'Academic Office',
            'assigned_staff_id': 'STF-009',
            'assigned_to': 'Prof. Sunil Bhat',
            'status': 'reopened',
            'sla_seconds': 60,
            'sla_deadline': now + 35,
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'Course schedule conflict preventing attendance in required engineering modules.',
            'routing_reasoning': 'Routed to Academic Office -> Prof. Sunil Bhat (Scheduling Officer).',
            'student_verification': 'rejected',
            'verification_reason': 'The lab slot was moved, but the room allocation still shows Room 204 for both sections on the student portal.',
            'reopened_count': 1,
            'created_at': now - 300,
            'updated_at': now - 25,
        },
        {
            'ticket_id': 'CMP-100740',
            'student_id': 'STU-DEMO',
            'student_name': 'Tatva (Student Demo)',
            'complaint_text': 'Someone broke the lock on the bicycle shed near Block A gate.',
            'title': 'Damaged bicycle shed lock',
            'category': 'security',
            'urgency': 'medium',
            'priority': 'medium',
            'location': 'Block A',
            'department_id': 'DEPT_MAINT',
            'department_name': 'Hostel Maintenance',
            'assigned_staff_id': 'STF-001',
            'assigned_to': 'Ramesh Kumar',
            'status': 'closed',
            'sla_seconds': 60,
            'sla_deadline': now - 600,
            'escalation_level': 0,
            'escalated_to': None,
            'escalation_note': None,
            'intake_reasoning': 'Physical security infrastructure failure near campus residential perimeter.',
            'routing_reasoning': 'Assigned to Ramesh Kumar (Maintenance Officer).',
            'resolution_note': 'Replaced heavy-duty padlock and distributed new keys to security desk.',
            'resolved_at': now - 400,
            'student_verification': 'verified',
            'closed_at': now - 350,
            'created_at': now - 1200,
            'updated_at': now - 350,
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
        "Hostel 2 Infrastructure & Dining Quality Cluster Identified",
        "Autonomous analysis detected high correlation of electrical & plumbing incidents originating from Hostel 2 over the past 48 hours. Furthermore, recurring dining complaints in the Main Mess indicate urgent supplier audit required. SLA breach rate in Hostel Maintenance is currently 16.7%.",
        json.dumps(["hostel-2", "electrical-hazard", "mess-quality", "sla-warning"]),
        json.dumps({"active_tickets": 5, "escalation_rate": "16.7%", "top_location": "Hostel 2", "top_category": "electrical"}),
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
    print("[CampusSOS] Database seeded successfully.")

if __name__ == '__main__':
    seed_database()
