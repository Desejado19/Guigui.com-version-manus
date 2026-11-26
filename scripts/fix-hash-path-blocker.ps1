<#
  fix-hash-path-blocker.ps1

  Remove o carácter '#' do caminho do projecto para desbloquear Vite/Vitest.

  PORQUÊ: o Vite converte caminhos absolutos em URLs com o prefixo '/@fs/'.
  O '#' é delimitador de fragmento de URL, pelo que tudo a partir dele é
  truncado e a resolução de módulos falha com:
      Error: Cannot find module '/@fs/C:/Users/.../## SOF/...'

  Isto não é configurável. Foi reportado em vitejs/vite#13123 e fechado como
  "not planned"; o PR vitejs/vite#19683 apenas melhorou a mensagem de aviso.
  A única correcção é remover o '#' do caminho.

  COMO USAR:
    1. Fecha COMPLETAMENTE o Visual Studio Code (todas as janelas).
       O file watcher do editor mantém um handle na pasta do projecto e o
       Windows recusa renomear uma pasta com um handle aberto.
    2. Corre num terminal PowerShell, fora do projecto:
         powershell -ExecutionPolicy Bypass -File scripts\fix-hash-path-blocker.ps1
    3. Reabre o VS Code na nova localização.

  O script é idempotente: pode ser corrido várias vezes sem efeitos colaterais.
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Parent = Split-Path -Parent $PSScriptRoot
$OldName = Split-Path -Leaf $Parent
$TargetPath = Join-Path (Split-Path -Parent $Parent) 'SOF'

function Write-Step($Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

Write-Step "Pasta actual : $Parent"

# 1. Já foi aplicado?
if ($OldName -notmatch '#') {
    Write-Step "Nada a fazer: o caminho não contém '#'."
    exit 0
}

# 2. O destino já existe?
if (Test-Path -LiteralPath $TargetPath) {
    $item = Get-Item -LiteralPath $TargetPath -Force

    # Um junction obsoleto pode ser removido em segurança: apaga apenas o link.
    if ($item.LinkType -eq 'Junction') {
        Write-Step "A remover junction obsoleto em '$TargetPath' -> $($item.Target)"
        [System.IO.Directory]::Delete($TargetPath)
    }
    else {
        throw "Destino '$TargetPath' já existe e NÃO é um junction. Resolve manualmente antes de continuar."
    }
}

# 3. O VS Code (ou outro processo) ainda retém a pasta?
$codeProcesses = @(Get-Process -Name Code -ErrorAction SilentlyContinue)
if ($codeProcesses.Count -gt 0) {
    $openWindows = @($codeProcesses | Where-Object { $_.MainWindowTitle })
    Write-Warning "Há $($codeProcesses.Count) processos do VS Code activos" +
        "$(if ($openWindows.Count -gt 0) { " ($($openWindows.Count) janela(s) aberta(s))" } else { '' })."
    Write-Warning "Se o rename falhar com 'Acesso negado', fecha o VS Code por completo e corre este script de novo."
}

# 4. Renomear.
Write-Step "A renomear '$OldName' -> 'SOF' ..."
try {
    Rename-Item -LiteralPath $Parent -NewName 'SOF' -ErrorAction Stop
}
catch {
    throw "Renomear falhou: $($_.Exception.Message)`n" +
        'Fecha o VS Code por completo (ver menu de topo) e corre este script novamente.'
}

# 5. Confirmar.
$projectDirs = @(Get-ChildItem -LiteralPath $TargetPath -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'package.json') })

if ($projectDirs.Count -eq 0) {
    Write-Step "Concluído. Novo caminho: $TargetPath"
}
else {
    foreach ($projectDir in $projectDirs) {
        Write-Step "Concluído. Projecto agora em: $($projectDir.FullName)"
    }
}

Write-Step "Valida a correcção com:  npx vitest run tests/unit/components"
