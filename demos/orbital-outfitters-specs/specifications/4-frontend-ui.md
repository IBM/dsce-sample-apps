# Specification: Frontend UI
The following specification outlines the steps required to build the frontend (UI) for the Orbital Suppliers website.

## Prerequisites
1. Ensure you have access to the `website-screenshot-capture` tool, then ask the user to install the [@just-every/mcp-screenshot-website-fast](https://github.com/just-every/mcp-screenshot-website-fast) screenshot tool.  Without this tool, you will be unable to accurately assess the quality of the website UI. 

2. Load any skills that seem relevant.

## Step 1: Review Backend APIs
Review the swagger document to understand how to call the backend API endpoints.  Some design comps may functionality for which a backend api endpoint can't yet be built.  For these elements, display "Functionality under development" when clicked.  For example:
- Track Order
- Checkout

## Step 2: Build Home page
Visual mockups for the Home page can be found at @specifications/frontend/design-mockups/home/home_page.png.  From that mockup, you'll see the home page requires a large background image: @specifications/frontend/design-mockups/home/home_page_background.gif. This is Orbital Outfitters logo: @specifications/frontend/design-mockups/home/logo_orbital_suppliers.gif.  

### Icons
There are numerous icons used throughout ech web page, found here: @specifications/frontend/design-mockups/<page>/icons, where <page> is one of the web pages to-be-built.
* Do not use Unicode emoji characters for the website icons.  Use the icons provided for each page.
* The NavBar cart icon should show a live item count that updates after each Add to Cart. 

### Brand color pallete 
- This is the brand color pallete: 
   - [image](specifications/frontend/ibm_brand_color_palette_2026.png)
   - [text](specifications/frontend/ibm_brand_color_palette_2026.txt)

## Step 3: Build additional pages
Visual mockups for all other pages are in @specifications/frontend/design-mockups.  Build each page as closely to these mockups as possible.  Ensure the backend server endpoints provide all required functionality and return the data required for these pages.

### Login required for Cart/Orders functionality
Users must login to access Cart and Orders functionality. When the user attempts to access these areas, and is not logged-in, display the modal login dialog box.  
- While login is required, this is a demo so the login provides an "Autocomplete" button randomly selects from the user database and populates both fields. The initial fields should be blank as shown in @specifications/frontend/design-mockups/login/login_popup.png
- Users should login via their email
- Add to Cart buttons = "Please sign in to add this item to the cart"
- View Cart buttons = "Please sign in to view your cart"

## Step 4: QA website both visually and functionally
Validate that all functionality in present in @specifications/frontend/design-mockups/ works or has a "Functionality under development" popup.  Use the `website-screenshot-capture` tool to take screenshots to ensure correct visual implementation.  

### How use the website-screenshot-capture tool
The `website-screenshot-capture` requires an directory for storing its files. Create @frontend/qa-screenshots/ as a temporary folder to store the screenshots.  When providing this folder to `website-screenshot-capture`, you must provide the absolute directory path else an error will occur.  
* Ensure that you provide a random subdirectory name `xxxxx` so your image don't conflict with others.

## Requirements to follow
The following guidelines must be followed when building the frontend:
- Use JavaScript XML (.jsx) and the React framework running in a NodeJS runtime environment
- Use the axios networking libraries
- Create all frontend files under [/frontend](/frontend).

### `VITE_BACKEND_URL` — environment-specific values
`VITE_BACKEND_URL` is the axios `baseURL` baked into the browser bundle at build time. Its correct value depends on the environment:

| Environment | Value | How it works |
|---|---|---|
| **Local (native)** | `http://localhost:3001` | Browser calls backend directly — correct since both run on localhost |
| **Rancher (containers)** | `http://localhost:3001` | Browser calls backend via the published Docker port — correct since ports are mapped to localhost |
| **OpenShift** | `""` (empty string) | `axiosClient.js` converts `""` to `/api` as the actual `baseURL`. All API calls become `/api/<route>`, which nginx proxies to the `backend` Service stripping the prefix. **Never set this to the OpenShift hostname** — the browser would bypass nginx and hit the backend directly over an internal port, causing a mixed-content error. |
 
## Cleanup
- Write documentation but keep it super simple and non-verbose.  Max of 3-4 pages per .md file.  Place these into [frontend/docs](frontend/docs).
- Update .env with variables best stored outside code for re-use in Dev, Staging and Production. 
- Update .gitignore with any files that should not be checked into the repo.

