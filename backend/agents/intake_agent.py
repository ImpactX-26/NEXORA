import json
import re
import os
from backend.config import Config

# Supported standard categories
VALID_CATEGORIES = [
    'electrical',
    'wifi',
    'bullying_crime',
    'grievance_redressal',
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
    # 1. Check bullying, ragging, physical assault, extortion, violence, campus discipline (Vice Principal)
    if any(k in lower for k in ['bully', 'bullied', 'bullying', 'ragging', 'ragged', 'threat', 'threaten', 'assault', 'violence', 'extort', 'extortion', 'crime', 'stalk', 'stalking', 'fight', 'weapon', 'illegal']):
        category = 'bullying_crime'
    # 2. Check Grievance Redressal (Unfair treatment, academic problems, harassment, administrative failures, scholarship delays)
    elif any(k in lower for k in ['unfair', 'bias', 'biased', 'harass', 'harassment', 'discrimination', 'scholarship', 'admin fail', 'administrative', 'evaluation', 'dispute', 'marks deduction', 'grade penalty', 'refused', 'arbitrary', 're-exam', 'attendance dispute', 'ombuds', 'complaint against', 'grievance', 'misconduct']):
        category = 'grievance_redressal'
    # 3. Check Electrical problems (Campus Electrician)
    elif any(k in lower for k in ['spark', 'shock', 'plug', 'switch', 'light', 'fan', 'ac', 'power', 'socket', 'wire', 'wiring', 'fuse', 'electric', 'blackout', 'short circuit', 'breaker', 'voltage']):
        category = 'electrical'
    # 4. Check WiFi & Network problems (Network Engineer)
    elif any(k in lower for k in ['wifi', 'wi-fi', 'internet', 'network', 'router', 'disconnect', 'bandwidth', 'ethernet', 'slow net', 'lan', 'dns', 'gateway', 'port', 'connection drop']):
        category = 'wifi'
        
    urgency = 'medium'
    is_high_priority_loc = any(k in lower for k in ['lab', 'labs', 'faculty room', 'staff room', 'server room', 'library', 'study hall', 'seminar hall', 'classroom', 'exam hall'])

    if category == 'bullying_crime':
        urgency = 'critical' if any(k in lower for k in ['threat', 'violence', 'assault', 'weapon', 'harm', 'hit', 'severe', 'ragging']) else 'high'
    elif any(k in lower for k in ['spark', 'shock', 'fire', 'severe', 'danger', 'hazard', 'emergency', 'blackout', 'immediately', 'critical']):
        urgency = 'critical' if ('fire' in lower or 'shock' in lower or 'spark' in lower) else 'high'
    elif category in ['electrical', 'wifi'] and is_high_priority_loc:
        urgency = 'high'
    elif category == 'grievance_redressal' and any(k in lower for k in ['harass', 'extort', 'threat', 'career', 'semester loss', 'expulsion', 'severe']):
        urgency = 'high'
    elif any(k in lower for k in ['broken', 'dropped', 'urgent', 'dispute', 'delay', 'failed']):
        urgency = 'high'
    elif any(k in lower for k in ['minor', 'slow', 'later', 'suggestion', 'request', 'query']):
        urgency = 'low'
        
    words = text.split()
    title = ' '.join(words[:6]).capitalize() if len(words) >= 3 else text[:40].capitalize()
    
    loc_note = " (High-Priority Facility)" if is_high_priority_loc and category in ['electrical', 'wifi'] else ""
    return {
        'category': category,
        'urgency': urgency,
        'title': title,
        'summary': text[:120] + ('...' if len(text) > 120 else ''),
        'reasoning': f"Rule-based classification ({reason}): Identified category as '{category}' and urgency as '{urgency}'{loc_note}.",
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
Analyze the following student complaint and classify it into exactly one of the supported categories:

Supported categories:
- electrical (electric problems: power cuts, sockets, sparking, wiring, lighting, voltage fluctuation, circuit breaker, fan/appliance power -> routed to Campus Electrician)
- wifi (network issues: Wi-Fi connection drops, LAN/ethernet faults, router failure, slow bandwidth, DNS issues -> routed to Network Engineer)
- bullying_crime (ragging, student intimidation, bullying, physical violence, threats, extortion, severe safety emergencies -> routed to Vice Principal)
- grievance_redressal (serious issues regarding unfair treatment, evaluation disputes, harassment by staff/faculty, administrative failures, scholarship delays that regular staff failed to resolve -> routed to Grievance Redressal Officer)
- other (unclassified issues -> routed to Grievance Redressal Officer)

Supported urgency levels:
- critical (bullying/ragging threats, physical danger, crimes, shock, fire risk, severe violence, core server room failures)
- high (active hazard, sparks, network/power blackout in labs/faculty rooms/staff rooms/library/server room, critical administrative deadline failure)
- medium (standard operational disruption, intermittent wifi in general areas, socket repair)
- low (minor aesthetic or routine query)

Note on Priority Locations:
For electrical or wifi issues in key facilities (labs, faculty room, staff room, server room, library, seminar hall), assign at least 'high' urgency due to high academic and operational impact.

Student Complaint:
\"\"\"{complaint_text.strip()}\"\"\"

Output STRICT JSON only:
{{
  "category": "electrical|wifi|bullying_crime|grievance_redressal|other",
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
                if cat in ['bullying', 'crime', 'ragging', 'ragging_crime', 'discipline']:
                    cat = 'bullying_crime'
                elif cat in ['network', 'internet', 'lan']:
                    cat = 'wifi'
                elif cat in ['electric', 'power', 'plugs']:
                    cat = 'electrical'
                elif cat in ['grievance', 'academic', 'harassment', 'administrative', 'admin']:
                    cat = 'grievance_redressal'
                elif cat not in VALID_CATEGORIES:
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
