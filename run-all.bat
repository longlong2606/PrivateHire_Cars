@echo off
echo ==========================================================
echo  DONG THOI KHOI DONG BACKEND VA FRONTEND (SCRUM PROJECT)
echo ==========================================================

start "Backend Server (Port 5000)" cmd /k "cd backend && npm run dev"
timeout /t 2 /nobreak > nul
start "Frontend Client (Port 5173)" cmd /k "cd frontend && npm run dev"

echo.
echo Da khoi dong Backend tai:  http://localhost:5000
echo Da khoi dong Frontend tai: http://localhost:5173
echo ==========================================================

