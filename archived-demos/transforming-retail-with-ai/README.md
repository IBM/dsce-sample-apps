# Retail Demo Application

This is a full-stack retail demo application built for deployment on IBM Cloud Red Hat OpenShift.

Features:
- Product catalog browsing with filters and sorting
- User authentication (JWT-based) with bcryptjs password hashing
- User-specific carts (multi-user support)
- Checkout flow with inventory locking and stock decrement in the database
- Orders history (per user)
- PostgreSQL database
- NGINX-based production frontend container
- Health checks (readiness/liveness) for backend and frontend
- OpenShift-ready Kubernetes manifests

Stack:
- Backend: Node.js, Express, PostgreSQL (pg), bcryptjs, jsonwebtoken
- Frontend: React + Vite, Axios
- DB: PostgreSQL
- Container runtime: podman
- Registry: docker.io/sunilmanika

See `deploy-steps.md` for deployment steps on OpenShift.
