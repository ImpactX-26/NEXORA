import threading
import time
from backend.config import Config
from backend.database import is_demo_mode
from backend.agents.escalation_agent import check_and_escalate_tickets

class EscalationScheduler:
    """Background daemon thread for autonomous SLA monitoring and ticket escalation."""
    _instance = None
    _running = False
    _thread = None

    @classmethod
    def start(cls):
        if cls._running:
            return
        cls._running = True
        cls._thread = threading.Thread(target=cls._run_loop, daemon=True, name="EscalationDaemon")
        cls._thread.start()
        print("[Escalation Scheduler] Background monitoring daemon started.")

    @classmethod
    def stop(cls):
        cls._running = False
        print("[Escalation Scheduler] Daemon stopped.")

    @classmethod
    def _run_loop(cls):
        while cls._running:
            try:
                # Check tickets for SLA breaches
                check_and_escalate_tickets()
            except Exception as e:
                print(f"[Escalation Scheduler Error] {e}")

            # Sleep interval depends on Demo vs Real mode
            interval = Config.DEMO_ESCALATION_CHECK_INTERVAL if is_demo_mode() else Config.REAL_ESCALATION_CHECK_INTERVAL
            time.sleep(interval)
