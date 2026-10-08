import json
import re
import os
from backend.config import Config

# Supported standard categories
VALID_CATEGORIES = [
    'electrical',
    'plumbing',
    'mess',
    'wifi',
    'academic',
    'timetable',
    'security',
    'hostel',
    'other'
]

VALID_URGENCIES = ['low', 'medium', 'high', 'critical']

# Supported model list on Groq in priority order
GROQ_MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
]

def _fallback_intake(text: str, reason: str = 'LLM unavailable') -> dict:
    """Safe fallback rule-based classification when LLM is unavailable or errors."""
    lower = text.lower()
    
    category = 'other'
    if any(k in lower for k in ['spark', 'shock', 'plug', 'switch', 'light', 'fan', 'ac', 'power', 'socket', 'wire', 'fuse', 'electric']):
        category = 'electrical'
    elif any(k in lower for k in ['leak', 'water', 'tap', 'washroom', 'toilet', 'flush', 'sink', 'pipe', 'drain', 'plumb']):
        category = 'plumbing'
    elif any(k in lower for k in ['food', 'mess', 'dal', 'roti', 'rice', 'meal', 'dinner', 'lunch', 'breakfast', 'taste', 'smell', 'canteen']):
        category = 'mess'
    elif any(k in lower for k in ['wifi', 'internet', 'network', 'router', 'disconnect', 'bandwidth', 'ethernet', 'slow net', 'lan']):
        category = 'wifi'
    elif any(k in lower for k in ['timetable', 'clash', 'schedule', 'slot', 'same room', 'timing', 'lecture clash']):
        category = 'timetable'
    elif any(k in lower for k in ['exam', 'grade', 'marks', 'professor', 'faculty', 'assignment', 'course', 'credit', 'academic']):
        category = 'academic'
    elif any(k in lower for k in ['lock', 'theft', 'stolen', 'broken gate', 'security', 'guard', 'safety', 'harass', 'cctv']):
        category = 'security'
    elif any(k in lower for k in ['bed', 'room', 'hostel', 'warden', 'clean', 'dustbin', 'corridor', 'balcony', 'window']):
        category = 'hostel'
        
    urgency = 'medium'
    if any(k in lower for k in ['spark', 'shock', 'fire', 'severe', 'danger', 'hazard', 'emergency', 'flood', 'immediately', 'critical']):
        urgency = 'critical' if 'fire' in lower or 'shock' in lower else 'high'
    elif any(k in lower for k in ['off', 'second time', 'broken', 'no water', 'urgent', 'drop']):
        urgency = 'high'
    elif any(k in lower for k in ['minor', 'slow', 'later', 'suggestion', 'request']):
        urgency = 'low'
        
    words = text.split()
    title = ' '.join(words[:6]).capitalize() if len(words) >= 3 else text[:40].capitalize()
    
    return {
        'category': category,
        'urgency': urgency,
        'title': title,
        'summary': text[:120] + ('...' if len(text) > 120 else ''),
        'reasoning': f"Rule-based classification fallback ({reason}): Identified category as '{category}' and urgency as '{urgency}'.",
        'is_fallback': True
    }

def analyze_complaint(complaint_text: str) -> dict:
    """
    Agent 1: Intake Agent.
    Analyzes raw complaint text using Groq LLM to determine category, urgency, title, and reasoning.
    Returns validated structured dict.
    """
    if not complaint_text or not complaint_text.strip():
        return _fallback_intake("Empty complaint", "Missing text")
        
    api_key = Config.GROQ_API_KEY
    if not api_key or api_key == 'your_groq_api_key_here':
        return _fallback_intake(complaint_text, "No valid GROQ_API_KEY configured")

    prompt = f"""You are the autonomous Intake Agent of CampusSOS, an institutional grievance & accountability system.
Analyze the following student complaint and output structured JSON.

Supported categories:
- electrical
- plumbing
- mess
- wifi
- timetable
- academic
- security
- hostel
- other

Supported urgency levels:
- critical (immediate hazard, shock, fire risk, flooding)
- high (active hindrance, e.g. spoiled food, no water, sparks)
- medium (standard operational disruption, intermittent wifi, timetable clash)
- low (minor aesthetic or suggestion)

Student Complaint:
\"\"\"{complaint_text.strip()}\"\"\"

Output STRICT JSON only:
{{
  "category": "electrical|plumbing|mess|wifi|timetable|academic|security|hostel|other",
  "urgency": "low|medium|high|critical",
  "title": "Concise summary title (max 8 words)",
  "summary": "One sentence summary of the issue",
  "reasoning": "1-2 sentence explanation of why this category and urgency level were chosen based on the grievance description"
}}
"""

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        
        last_error = None
        for model in GROQ_MODELS:
            try:
                response = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": "You are a precise, autonomous JSON-only classification agent."},
                        {"role": "user", "content": prompt}
                    ],
                    model=model,
                    temperature=0.1,
                    max_tokens=300,
                    response_format={"type": "json_object"}
                )
                
                raw_content = response.choices[0].message.content.strip()
                data = json.loads(raw_content)
                
                # Validation
                cat = data.get('category', '').lower().strip()
                if cat not in VALID_CATEGORIES:
                    matched = next((c for c in VALID_CATEGORIES if c in cat), 'other')
                    cat = matched
                    
                urg = data.get('urgency', '').lower().strip()
                if urg not in VALID_URGENCIES:
                    urg = 'medium'
                    
                title = data.get('title', '').strip() or complaint_text[:40]
                summary = data.get('summary', '').strip() or complaint_text[:120]
                reasoning = data.get('reasoning', '').strip() or f"Classified by Intake Agent as {cat} with {urg} urgency."
                
                return {
                    'category': cat,
                    'urgency': urg,
                    'title': title,
                    'summary': summary,
                    'reasoning': reasoning,
                    'is_fallback': False
                }
            except Exception as model_err:
                last_error = model_err
                continue
                
        raise last_error or Exception("All Groq models failed")
        
    except Exception as e:
        print(f"[Intake Agent Warning] Groq API error: {e}. Using deterministic fallback.")
        return _fallback_intake(complaint_text, str(e))
