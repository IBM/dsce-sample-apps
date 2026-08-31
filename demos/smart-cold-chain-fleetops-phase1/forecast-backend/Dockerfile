# ============================================================================
# Stage 1: Download TTM Model (Native Platform - ARM64 on M4 Mac)
# ============================================================================
FROM python:3.11-slim AS model-downloader

WORKDIR /app

# Install system dependencies needed for model download
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install granite-tsfm package with all dependencies
# This includes the TTM model code and transformers
RUN pip install --no-cache-dir "granite-tsfm[notebooks]==0.3.3"

# Download TTM model to cache directory
# This runs natively on your Mac's ARM64 architecture (no QEMU emulation)
RUN python -c "from tsfm_public import TinyTimeMixerForPrediction; \
    print('Downloading TTM model...'); \
    model = TinyTimeMixerForPrediction.from_pretrained('ibm-granite/granite-timeseries-ttm-r2', \
    cache_dir='/cache'); \
    print('TTM model downloaded successfully to /cache')"

# ============================================================================
# Stage 2: Final Application Image (AMD64 for OpenShift)
# ============================================================================
FROM --platform=linux/amd64 python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create cache directory
RUN mkdir -p /app/.cache/huggingface

# Copy downloaded model from stage 1 (ARM64) to stage 2 (AMD64)
# Model files are platform-independent, so this works perfectly
COPY --from=model-downloader /cache /app/.cache/huggingface

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /app/.cache
USER appuser

# Set HuggingFace cache directory
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5001/health')" || exit 1

# Run the application
CMD ["python", "main.py"]

# Made with Bob
