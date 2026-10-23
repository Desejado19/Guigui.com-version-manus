$response = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 10
Write-Host "Status: $($response.StatusCode)"
Write-Host "Content-Type: $($response.Headers['Content-Type'])"
Write-Host "Length: $($response.Content.Length)"
Write-Host "Has root div: $($response.Content -match 'id=\"root\"')"
Write-Host "Has @vite/client: $($response.Content -match '@vite/client')"
Write-Host "First 300 chars:"
Write-Host $response.Content.Substring(0,[Math]::Min(300,$response.Content.Length))