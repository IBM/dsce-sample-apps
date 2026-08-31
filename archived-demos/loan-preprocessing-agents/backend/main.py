from dotenv import load_dotenv
load_dotenv()

import os
import json
import yaml
import shutil
import uvicorn
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, File, Form, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from utils.cos_client import COSClient
from utils.agents import invoke_agents, get_logs
from utils.chat_image import ChatWithImage
from utils.kv_extraction import extract_key_value_pairs

# These are your local modules
import models, schemas, security, database

# Create DB tables upon startup
models.Base.metadata.create_all(bind=database.engine)

image_client = ChatWithImage(model_id="meta-llama/llama-4-maverick-17b-128e-instruct-fp8", max_tokens=2000, top_p=0.1, temperature=0)

app = FastAPI(title="Loan Application API")
cos = COSClient()

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COS_BUCKET_NAME = os.getenv("COS_BUCKET_NAME", "loan-processing-bucket")
# --- File Handling ---
UPLOAD_DIRECTORY = "./uploads"
ZIP_FILE_PATH = "data/sample_documents.zip"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)
def save_upload_file(upload_file: UploadFile, destination: str):
    """Safely saves an uploaded file to a destination path."""
    try:
        with open(destination, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
        cos.upload_local_file_to_cos(local_filepath=destination, bucket_name=COS_BUCKET_NAME, output_filepath=destination)
    finally:
        upload_file.file.close()

def dict_to_markdown(data, indent=0):
    md = ''
    indent_str = '    ' * indent  # 4 spaces per indent level
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                md += f"{indent_str}- **{key}**:\n"
                md += dict_to_markdown(value, indent + 1)
            else:
                md += f"{indent_str}- **{key}**: {value}\n"
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, (dict, list)):
                md += dict_to_markdown(item, indent)
            else:
                md += f"{indent_str}- {item}\n"
    return md

def process_application_in_background(app_id, uploaded_files, application_file_path, db):
    db = database.SessionLocal()
    application_to_update = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not application_to_update:
        print(f"BACKGROUND TASK ERROR: Application with ID {app_id} not found.")
        return
    
    app_id_str = application_to_update.app_id_str
    print("Processing application...")
    application_status = invoke_agents(
        document_names=", ".join(uploaded_files),
        loan_application_file=application_file_path,
        application_id=app_id_str
    )
    print("Application Status from Agents:\n", application_status)
    # Update database with the final status from agents
    application_to_update.status = application_status.get("loan_application_status", "Processing Failed")
    validation_comments = application_status.get("validation_details", {"error": "Error processing application"})
    application_to_update.validation_comments = dict_to_markdown(validation_comments)
    db.commit()

# --- Authentication Endpoints ---

@app.post("/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = security.get_user(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        hashed_password=hashed_password,
        first_name=user.firstName,
        last_name=user.lastName,
        date_of_birth=user.dateOfBirth
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = security.get_user(db, username=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserDetail)
async def read_users_me(current_user: models.User = Depends(security.get_current_user)):
    return current_user

@app.get("/list_applications", response_model=List[schemas.Application])
async def get_user_applications(
    current_user: schemas.User = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    # This now only returns applications for the logged-in user
    apps = db.query(models.Application).filter(models.Application.owner_id == current_user.id).all()
    apps = [schemas.Application.model_validate(app) for app in apps]
    return apps

@app.post("/submit_form")
async def submit_application_form(
    background_tasks: BackgroundTasks,
    formDataJson: str = Form(...),
    idProof: UploadFile = File(...),
    incomeProof: UploadFile = File(...),
    addressProof: UploadFile = File(...),
    additionalDocs: Optional[List[UploadFile]] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.User = Depends(security.get_current_user),
):
    form_data = json.loads(formDataJson)
    app_id_str = f"app_{int(datetime.now().timestamp())}"
    
    # Associate with current user
    new_application = models.Application(
        app_id_str=app_id_str,
        applicant_name=f"{form_data.get('firstName', '')} {form_data.get('lastName', '')}",
        loan_type=form_data.get("loanType", "N/A"),
        amount=float(form_data.get("loanAmount", 0)),
        status="Pending",
        validation_comments="",
        submitted_date=datetime.now().strftime("%Y-%m-%d"),
        owner_id=current_user.id
    )
    db.add(new_application)
    db.commit()

    # --- File Saving Logic ---
    app_upload_dir = os.path.join(UPLOAD_DIRECTORY, app_id_str)
    application_file_path = os.path.join(app_upload_dir, "application_data.json")
    cos.upload_json_to_cos(json_content=form_data, bucket_name=COS_BUCKET_NAME, output_filepath=application_file_path)

    os.makedirs(app_upload_dir, exist_ok=True)
    uploaded_files = [os.path.join(app_upload_dir, idProof.filename),
                      os.path.join(app_upload_dir, incomeProof.filename),
                      os.path.join(app_upload_dir, addressProof.filename)]
    try:
        save_upload_file(idProof, os.path.join(app_upload_dir, idProof.filename))
        save_upload_file(incomeProof, os.path.join(app_upload_dir, incomeProof.filename))
        save_upload_file(addressProof, os.path.join(app_upload_dir, addressProof.filename))
        if additionalDocs:
            for doc in additionalDocs:
                save_upload_file(doc, os.path.join(app_upload_dir, doc.filename))
                uploaded_files.append(os.path.join(app_upload_dir, doc.filename))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving files: {e}")

    background_tasks.add_task(
        process_application_in_background,
        new_application.id,
        uploaded_files,
        application_file_path,
        db
    )
        
    return {"status": "success", "message": "Application submitted.", "application_id": app_id_str}

@app.post("/submit_pdf_form")
async def submit_pdf_form(
    background_tasks: BackgroundTasks,
    applicationPdf: UploadFile = File(...),
    idProof: UploadFile = File(...),
    incomeProof: UploadFile = File(...),
    addressProof: UploadFile = File(...),
    additionalDocs: List[UploadFile] = File([]),
    db: Session = Depends(database.get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    app_id_str = f"pdf_{int(datetime.now().timestamp())}"

    # --- File Saving Logic ---
    app_upload_dir = os.path.join(UPLOAD_DIRECTORY, app_id_str)
    os.makedirs(app_upload_dir, exist_ok=True)
    uploaded_files = [os.path.join(app_upload_dir, idProof.filename),
                      os.path.join(app_upload_dir, incomeProof.filename),
                      os.path.join(app_upload_dir, addressProof.filename)]
    try:
        save_upload_file(applicationPdf, os.path.join(app_upload_dir, applicationPdf.filename))
        save_upload_file(idProof, os.path.join(app_upload_dir, idProof.filename))
        save_upload_file(incomeProof, os.path.join(app_upload_dir, incomeProof.filename))
        save_upload_file(addressProof, os.path.join(app_upload_dir, addressProof.filename))
        for doc in additionalDocs:
            save_upload_file(doc, os.path.join(app_upload_dir, doc.filename))
            uploaded_files.append(os.path.join(app_upload_dir, doc.filename))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving files: {e}")
    
    form_data = extract_key_value_pairs(image_client, filename=os.path.join(app_upload_dir, applicationPdf.filename))
    applicant_name = form_data.get("full_name", current_user.username)
    loan_type = form_data.get("loan_type", "PDF Application")
    loan_amount = form_data.get("loan_amount", 0)

    application_file_path = os.path.join(app_upload_dir, "application_data.json")
    cos.upload_json_to_cos(json_content=form_data, bucket_name=COS_BUCKET_NAME, output_filepath=application_file_path)

    new_application = models.Application(
        app_id_str=app_id_str,
        applicant_name=applicant_name,
        loan_type=loan_type,
        amount=loan_amount,
        status="Pending ",
        submitted_date=datetime.now().strftime("%Y-%m-%d"),
        owner_id=current_user.id
    )
    db.add(new_application)
    db.commit()


    background_tasks.add_task(
        process_application_in_background,
        new_application.id,
        uploaded_files,
        application_file_path,
        db
    )

    return {"status": "success", "message": "PDF application submitted successfully.", "application_id": app_id_str}

@app.get("/get_logs/{app_id_str}")
async def get_application_logs(
    app_id_str: str,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    # Find the application and ensure it belongs to the current user
    application = db.query(models.Application).filter(
        models.Application.app_id_str == app_id_str,
        models.Application.owner_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found or access denied.")
    logs = get_logs(app_id_str)
    return {"logs": logs}

@app.get("/download_sample_documents")
async def download_file():
    if not os.path.exists(ZIP_FILE_PATH):
        return {"error": "File not found"}
    return FileResponse(
        path=ZIP_FILE_PATH,
        media_type="application/zip",
        filename="sample_documents.zip"
    )
    
# Standard entry point to run the app
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)