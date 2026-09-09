# backend/Dockerfile
# Production image for the FastAPI backend (Turnaround Supply Chain Intelligence)
# Target: IBM Cloud Code Engine

FROM python:3.11-slim AS base

# ── System deps ──────────────────────────────────────────────────────────────
# librdkafka is bundled inside the confluent-kafka wheel (manylinux), so no
# extra apt packages are needed on slim. Only security updates are applied.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# ── Non-root user ────────────────────────────────────────────────────────────
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /sbin/nologin --no-create-home appuser

# ── Python dependencies ──────────────────────────────────────────────────────
WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Application code ─────────────────────────────────────────────────────────
COPY app/ ./app/

# ── Ownership ────────────────────────────────────────────────────────────────
RUN chown -R appuser:appgroup /app

USER appuser

# ── Runtime ──────────────────────────────────────────────────────────────────
ENV PORT=3001 \
    LOG_LEVEL=info \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3001/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001", "--workers", "1"]
