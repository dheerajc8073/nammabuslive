# Contributing to Namma Bus Live

Thank you for your interest in improving public transportation intelligence for Bengaluru! We welcome contributions, bug reports, and dataset refinements.

---

## 1. Code of Conduct & Principles

* **Factual & Honest Transit Data:** Never simulate, fake, or invent real-time bus locations, ETAs, or agency capabilities. If a live feed is offline or unauthenticated, the application must display static scheduled estimates or indicate unavailable telemetry honestly.
* **Preserve Working Architecture:** The frontend is intentionally zero-framework vanilla JavaScript with MapLibre GL and Three.js to maintain lightning-fast mobile load times. Do not refactor into heavy JS frameworks (React, Vue, Angular) without prior architectural consensus.
* **Zero Secret Policy:** Never commit `.env` files, API keys, database passwords, or operational secrets.

---

## 2. Local Development Workflow

### Prerequisites
* Python 3.11+
* Docker & Docker Compose (or local PostgreSQL 16 with PostGIS 3.4+ and Redis 7)
* Java 21 JRE (if running OpenTripPlanner 2 locally)

### Step-by-Step Setup
1. **Fork & Clone:**
   ```bash
   git clone https://github.com/<your-username>/namma-bus-live.git
   cd namma-bus-live
   ```

2. **Python Virtual Environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Update database passwords or OTP2 endpoints as required
   ```

4. **Run Automated Tests:**
   ```bash
   python -m pytest tests/ -v
   ```

5. **Start Application Locally:**
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Open `http://localhost:8000/` in your web browser.

---

## 3. Submitting Pull Requests

1. Create a feature branch: `git checkout -b feature/your-feature-name`.
2. Commit your changes with clear, descriptive commit messages.
3. Ensure all tests pass: `pytest tests/`.
4. Submit a Pull Request targeting the `main` branch with detailed notes on your changes.
