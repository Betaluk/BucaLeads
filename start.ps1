# Script de inicialização BucaLeads (PowerShell)
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "          INICIANDO BUCALEADS PLATFORM            " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/3] Iniciando Servico WhatsApp Baileys (Porta 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\whatsapp-service'; npm start"

Write-Host "[2/3] Iniciando Backend FastAPI (Porta 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\backend'; .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Write-Host "[3/3] Iniciando Frontend React/Vite (Porta 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\frontend'; npm run dev"

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Abrindo aplicacao no navegador: http://localhost:5173 ..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "WhatsApp: http://localhost:3001/status" -ForegroundColor Green

