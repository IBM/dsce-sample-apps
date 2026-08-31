from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
def get_start_page(request: Request):
    return templates.TemplateResponse("main.html", {
        "request": request,
        "AGENT_ID": os.getenv("AGENT_ID"),
        "WX_HOST_URL": os.getenv("WX_HOST_URL"),
        "WX_CRN": os.getenv("WX_CRN"),
        "ORCHESTRATION_ID":os.getenv("ORCHESTRATION_ID")
    })
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=4000)