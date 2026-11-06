@echo off
chcp 65001 >nul
title Xóa Sạch Database Để Test Lại - PrivateHire Cars
color 0C

echo ===============================================================
echo   🧹 ĐANG XÓA TOÀN BỘ TÀI KHOẢN ĐỂ TEST ĐĂNG KÝ / ĐĂNG NHẬP
echo ===============================================================
echo.

cd /d "%~dp0backend"
node clean-db.js

echo.
pause
