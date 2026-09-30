# Container image for the AI Guardrails sample (IBM Cloud Code Engine / any OCI runtime).
# Serves the Dash app through gunicorn, so Flask/Werkzeug debug mode and the
# interactive debugger can never be enabled in this image.
# ibm-watsonx-gov publishes x86_64 Linux wheels only, so pin the platform (Code Engine builds on amd64).
FROM --platform=linux/amd64 python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBUG_MODE=false \
    SERVICE_HOST=0.0.0.0 \
    SERVICE_PORT=8080

WORKDIR /app

RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Run as an unprivileged user.
RUN useradd --create-home --uid 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# gunicorn serves app.server directly; app.run() (and therefore debug mode) is never invoked.
CMD ["sh", "-c", "exec gunicorn app:server --bind ${SERVICE_HOST}:${SERVICE_PORT} --workers 2 --threads 4 --timeout 300 --access-logfile - --error-logfile -"]
