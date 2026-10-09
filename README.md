# 🏛️ CampusSOS — Autonomous Institutional Grievance & Accountability System
### *Agentic AI Track | Hackathon Project*

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_%7C_Qwen_%7C_GPT--OSS-F55036?style=for-the-badge&logo=fastapi&logoColor=white)](https://groq.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Track](https://img.shields.io/badge/Hackathon_Track-Agentic_AI-8A2BE2?style=for-the-badge)](https://github.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

---

## 📌 Executive Summary

Campus grievance management systems have long been plagued by human bottlenecks, opaque departmental silos, slow escalations, and unverified ticket closures. Complaints get lost in administrative backlogs, emergencies remain unaddressed, and students have no real voice in confirming whether an issue was truly resolved.

**CampusSOS** is an **autonomous, multi-agent AI system** designed to solve this institutional failure. Powered by a collaborative team of specialized autonomous agents, CampusSOS eliminates manual triage, dynamically enforces service-level agreements (SLAs), autonomously escalates neglected issues up the institutional hierarchy, synthesizes preventive intelligence reports, and guarantees human-in-the-loop accountability through student-verified closures.

```
       ┌─────────────────────────────────────────────────────────────┐
       │               CAMPUSSOS AGENTIC ECOSYSTEM                   │
       └─────────────────────────────────────────────────────────────┘
                                      │
   [ 🎓 Student Grievance ]           │
             │                        ▼
             ├────────► 🤖 AGENT 1: Intake & Safety Agent
             │            • Semantic Category Extraction
             │            • Severity & Urgency Assessment
             │            • Safety Threat Detection
             │                        │
             ├────────► 🤖 AGENT 2: Zero-Hallucination Routing Agent
             │            • DB-Grounded Candidate Search
             │            • Multi-Factor Scoring (Skill + Load + Location)
             │            • Transparent Decision Explanations
             │                        │
             ├────────► ⚙️ SQLite Database (WAL Mode Concurrency)
             │            ▲                   ▲
             │            │                   │
   [ ⏰ Autonomous Loop ] │                   │ [ 🏢 Staff Work ]
             ├────────► 🤖 AGENT 3: Escalation Daemon  │  • Accept / In-Progress
             │            • Real-Time SLA Ticking      │  • Submit Resolution
             │            • Autonomous Hierarchy Jump  │
             │            • Audit Event Logging        │
             │                                         │
   [ 🛡️ Student Agency ]                                │
             ├────────► 🔄 Closed-Loop Student Verification
             │            • Confirm Fix ──► Close Ticket
             │            • Reject Fix  ──► Reopen + Restart SLA
             │                        │
             └────────► 🤖 AGENT 4: Insight & Intelligence Agent
                          • Cross-Campus Hotspot Detection
                          • Breach Rate & Bottleneck Analytics
                          • Executive AI Briefings & Recommendations
```

---

## 🌟 Why Agentic AI? (The Problem & Paradigm Shift)

| Traditional Campus Ticketing | The CampusSOS Agentic Approach |
| :--- | :--- |
| ❌ **Manual Triage Delays:** Complaints sit in unassigned inboxes for days. | ✅ **Autonomous Intake Agent:** Categorizes, assesses urgency, and extracts key entities in sub-second time. |
| ❌ **Arbitrary Routing & Bias:** Complaints routed to random or overloaded staff. | ✅ **Grounded Routing Agent:** Real-time database matching optimizing workload, specialization, and proximity. |
| ❌ **Static SLAs & Ignored Deadlines:** Escalation requires manual student follow-up. | ✅ **Autonomous Escalation Daemon:** Background agent constantly monitors timers and automatically escalates neglected cases. |
| ❌ **Falsified Closures:** Staff mark tickets "done" without resolving the root issue. | ✅ **Closed-Loop Verification:** Only the student can permanently close a ticket. Rejections auto-reopen with reset SLAs. |
| ❌ **Reactive Maintenance:** Administration only notices failures after mass protests. | ✅ **Autonomous Insight Agent:** Analyzes systemic failure patterns and generates proactive executive intelligence. |

---

## 🤖 Multi-Agent Architecture

CampusSOS is powered by four specialized, autonomous agents that collaborate across asynchronous event loops:

### 1️⃣ Agent 1: Autonomous Intake & Safety Agent (`intake_agent.py`)
* **Role:** Analyzes raw natural-language student complaints with contextual safety and urgency classification.
* **LLM Engine:** Multi-model fallback chain via Groq Cloud (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`, `qwen/qwen3.8-27b`, `llama-3.1-8b-instant`) with automatic fallback to a deterministic rule heuristic engine.
* **Capabilities:**
  * Categorizes grievances into 5 institutional domains: `electrical`, `wifi`, `bullying_crime`, `grievance_redressal`, and `other`.
  * Computes urgency level (`critical`, `high`, `medium`, `low`) based on safety hazards, key academic infrastructure (labs, server rooms, exam halls), and student distress markers.
  * Generates concise executive titles and human-readable reasoning logs explaining *why* the ticket was categorized as such.

### 2️⃣ Agent 2: Zero-Hallucination Routing Agent (`routing_agent.py`)
* **Role:** Assigns the ticket to a verified staff member in the institutional directory.
* **Core Philosophy:** **Zero Hallucination Guarantee**. The agent never invents names or departments; all assignments are strictly grounded in live SQLite database records.
* **Multi-Factor Scoring Algorithm:**
  $$\text{Score} = \text{Specialization Match} (+6) + \text{Location Match} (+4) - \text{Workload} (2 \times \text{Active}) + \text{Track Record} (\lfloor\text{Resolved}/10\rfloor)$$
* **Institutional Governance Policy:**
  * **Bullying / Ragging / Crime** $\rightarrow$ Automatically routed directly to the **Vice Principal** (Executive Disciplinary Committee).
  * **Academic Bias / Harassment / Unfair Treatment** $\rightarrow$ Automatically routed to the **Grievance Redressal Officer**.
  * **Infrastructure Issues** $\rightarrow$ Routed to the lowest-workload specialist in Electrical or Network Operations.

### 3️⃣ Agent 3: Autonomous Escalation Daemon (`escalation_agent.py` & `scheduler.py`)
* **Role:** An independent background thread executing continuous SLA surveillance.
* **Autonomy Level:** Fully proactive — operates 24/7 without requiring any user click or browser connection.
* **Escalation Hierarchy Chains:**
  * `DEPT_ELEC`: Electrical Maintenance Supervisor $\rightarrow$ Chief Estate Officer $\rightarrow$ Institutional Director
  * `DEPT_IT`: Head of Computer Centre $\rightarrow$ Dean of Digital Infrastructure $\rightarrow$ Institutional Director
  * `DEPT_EXEC`: Anti-Ragging Committee $\rightarrow$ Disciplinary Governing Council $\rightarrow$ Principal
  * `DEPT_GRO`: University Ombudsperson $\rightarrow$ Executive Grievance Tribunal $\rightarrow$ Principal
* **Action:** Upon SLA breach, automatically transitions ticket status to `escalated`, steps up the escalation level ($0 \rightarrow 1 \rightarrow 2 \rightarrow 3$), assigns the next authority in the chain, and writes an audit event to `ticket_events`.

### 4️⃣ Agent 4: Insight & Intelligence Agent (`insight_agent.py`)
* **Role:** Analyzes campus-wide ticket distribution, recurring complaints, SLA breaches, and student reopen rates.
* **Intelligence Capabilities:**
  * Detects infrastructure hotspot clusters (e.g., recurring power failures in specific hostel blocks or lab networks).
  * Measures departmental bottleneck rates and SLA compliance.
  * Formulates data-driven executive briefings with actionable institutional recommendations via Groq LLM synthesis or statistical digest fallback.

---

## 🔄 The Closed-Loop Human Verification Workflow

One of the defining innovations of CampusSOS is the **Student-Led Verification Loop**:

```
[ Student Files Ticket ] ──► [ Intake Agent ] ──► [ Routing Agent ]
                                                          │
                                                          ▼
                                                  [ Assigned Staff ]
                                                          │
                                                    (Works on Fix)
                                                          │
                                                          ▼
                                                  [ Submit Resolution ]
                                                          │
                                                          ▼
                                            ┌───────────────────────────┐
                                            │ Status: resolved_awaiting │
                                            │    (NOT YET CLOSED)       │
                                            └─────────────┬─────────────┘
                                                          │
                                              [ Student Inspection ]
                                              /                    \
                                             /                      \
                                  [ Confirms Fix ]             [ Rejects Fix ]
                                         │                            │
                                         ▼                            ▼
                                ┌─────────────────┐          ┌─────────────────┐
                                │ Status: CLOSED  │          │ Status: REOPENED│
                                │  Resolution     │          │  SLA Reset &    │
                                │  Verified       │          │  Count Bumped   │
                                └─────────────────┘          └─────────────────┘
```

1. When a staff member completes repairs, they submit a **Resolution Note**.
2. The ticket transitions to **`resolved_awaiting`** — preventing staff from unilaterally closing unresolved tickets.
3. The student receives immediate feedback and has two options:
   * **Verify & Close:** Confirms the issue is fixed; ticket is permanently closed with verification timestamp.
   * **Reject & Reopen:** Student provides a rejection reason; the system automatically reopens the ticket, resets the SLA monitor, logs a `REOPENED` event, and alerts administration.

---

## ⚡ Key Highlights & Hackathon Features

- 🏎️ **Demo Mode vs. Real Mode SLA Engine:**
  - **Demo Mode:** Ultra-fast SLA cycles (**20s critical, 30s high, 60s medium, 120s low**) with **2-second daemon ticks** for fast, high-impact live judging demonstrations.
  - **Real Mode:** Realistic enterprise operational SLAs (**30 min to 24 hours**).
  - Easily toggled via the Admin Dashboard or topbar.
- 🛡️ **100% Offline-Resilient & Dual-Engine Operation:**
  - Seamlessly utilizes Groq Cloud LLMs when an API key is present.
  - If no key is set or network is offline, the system seamlessly activates the **Deterministic Heuristic Engine**, guaranteeing zero crashes and 100% testability.
- 📜 **Full Activity Audit Ledger:**
  - Every decision, score, reassignment, and student action is logged with microsecond precision in SQLite (`ticket_events`).
- 💎 **Sleek Glassmorphic Interface:**
  - Responsive, dark-mode native interface with micro-animations, live SLA countdown badges, filtered search, and real-time dashboard analytics.
- 👥 **One-Click Demo Authentication:**
  - Instant login switches between Student, Campus Electrician, Network Engineer, Vice Principal, Grievance Redressal Officer, and Dean of Student Welfare (Admin).

---

## 🏗️ System Architecture & Tech Stack

```
CAMPUSSOS V3
├── backend/
│   ├── agents/
│   │   ├── __init__.py           # Agent exports
│   │   ├── intake_agent.py       # Agent 1: Classification, Urgency & Safety
│   │   ├── routing_agent.py      # Agent 2: Zero-Hallucination Grounded Routing
│   │   ├── escalation_agent.py   # Agent 3: Autonomous Hierarchy Escalation
│   │   └── insight_agent.py      # Agent 4: Campus Intelligence & Pattern Mining
│   ├── app.py                   # Flask Application Factory & REST Endpoints
│   ├── config.py                # SLA Profiles, Host/Port & Environment Settings
│   ├── database.py              # SQLite Schema, WAL Mode & DB Helper Methods
│   ├── scheduler.py             # Background Escalation Daemon Thread
│   └── seed_data.py             # Realistic Campus Departments, Staff & Demo Tickets
├── js/
│   ├── pages/
│   │   ├── student.js           # Student Portal: Filing, Tracking, Verification
│   │   ├── faculty.js           # Staff Portal: Work Queues, Accept, Resolve
│   │   ├── admin.js             # Admin Dashboard: Metrics, Scorecards, Intelligence
│   │   ├── login.js             # One-Click Demo Auth Modal
│   │   └── ticketDetail.js      # Interactive Lifecycle Timeline & Actions
│   ├── api.js                   # Fetch Client for Backend Endpoints
│   ├── engine.js                # State Synchronization & Polling Engine
│   ├── main.js                  # App Entry Point & SPA Bootstrap
│   ├── router.js                # Client-Side Hash Router
│   ├── state.js                 # Centralized Client Reactive State
│   ├── topbar.js                # Dynamic Navigation, Demo Toggles & Auth UI
│   └── utils.js                 # Time formatters, toasts, modals & helpers
├── app.py                       # Root Server Launcher
├── index.html                   # SPA HTML Shell
├── styles.css                   # Glassmorphic Design System & Responsive CSS
├── requirements.txt             # Python Dependencies
├── .env.example                 # Environment Variable Template
└── README.md                    # Project Documentation
```

### Technology Stack
* **Backend:** Python 3.10+, Flask, Flask-CORS, Python-Dotenv
* **Database:** SQLite 3 (configured with `WAL` journal mode and busy timeouts for concurrent agent reads/writes)
* **LLM Orchestration:** Groq Python SDK (`llama-3.3-70b-versatile`, `qwen/qwen3.8-27b`, `openai/gpt-oss-120b`, `llama-3.1-8b-instant`)
* **Background Processing:** Python `threading.Thread` daemon for autonomous SLA monitoring
* **Frontend:** Vanilla JavaScript (ES6+ Modules, zero heavy framework overhead), Modern Vanilla CSS with CSS custom properties and glassmorphic aesthetics

---

## 🚀 Quick Start & Installation

### Prerequisites
* Python 3.10 or higher
* Git

### 1. Clone the Repository
```bash
git clone https://github.com/ImpactX-26/NEXORA.git
cd "CAMPUSSOS V3"
```

### 2. Set Up Virtual Environment (Recommended)
```bash
# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your free Groq API key (from [console.groq.com](https://console.groq.com)):
```env
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
```
> **Note:** Even without an API key, CampusSOS will run 100% normally using its built-in deterministic heuristic engine.

### 5. Launch CampusSOS
```bash
python app.py
```
Open your browser and navigate to:
👉 **`http://localhost:5500`**

---

## 🎭 Demo Accounts (One-Click Login)

The login screen contains **quick-fill buttons** for instant persona switching:

| Portal | Username | Password | Role / Title |
| :--- | :--- | :--- | :--- |
| **Student** | `student` | `student123` | Student #101 |
| **Student (Alt)** | `student2` | `student123` | Student #102 |
| **Staff (Electrician)** | `electrician` | `staff123` | Campus Electrician (Electrical Maintenance) |
| **Staff (Network)** | `network` | `staff123` | Network Engineer (IT & Network Ops) |
| **Staff (VP)** | `viceprincipal` | `staff123` | Vice Principal (Discipline & Anti-Ragging) |
| **Staff (Grievance)** | `grievance` | `staff123` | Grievance Redressal Officer |
| **Executive Admin** | `admin` | `admin123` | Dean of Student Welfare (Admin) |

---

## 🎬 3-Minute Live Hackathon Demo Script

Follow this step-by-step workflow during judge evaluation:

1. **Intake & Routing in Action:**
   - Log in as **Student #101** (`student`).
   - File a new grievance: *"The primary circuit breaker in Computer Lab 3 is sparking and smoking after a voltage surge."* (Location: `Lab Block B`).
   - Submit the complaint and open the ticket.
   - **Show the Judges:** Point out how **Agent 1** classified it as `electrical` + `critical` with safety reasoning, and **Agent 2** grounded it into `DEPT_ELEC` assigned to `Campus Electrician`.
2. **Witness Autonomous Escalation (Agent 3):**
   - In Demo Mode, watch the live SLA countdown tick down.
   - When the SLA expires (20 seconds), the **Escalation Daemon** automatically escalates the ticket to **Level 1** (`Electrical Maintenance Supervisor`).
   - Click the ticket to show the live timeline event logged by `Escalation Agent`.
3. **Staff Resolution Workflow:**
   - Switch user / Log in as **Campus Electrician** (`electrician`).
   - Open the assigned ticket $\rightarrow$ Click **Start Work** $\rightarrow$ Click **Submit Resolution**.
   - Enter: *"Replaced the blown breaker and insulated the junction box."*
   - Notice the status updates to **`resolved_awaiting`** (it does *not* close).
4. **Student Verification Loop (Anti-Falsification):**
   - Log back in as **Student #101** $\rightarrow$ Open the ticket.
   - Click **Reject Resolution** with reason: *"Power is back, but socket 4 is still smoking."*
   - Notice the ticket reopens, incrementing the reopen count and restarting the SLA timer.
   - Click **Verify & Close** when satisfied $\rightarrow$ Ticket is officially closed.
5. **Executive Intelligence (Agent 4):**
   - Log in as **Admin** (`admin`).
   - Review the live Department Scorecards and Breach Rates.
   - Click **Generate Insight Report** $\rightarrow$ Watch **Agent 4** synthesize an executive intelligence briefing identifying hotspot clusters and preventative actions.

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check, Groq API key status, and system timestamp. |
| `/api/config` | `GET` | Retrieve SLA configurations and active mode. |
| `/api/demo/mode` | `POST` | Toggle between Demo Mode (fast SLA) and Real Mode. |
| `/api/demo/reset` | `POST` | Reset SQLite database to deterministic baseline scenario. |
| `/api/auth/login` | `POST` | Authenticate user against campus directory. |
| `/api/tickets` | `POST` | File new grievance (Triggers Agent 1 Intake & Agent 2 Routing). |
| `/api/tickets` | `GET` | List tickets with optional status, department, and staff filters. |
| `/api/tickets/<id>` | `GET` | Retrieve single ticket details with full chronological audit timeline. |
| `/api/tickets/<id>/accept` | `POST` | Staff accepts assigned complaint. |
| `/api/tickets/<id>/start_work` | `POST` | Staff marks ticket in-progress. |
| `/api/tickets/<id>/resolve` | `POST` | Staff submits resolution note (moves to `resolved_awaiting`). |
| `/api/tickets/<id>/verify` | `POST` | Student verifies fix and permanently closes ticket. |
| `/api/tickets/<id>/reject` | `POST` | Student rejects resolution and reopens ticket with reset SLA. |
| `/api/admin/dashboard` | `GET` | Fetch aggregate metrics, department scorecards, and recent events. |
| `/api/admin/insight` | `POST` | Trigger Agent 4 Insight Agent to analyze campus patterns. |

---

## 🔮 Future Roadmap

- [ ] **Multi-Channel Ingestion:** WhatsApp, Telegram, and SMS bot integrations for instant field filing.
- [ ] **Campus IoT Mesh Integration:** Direct API triggers from smart electrical circuit breakers and network ping sensors.
- [ ] **Multimodal Photo / Video Evidence Agent:** Computer vision model to verify physical damage and post-repair proof.
- [ ] **Voice SOS Agent:** Speech-to-text emergency call intake for rapid distress response.
- [ ] **Multi-Campus Federation:** Federated analytics across multiple universities and municipal institutions.

---

## 📄 License & Acknowledgments

This project is licensed under the [MIT License](LICENSE).

Developed with ❤️ for the **Agentic AI Track**.

*Empowering students, automating institutional accountability, and ensuring no grievance is ever ignored.*
