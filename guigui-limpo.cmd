@echo off
setlocal EnableExtensions EnableDelayedExpansion
REM ============================================================================
REM  Guigui.com - correr num caminho sem '#'
REM
REM  Porque este ficheiro existe:
REM  O Vite (dev server) e o Vitest (testes unitarios) quebram quando o caminho
REM  do projecto contem '#', porque o interpretam como fragmento de URL e cortam
REM  o caminho. A pasta actual esta em "...\NEXUS-GW\## SOF\Guigui...", por isso
REM  nem junctions nem 'subst' resolvem (seguem sempre o caminho real com '#').
REM
REM  O que este script faz:
REM  1) Espelha os FONTES deste projecto para C:\guigui (caminho curto e limpo).
REM  2) Na primeira execucao, copia tambem o node_modules (pesado; so uma vez).
REM  3) Entra em C:\guigui e corre o comando pedido.
REM
REM  Uso:
REM     guigui-limpo.cmd              -> sincroniza e arranca o servidor (npm run dev)
REM     guigui-limpo.cmd check        -> npm run check   (tipagem)
REM     guigui-limpo.cmd test:unit    -> npm run test:unit
REM     guigui-limpo.cmd test:e2e     -> npm run test:e2e  (Playwright)
REM     guigui-limpo.cmd shell        -> so abre o terminal em C:\guigui
REM ============================================================================

REM Pasta deste script = fonte (o projecto original, com '#'). Robocopy lida bem
REM com '#' na fonte; o problema era so do Vite/Vitest a resolver URLs.
set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

REM Destino: caminho curto, sem '#', sem espacos.
set "DEST=C:\guigui"

REM Comando a correr (por omissao: dev).
set "CMD=%~1"
if "%CMD%"=="" set "CMD=dev"

echo.
echo [guigui] Fonte : %SRC%
echo [guigui] Destino: %DEST%
echo [guigui] Comando: %CMD%
echo.

if not exist "%DEST%" mkdir "%DEST%"

REM --- 1) node_modules: copiar apenas quando ainda nao existir -----------------
if not exist "%DEST%\node_modules\vite\package.json" (
  echo [guigui] Primeira execucao: a copiar node_modules ^(261 MB, pode demorar^)...
  robocopy "%SRC%\node_modules" "%DEST%\node_modules" /E /MT:16 /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 (
    echo [guigui] ERRO ao copiar node_modules. corrida abortada.
    exit /b 1
  )
  echo [guigui] node_modules copiado.
)

REM --- 2) fontes: espelhar (exclui o pesado e as pastas de resultado) ----------
REM /MIR espelha: o destino fica igual a fonte nos fontes. node_modules e
REM .tools estao em /XD, portanto nunca sao tocados aqui.
echo [guigui] A sincronizar fontes...
robocopy "%SRC%" "%DEST%" /MIR ^
  /XD node_modules .tools dist playwright-report test-results .git ^
  /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo [guigui] ERRO ao sincronizar fontes. corrida abortada.
  exit /b 1
)
echo [guigui] Fontes sincronizados.
echo.

REM --- 3) entrar no destino e correr ------------------------------------------
cd /d "%DEST%"

if /i "%CMD%"=="shell" (
  echo [guigui] Terminal aberto em %DEST%. Escreve 'exit' para sair.
  cmd /k
  exit /b 0
)

echo [guigui] A correr: npm run %CMD%
echo.
npm run %CMD%
exit /b %errorlevel%
