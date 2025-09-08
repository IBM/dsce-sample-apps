from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    first_name = Column(String, index=True)
    last_name = Column(String, index=True)
    date_of_birth = Column(String)
    applications = relationship("Application", back_populates="owner")

class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    app_id_str = Column(String, unique=True, index=True)
    applicant_name = Column(String)
    loan_type = Column(String)
    amount = Column(Float)
    status = Column(String)
    submitted_date = Column(String)
    validation_comments = Column(String, nullable=True)  # Optional comments field
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="applications")