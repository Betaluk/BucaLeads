@echo off
echo ========================================================
echo        BUCALEADS - CONFIGURACAO DE NOVO COMPUTADOR
echo ========================================================
echo.
echo Este script prepara o ambiente (Python e Node.js) no seu
echo novo computador a partir da pasta sincronizada do Google Drive.
echo.

cd /d "%~dp0"

:: 1. Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado no PATH do Windows!
    echo Instale o Python 3.10+ em https://www.python.org e marque 'Add python.exe to PATH'.
    pause
    exit /b 1
)

:: 2. Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado no PATH do Windows!
    echo Instale o Node.js 18+ em https://nodejs.org.
    pause
    exit /b 1
)

echo [1/3] Preparando ambiente Python do Backend...
cd backend
if exist "venv" (
    echo Verificando ambiente virtual existente...
    call venv\Scripts\python.exe -c "import sys; sys.exit(0)" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [INFO] O venv sincronizado continha caminhos do outro computador. Recriando venv local...
        rmdir /s /q venv
        python -m venv venv
    )
) else (
    echo Criando novo ambiente virtual venv...
    python -m venv venv
)

echo Instalando/Atualizando dependencias Python...
call venv\Scripts\python.exe -m pip install --upgrade pip >nul 2>&1
call venv\Scripts\pip install -r requirements.txt
cd ..

echo.
echo [2/3] Instalando dependencias do Frontend React...
cd frontend
call npm install
cd ..

echo.
echo [3/3] Instalando dependencias do WhatsApp Service...
cd whatsapp-service
call npm install
cd ..

echo.
echo ========================================================
echo    Configuracao concluida com sucesso!
echo    Sua base de leads da Cloudflare e chaves estao prontas.
echo    Para iniciar o sistema, basta dar dois cliques em:
echo    -> start.bat
echo ========================================================
echo.
pause
