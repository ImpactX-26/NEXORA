import sys
from pathlib import Path

# Add project root to python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.config import Config
from backend.app import create_app

app = create_app()

if __name__ == '__main__':
    print(f"============================================================")
    print(f"  CampusSOS v2 — Autonomous Institutional Grievance System  ")
    print(f"  Running on: http://localhost:{Config.PORT}                ")
    print(f"  SLA Mode: {'DEMO (Fast Cycles)' if Config.DEBUG else 'REAL'}")
    print(f"============================================================")
    # Use use_reloader=False on Windows to prevent spawning duplicate background daemon threads
    app.run(host=Config.HOST, port=Config.PORT, debug=False, use_reloader=False)
