# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies with --no-deps flag to preserve exact versions
RUN pip install --no-deps -r requirements.txt

# Copy application files
COPY app.py .
COPY api_server.py .
COPY app-config.properties .

# Expose port 8080 (Code Engine default)
EXPOSE 8080

# Set environment variable for port (Code Engine uses PORT env var)
ENV SERVICE_PORT=${PORT:-8080}
ENV DEBUG_MODE=False

# Run the REST API server
CMD ["python", "api_server.py"]
