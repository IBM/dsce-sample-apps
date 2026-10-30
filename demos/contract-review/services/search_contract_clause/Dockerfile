FROM python:3.11-slim-bookworm@sha256:ad48290def663b9c7e86049c53ec6a07893df94c09ee7cebb3c6440b2e413fc3

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --system --uid 10001 --no-create-home appuser
USER 10001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
