FROM docker.io/library/postgres:16-alpine

# Copy the SQL dump into the image
COPY full_dump.sql /tmp/full_dump.sql

# Ensure correct permissions (runs as postgres user in base image)
RUN chown postgres:postgres /tmp/full_dump.sql

USER postgres