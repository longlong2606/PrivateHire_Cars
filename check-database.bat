@echo off
chcp 65001 >nul
title Kiểm Tra Cơ Sở Dữ Liệu PostgreSQL - PrivateHire Cars
color 0A

echo ===============================================================
echo   🔍 ĐANG KIỂM TRA CƠ SỞ DỮ LIỆU POSTGRESQL (DATAGRIP)
echo ===============================================================
echo.

cd /d "%~dp0backend"
node check-db.js

echo.
pause

