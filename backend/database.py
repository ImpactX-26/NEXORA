import sqlite3
import json
import time
from backend.config import Config

def get_db_connection():
    """Get a SQLite database connection with row factory."""
    conn = sqlite3.connect(str(Config.DB_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables and set WAL mode."""
    # Run PRAGMAs in autocommit mode
    prag_conn = sqlite3.connect(str(Config.DB_PATH), timeout=30.0)
    prag_conn.isolation_level = None
    prag_conn.execute('PRAGMA journal_mode=WAL;')
    prag_conn.execute('PRAGMA synchronous=NORMAL;')
    prag_conn.execute('PRAGMA busy_timeout=30000;')
    prag_conn.close()

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Departments table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        default_sla_minutes INTEGER DEFAULT 120,
        escalation_target TEXT NOT NULL,
        created_at REAL DEFAULT (strftime('%s', 'now'))
    )
    ''')

    # 2. Staff / Faculty table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL,
        department_id TEXT NOT NULL,
        specializations TEXT DEFAULT '[]',
        active INTEGER DEFAULT 1,
        current_open_ticket_count INTEGER DEFAULT 0,
        total_resolved_count INTEGER DEFAULT 0,
        avg_resolution_seconds REAL DEFAULT 0.0,
        created_at REAL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (department_id) REFERENCES departments (id)
    )
    ''')

    # 3. Users table (for student, faculty, admin demo logins)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL DEFAULT 'password123',
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        department_id TEXT,
        staff_id TEXT,
        created_at REAL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (department_id) REFERENCES departments (id),
        FOREIGN KEY (staff_id) REFERENCES staff (id)
    )
    ''')

    # Auto-migration for password column in existing users table
    cursor.execute("PRAGMA table_info(users);")
    cols = [col['name'] for col in cursor.fetchall()]
    if 'password' not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT 'password123';")

    # 4. Tickets table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT UNIQUE NOT NULL,
        student_id TEXT NOT NULL DEFAULT 'STU-DEMO',
        student_name TEXT NOT NULL DEFAULT 'Anonymous Student',
        complaint_text TEXT NOT NULL,
        title TEXT,
        category TEXT,
        urgency TEXT DEFAULT 'medium',
        priority TEXT DEFAULT 'normal',
        location TEXT DEFAULT 'Campus',
        department_id TEXT,
        department_name TEXT,
        assigned_staff_id TEXT,
        assigned_to TEXT,
        status TEXT NOT NULL DEFAULT 'submitted',
        sla_deadline REAL NOT NULL,
        sla_seconds INTEGER NOT NULL,
        escalation_level INTEGER DEFAULT 0,
        escalated_to TEXT,
        escalation_note TEXT,
        intake_reasoning TEXT,
        routing_reasoning TEXT,
        resolution_note TEXT,
        student_verification TEXT,
        verification_reason TEXT,
        reopened_count INTEGER DEFAULT 0,
        created_at REAL NOT NULL,
        updated_at REAL NOT NULL,
        resolved_at REAL,
        closed_at REAL,
        FOREIGN KEY (department_id) REFERENCES departments (id),
        FOREIGN KEY (assigned_staff_id) REFERENCES staff (id)
    )
    ''')

    # 5. Ticket Events / Activity Log
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS ticket_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        message TEXT NOT NULL,
        details_json TEXT DEFAULT '{}',
        created_at REAL NOT NULL
    )
    ''')

    # 6. Insights table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        headline TEXT NOT NULL,
        body TEXT NOT NULL,
        tags_json TEXT DEFAULT '[]',
        metrics_json TEXT DEFAULT '{}',
        created_at REAL NOT NULL
    )
    ''')

    # 7. System config table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at REAL NOT NULL
    )
    ''')

    # Create indexes for fast query performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_staff_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tickets_student ON tickets(student_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events(ticket_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_created ON ticket_events(created_at DESC);')

    conn.commit()
    conn.close()

def log_ticket_event(ticket_id, event_type, actor, message, details=None):
    """Insert a decision/activity event into the ticket_events table."""
    conn = get_db_connection()
    now = time.time()
    details_str = json.dumps(details or {})
    try:
        conn.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (ticket_id, event_type, actor, message, details_str, now))
        conn.commit()
    finally:
        conn.close()

def is_demo_mode():
    """Check if the system is running in demo mode."""
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT value FROM system_config WHERE key = 'demo_mode'").fetchone()
        if row:
            return row['value'].lower() == 'true'
        return True
    finally:
        conn.close()

def set_demo_mode(enabled: bool):
    """Set demo mode status in system config."""
    conn = get_db_connection()
    now = time.time()
    try:
        conn.execute('''
            INSERT INTO system_config (key, value, updated_at)
            VALUES ('demo_mode', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        ''', ('true' if enabled else 'false', now))
        conn.commit()
    finally:
        conn.close()
