# Agent evaluation demo: React frontend built in stage 1, FastAPI + ADK evaluation framework in stage 2.
# Build with: docker build --platform linux/amd64 -t agent-evaluation-demo .   (Code Engine builds amd64 natively)
FROM --platform=$BUILDPLATFORM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    RUN_ROOT=/tmp/agentops-d1-runs STATIC_DIR=/app/frontend/dist HOME=/home/app
RUN useradd --create-home --uid 1001 app
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
COPY agents/ ./agents/
COPY tools/ ./tools/
COPY evaluations/ ./evaluations/
COPY scenarios.json ./
COPY --from=frontend /build/dist ./frontend/dist
RUN chown -R app:app /app
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=4)" || exit 1
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
