# Environment Configuration Reference

Key `.env` variables that differ between environments. All values live in `.env` only — never hard-coded.

## Environment-specific values

| Variable | Local (native) | Rancher (containers) | OpenShift |
|---|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:3001` | `http://localhost:3001` | `""` (empty) |
| `BACKEND_SERVER_URL` | `http://localhost:3001` | `http://backend:3001` | `http://backend:3001` |
| `CHROMA_HOST` | `localhost` | `chromadb` | `chromadb` |
| `CHROMA_PORT` | `8000` | `8000` | `8000` |
| `CHROMA_SERVER_URL` | `http://localhost:8000` | `http://chromadb:8000` | `http://chromadb:8000` |

## Why `VITE_BACKEND_URL` is empty on OpenShift

`VITE_BACKEND_URL` is the axios `baseURL` baked into the browser bundle at build time. On OpenShift:

- The frontend Route terminates TLS at the OpenShift edge — there is no separate backend Route
- Setting `VITE_BACKEND_URL` to the OpenShift hostname causes the browser to call the backend directly over HTTP on an internal port, which the browser blocks as a mixed-content error
- Setting it to `""` makes axios use relative URLs (e.g. `/api/products`), which the browser sends to the same origin, and the nginx proxy inside the frontend pod routes them to `http://backend:3001` internally

## Why container hostnames differ from local

In Docker Compose and on OpenShift, services reach each other using their service names as hostnames (`backend`, `chromadb`). Locally, everything binds to `localhost`. `BACKEND_SERVER_URL` and `CHROMA_*` variables must reflect this — the backend uses them server-side to reach ChromaDB.

`VITE_BACKEND_URL` is the exception: it is resolved by the **browser**, not the server, so container hostnames are never valid values for it.
