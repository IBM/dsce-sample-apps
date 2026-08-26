# Setup Guide — Orbital Suppliers Frontend

## Prerequisites

- Node.js 18+ and npm 9+
- The backend Express server running on port 3001

## Install & Run

```bash
cd frontend
npm install
npm run dev        # starts Vite dev server at http://localhost:5173
```

## Environment Variables

Create `frontend/.env`:

```
VITE_BACKEND_URL=http://localhost:3001
```

| Variable | Local | OpenShift |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:3001` | `""` (empty — uses relative URLs via nginx proxy) |

> **Never** set `VITE_BACKEND_URL` to an internal container hostname on OpenShift.
> The browser would attempt a cross-origin request on an internal port, which browsers block.

## Build for Production

```bash
cd frontend
npm run build      # outputs to frontend/dist/
npm run preview    # serves the build locally for verification
```

## Lint

```bash
npm run lint       # runs oxlint
```

## Demo Users

Use the **Autocomplete with random user** button on the Login modal, or log in manually:

| Email | Password |
|---|---|
| james.smith@email.com | password |
| sarah.johnson@email.com | password |
| michael.williams@email.com | password |
