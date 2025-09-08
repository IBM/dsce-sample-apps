# Financial LoanHub - Backend

This is the backend API for the Financial LoanHub application. It is built with FastAPI and provides a secure, robust foundation for handling user authentication, loan applications, and data management.

## Features

-   **User Authentication:** Secure registration and login endpoints using JWT (JSON Web Tokens) and OAuth2 password flow.
-   **Password Security:** Passwords are never stored in plain text. They are securely hashed using `bcrypt`.
-   **Protected Endpoints:** API routes for application management are protected and require a valid JWT bearer token.
-   **Database Integration:** Uses SQLAlchemy to interact with a database (SQLite for development). The models are easily adaptable to production databases like PostgreSQL.
-   **Data Validation:** Leverages Pydantic for robust request and response data validation, ensuring data integrity.
-   **File Upload Handling:** Securely handles multipart form data for uploading application documents and saves them to the server.
-   **CORS Enabled:** Configured with Cross-Origin Resource Sharing (CORS) to allow requests from the frontend application.
-   **Organized Structure:** Code is organized into modules for database, models, schemas, and security for better maintainability.

## Tech Stack

-   **Framework:** [FastAPI](https://fastapi.tiangolo.com/)
-   **Database ORM:** [SQLAlchemy](https://www.sqlalchemy.org/)
-   **Authentication:** [python-jose](https://github.com/mpdavis/python-jose) for JWT, [passlib](https://passlib.readthedocs.io/en/stable/) with `bcrypt` for password hashing.
-   **Data Validation:** [Pydantic](https://pydantic-docs.helpmanual.io/)
-   **Server:** [Uvicorn](https://www.uvicorn.org/)
-   **Language:** Python 3.8+

---

## Getting Started

### Prerequisites

-   [Python](https://www.python.org/) (version 3.8 or later)
-   `pip` (Python package installer)

### Installation

1.  **Clone the repository:**

2.  **Install Dependencies (using uv):**

    - [Install uv](https://docs.astral.sh/uv/getting-started/installation/) if you don't have it.

    - Create a virtual environment and install dependencies:

    ```bash
    uv sync --locked
    ```

3. **Setup Environment Variables:**

   - Create an `.env` file (see [.env_example](./.env_example))

3. **Run the API:**

    ```bash
    uv run main.py
    ```

### Configuration

The JWT secret key should be configured for security.

1.  Open the `security.py` file.
2.  Find the `SECRET_KEY` variable.
3.  Replace the placeholder key with a strong, randomly generated key. You can generate one using OpenSSL:
    ```bash
    openssl rand -hex 32
    ```
    **Do not commit your production secret key to a public repository.** Use environment variables for production deployments.
