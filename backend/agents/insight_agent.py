import json
import time
from collections import Counter
from backend.config import Config
from backend.database import get_db_connection, log_ticket_event

GROQ_MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
]

def generate_insights() -> dict:
    """
    Agent 4: Insight Agent.
    Aggregates real statistics from SQLite tickets table, detects patterns (hotspots, breach rates, recurring issues),
    and generates an actionable intelligence summary using Groq LLM (or deterministic data-driven report).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        tickets = cursor.execute('''
            SELECT id, ticket_id, category, urgency, location, department_name, assigned_to,
                   status, sla_seconds, escalation_level, reopened_count,
                   created_at, resolved_at, closed_at
            FROM tickets
        ''').fetchall()
    finally:
        conn.close()

    total_count = len(tickets)

    if total_count == 0:
        return {
            'headline': 'Insufficient Data for Intelligence Report',
            'body': 'The system database currently contains no ticket records. Insights will generate automatically once complaints are filed and processed.',
            'tags': ['no-data', 'system-ready'],
            'metrics': {'total_tickets': 0, 'active_tickets': 0, 'breach_rate': '0%'}
        }

    # Statistical Aggregations from real DB data
    active_tickets = [t for t in tickets if t['status'] not in ('closed', 'verified')]
    resolved_tickets = [t for t in tickets if t['resolved_at'] or t['closed_at']]
    escalated_tickets = [t for t in tickets if t['status'] == 'escalated' or (t['escalation_level'] or 0) > 0]
    reopened_tickets = [t for t in tickets if (t['reopened_count'] or 0) > 0]

    category_counts = Counter(t['category'] for t in tickets if t['category'])
    location_counts = Counter(t['location'] for t in tickets if t['location'])
    dept_counts = Counter(t['department_name'] for t in tickets if t['department_name'])
    dept_escalations = Counter(t['department_name'] for t in escalated_tickets if t['department_name'])

    top_category = category_counts.most_common(1)[0][0] if category_counts else 'General'
    top_location = location_counts.most_common(1)[0][0] if location_counts else 'Campus'
    top_dept = dept_counts.most_common(1)[0][0] if dept_counts else 'General'

    # Compute resolution times
    res_times = []
    for t in resolved_tickets:
        end = t['resolved_at'] or t['closed_at']
        if end and t['created_at']:
            diff = end - t['created_at']
            if diff > 0:
                res_times.append(diff)

    avg_res_min = round(sum(res_times) / len(res_times) / 60.0, 1) if res_times else 0.0
    breach_rate = round((len(escalated_tickets) / total_count) * 100, 1) if total_count > 0 else 0.0

    metrics_snapshot = {
        'total_tickets': total_count,
        'active_tickets': len(active_tickets),
        'resolved_tickets': len(resolved_tickets),
        'escalated_tickets': len(escalated_tickets),
        'reopened_tickets': len(reopened_tickets),
        'breach_rate': f"{breach_rate}%",
        'avg_resolution_minutes': avg_res_min,
        'top_location': top_location,
        'top_category': top_category,
        'top_department': top_dept
    }

    # LLM Synthesis using Groq
    api_key = Config.GROQ_API_KEY
    insight_headline = ""
    insight_body = ""
    insight_tags = []

    if api_key and api_key != 'your_groq_api_key_here':
        try:
            from groq import Groq
            client = Groq(api_key=api_key)

            sample_summaries = [
                f"- Ticket {t['ticket_id']} ({t['category']}/{t['urgency']}) at {t['location']}: status={t['status']}, escalated_level={t['escalation_level']}, reopened={t['reopened_count']}"
                for t in tickets[:15]
            ]
            samples_str = "\n".join(sample_summaries)

            prompt = f"""You are the autonomous Insight & Accountability Agent for CampusSOS.
Analyze the following REAL statistical campus grievance data:

Metrics Summary:
- Total complaints logged: {total_count}
- Currently active: {len(active_tickets)}
- Escalated (SLA breached): {len(escalated_tickets)} ({breach_rate}%)
- Reopened by students after dissatisfaction: {len(reopened_tickets)}
- Highest volume location: {top_location} ({location_counts.get(top_location, 0)} complaints)
- Highest volume category: {top_category} ({category_counts.get(top_category, 0)} complaints)
- Department breakdown: {dict(dept_counts)}
- Department SLA escalations: {dict(dept_escalations)}

Sample Ticket Logs:
{samples_str}

Provide a concise, data-driven intelligence report for campus administration.
Output STRICT JSON with the following format:
{{
  "headline": "Short punchy executive headline (max 10 words)",
  "body": "2-3 crisp paragraphs highlighting: (1) Identified infrastructural or operational failure clusters and specific hotspot locations; (2) Departmental bottlenecks, SLA risk areas, or verification issues; (3) Concrete, actionable preventive recommendations for campus administration.",
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}}
"""

            for model in GROQ_MODELS:
                try:
                    response = client.chat.completions.create(
                        messages=[
                            {"role": "system", "content": "You are a professional, data-driven campus operations intelligence analyst."},
                            {"role": "user", "content": prompt}
                        ],
                        model=model,
                        temperature=0.2,
                        max_tokens=450,
                        response_format={"type": "json_object"}
                    )

                    data = json.loads(response.choices[0].message.content.strip())
                    insight_headline = data.get('headline', '')
                    insight_body = data.get('body', '')
                    insight_tags = data.get('tags', [])
                    if insight_headline:
                        break
                except Exception:
                    continue

        except Exception as e:
            print(f"[Insight Agent Warning] Groq error: {e}. Generating statistical fallback digest.")

    # If LLM failed or not available, use deterministic data-driven synthesis
    if not insight_headline:
        insight_headline = f"Operational Cluster Detected in {top_location} ({top_category.capitalize()})"
        insight_body = (
            f"Autonomous operational analysis across {total_count} campus grievance records reveals a prominent "
            f"cluster of {top_category} complaints centered around {top_location}. "
            f"The system recorded an overall SLA escalation rate of {breach_rate}% ({len(escalated_tickets)} overdue tickets), "
            f"with {top_dept} managing the majority of active workload ({dept_counts.get(top_dept, 0)} cases). "
            f"{len(reopened_tickets)} complaints required reopening following student verification rejection, "
            f"underscoring the importance of post-resolution inspection."
        )
        insight_tags = [
            f"hotspot-{top_location.lower().replace(' ', '-')}",
            top_category,
            f"sla-{int(breach_rate)}pct",
            "autonomous-digest"
        ]

    now = time.time()

    # Save to database
    conn = get_db_connection()
    try:
        conn.execute('''
            INSERT INTO insights (headline, body, tags_json, metrics_json, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (insight_headline, insight_body, json.dumps(insight_tags), json.dumps(metrics_snapshot), now))

        conn.execute('''
            INSERT INTO ticket_events (ticket_id, event_type, actor, message, details_json, created_at)
            VALUES ('SYSTEM', 'INSIGHT_GENERATED', 'Insight Agent', ?, ?, ?)
        ''', (f"Generated Campus Intelligence Report: {insight_headline}", json.dumps(metrics_snapshot), now))

        conn.commit()
    finally:
        conn.close()

    return {
        'headline': insight_headline,
        'body': insight_body,
        'tags': insight_tags,
        'metrics': metrics_snapshot,
        'created_at': now
    }
