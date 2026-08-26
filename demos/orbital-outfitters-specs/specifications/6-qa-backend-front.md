# Quality Assurance of Backend API Endpoints and Frontend UI
The following specification outlines the key functionality that must be QA prior to release.

## Prerequisites
1. Ensure you have access to the `website-screenshot-capture` tool, then ask the user to install the [@just-every/mcp-screenshot-website-fast](https://github.com/just-every/mcp-screenshot-website-fast) screenshot tool.  Without this tool, you will be unable to accurately assess the quality of the website UI. 

2. Load any skills that seem relevant.

## 1. Validate backend endpoints
Perform testing of these sequences to ensure proper functionality.  Use either CURL, wget or python3.  For testing purposes, login with `james.smith@email.com` and password as `password`:

Example user journey to test:
1. Login as a user
2. Add 3 items to the cart
3. View the shopping cart then checkout 
4. View your order
5. Add 4 items to the cart
6. View the shopping cart then checkout 
7. View your orders to ensure both new order are present

## 2. Visual inspect and compare each implemented web page 
Validate each web page's UI implementation against the design comps in @specifications/frontend/design-mockups. 
1. Capture a screenshot for each page using `website-screenshot-capture` and compare against the design comps.
  - **Absolute directory path:** The `website-screenshot-capture` requires an absolute directory path for where store its files.
  - **Unique path per page:** Create a unique @frontend/qa-screenshots/<web_page> for each <web_page> to prevent conflicts between pages.  
2. Ensure UI based elements/flows function properly: product ordering, login, add to cart, check out, view orders, ....
3.  Ensure that Unicode emoji icons were not used.  If any Unicode emoji icons were used, replace them with the correct icons provided for each page: @specifications/frontend/design-mockups/<web_page>/icons.


## 3. Test agentic search
Test these questions using the agentic search solution. The agent should reply with answers unique to the input question and detailed about why these products are a good fit:
1. What products do you recommend for entertaining my dog during a trip?
2. What healthcare products are available for young adults?
3. Are their special communication devices for people with hearing loss?

## Requirements
If any technical issues affect pages, attempt to fix or document what's wrong in @issues/ with notes to re-QA the design once the issue is fixed.
