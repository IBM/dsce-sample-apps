# Financial LoanHub - Frontend

This is the frontend for the Financial LoanHub application, a modern web platform for applying for and managing loans. It is built with React, Vite, and the Carbon Design System.

## Features

-   **User Authentication:** Secure user registration and login using JWT (JSON Web Tokens).
-   **Persistent Sessions:** Users remain logged in across page refreshes using `localStorage`.
-   **Protected Routes:** Core application features are only accessible to authenticated users.
-   **Multi-Step Loan Application:** A user-friendly, multi-step form for submitting new loan applications with file uploads.
-   **PDF Application Upload:** An alternative application method allowing users to upload a pre-filled PDF.
-   **My Applications Dashboard:** A data table view for users to see the status and details of their submitted applications.
-   **Loan Calculator:** An interactive tool to help users estimate monthly loan payments.
-   **Responsive Design:** Styled with the Carbon Design System for a clean, professional, and responsive user interface.

## Tech Stack

-   **Framework:** [React](https://reactjs.org/)
-   **Build Tool:** [Vite](https://vitejs.dev/)
-   **UI Components:** [Carbon Design System](https://carbondesignsystem.com/)
-   **Routing:** [React Router](https://reactrouter.com/)
-   **State Management:** React Context API (for authentication)
-   **Language:** JavaScript (ES6+)

---

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (version 16.x or later recommended)
-   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
-   A running instance of the [backend server]

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/financial-loanhub-frontend.git
    cd financial-loanhub-frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

### Environment Configuration

This project requires an environment variable to connect to the backend API.

1.  Create a `.env` file in the root of the project directory:
    ```bash
    touch .env
    ```

2.  Add the following line to the `.env` file, pointing to the URL of your running backend server:
    ```
    VITE_API_URL=http://localhost:8000
    ```

### Running the Development Server

To start the local development server, run:

```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:5173` (or the next available port). The server will automatically reload when you make changes to the source code.

## Building for Production

To create a production-ready build of the application, run:

```bash
npm run build
# or
yarn build
```

This will create an optimized `dist` folder with static assets that can be deployed to any web hosting service.