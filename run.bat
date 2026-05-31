@echo off
title IMGCHEST Uploader
echo ==================================================
echo         IMGCHEST Uploader Desktop Launcher
echo ==================================================
echo.
echo Starting application backend...
python imgchest_uploader.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] The application terminated with an error or Python is not installed.
    echo Please make sure dependencies are installed using:
    echo pip install -r requirements.txt
    echo.
    pause
)
