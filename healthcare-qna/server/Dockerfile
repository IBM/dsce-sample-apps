FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
COPY app.py .
COPY static static
COPY upload upload

RUN python -m venv venv
RUN venv/bin/pip install --upgrade pip
RUN venv/bin/pip install -r requirements.txt


RUN pip3 install python-dotenv
#RUN pip3 install langchain
#RUN pip3 install genai
#RUN pip3 install ibm-generative-ai==0.1.17
RUN pip3 install pydantic>=1.10.0

CMD . venv/bin/activate && exec python app.py 
