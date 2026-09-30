@echo off
echo ===================================================
echo           INICIANDO BUCALEADS PLATFORM
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Iniciando Servico WhatsApp Baileys (Porta 3001)...
start "BucaLeads - WhatsApp Service" cmd /k "cd whatsapp-service && npm start"

echo [2/3] Iniciando Backend FastAPI (Porta 8000)...
start "BucaLeads - Backend" cmd /k "cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Iniciando Frontend React/Vite (Porta 5173)...
start "BucaLeads - Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 5 /nobreak >nul
echo.
echo Abrindo aplicacao no navegador: http://localhost:5173 ...
start http://localhost:5173

echo.
echo ===================================================
echo    BucaLeads rodando com sucesso!
echo    Frontend: http://localhost:5173
echo    API Docs: http://localhost:8000/docs
echo    WhatsApp: http://localhost:3001/status
echo ===================================================
pause
