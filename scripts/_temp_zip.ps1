
$source = 'C:\Users\PC\Downloads\Guigui.com-completo-para-download'
$zipPath = 'C:\Users\PC\Desktop\Guigui.com-completo.zip'

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
