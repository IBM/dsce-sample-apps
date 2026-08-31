# Multi-stage Dockerfile for FleetOps Backend
# Optimized for production deployment on OpenShift

# Stage 1: Builder
FROM python:3.12-slim as builder

# Set working directory
WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install Python dependencies to /opt (accessible by any user)
COPY --from=builder /root/.local /opt/app-root

# Copy application code
COPY . .

# Set permissions for OpenShift (arbitrary UID support)
RUN chmod -R g=u /app /etc/passwd /opt/app-root && \
    mkdir -p /app/data && \
    chmod -R 775 /app/data

# Set environment variables
ENV PATH=/opt/app-root/bin:$PATH \
    PYTHONPATH=/opt/app-root/lib/python3.12/site-packages:$PYTHONPATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8085 \
    HOME=/app

# OpenShift runs as arbitrary UID, so no USER directive needed

# Expose port
EXPOSE 8085

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8085/health')" || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8085"]

# Made with Bob
