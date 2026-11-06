@echo off
echo ==========================================================
echo  DONG THOI KHOI DONG BACKEND VA FRONTEND (SCRUM PROJECT)
echo ==========================================================

echo [1/3] Kiem tra va giai phong cong 5000, 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

timeout /t 1 /nobreak > nul

echo [2/3] Khoi dong Backend Server tren cong 5000...
start "Backend Server (Port 5000)" cmd /k "cd backend && npm run dev"
timeout /t 2 /nobreak > nul

echo [3/3] Khoi dong Frontend Client tren cong 5173...
start "Frontend Client (Port 5173)" cmd /k "cd frontend && npm run dev"

echo.
echo ==========================================================
echo  DA KHOI DONG HE THONG THANH CONG!
echo  - Backend API:  http://localhost:5000
echo  - Frontend Web: http://localhost:5173
echo ==========================================================

