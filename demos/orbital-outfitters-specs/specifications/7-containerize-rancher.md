# Specification 6: Local Containerization using Rancher Desktop

The following specification outlines the steps required to containerize the application so that the vector database, frontend and backend all run as separate containers running locally in Rancher Desktop.

## Prerequisites

No specific skills are required for this specification. Load any skills that seem relevant — new ones may be added over time.

## Step 1: Containerize the application
Containerize the application while also allowing it to run locally outside of containers (e.g. via `npm start` for the front and backend).

## Step 2: Requirements to follow
The following guidelines must be followed when building the backend API endpoints:
- The containers will run in Rancher
- Use the dockerd (moby) Container Engine
- Store all container related files under /rancher
- If using native files tools like `read_files`, `write_files` or `list_files` doesn't provide the results or functionality you require, use `execute`.

## Step 3: Update .env
Update [.env](.env) with the agent environment and agent IDs to make updating easier between dev, staging and production.

`VITE_BACKEND_URL` must remain `http://localhost:3001` for Rancher. The browser calls the backend via the published Docker port — this is correct and intentional. Do **not** change this to a container service name; the browser cannot resolve internal Docker hostnames.

## Step 4: Documentation
Write documentation but keep it super simple and non-verbose.
- Max of 3-4 pages per .md file.  Place these into /rancher/docs.
- Update the swagger files

## Step 5: Update .gitignore
Ensure that the .gitignore contains all files that should not be checked into the repo.

