# Use the official Selenium Standalone Chrome image as the base image
FROM registry.access.redhat.com/ubi8/python-311:latest

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file to the container and install dependencies
COPY requirements.txt /app/requirements.txt
USER 0
RUN pip3 install -r requirements.txt

# Copy your FastAPI Python script to the container
COPY . .

RUN python3 prereqs.py

EXPOSE 4050

# Set the command to run your Python script
CMD ["python3", "app.py"]
