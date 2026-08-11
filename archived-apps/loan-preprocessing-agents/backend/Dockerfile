# syntax=docker/dockerfile:1

# -------- Base image (match pyproject requires-python >=3.13) --------
FROM python:3.13-slim AS app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    PATH="/root/.local/bin:${PATH}" \
    PORT=8000 \
    # Be explicit for uv so it never picks 3.12 by mistake
    UV_PYTHON=/usr/local/bin/python3.13

WORKDIR /app

# System deps (for building native wheels like bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates build-essential \
 && rm -rf /var/lib/apt/lists/*

# -------- Install uv --------
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# -------- Python deps (via uv) --------
# Copy dependency descriptors first for better caching
COPY pyproject.toml ./
COPY uv.lock* ./
COPY requirements.txt* ./

# If pyproject + uv.lock exist, sync locked deps; else fall back to requirements.txt
RUN if [ -f "pyproject.toml" ] && [ -f "uv.lock" ]; then \
        uv sync --frozen --no-dev --python "$UV_PYTHON"; \
    elif [ -f "requirements.txt" ]; then \
        uv pip install --system -r requirements.txt; \
    else \
        echo "No dependency files found; skipping dependency install."; \
    fi

# -------- App code --------
COPY . .

# Writable dirs (e.g., SQLite/uploads), non-root user
RUN mkdir -p /data /app/uploads && \
    adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app /data
USER appuser

EXPOSE 8000

# HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
#   CMD python - <<'PY' || exit 1
# import urllib.request, sys
# try:
#     with urllib.request.urlopen('http://127.0.0.1:8000/docs', timeout=3) as r:
#         sys.exit(0 if r.status in (200, 401) else 1)
# except Exception:
#     sys.exit(1)
# PY

# Start FastAPI (change main:app if your module/app is different)
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
