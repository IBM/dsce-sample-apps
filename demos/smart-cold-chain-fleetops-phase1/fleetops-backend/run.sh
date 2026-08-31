#!/bin/bash

# FleetOps Backend - Run Script

echo "==================================="
echo "FleetOps Simulation Backend"
echo "==================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment with Python 3.12..."
    python3.12 -m venv venv || python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "==================================="
echo "Starting FleetOps Backend Server"
echo "==================================="
echo ""
echo "API will be available at: http://localhost:8085"
echo "API Documentation: http://localhost:8085/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the server
cd ..
uvicorn fleetops-backend.app.main:app --reload --host 0.0.0.0 --port 8085

# Made with Bob
