# Use Red Hat Universal Base Image (UBI) with Python 3.12
FROM registry.access.redhat.com/ubi9/python-312:latest

# Set working directory
WORKDIR /app

# Copy requirements file with proper permissions
COPY --chmod=644 app/requirements.txt .

# Install Python dependencies (run as root explicitly)
USER 0
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code with correct permissions
COPY --chmod=755 app/ .

# Switch back to non-root user
USER 1001

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8080/health')" || exit 1

# Run the application
CMD ["python", "server.py"]
