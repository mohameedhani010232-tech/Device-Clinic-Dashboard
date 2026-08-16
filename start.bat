@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo   عيادة جهاز مدينة العبور - الخادم المركزي
echo ================================================
echo.
if not exist "node_modules\express\package.json" (
  echo جاري تثبيت مكونات المشروع لأول مرة...
  call npm install
  if errorlevel 1 (
    echo فشل تثبيت المكونات. تأكد من تثبيت Node.js ووجود الإنترنت.
    pause
    exit /b 1
  )
)
echo.
echo سيتم تشغيل الخادم على المنفذ 5000.
echo من نفس الجهاز: http://localhost:5000
echo من الأجهزة الأخرى على نفس الشبكة: http://IP-الجهاز-المشغل:5000
echo.
echo اترك هذه النافذة مفتوحة أثناء استخدام النظام.
echo.
call npm start
pause
