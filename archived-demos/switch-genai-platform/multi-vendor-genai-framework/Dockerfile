ARG RUNTIME_BASE=registry.access.redhat.com/ubi8/ubi-minimal:8.8-1014

FROM ${RUNTIME_BASE} as base

ENV SERVICE_PORT=8000 \
    PIP_DEFAULT_TIMEOUT=100 \
    # Allow statements and log messages to immediately appear
    PYTHONUNBUFFERED=1 \
    # disable a pip version check to reduce run-time & log-spam
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # cache is useless in docker image, so disable to reduce image size
    PIP_NO_CACHE_DIR=1

# Setting up the working directory
WORKDIR /app
COPY requirements.txt /app/requirements.txt

RUN microdnf install python3.9 -y && \
    python3 -m ensurepip --upgrade && \
    python3 -m pip install pip==22.3 && \
    pip3 install --no-cache-dir -r requirements.txt && \
    rm -rf /var/cache/dnf /var/cache/yum /var/lib/apt/lists/* && \
    python3 --version > /app/python-version.txt && \
    pip3 -V > /app/pip-version.txt

COPY openapi-specs.yaml /app/openapi-specs.yaml
COPY providers.json /app/providers.json
COPY core /app/core
COPY payload /app/payload
COPY main.py /app/main.py

EXPOSE ${SERVICE_PORT}

ENTRYPOINT ["python3","main.py"]