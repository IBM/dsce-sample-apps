# Headless Bob core service — lean image: Python + Bob Shell v2, nothing else.
# Bob version is PINNED (the lesson from the v1→v2 breakage that hit the
# bobserver forks: never let `latest` into a build).

FROM registry.access.redhat.com/ubi9/python-311:latest

ARG BOB_VERSION=2.0.4
# SHA-256 of bobshell-${BOB_VERSION}.tgz, pinned here so a build cannot pick
# up a different artifact than the one we validated. Update both together and
# run scripts/verify_bob_version.sh on the new image.
ARG BOB_SHA256=10de047ffdc23a50f3e1ef69fad3b6313ff6dda0010589a22efe26b24685254b

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    HOME=/workspace/home \
    HB_ROOT=/workspace \
    HB_DB=/workspace/headless-bob.db \
    HB_BOB_BIN=bob \
    HB_WORKERS=3

WORKDIR /app

USER 0

RUN dnf -y module reset nodejs && \
    dnf -y module enable nodejs:22 && \
    dnf -y install nodejs npm && \
    dnf clean all && \
    curl -fsSL -o /tmp/bobshell.tgz \
      "https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-${BOB_VERSION}.tgz" && \
    echo "${BOB_SHA256}  /tmp/bobshell.tgz" | sha256sum -c - && \
    npm install -g /tmp/bobshell.tgz && rm /tmp/bobshell.tgz && \
    bob --version && \
    mkdir -p /workspace/home && \
    chgrp -R 0 /workspace /opt/app-root/src && \
    chmod -R g=u /workspace /opt/app-root/src

COPY pyproject.toml README.md ./
COPY src ./src
COPY seeds ./seeds

RUN python3.11 -m pip install --no-cache-dir . && \
    chgrp -R 0 /app /workspace && \
    chmod -R g=u /app /workspace

USER 1001:0

EXPOSE 8080

CMD ["python3.11", "-m", "headless_bob", "serve"]
