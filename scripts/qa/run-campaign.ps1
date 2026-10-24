param([switch]$PreflightOnly)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runId = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$runDirectory = Join-Path $repoRoot "test-results\qa\$runId"
if (Test-Path -LiteralPath $runDirectory) {
  throw 'The QA campaign output directory already exists; refusing to overwrite it.'
}
$rawDirectory = Join-Path $runDirectory 'raw'
$stateDirectory = Join-Path $runDirectory 'state'
New-Item -ItemType Directory -Path $rawDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$emptyDotenvPath = Join-Path $rawDirectory 'empty.env'
[System.IO.File]::WriteAllText($emptyDotenvPath, '')

$script:repoRoot = $repoRoot
$script:runDirectory = $runDirectory
$script:rawDirectory = $rawDirectory
$script:limitations = @()
$qaBaseUrl = 'http://127.0.0.1:4313'
$qaDatabaseName = 'guigui_pg18_synthetic_target'
$qaPort = '4313'

$adminDatabaseUrl = [Environment]::GetEnvironmentVariable('QA_ADMIN_DATABASE_URL', 'Process')
$fixturePassword = [Environment]::GetEnvironmentVariable('QA_ADMIN_FIXTURE_PASSWORD', 'Process')
$requestedDatabaseName = [Environment]::GetEnvironmentVariable('QA_DATABASE_NAME', 'Process')
$requestedPort = [Environment]::GetEnvironmentVariable('QA_PORT', 'Process')
$requestedZapHome = [Environment]::GetEnvironmentVariable('ZAP_HOME', 'Process')
$requestedJavaHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Process')
$programFiles = [Environment]::GetEnvironmentVariable('ProgramFiles', 'Process')
$systemRoot = [Environment]::GetEnvironmentVariable('SystemRoot', 'Process')
$qaDatabaseUrl = $null
$databaseUri = $null

function Find-ExecutablePath {
  param([string[]]$Names)
  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandType -eq 'Application' } |
      Select-Object -First 1
    if ($command -and $command.Source) {
      return $command.Source
    }
  }
  return $null
}

$nodePath = Find-ExecutablePath @('node.exe', 'node')
$npmPath = Find-ExecutablePath @('npm.cmd', 'npm')
$playwrightPath = Join-Path $repoRoot 'node_modules\.bin\playwright.cmd'
$tsxPath = Join-Path $repoRoot 'node_modules\.bin\tsx.cmd'
$localNewmanPath = Join-Path $repoRoot 'node_modules\.bin\newman.cmd'
$newmanPath = if (Test-Path -LiteralPath $localNewmanPath -PathType Leaf) {
  $localNewmanPath
} else {
  Find-ExecutablePath @('newman.cmd', 'newman')
}
$k6Path = Find-ExecutablePath @('k6.exe', 'k6')
$psqlPath = Find-ExecutablePath @('psql.exe', 'psql')
$javaPath = Find-ExecutablePath @('java.exe', 'java')
if (-not $javaPath -and $requestedJavaHome) {
  $javaHomeCandidate = Join-Path $requestedJavaHome 'bin\java.exe'
  if (Test-Path -LiteralPath $javaHomeCandidate -PathType Leaf) {
    $javaPath = $javaHomeCandidate
  }
}
if (-not $javaPath -and $programFiles) {
  $javaRoots = @(
    (Join-Path $programFiles 'Eclipse Adoptium'),
    (Join-Path $programFiles 'Java')
  )
  foreach ($javaRoot in $javaRoots) {
    if (Test-Path -LiteralPath $javaRoot -PathType Container) {
      $javaPath = Get-ChildItem -LiteralPath $javaRoot -Directory |
        ForEach-Object { Join-Path $_.FullName 'bin\java.exe' } |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1
      if ($javaPath) { break }
    }
  }
}
$gitPath = Find-ExecutablePath @('git.exe', 'git')
$zapHome = if ([string]::IsNullOrWhiteSpace($requestedZapHome)) {
  if ($programFiles) { Join-Path $programFiles 'ZAP\Zed Attack Proxy' } else { $null }
} else {
  $requestedZapHome
}
$zapPath = if ($zapHome) { Join-Path $zapHome 'zap.bat' } else { $null }
$powershellPath = Join-Path $PSHOME 'powershell.exe'
$tsxCliPath = Join-Path $repoRoot 'node_modules\tsx\dist\cli.mjs'
$serverEntryPath = Join-Path $repoRoot 'server\entrypoint.ts'
$seedSqlPath = Join-Path $runDirectory 'seed\guigui-synthetic-10000.sql'
$reportBuilderPath = Join-Path $repoRoot 'scripts\qa\build-report.ts'
$rawResultsPath = Join-Path $rawDirectory 'campaign-results.json'
$sanitizedReportPath = Join-Path $runDirectory 'report.json'
$routeInventoryPath = Join-Path $repoRoot 'tests\api\route-inventory.json'
$postmanCollectionPath = Join-Path $repoRoot 'tests\api\guigui-local-qa.postman_collection.json'
$k6SummaryPath = Join-Path $runDirectory 'k6\summary.json'
$newmanReportPath = Join-Path $runDirectory 'newman\report.json'
$playwrightReportPath = Join-Path $runDirectory 'playwright\results.json'
$playwrightArtifactsPath = Join-Path $runDirectory 'playwright\artifacts'
$zapReportDirectory = Join-Path $runDirectory 'zap'
$zapCountsPath = Join-Path $zapReportDirectory 'alert-counts.json'

$results = [ordered]@{
  runId = $runId
  startedAt = [DateTime]::UtcNow.ToString('o')
  commit = 'unknown'
  branch = 'unknown'
  toolVersions = [ordered]@{
    playwright = $null
    newman = $null
    k6 = $null
    zap = $null
  }
  phases = [ordered]@{
    playwright = [ordered]@{ status = 'blocked'; exitCode = $null; artifactPaths = @() }
    newman = [ordered]@{ status = 'blocked'; exitCode = $null; artifactPaths = @() }
    k6 = [ordered]@{ status = 'blocked'; exitCode = $null; artifactPaths = @() }
    zap = [ordered]@{ status = 'blocked'; exitCode = $null; artifactPaths = @() }
  }
  e2eCounts = [ordered]@{ passed = 0; failed = 0; skipped = 0; blocked = 0 }
  apiCounts = [ordered]@{ inventoried = 0; covered = 0; excluded = 0 }
  k6Metrics = [ordered]@{
    vus = $null
    durationSeconds = $null
    p95Ms = $null
    failureRate = $null
    checksPassed = $null
    thresholdsPassed = $null
  }
  zapCounts = [ordered]@{ critical = 0; high = 0; medium = 0; low = 0; informational = 0 }
  zapConfidenceCounts = [ordered]@{
    high = 0; medium = 0; low = 0; falsePositive = 0; unknown = 0
  }
  zapAlertedEndpointCount = 0
  zapBaselineDelta = [ordered]@{ new = 0; resolved = 0; unchanged = 0 }
  limitations = @()
}

function Add-Limitation {
  param([string]$Message)
  $script:limitations += $Message
}

function Set-ProcessEnvironment {
  param([string]$Name, [AllowNull()][string]$Value)
  [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
}

function Test-PortListening {
  param([int]$Port)
  $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
  return @($listeners | Where-Object { $_.Port -eq $Port }).Count -gt 0
}

function Get-RelativeArtifactPath {
  param([string]$Path)
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $rootPrefix = [System.IO.Path]::GetFullPath($script:repoRoot).TrimEnd('\') + '\'
  if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    return '[external artifact omitted]'
  }
  return $fullPath.Substring($rootPrefix.Length).Replace('\', '/')
}

function Invoke-LoggedCommand {
  param([string]$Name, [scriptblock]$Command)
  $logPath = Join-Path $script:rawDirectory "$Name.log"
  $exitCode = 1
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $Command *> $logPath
    if ($null -ne $LASTEXITCODE) {
      $exitCode = [int]$LASTEXITCODE
    } else {
      $exitCode = 0
    }
  } catch {
    $_ | Out-String | Set-Content -LiteralPath $logPath -Encoding UTF8
    $exitCode = 1
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  return $exitCode
}

function Get-ToolVersion {
  param([string]$Path, [string[]]$Arguments, [string]$WorkingDirectory)
  if (-not $Path) { return $null }
  $previousLocation = Get-Location
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    if ($WorkingDirectory) { Set-Location -LiteralPath $WorkingDirectory }
    $output = & $Path @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { return $null }
    $versionLines = @(
      $output |
        ForEach-Object { [string]$_ } |
        Where-Object { $_ -match '^\s*(?:(?:version|k6)\s+)?v?\d+\.\d+' }
    )
    if ($versionLines.Count -eq 0) { return $null }
    $version = [string]$versionLines[-1].Trim()
    if ([string]::IsNullOrWhiteSpace($version)) { return $null }
    if ($version.Length -gt 120) { return $version.Substring(0, 120) }
    return $version
  } catch {
    return $null
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    Set-Location -LiteralPath $previousLocation
  }
}

function Set-AllPhasesBlocked {
  param([string]$Reason)
  foreach ($phaseName in @('playwright', 'newman', 'k6', 'zap')) {
    $results.phases[$phaseName].status = 'blocked'
    $results.phases[$phaseName].exitCode = $null
    $results.phases[$phaseName].artifactPaths = @()
  }
  Add-Limitation $Reason
  Add-Limitation 'No E2E, Newman, k6, or ZAP execution data were collected; zero result counts are placeholders, not successful results.'
}

function Read-RouteCoverage {
  if (-not (Test-Path -LiteralPath $routeInventoryPath -PathType Leaf)) {
    Add-Limitation 'The API route inventory is missing; Newman coverage cannot be reported.'
    return $false
  }
  try {
    $entries = Get-Content -LiteralPath $routeInventoryPath -Raw | ConvertFrom-Json
    $results.apiCounts.inventoried = $entries.Count
    $results.apiCounts.covered = @($entries | Where-Object {
      -not [string]::IsNullOrWhiteSpace([string]$_.scenario)
    }).Count
    $results.apiCounts.excluded = @($entries | Where-Object {
      -not [string]::IsNullOrWhiteSpace([string]$_.exclusionReason)
    }).Count
    return $results.apiCounts.inventoried -eq (
      $results.apiCounts.covered + $results.apiCounts.excluded
    )
  } catch {
    Add-Limitation 'The API route inventory could not be parsed; Newman coverage cannot be reported.'
    return $false
  }
}

function Read-PlaywrightCounts {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Add-Limitation 'Playwright did not produce structured test counts; raw output remains local.'
    return
  }
  $countsOutput = & $tsxPath $reportBuilderPath '--playwright-counts' $Path
  if ($LASTEXITCODE -ne 0) {
    Add-Limitation 'Playwright JSON could not be parsed; raw output remains local.'
    return
  }
  try {
    $counts = ($countsOutput -join [Environment]::NewLine) | ConvertFrom-Json
    $results.e2eCounts.passed = [int]$counts.passed
    $results.e2eCounts.failed = [int]$counts.failed
    $results.e2eCounts.skipped = [int]$counts.skipped
    $results.e2eCounts.blocked = [int]$counts.blocked
    if ([int]$counts.reportErrors -gt 0) {
      Add-Limitation "Playwright reported $($counts.reportErrors) global error record(s); some test cases may not have been enumerated."
    }
  } catch {
    Add-Limitation 'Playwright count output could not be parsed; raw output remains local.'
  }
}

function Read-K6Metrics {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Add-Limitation 'k6 did not produce a summary; its measurements are unavailable.'
    return
  }
  try {
    $summary = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    $metrics = $summary.metrics
    $vusMetric = $metrics.PSObject.Properties['vus_max']
    $durationMetric = $metrics.PSObject.Properties['http_req_duration']
    $failureMetric = $metrics.PSObject.Properties['http_req_failed']
    $checksMetric = $metrics.PSObject.Properties['checks']

    if ($vusMetric -and $null -ne $vusMetric.Value.values.max) {
      $results.k6Metrics.vus = [double]$vusMetric.Value.values.max
    }
    if ($summary.state -and $null -ne $summary.state.testRunDurationMs) {
      $results.k6Metrics.durationSeconds = [double]$summary.state.testRunDurationMs / 1000
    }
    if ($durationMetric -and $null -ne $durationMetric.Value.values.'p(95)') {
      $results.k6Metrics.p95Ms = [double]$durationMetric.Value.values.'p(95)'
    }
    if ($failureMetric -and $null -ne $failureMetric.Value.values.rate) {
      $results.k6Metrics.failureRate = [double]$failureMetric.Value.values.rate
    }
    if ($checksMetric -and $null -ne $checksMetric.Value.values.rate) {
      $results.k6Metrics.checksPassed = [double]$checksMetric.Value.values.rate -eq 1
    }
  } catch {
    Add-Limitation 'k6 summary could not be parsed; its measurements are unavailable.'
  }
}

function Read-ZapCounts {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Add-Limitation 'ZAP did not produce alert counts; the baseline delta is unavailable.'
    return
  }
  try {
    $counts = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    $riskCounts = $counts.byRisk
    $results.zapCounts.critical = 0
    $results.zapCounts.high = [int]$riskCounts.High
    $results.zapCounts.medium = [int]$riskCounts.Medium
    $results.zapCounts.low = [int]$riskCounts.Low
    $results.zapCounts.informational = [int]$riskCounts.Informational
    if ([int]$riskCounts.Unknown -gt 0) {
      Add-Limitation 'ZAP reported alerts with an unknown risk category.'
    }

    $supplementalOutput = & $tsxPath $reportBuilderPath '--zap-supplemental-counts' $Path
    if ($LASTEXITCODE -ne 0) {
      Add-Limitation 'ZAP confidence and alerted-endpoint counts could not be parsed.'
    } else {
      $supplemental = ($supplementalOutput -join [Environment]::NewLine) | ConvertFrom-Json
      $results.zapConfidenceCounts = $supplemental.confidenceCounts
      $results.zapAlertedEndpointCount = [int]$supplemental.alertedEndpointCount
    }

    $baseline = [ordered]@{
      critical = 0
      high = 0
      medium = 4
      low = 1
      informational = 2
    }
    foreach ($risk in $baseline.Keys) {
      $current = [int]$results.zapCounts[$risk]
      $previous = [int]$baseline[$risk]
      $results.zapBaselineDelta.new += [Math]::Max(0, $current - $previous)
      $results.zapBaselineDelta.resolved += [Math]::Max(0, $previous - $current)
      $results.zapBaselineDelta.unchanged += [Math]::Min($current, $previous)
    }
    Add-Limitation 'ZAP baseline delta is count-based by severity; prior alert fingerprints are unavailable, so unchanged counts do not prove alert identity.'
  } catch {
    Add-Limitation 'ZAP alert counts could not be parsed; the baseline delta is unavailable.'
  }
}

function Add-PhaseArtifacts {
  param([string]$PhaseName, [string[]]$Paths)
  $results.phases[$PhaseName].artifactPaths = @(
    $Paths |
      Where-Object { Test-Path -LiteralPath $_ } |
      ForEach-Object { Get-RelativeArtifactPath $_ }
  )
}

$inventoryValid = Read-RouteCoverage
$preflightFailures = @()
if ([string]::IsNullOrWhiteSpace($adminDatabaseUrl)) {
  $preflightFailures += 'QA_ADMIN_DATABASE_URL is not set in the local process.'
} else {
  try {
    $databaseUri = [Uri]$adminDatabaseUrl
    $validDatabaseScheme = @('postgres', 'postgresql') -contains $databaseUri.Scheme
    $validDatabaseHost = @('127.0.0.1', '::1', '[::1]') -contains $databaseUri.Host
    if (-not $validDatabaseScheme -or -not $validDatabaseHost) {
      throw 'invalid target'
    }
    $databaseBuilder = New-Object System.UriBuilder -ArgumentList $databaseUri
    $databaseBuilder.Path = "/$qaDatabaseName"
    $qaDatabaseUrl = $databaseBuilder.Uri.AbsoluteUri
  } catch {
    $preflightFailures += 'QA_ADMIN_DATABASE_URL must be a valid PostgreSQL URL on loopback.'
  }
}
if ($requestedDatabaseName -ne $qaDatabaseName) {
  $preflightFailures += 'QA_DATABASE_NAME must equal the reserved synthetic database name.'
}
if ($requestedPort -ne $qaPort) {
  $preflightFailures += 'QA_PORT must equal 4313.'
}
if ([string]::IsNullOrWhiteSpace($fixturePassword)) {
  $preflightFailures += 'QA_ADMIN_FIXTURE_PASSWORD must be set locally to match the existing synthetic E2E fixture; its value is never logged.'
}
if (-not $inventoryValid) {
  $preflightFailures += 'API route coverage must reconcile before the campaign can run.'
}

$requiredExecutables = [ordered]@{
  node = $nodePath
  npm = $npmPath
  tsx = $(if (Test-Path -LiteralPath $tsxPath -PathType Leaf) { $tsxPath } else { $null })
  playwright = $(if (Test-Path -LiteralPath $playwrightPath -PathType Leaf) { $playwrightPath } else { $null })
  newman = $newmanPath
  k6 = $k6Path
  psql = $psqlPath
  zap = $(if ($zapPath -and (Test-Path -LiteralPath $zapPath -PathType Leaf)) { $zapPath } else { $null })
}
foreach ($name in $requiredExecutables.Keys) {
  if (-not $requiredExecutables[$name]) {
    $preflightFailures += "$name is not available locally."
  }
}
if (Test-PortListening 4313) {
  $preflightFailures += 'QA app port 4313 is occupied; no existing process will be reused or stopped.'
}
if (Test-PortListening 4314) {
  $preflightFailures += 'ZAP loopback port 4314 is occupied; no existing process will be reused or stopped.'
}
if ($PreflightOnly) {
  $preflightFailures += 'Preflight-only mode was requested; no database, app, or live tool phase was started.'
}

$runtimeNames = @(
  'PATH', 'PATHEXT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE',
  'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'ProgramFiles', 'ProgramFiles(x86)',
  'JAVA_HOME', 'ZAP_HOME', 'ComSpec'
)
$runtimeEnvironment = @{}
foreach ($name in $runtimeNames) {
  $value = [Environment]::GetEnvironmentVariable($name, 'Process')
  if ($null -ne $value) { $runtimeEnvironment[$name] = $value }
}
$processEnvironment = [Environment]::GetEnvironmentVariables('Process')
foreach ($name in @($processEnvironment.Keys)) {
  [Environment]::SetEnvironmentVariable([string]$name, $null, 'Process')
}
foreach ($name in $runtimeEnvironment.Keys) {
  [Environment]::SetEnvironmentVariable([string]$name, [string]$runtimeEnvironment[$name], 'Process')
}

$toolDirectories = @()
foreach ($toolPath in @(
  $nodePath, $npmPath, $tsxPath, $playwrightPath, $newmanPath, $k6Path,
  $psqlPath, $javaPath, $zapPath, $powershellPath, $gitPath
)) {
  if ($toolPath -and (Test-Path -LiteralPath $toolPath -PathType Leaf)) {
    $toolDirectories += Split-Path -Parent $toolPath
  }
}
if ($systemRoot) {
  $toolDirectories += Join-Path $systemRoot 'System32'
  $toolDirectories += $systemRoot
}
$toolDirectories = @($toolDirectories | Where-Object { $_ } | Select-Object -Unique)
Set-ProcessEnvironment 'PATH' ($toolDirectories -join ';')
Set-ProcessEnvironment 'PATHEXT' '.COM;.EXE;.BAT;.CMD'
Set-ProcessEnvironment 'PSModulePath' (Join-Path $PSHOME 'Modules')
if ($zapHome) { Set-ProcessEnvironment 'ZAP_HOME' $zapHome }
Set-ProcessEnvironment 'QA_BASE_URL' $qaBaseUrl
Set-ProcessEnvironment 'QA_DATABASE_NAME' $requestedDatabaseName
Set-ProcessEnvironment 'QA_PORT' $requestedPort
if ($adminDatabaseUrl) { Set-ProcessEnvironment 'QA_ADMIN_DATABASE_URL' $adminDatabaseUrl }
if ($fixturePassword) { Set-ProcessEnvironment 'QA_ADMIN_FIXTURE_PASSWORD' $fixturePassword }
if ($qaDatabaseUrl) {
  Set-ProcessEnvironment 'QA_DATABASE_URL' $qaDatabaseUrl
  Set-ProcessEnvironment 'DATABASE_URL' $qaDatabaseUrl
}
Set-ProcessEnvironment 'HOST' '127.0.0.1'
Set-ProcessEnvironment 'PORT' $qaPort
Set-ProcessEnvironment 'NODE_ENV' 'test'
Set-ProcessEnvironment 'APP_URL' $qaBaseUrl
Set-ProcessEnvironment 'CORS_ALLOWED_ORIGINS' $qaBaseUrl
Set-ProcessEnvironment 'DOTENV_CONFIG_PATH' $emptyDotenvPath
Set-ProcessEnvironment 'GUIGUI_DATA_DIR' $stateDirectory
Set-ProcessEnvironment 'QA_ARTIFACT_DIR' $runDirectory
Set-ProcessEnvironment 'GUIGUI_SMS_MODE' 'simulated'
Set-ProcessEnvironment 'GUIGUI_SMS_GATEWAY_URL' ''
Set-ProcessEnvironment 'GUIGUI_SMS_GATEWAY_KEY' ''
Set-ProcessEnvironment 'GUIGUI_SMS_TIMEOUT_MS' '1000'
Set-ProcessEnvironment 'SMTP_HOST' ''
Set-ProcessEnvironment 'SMTP_USER' ''
Set-ProcessEnvironment 'SMTP_PASSWORD' ''
Set-ProcessEnvironment 'EMAIL_FROM' ''
Set-ProcessEnvironment 'GUIGUI_BACKUP_INTERVAL_HOURS' '0'
Set-ProcessEnvironment 'NPM_CONFIG_OFFLINE' 'true'
Set-ProcessEnvironment 'NPM_CONFIG_UPDATE_NOTIFIER' 'false'
Set-ProcessEnvironment 'CI' 'true'

if ($gitPath) {
  $commitOutput = & $gitPath -C $repoRoot rev-parse --short HEAD 2>$null
  if ($LASTEXITCODE -eq 0 -and $commitOutput) { $results.commit = ([string]$commitOutput).Trim() }
  $branchOutput = & $gitPath -C $repoRoot branch --show-current 2>$null
  if ($LASTEXITCODE -eq 0 -and $branchOutput) { $results.branch = ([string]$branchOutput).Trim() }
}

$results.toolVersions.playwright = Get-ToolVersion $playwrightPath @('--version') $null
$results.toolVersions.newman = Get-ToolVersion $newmanPath @('--version') $null
$results.toolVersions.k6 = Get-ToolVersion $k6Path @('version') $null
$results.toolVersions.zap = Get-ToolVersion $zapPath @('-version') $zapHome
foreach ($toolName in @('playwright', 'newman', 'k6', 'zap')) {
  if (-not $results.toolVersions[$toolName]) {
    $preflightFailures += "Unable to determine the local $toolName version."
  }
}

$routeCheckValid = $false
$routeCheckExit = 1
if ($npmPath -and (Test-Path -LiteralPath $tsxPath -PathType Leaf)) {
  $routeCheckExit = Invoke-LoggedCommand 'api-inventory-check' {
    & $npmPath run qa:api:check
  }
  $routeCheckValid = $routeCheckExit -eq 0
}
if (-not $routeCheckValid) {
  $preflightFailures += 'API route inventory validation failed; see the local raw inventory log.'
}

$databaseReady = $false
$appHealthy = $false
$serverProcess = $null

try {
  if ($preflightFailures.Count -eq 0) {
    $provisionExit = Invoke-LoggedCommand 'database-provision' {
      & $npmPath run qa:provision
    }
    if ($provisionExit -ne 0) {
      Add-Limitation 'Database provisioning failed; see the local raw provisioning log. The database was not removed.'
    } else {
      $categoryExit = Invoke-LoggedCommand 'category-seed' {
        & $tsxPath scripts/seed-categories-db.ts
      }
      if ($categoryExit -ne 0) {
        Add-Limitation 'Category seeding failed; see the local raw seed log. The database was not removed.'
      } else {
        $generatorExit = Invoke-LoggedCommand 'synthetic-seed-generation' {
          & $npmPath run db:seed:synthetic:10000
        }
        if ($generatorExit -ne 0 -or -not (Test-Path -LiteralPath $seedSqlPath -PathType Leaf)) {
          Add-Limitation 'The 10,000-row synthetic SQL seed was not generated; no import was attempted.'
        } else {
          $userInfo = $databaseUri.UserInfo
          $separatorIndex = $userInfo.IndexOf(':')
          $pgUser = if ($separatorIndex -ge 0) {
            [Uri]::UnescapeDataString($userInfo.Substring(0, $separatorIndex))
          } else {
            [Uri]::UnescapeDataString($userInfo)
          }
          $pgPassword = if ($separatorIndex -ge 0) {
            [Uri]::UnescapeDataString($userInfo.Substring($separatorIndex + 1))
          } else {
            ''
          }
          Set-ProcessEnvironment 'PGHOST' $databaseUri.Host.Trim('[', ']')
          Set-ProcessEnvironment 'PGPORT' $(if ($databaseUri.IsDefaultPort) { '5432' } else { [string]$databaseUri.Port })
          Set-ProcessEnvironment 'PGUSER' $pgUser
          Set-ProcessEnvironment 'PGPASSWORD' $pgPassword
          Set-ProcessEnvironment 'PGDATABASE' $qaDatabaseName
          $importExit = Invoke-LoggedCommand 'synthetic-seed-import' {
            & $psqlPath -X -v ON_ERROR_STOP=1 -f $seedSqlPath
          }
          Set-ProcessEnvironment 'PGHOST' $null
          Set-ProcessEnvironment 'PGPORT' $null
          Set-ProcessEnvironment 'PGUSER' $null
          Set-ProcessEnvironment 'PGPASSWORD' $null
          Set-ProcessEnvironment 'PGDATABASE' $null
          if ($importExit -ne 0) {
            Add-Limitation 'The synthetic SQL import failed; see the local raw import log. The database was not removed.'
          } else {
            $demoSeedExit = Invoke-LoggedCommand 'demo-seed' {
              & $npmPath run db:seed-demo
            }
            if ($demoSeedExit -ne 0) {
              Add-Limitation 'The synthetic demo dataset seed failed; see the local raw seed log.'
            } else {
              $adminFixtureExit = Invoke-LoggedCommand 'admin-fixture-seed' {
                & $tsxPath scripts/qa/seed-admin-fixture.ts
              }
              if ($adminFixtureExit -ne 0) {
                Add-Limitation 'The synthetic QA admin fixture failed verification; see the local raw fixture log.'
              } else {
                $databaseReady = $true
              }
            }
          }
        }
      }
    }
  }

  if ($preflightFailures.Count -gt 0) {
    foreach ($failure in $preflightFailures) { Add-Limitation $failure }
    Set-AllPhasesBlocked 'Campaign preflight did not pass; no database, application, or live tool phase was started.'
  } elseif (-not $databaseReady) {
    Set-AllPhasesBlocked 'Database preparation did not complete; all HTTP tool phases were blocked.'
  } else {
    if (Test-PortListening 4313) {
      Add-Limitation 'QA app port 4313 became occupied before startup; no existing process was reused or stopped.'
    } else {
      $serverStdout = Join-Path $rawDirectory 'server.stdout.log'
      $serverStderr = Join-Path $rawDirectory 'server.stderr.log'
      $serverArguments = '"{0}" "{1}"' -f $tsxCliPath, $serverEntryPath
      $serverProcess = Start-Process -FilePath $nodePath `
        -ArgumentList $serverArguments `
        -WorkingDirectory $repoRoot `
        -PassThru `
        -RedirectStandardOutput $serverStdout `
        -RedirectStandardError $serverStderr

      $deadline = [DateTime]::UtcNow.AddSeconds(60)
      $lastHealthResult = 'health endpoint did not return HTTP 200 without redirects'
      while ([DateTime]::UtcNow -lt $deadline) {
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) {
          $lastHealthResult = 'the campaign server exited before becoming healthy'
          break
        }
        try {
          $response = Invoke-WebRequest -Uri "$qaBaseUrl/api/health" `
            -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 2
          if ([int]$response.StatusCode -eq 200) {
            $appHealthy = $true
            break
          }
        } catch {
          $lastHealthResult = 'health endpoint did not return HTTP 200 without redirects'
        }
        Start-Sleep -Seconds 1
      }

      if (-not $appHealthy) {
        Add-Limitation "The isolated campaign server did not become healthy: $lastHealthResult."
        Set-AllPhasesBlocked 'The local application health preflight failed; no test tools were run.'
      } else {
        $playwrightDirectory = Join-Path $runDirectory 'playwright'
        New-Item -ItemType Directory -Path $playwrightDirectory -Force | Out-Null
        Set-ProcessEnvironment 'PLAYWRIGHT_JSON_OUTPUT_NAME' $playwrightReportPath
        $playwrightExit = Invoke-LoggedCommand 'playwright' {
          & $playwrightPath test --config=playwright.qa.config.ts `
            --reporter=json --output $playwrightArtifactsPath
        }
        Set-ProcessEnvironment 'PLAYWRIGHT_JSON_OUTPUT_NAME' $null
        $results.phases.playwright.status = if ($playwrightExit -eq 0) { 'passed' } else { 'failed' }
        $results.phases.playwright.exitCode = $playwrightExit
        Read-PlaywrightCounts $playwrightReportPath
        Add-PhaseArtifacts 'playwright' @($playwrightReportPath, $playwrightArtifactsPath)

        if ($routeCheckValid) {
          New-Item -ItemType Directory -Path (Join-Path $runDirectory 'newman') -Force | Out-Null
          $newmanExit = Invoke-LoggedCommand 'newman' {
            & $newmanPath run $postmanCollectionPath `
              --env-var "qaBaseUrl=$qaBaseUrl" `
              --ignore-redirects `
              --reporters cli,json `
              --reporter-json-export $newmanReportPath
          }
          $results.phases.newman.status = if ($newmanExit -eq 0) { 'passed' } else { 'failed' }
          $results.phases.newman.exitCode = $newmanExit
          Add-PhaseArtifacts 'newman' @($newmanReportPath)
        } else {
          $results.phases.newman.status = 'failed'
          $results.phases.newman.exitCode = $routeCheckExit
          $results.phases.newman.artifactPaths = @(
            Get-RelativeArtifactPath (Join-Path $rawDirectory 'api-inventory-check.log')
          )
          Add-Limitation 'API route inventory validation failed; Newman requests were not sent.'
        }

        if ($results.phases.playwright.status -eq 'passed' -and $results.phases.newman.status -eq 'passed') {
          $k6Exit = Invoke-LoggedCommand 'k6' {
            & $npmPath run qa:load
          }
          $results.phases.k6.status = if ($k6Exit -eq 0) { 'passed' } else { 'failed' }
          $results.phases.k6.exitCode = $k6Exit
          Read-K6Metrics $k6SummaryPath
          Add-PhaseArtifacts 'k6' @($k6SummaryPath)
        } else {
          $results.phases.k6.status = 'blocked'
          $results.phases.k6.exitCode = $null
          Add-Limitation 'k6 was blocked because both Playwright and Newman must pass first.'
        }

        if ($appHealthy) {
          $zapExit = Invoke-LoggedCommand 'zap' {
            & $powershellPath -NoProfile -ExecutionPolicy Bypass `
              -File (Join-Path $PSScriptRoot 'zap-local-baseline.ps1')
          }
          $results.phases.zap.status = if ($zapExit -eq 0) { 'passed' } else { 'failed' }
          $results.phases.zap.exitCode = $zapExit
          Read-ZapCounts $zapCountsPath
          Add-PhaseArtifacts 'zap' @(
            (Join-Path $zapReportDirectory 'zap-report.json'),
            (Join-Path $zapReportDirectory 'zap-report.html'),
            $zapCountsPath
          )
        }
      }
    }
  }
} catch {
  $orchestrationErrorPath = Join-Path $rawDirectory 'orchestration-error.log'
  [System.IO.File]::WriteAllText(
    $orchestrationErrorPath,
    ($_ | Out-String),
    [System.Text.UTF8Encoding]::new($false)
  )
  Add-Limitation 'Campaign orchestration stopped on an unexpected error; see the corresponding local raw log.'
  foreach ($phaseName in @('playwright', 'newman', 'k6', 'zap')) {
    if ($results.phases[$phaseName].status -eq 'blocked') { continue }
    if ($null -eq $results.phases[$phaseName].exitCode) {
      $results.phases[$phaseName].status = 'blocked'
    }
  }
} finally {
  if ($serverProcess) {
    $serverProcess.Refresh()
    if (-not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force
      $serverProcess.WaitForExit()
    }
  }
}

$results.limitations = @($script:limitations)
$resultsPathDirectory = Split-Path -Parent $rawResultsPath
New-Item -ItemType Directory -Path $resultsPathDirectory -Force | Out-Null
$resultsJson = $results | ConvertTo-Json -Depth 20
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($rawResultsPath, $resultsJson, $utf8WithoutBom)

$reportExit = Invoke-LoggedCommand 'report-builder' {
  & $tsxPath $reportBuilderPath $rawResultsPath $sanitizedReportPath
}
if ($reportExit -ne 0 -or -not (Test-Path -LiteralPath $sanitizedReportPath -PathType Leaf)) {
  throw 'The sanitized campaign report could not be generated; inspect the local raw report-builder log.'
}

$relativeReportPath = Get-RelativeArtifactPath $sanitizedReportPath
Write-Output "Sanitized QA report: $relativeReportPath"
Write-Output "Raw QA artifacts: $(Get-RelativeArtifactPath $rawDirectory)"

$hasIncompletePhase = @($results.phases.Values | Where-Object { $_.status -ne 'passed' }).Count -gt 0
if ($hasIncompletePhase) { exit 1 }
exit 0
