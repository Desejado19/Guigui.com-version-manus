import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const sourceDir = process.cwd();
const desktopZip = path.join(process.env.USERPROFILE || 'c:\\Users\\PC', 'Desktop', 'Guigui.com-completo.zip');

console.log('Source directory:', sourceDir);
console.log('Destination ZIP:', desktopZip);

if (fs.existsSync(desktopZip)) {
  fs.unlinkSync(desktopZip);
}

// Create powershell script file to execute cleanly
const psScriptPath = path.join(process.cwd(), 'scripts', '_temp_zip.ps1');
const psContent = `
$source = '${sourceDir}'
$zipPath = '${desktopZip}'

$exclude = @('node_modules', 'dist', '.git', '.vercel', 'test-results', 'playwright-report')

$tempDir = Join-Path $env:TEMP ('guigui_build_' + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Get-ChildItem -Path $source -Force | ForEach-Object {
    if ($exclude -notcontains $_.Name -and $_.Name -notlike '*.zip') {
        Copy-Item -Path $_.FullName -Destination $tempDir -Recurse -Force
    }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Remove-Item -Path $tempDir -Recurse -Force
Write-Host "ZIP created successfully: $((Get-Item $zipPath).Length) bytes"
`;

fs.writeFileSync(psScriptPath, psContent, 'utf8');

try {
  const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
    stdio: 'inherit',
  });
} finally {
  if (fs.existsSync(psScriptPath)) {
    fs.unlinkSync(psScriptPath);
  }
}
