import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / '.env')

class Config:
    # Security: GROQ_API_KEY is read strictly from backend environment variable
    GROQ_API_KEY = os.getenv('GROQ_API_KEY', '').strip()
    
    # SQLite Database file path
    DB_PATH = BASE_DIR / 'campussos.db'
    
    # Server configuration
    PORT = int(os.getenv('PORT', 5500))
    HOST = os.getenv('HOST', '0.0.0.0')
    DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')
    
    # SLA Configurations (in seconds)
    # Demo Mode: fast cycles for live hackathon demonstration
    DEMO_SLA = {
        'critical': 20,   # 20 seconds
        'high':     30,   # 30 seconds
        'medium':   60,   # 60 seconds
        'low':      120,  # 120 seconds
    }
    
    # Real Mode: standard campus operations
    REAL_SLA = {
        'critical': 1800,   # 30 minutes
        'high':     7200,   # 2 hours
        'medium':   28800,  # 8 hours
        'low':      86400,  # 24 hours
    }
    
    # Escalation interval check in seconds
    DEMO_ESCALATION_CHECK_INTERVAL = 2.0  # check every 2s in demo mode
    REAL_ESCALATION_CHECK_INTERVAL = 30.0 # check every 30s in real mode
