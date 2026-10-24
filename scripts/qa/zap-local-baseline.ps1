param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$baseUrl = [Environment]::GetEnvironmentVariable('QA_BASE_URL')
$mode = 'baseline'
$tsxLauncher = Join-Path $repoRoot 'node_modules\.bin\tsx.cmd'
$scopeValidator = Join-Path $PSScriptRoot 'validate-zap-scope.ts'

if ([string]::IsNullOrWhiteSpace($baseUrl)) {
  throw 'QA_BASE_URL must be set to the approved local QA origin before ZAP runs.'
}
if (-not (Test-Path -LiteralPath $tsxLauncher -PathType Leaf)) {
  throw 'The local TypeScript runner is unavailable; restore project dependencies before ZAP.'
}

$validatorArguments = @($scopeValidator, $baseUrl, $mode)
if (-not $ValidateOnly) {
  $validatorArguments += '--check-health'
}
& $tsxLauncher @validatorArguments
if ($LASTEXITCODE -ne 0) {
  throw 'ZAP scope validation failed; no scanner was started.'
}

$zapHome = if ([string]::IsNullOrWhiteSpace($env:ZAP_HOME)) {
  Join-Path $env:ProgramFiles 'ZAP\Zed Attack Proxy'
} else {
  $env:ZAP_HOME
}
$zapLauncher = Join-Path $zapHome 'zap.bat'
if (-not (Test-Path -LiteralPath $zapLauncher -PathType Leaf)) {
  throw 'OWASP ZAP was not found; install it separately before running the passive baseline.'
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  $javaRoots = @(
    (Join-Path $env:ProgramFiles 'Eclipse Adoptium'),
    (Join-Path $env:ProgramFiles 'Java')
  )
  $javaExecutable = $null
  foreach ($javaRoot in $javaRoots) {
    if (Test-Path -LiteralPath $javaRoot -PathType Container) {
      $javaExecutable = Get-ChildItem -LiteralPath $javaRoot -Directory |
        ForEach-Object { Join-Path $_.FullName 'bin\java.exe' } |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1
      if ($javaExecutable) { break }
    }
  }
  if (-not $javaExecutable) {
    throw 'OWASP ZAP requires Java, but no local Java runtime was found.'
  }
  $env:PATH = "$(Split-Path -Parent $javaExecutable);$env:PATH"
}

$proxyPort = 4314
$existingProxy = Get-NetTCPConnection -State Listen -LocalPort $proxyPort -ErrorAction SilentlyContinue
if ($existingProxy) {
  throw "ZAP's loopback proxy port $proxyPort is already in use; refusing to bind."
}

$runId = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
if ([string]::IsNullOrWhiteSpace($env:QA_ARTIFACT_DIR)) {
  $qaDirectory = Join-Path $repoRoot '.local-qa\zap'
  $outputDirectory = Join-Path $qaDirectory $runId
} else {
  $campaignRoot = [System.IO.Path]::GetFullPath($env:QA_ARTIFACT_DIR)
  $allowedRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'test-results\qa')).TrimEnd('\') + '\'
  if (-not $campaignRoot.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'QA_ARTIFACT_DIR must be inside the campaign test-results/qa directory.'
  }
  $outputDirectory = Join-Path $campaignRoot 'zap'
}
if (Test-Path -LiteralPath $outputDirectory) {
  throw 'The ZAP output directory already exists; refusing to overwrite previous artifacts.'
}
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$scanTarget = 'http://127.0.0.1:4313'
$automationPlanPath = Join-Path $outputDirectory 'automation.yaml'
$automationPlan = @"
env:
  contexts:
    - name: guigui-local-qa
      urls:
        - "$scanTarget"
      includePaths:
        - 'http://127\.0\.0\.1:4313/.*'
      excludePaths: []
  parameters:
    failOnError: true
    failOnWarning: false
    continueOnFailure: false
    progressToStdout: true
jobs:
  - type: spider
    parameters:
      context: guigui-local-qa
      url: "$scanTarget"
      maxDuration: 2
      maxDepth: 4
      maxChildren: 100
  - type: passiveScan-wait
    parameters:
      maxDuration: 2
  - type: report
    parameters:
      template: traditional-json
      reportDir: .
      reportFile: zap-report.json
  - type: report
    parameters:
      template: traditional-html
      reportDir: .
      reportFile: zap-report.html
"@
Set-Content -LiteralPath $automationPlanPath -Value $automationPlan -Encoding UTF8

Push-Location $zapHome
try {
  & $zapLauncher -host 127.0.0.1 -port $proxyPort -cmd -autocheck $automationPlanPath
  if ($LASTEXITCODE -ne 0) {
    throw 'ZAP rejected its passive automation plan; no scan was started.'
  }

  if ($ValidateOnly) {
    Write-Output "ZAP passive automation plan validated: $automationPlanPath"
    return
  }

  & $zapLauncher -host 127.0.0.1 -port $proxyPort -cmd -autorun $automationPlanPath
  $zapExitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($zapExitCode -ne 0) {
  throw "ZAP passive baseline did not complete successfully (exit code $zapExitCode)."
}

$jsonReportPath = Join-Path $outputDirectory 'zap-report.json'
if (-not (Test-Path -LiteralPath $jsonReportPath -PathType Leaf)) {
  throw 'ZAP completed without creating its required machine-readable report.'
}
$report = Get-Content -LiteralPath $jsonReportPath -Raw | ConvertFrom-Json
$alerts = @()
foreach ($site in @($report.site)) {
  if ($null -ne $site.alerts) {
    $alerts += @($site.alerts)
  }
}

$riskCounts = [ordered]@{
  High = 0
  Medium = 0
  Low = 0
  Informational = 0
  Unknown = 0
}
$riskConfidenceCounts = @{}
foreach ($alert in $alerts) {
  $risk = switch ([string]$alert.riskcode) {
    '3' { 'High' }
    '2' { 'Medium' }
    '1' { 'Low' }
    '0' { 'Informational' }
    default {
      $riskDescription = ([string]$alert.riskdesc -split '\s+')[0]
      if ($riskDescription -in @('High', 'Medium', 'Low', 'Informational')) {
        $riskDescription
      } else {
        'Unknown'
      }
    }
  }
  $riskCounts[$risk]++
  $confidence = if ([string]::IsNullOrWhiteSpace([string]$alert.confidence)) {
    'Unknown'
  } else {
    [string]$alert.confidence
  }
  $key = "$risk/$confidence"
  if (-not $riskConfidenceCounts.ContainsKey($key)) {
    $riskConfidenceCounts[$key] = 0
  }
  $riskConfidenceCounts[$key]++
}

$counts = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  totalAlerts = $alerts.Count
  byRisk = $riskCounts
  byRiskAndConfidence = $riskConfidenceCounts
}
$countsPath = Join-Path $outputDirectory 'alert-counts.json'
Set-Content -LiteralPath $countsPath -Value ($counts | ConvertTo-Json -Depth 5) -Encoding UTF8
Write-Output "ZAP passive baseline completed; alert counts: $countsPath"
Write-Output "Raw reports: $jsonReportPath and $(Join-Path $outputDirectory 'zap-report.html')"
