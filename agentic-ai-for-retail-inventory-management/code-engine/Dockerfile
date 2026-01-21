FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements.txt
RUN uv pip install --system  --extra-index-url https://download.pytorch.org/whl/cpu  -r requirements.txt

COPY . .

CMD ["python", "app.py"]