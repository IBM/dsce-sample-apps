FROM python:3.11-slim
RUN apt update
RUN apt install git -y
COPY .  .

RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install git+https://github.com/PyFPDF/fpdf2.git@master
RUN pip install -r requirements.txt

# Create db and cache directories with proper permissions
RUN mkdir -p /db && chmod 777 /db
RUN mkdir -p /cache/tools && chmod 777 /cache/tools

# Clean up any existing milvus db file and create as directory
# Milvus expects a directory, not a file
RUN rm -f /db/milvus_goldman_report.db && mkdir -p /db/milvus_goldman_report.db && chmod 777 /db/milvus_goldman_report.db

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
