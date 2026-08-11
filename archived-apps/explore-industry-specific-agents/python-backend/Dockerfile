FROM python:3.11-slim

COPY .  .

RUN pip install --no-cache-dir --upgrade pip
# RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
# RUN pip install --no-cache-dir sentence-transformers
RUN pip install -r requirements.txt

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]