import time
import json
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from backend.config import Config
from backend.database import (
    get_db_connection, init_db, log_ticket_event,
    is_demo_mode, set_demo_mode
)
from backend.seed_data import seed_database
from backend.scheduler import EscalationScheduler
from backend.agents import (
    analyze_complaint, route_ticket,
    check_and_escalate_tickets, generate_insights
)

def create_app():
    # Base directory where frontend files reside
    static_folder = Path(__file__).resolve().parent.parent

    app = Flask(__name__, static_folder=str(static_folder), static_url_path='')
    CORS(app)

    # Initialize SQLite database schema
    init_db()

    # If database is empty, automatically seed initial demo data
    conn = get_db_connection()
    count = conn.execute("SELECT COUNT(*) as cnt FROM tickets").fetchone()['cnt']
    conn.close()
    if count == 0:
        seed_database()

    # Start autonomous background escalation scheduler
    EscalationScheduler.start()

    @app.after_request
    def add_no_cache_headers(response):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
        return response

    # ── STATIC FRONTEND ROUTES ──────────────────────────────────
    @app.route('/')
    def serve_index():
        return send_from_directory(static_folder, 'index.html')

    @app.route('/styles.css')
    def serve_css():
        return send_from_directory(static_folder, 'styles.css')

    @app.route('/js/<path:filename>')
    def serve_js(filename):
        return send_from_directory(static_folder / 'js', filename)

    # ── SYSTEM & HEALTH ROUTES ───────────────────────────────────
    @app.route('/api/health', methods=['GET'])
    def health_check():
        groq_set = bool(Config.GROQ_API_KEY and Config.GROQ_API_KEY != 'your_groq_api_key_here')
        return jsonify({
            'status': 'ok',
            'system': 'CampusSOS v2 Autonomous Backend',
            'groq_key_set': groq_set,
            'demo_mode': is_demo_mode(),
            'timestamp': time.time()
        })

    @app.route('/api/config', methods=['GET'])
    def get_config():
        return jsonify({
            'demo_mode': is_demo_mode(),
            'demo_sla': Config.DEMO_SLA,
            'real_sla': Config.REAL_SLA
        })

    @app.route('/api/demo/mode', methods=['POST'])
    def toggle_demo_mode():
        data = request.get_json() or {}
        enabled = bool(data.get('demo_mode', True))
        set_demo_mode(enabled)
        return jsonify({
            'success': True,
            'demo_mode': is_demo_mode(),
            'message': f"System switched to {'Demo' if enabled else 'Real'} SLA Mode."
        })

    @app.route('/api/demo/reset', methods=['POST'])
    def reset_demo_data():
        seed_database()
        return jsonify({
            'success': True,
            'message': 'Database reset with deterministic demo scenario tickets, departments, and staff.'
        })

    # ── TICKETS API ──────────────────────────────────────────────
    @app.route('/api/tickets', methods=['POST'])
    def create_complaint_ticket():
        """Student files a complaint -> runs Intake Agent -> runs Routing Agent -> saves to DB."""
        data = request.get_json() or {}
        text = (data.get('complaint_text') or data.get('text') or '').strip()
        student_name = (data.get('student_name') or data.get('name') or 'Anonymous Student').strip()
        location = (data.get('location') or 'Campus').strip()
        student_id = (data.get('student_id') or 'STU-DEMO').strip()

        if not text:
            return jsonify({'error': 'Complaint text is required.'}), 400

        now = time.time()

        # 1. RUN AGENT 1: Intake Agent (Groq LLM Reasoning)
        intake_res = analyze_complaint(text)

        # 2. RUN AGENT 2: Routing Agent (DB Candidate Selection - No Hallucinations)
        routing_res = route_ticket(intake_res, location)

        # Determine SLA duration
        urgency = intake_res.get('urgency', 'medium')
        sla_dict = Config.DEMO_SLA if is_demo_mode() else Config.REAL_SLA
        sla_seconds = sla_dict.get(urgency, 60)
        sla_deadline = now + sla_seconds

        department_id = routing_res.get('department_id')
        department_name = routing_res.get('department_name')
        assigned_staff_id = routing_res.get('assigned_staff_id')
        assigned_to = routing_res.get('assigned_to')

        # Open connection and do atomic insertion
        conn = get_db_connection()
        cursor = conn.cursor()

        last_id_row = cursor.execute("SELECT MAX(id) as max_id FROM tickets").fetchone()
        next_seq = (last_id_row['max_id'] or 100) + 1
        ticket_id = f"CMP-{(next_seq * 7 + 100000):06d}"

        # Insert Ticket
        cursor.execute('''
            INSERT INTO tickets (
                ticket_id, student_id, student_name, complaint_text, title, category,
                urgency, priority, location, department_id, department_name,
                assigned_staff_id, assigned_to, status, sla_deadline, sla_seconds,
                escalation_level, intake_reasoning, routing_reasoning,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?, 0, ?, ?, ?, ?)
        ''', (
            ticket_id, student_id, student_name, text, intake_res.get('title'), intake_res.get('category'),
            urgency, urgency, location, department_id, department_name,
            assigned_staff_id, assigned_to, sla_deadline, sla_seconds,
            intake_res.get('reasoning'), routing_res.get('routing_reasoning'),
            now, now
        ))

        # Update staff workload count
        if assigned_staff_id:
            cursor.execute('''
                UPDATE staff
                SET current_open_ticket_count = current_open_ticket_count + 1
                WHERE id = ?
            ''', (assigned_staff_id,))

        # Log Activity Events
        cursor.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES (?, 'INTAKE', 'Intake Agent', ?, ?, ?)
        ''', (ticket_id, f"Classified as {intake_res.get('category')} ({urgency} urgency): {intake_res.get('reasoning')}", json.dumps(intake_res), now))

        cursor.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES (?, 'ROUTED', 'Routing Agent', ?, ?, ?)
        ''', (ticket_id, routing_res.get('routing_reasoning'), json.dumps(routing_res), now + 0.5))

        conn.commit()

        # Fetch created ticket
        ticket_row = cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,)).fetchone()
        ticket_dict = dict(ticket_row)
        conn.close()

        return jsonify(ticket_dict), 201

    @app.route('/api/tickets', methods=['GET'])
    def list_tickets():
        status_filter = request.args.get('status')
        dept_filter = request.args.get('department_id')
        staff_filter = request.args.get('assigned_staff_id')
        student_filter = request.args.get('student_id')
        category_filter = request.args.get('category')

        conn = get_db_connection()
        query = "SELECT * FROM tickets WHERE 1=1"
        params = []

        if status_filter:
            query += " AND status = ?"
            params.append(status_filter)
        if dept_filter:
            query += " AND department_id = ?"
            params.append(dept_filter)
        if staff_filter:
            query += " AND assigned_staff_id = ?"
            params.append(staff_filter)
        if student_filter:
            query += " AND student_id = ?"
            params.append(student_filter)
        if category_filter:
            query += " AND category = ?"
            params.append(category_filter)

        query += " ORDER BY created_at DESC"
        rows = conn.execute(query, params).fetchall()

        now = time.time()
        tickets = []
        for r in rows:
            d = dict(r)
            # Add live computed remaining seconds until escalation
            sla_sec = d['sla_seconds'] or 60
            deadline = d['sla_deadline']
            d['seconds_until_escalation'] = max(0, int(deadline - now))
            tickets.append(d)

        conn.close()
        return jsonify(tickets)

    @app.route('/api/tickets/<ticket_id>', methods=['GET'])
    def get_ticket_details(ticket_id):
        conn = get_db_connection()
        t_row = conn.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,)).fetchone()
        if not t_row:
            conn.close()
            return jsonify({'error': f"Ticket {ticket_id} not found."}), 404

        ticket = dict(t_row)
        now = time.time()
        ticket['seconds_until_escalation'] = max(0, int(ticket['sla_deadline'] - now))

        # Fetch timeline events
        events = conn.execute('''
            SELECT event_type, actor, message, details_json, created_at
            FROM ticket_events
            WHERE ticket_id = ?
            ORDER BY created_at ASC
        ''', (ticket_id,)).fetchall()

        timeline = []
        for e in events:
            timeline.append({
                'type': e['event_type'].lower(),
                'agent': e['actor'],
                'text': e['message'],
                'timestamp': int(e['created_at'] * 1000)
            })

        ticket['timeline'] = timeline
        conn.close()
        return jsonify(ticket)

    # ── FACULTY / STAFF ACTIONS ──────────────────────────────────
    @app.route('/api/tickets/<ticket_id>/accept', methods=['POST'])
    def accept_ticket(ticket_id):
        data = request.get_json() or {}
        actor_name = data.get('actor_name') or 'Faculty Member'
        now = time.time()

        conn = get_db_connection()
        cursor = conn.cursor()
        t_row = cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,)).fetchone()
        if not t_row:
            conn.close()
            return jsonify({'error': 'Ticket not found'}), 404

        cursor.execute('''
            UPDATE tickets
            SET status = 'assigned', updated_at = ?
            WHERE ticket_id = ?
        ''', (now, ticket_id))

        cursor.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES (?, 'ACTION', ?, ?, '{}', ?)
        ''', (ticket_id, actor_name, f"{actor_name} accepted the complaint assignment.", now))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'ticket_id': ticket_id, 'status': 'assigned'})

    @app.route('/api/tickets/<ticket_id>/start_work', methods=['POST'])
    def start_work_on_ticket(ticket_id):
        data = request.get_json() or {}
        actor_name = data.get('actor_name') or 'Faculty Member'
        now = time.time()

        conn = get_db_connection()
        cursor = conn.cursor()
        t_row = cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,)).fetchone()
        if not t_row:
            conn.close()
            return jsonify({'error': 'Ticket not found'}), 404

        cursor.execute('''
            UPDATE tickets
            SET status = 'in_progress', updated_at = ?
            WHERE ticket_id = ?
        ''', (now, ticket_id))

        cursor.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES (?, 'ACTION', ?, ?, '{}', ?)
        ''', (ticket_id, actor_name, f"{actor_name} started working on the issue.", now))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'ticket_id': ticket_id, 'status': 'in_progress'})

    @app.route('/api/tickets/<ticket_id>/resolve', methods=['POST'])
    def resolve_ticket(ticket_id):
        """Staff marks ticket as resolved. Moves to RESOLVED_AWAITING_VERIFICATION (NOT CLOSED)."""
        data = request.get_json() or {}
        actor_name = data.get('actor_name') or 'Faculty Staff'
        resolution_note = (data.get('resolution_note') or '').strip()

        if not resolution_note:
            return jsonify({'error': 'Resolution note is required.'}), 400

        now = time.time()
        conn = get_db_connection()
        cursor = conn.cursor()

        t_row = cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,)).fetchone()
        if not t_row:
            conn.close()
            return jsonify({'error': 'Ticket not found'}), 404

        # Update ticket status to 'resolved_awaiting'
        cursor.execute('''
            UPDATE tickets
            SET status = 'resolved_awaiting',
                resolution_note = ?,
                resolved_at = ?,
                updated_at = ?
            WHERE ticket_id = ?
        ''', (resolution_note, now, now, ticket_id))

        # Update staff metrics
        if t_row['assigned_staff_id']:
            duration = now - t_row['created_at']
            cursor.execute('''
                UPDATE staff
                SET current_open_ticket_count = MAX(0, current_open_ticket_count - 1),
                    total_resolved_count = total_resolved_count + 1,
                    avg_resolution_seconds = (avg_resolution_seconds * total_resolved_count + ?) / (total_resolved_count + 1)
                WHERE id = ?
            ''', (duration, t_row['assigned_staff_id']))

        cursor.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES (?, 'RESOLVED', ?, ?, '{}', ?)
        ''', (ticket_id, actor_name, f"Resolution submitted by {actor_name}: \"{resolution_note}\" (Awaiting Student Verification)", now))

        conn.commit()
        conn.close()
        return jsonify({
            'success': True,
            'ticket_id': ticket_id,
            'status': 'resolved_awaiting',
            'message': 'Resolution submitted. Ticket is awaiting student verification.'
        })

    # ── STUDENT VERIFICATION WORKFLOW ────────────────────────────
    @app.route('/api/tickets/<ticket_id>/verify', methods=['POST'])
    def verify_ticket_resolution(ticket_id):
        """Student confirms issue is fixed -> closes ticket."""
        now = time.time()
        conn = get_db_connection()
        cursor = conn.cursor()

        t_row = cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,)).fetchone()
        if not t_row:
            conn.close()
            return jsonify({'error': 'Ticket not found'}), 404

        if t_row['status'] == 'closed':
            conn.close()
            return jsonify({'error': 'Ticket is already closed.'}), 400

        cursor.execute('''
            UPDATE tickets
            SET status = 'closed',
                student_verification = 'verified',
                closed_at = ?,
                updated_at = ?
            WHERE ticket_id = ?
        ''', (now, now, ticket_id))

        cursor.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES (?, 'VERIFIED', 'Student', 'Student confirmed resolution. Ticket closed.', '{}', ?)
        ''', (ticket_id, now))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'ticket_id': ticket_id, 'status': 'closed'})

    @app.route('/api/tickets/<ticket_id>/reject', methods=['POST'])
    def reject_ticket_resolution(ticket_id):
        """Student rejects resolution -> reopens ticket and restarts SLA monitor."""
        data = request.get_json() or {}
        reason = (data.get('verification_reason') or data.get('reason') or 'Issue persists.').strip()
        now = time.time()

        conn = get_db_connection()
        cursor = conn.cursor()

        t_row = cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,)).fetchone()
        if not t_row:
            conn.close()
            return jsonify({'error': 'Ticket not found'}), 404

        # Reset SLA deadline for reopened ticket
        sla_seconds = t_row['sla_seconds'] or 60
        new_deadline = now + sla_seconds

        cursor.execute('''
            UPDATE tickets
            SET status = 'reopened',
                student_verification = 'rejected',
                verification_reason = ?,
                reopened_count = COALESCE(reopened_count, 0) + 1,
                resolved_at = NULL,
                resolution_note = NULL,
                sla_deadline = ?,
                updated_at = ?
            WHERE ticket_id = ?
        ''', (reason, new_deadline, now, ticket_id))

        cursor.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES (?, 'REOPENED', 'Student', ?, '{}', ?)
        ''', (ticket_id, f"Student rejected resolution: \"{reason}\". Ticket reopened into active workflow.", now))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'ticket_id': ticket_id, 'status': 'reopened'})

    # ── FACULTY / DIRECTORY API ──────────────────────────────────
    @app.route('/api/faculty/list', methods=['GET'])
    def list_faculty():
        conn = get_db_connection()
        staff_members = conn.execute('''
            SELECT s.*, d.name as department_name
            FROM staff s
            LEFT JOIN departments d ON s.department_id = d.id
            ORDER BY s.name ASC
        ''').fetchall()
        result = [dict(s) for s in staff_members]
        conn.close()
        return jsonify(result)

    @app.route('/api/faculty/<staff_name_or_id>/tickets', methods=['GET'])
    def get_faculty_assigned_tickets(staff_name_or_id):
        conn = get_db_connection()
        rows = conn.execute('''
            SELECT * FROM tickets
            WHERE assigned_staff_id = ? OR assigned_to = ?
            ORDER BY created_at DESC
        ''', (staff_name_or_id, staff_name_or_id)).fetchall()

        now = time.time()
        tickets = []
        for r in rows:
            d = dict(r)
            d['seconds_until_escalation'] = max(0, int(d['sla_deadline'] - now))
            tickets.append(d)

        conn.close()
        return jsonify(tickets)

    # ── ADMIN DASHBOARD API ──────────────────────────────────────
    @app.route('/api/admin/dashboard', methods=['GET'])
    def admin_dashboard_summary():
        """Calculate real live metrics from SQLite database."""
        conn = get_db_connection()
        tickets = conn.execute("SELECT * FROM tickets").fetchall()
        departments = conn.execute("SELECT * FROM departments").fetchall()
        events = conn.execute("SELECT * FROM ticket_events ORDER BY created_at DESC LIMIT 25").fetchall()
        latest_insight = conn.execute("SELECT * FROM insights ORDER BY created_at DESC LIMIT 1").fetchone()

        total = len(tickets)
        active = len([t for t in tickets if t['status'] not in ('closed', 'verified')])
        assigned = len([t for t in tickets if t['status'] == 'assigned'])
        in_progress = len([t for t in tickets if t['status'] == 'in_progress'])
        resolved_awaiting = len([t for t in tickets if t['status'] == 'resolved_awaiting'])
        closed = len([t for t in tickets if t['status'] in ('closed', 'verified')])
        escalated = len([t for t in tickets if t['status'] == 'escalated' or (t['escalation_level'] or 0) > 0])
        reopened = len([t for t in tickets if (t['reopened_count'] or 0) > 0])

        breach_rate = round((escalated / total * 100), 1) if total > 0 else 0.0

        # Calculate Department Scorecards
        dept_cards = []
        for d in departments:
            d_id = d['id']
            d_name = d['name']
            dept_tickets = [t for t in tickets if t['department_id'] == d_id]
            d_total = len(dept_tickets)
            d_open = len([t for t in dept_tickets if t['status'] not in ('closed', 'verified')])
            d_resolved = len([t for t in dept_tickets if t['status'] in ('closed', 'verified', 'resolved_awaiting')])
            d_escalated = len([t for t in dept_tickets if t['status'] == 'escalated' or (t['escalation_level'] or 0) > 0])
            d_breach_rate = round((d_escalated / d_total * 100), 1) if d_total > 0 else 0.0

            dept_cards.append({
                'id': d_id,
                'name': d_name,
                'total': d_total,
                'open': d_open,
                'resolved': d_resolved,
                'escalated': d_escalated,
                'breach_rate': f"{d_breach_rate}%",
                'escalation_target': d['escalation_target']
            })

        # Activity stream
        activity_stream = []
        for e in events:
            activity_stream.append({
                'ticket_id': e['ticket_id'],
                'type': e['event_type'],
                'actor': e['actor'],
                'text': e['message'],
                'ts': int(e['created_at'] * 1000)
            })

        insight_data = None
        if latest_insight:
            try:
                tags = json.loads(latest_insight['tags_json'])
            except Exception:
                tags = []
            insight_data = {
                'headline': latest_insight['headline'],
                'body': latest_insight['body'],
                'tags': tags,
                'created_at': int(latest_insight['created_at'] * 1000)
            }

        conn.close()

        return jsonify({
            'metrics': {
                'total': total,
                'active': active,
                'assigned': assigned,
                'in_progress': in_progress,
                'resolved_awaiting': resolved_awaiting,
                'closed': closed,
                'escalated': escalated,
                'reopened': reopened,
                'breach_rate': f"{breach_rate}%"
            },
            'departments': dept_cards,
            'recent_activity': activity_stream,
            'latest_insight': insight_data
        })

    @app.route('/api/admin/activity', methods=['GET'])
    def get_all_activity():
        conn = get_db_connection()
        events = conn.execute("SELECT * FROM ticket_events ORDER BY created_at DESC LIMIT 50").fetchall()
        result = []
        for e in events:
            result.append({
                'ticket_id': e['ticket_id'],
                'type': e['event_type'],
                'actor': e['actor'],
                'text': e['message'],
                'ts': int(e['created_at'] * 1000)
            })
        conn.close()
        return jsonify(result)

    @app.route('/api/admin/insights', methods=['GET'])
    def list_insights():
        conn = get_db_connection()
        rows = conn.execute("SELECT * FROM insights ORDER BY created_at DESC LIMIT 10").fetchall()
        result = []
        for r in rows:
            result.append({
                'id': r['id'],
                'headline': r['headline'],
                'body': r['body'],
                'tags': json.loads(r['tags_json'] or '[]'),
                'created_at': int(r['created_at'] * 1000)
            })
        conn.close()
        return jsonify(result)

    @app.route('/api/admin/insight', methods=['POST'])
    def trigger_insight_agent():
        """Trigger Agent 4: Insight Agent to analyze database patterns."""
        report = generate_insights()
        return jsonify(report)

    # ── AGENT COMPATIBILITY ENDPOINTS ────────────────────────────
    @app.route('/api/intake', methods=['POST'])
    def legacy_intake():
        data = request.get_json() or {}
        text = data.get('text') or data.get('complaint_text') or ''
        return jsonify(analyze_complaint(text))

    @app.route('/api/route', methods=['POST'])
    def legacy_route():
        data = request.get_json() or {}
        intake = data.get('intake') or {}
        location = data.get('location') or 'Campus'
        return jsonify(route_ticket(intake, location))

    @app.route('/api/escalate', methods=['POST'])
    def legacy_escalate():
        data = request.get_json() or {}
        escalated = check_and_escalate_tickets()
        return jsonify({'escalated_count': len(escalated), 'tickets': escalated})

    @app.route('/api/insight', methods=['POST'])
    def legacy_insight():
        return jsonify(generate_insights())

    return app

if __name__ == '__main__':
    app = create_app()
    print(f"[CampusSOS v2] Server starting at http://localhost:{Config.PORT}")
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
