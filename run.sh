#!/bin/bash
echo "=================================================="
echo "        IMGCHEST Uploader Desktop Launcher"
echo "=================================================="
echo ""
echo "Starting application backend..."

# Detect standard python3 or python commands
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python is not installed or not in PATH."
    echo "Please install Python 3 and try again."
    read -p "Press enter to exit..."
    exit 1
fi

$PYTHON_CMD imgchest_uploader.py
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] The application terminated with an error."
    echo "Please make sure dependencies are installed using:"
    echo "pip install -r requirements.txt"
    echo ""
    read -p "Press enter to exit..."
fi
