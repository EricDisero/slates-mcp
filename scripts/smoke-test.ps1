#requires -Version 5.1
<#
Slates MCP smoke test.

Reads ~/.slates/agent-connection.json and runs end-to-end probes against
the cloud (slates-api) and the local desktop server. Exits non-zero on
any failure. Skips checks for missing credentials with a clear note
rather than failing the whole run — partial setups should still get a
useful report.

Usage:
    cd "C:\Coding Projects\slates\slates-mcp"
    .\scripts\smoke-test.ps1                    # against local dev (http://localhost:3000)
    .\scripts\smoke-test.ps1 -Cloud Production  # against https://slates-api.fly.dev
#>

param(
    [ValidateSet('Local','Production')]
    [string]$Cloud = 'Local'
)

$ErrorActionPreference = 'Stop'

$cloudBaseUrl = if ($Cloud -eq 'Production') { 'https://slates-api.fly.dev' } else { 'http://localhost:3000' }
$connectionFile = Join-Path $env:USERPROFILE '.slates\agent-connection.json'
$repoRoot = Split-Path -Parent $PSScriptRoot
$cliEntry = Join-Path $repoRoot 'packages\cli\dist\index.js'

$results = @()
function Add-Result {
    param($Name, $Status, $Detail = '')
    $script:results += [PSCustomObject]@{
        Name = $Name
        Status = $Status
        Detail = $Detail
    }
    $color = switch ($Status) {
        'PASS' { 'Green' }
        'FAIL' { 'Red' }
        'SKIP' { 'Yellow' }
        default { 'Gray' }
    }
    Write-Host ("  {0,-6} {1}" -f $Status, $Name) -ForegroundColor $color
    if ($Detail) {
        Write-Host ("         {0}" -f $Detail) -ForegroundColor DarkGray
    }
}

Write-Host "`n=== Slates MCP Smoke Test ===" -ForegroundColor Cyan
Write-Host "Cloud target:    $cloudBaseUrl"
Write-Host "Connection file: $connectionFile"
Write-Host "CLI entry:       $cliEntry"
Write-Host ""

# --------------------------------------------------------------------
# 1. Connection file
# --------------------------------------------------------------------
Write-Host "[1] Connection file" -ForegroundColor Cyan
$conn = $null
if (-not (Test-Path $connectionFile)) {
    Add-Result 'Connection file exists' 'FAIL' "$connectionFile not found. Open Slates -> Settings -> Agent Control -> toggle on."
} else {
    try {
        $conn = Get-Content $connectionFile -Raw | ConvertFrom-Json
        Add-Result 'Connection file exists' 'PASS'
    } catch {
        Add-Result 'Connection file parses' 'FAIL' $_.Exception.Message
    }
}

if ($conn) {
    if ($conn.cloud.token) {
        Add-Result 'Cloud token present' 'PASS' ($conn.cloud.token.Substring(0, [Math]::Min(20, $conn.cloud.token.Length)) + '...')
    } else {
        Add-Result 'Cloud token present' 'SKIP' 'Run `slates login` or use Settings -> Connect Claude Code'
    }

    if ($conn.desktop.enabled -and $conn.desktop.port -and $conn.desktop.token) {
        Add-Result 'Desktop server enabled' 'PASS' "127.0.0.1:$($conn.desktop.port)"
    } else {
        Add-Result 'Desktop server enabled' 'SKIP' 'Toggle Settings -> Agent Control -> Local HTTP server'
    }
}

# --------------------------------------------------------------------
# 2. Cloud probes
# --------------------------------------------------------------------
Write-Host "`n[2] Cloud (slates-api)" -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$cloudBaseUrl/health" -Method Get -ErrorAction Stop
    Add-Result 'GET /health' 'PASS' ($health | ConvertTo-Json -Compress)
} catch {
    Add-Result 'GET /health' 'FAIL' $_.Exception.Message
}

if ($conn -and $conn.cloud.token) {
    $cloudHeaders = @{ Authorization = "Bearer $($conn.cloud.token)" }
    try {
        $me = Invoke-RestMethod -Uri "$cloudBaseUrl/api/agent/me" -Headers $cloudHeaders -Method Get -ErrorAction Stop
        Add-Result 'GET /api/agent/me' 'PASS' "user=$($me.user.email) tier=$($me.user.tier) credits=`$$($me.user.credit_balance_dollars)"
    } catch {
        Add-Result 'GET /api/agent/me' 'FAIL' $_.Exception.Message
    }

    try {
        $bal = Invoke-RestMethod -Uri "$cloudBaseUrl/api/agent/credits/balance" -Headers $cloudHeaders -Method Get -ErrorAction Stop
        Add-Result 'GET /api/agent/credits/balance' 'PASS' "`$$($bal.credit_balance_dollars)"
    } catch {
        Add-Result 'GET /api/agent/credits/balance' 'FAIL' $_.Exception.Message
    }

    try {
        $models = Invoke-RestMethod -Uri "$cloudBaseUrl/api/agent/models" -Headers $cloudHeaders -Method Get -ErrorAction Stop
        Add-Result 'GET /api/agent/models' 'PASS' "$($models.models.Count) models in registry"
    } catch {
        Add-Result 'GET /api/agent/models' 'FAIL' $_.Exception.Message
    }

    # Negative test — invalid token should 401, not 500
    # PowerShell 5.1 has no -SkipHttpErrorCheck, so we catch the WebException
    # and read the status code off the response object instead.
    try {
        Invoke-WebRequest -Uri "$cloudBaseUrl/api/agent/me" `
            -Headers @{ Authorization = 'Bearer slates_sk_obviously_not_a_real_token' } `
            -Method Get -ErrorAction Stop -UseBasicParsing | Out-Null
        Add-Result 'Invalid token rejected (401)' 'FAIL' 'Expected 401 but request succeeded'
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        if ($code -eq 401) {
            Add-Result 'Invalid token rejected (401)' 'PASS'
        } else {
            Add-Result 'Invalid token rejected (401)' 'FAIL' "Got HTTP $code"
        }
    }
} else {
    Add-Result 'Cloud probes' 'SKIP' 'No cloud token in connection file'
}

# --------------------------------------------------------------------
# 3. Desktop probes
# --------------------------------------------------------------------
Write-Host "`n[3] Desktop server" -ForegroundColor Cyan
if ($conn -and $conn.desktop.enabled -and $conn.desktop.port -and $conn.desktop.token) {
    $desktopBase = "http://127.0.0.1:$($conn.desktop.port)"
    $desktopHeaders = @{ Authorization = "Bearer $($conn.desktop.token)" }

    try {
        $h = Invoke-RestMethod -Uri "$desktopBase/agent/healthz" -Method Get -ErrorAction Stop
        Add-Result 'GET /agent/healthz (no auth)' 'PASS' ($h | ConvertTo-Json -Compress)
    } catch {
        Add-Result 'GET /agent/healthz (no auth)' 'FAIL' $_.Exception.Message
    }

    try {
        $proj = Invoke-RestMethod -Uri "$desktopBase/agent/projects" -Headers $desktopHeaders -Method Get -ErrorAction Stop
        Add-Result 'GET /agent/projects' 'PASS' "$($proj.projects.Count) project(s) returned"
    } catch {
        Add-Result 'GET /agent/projects' 'FAIL' $_.Exception.Message
    }

    # Origin gate (PS 5.1 friendly — catch WebException and read status)
    try {
        Invoke-WebRequest -Uri "$desktopBase/agent/projects" `
            -Headers @{ Authorization = "Bearer $($conn.desktop.token)"; Origin = 'https://malicious.example.com' } `
            -Method Get -ErrorAction Stop -UseBasicParsing | Out-Null
        Add-Result 'Origin header rejected (403)' 'FAIL' 'Expected 403 but request succeeded'
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        if ($code -eq 403) {
            Add-Result 'Origin header rejected (403)' 'PASS'
        } else {
            Add-Result 'Origin header rejected (403)' 'FAIL' "Got HTTP $code"
        }
    }

    # Bad desktop token
    try {
        Invoke-WebRequest -Uri "$desktopBase/agent/projects" `
            -Headers @{ Authorization = 'Bearer wrong-token-here' } `
            -Method Get -ErrorAction Stop -UseBasicParsing | Out-Null
        Add-Result 'Bad desktop token rejected (401)' 'FAIL' 'Expected 401 but request succeeded'
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        if ($code -eq 401) {
            Add-Result 'Bad desktop token rejected (401)' 'PASS'
        } else {
            Add-Result 'Bad desktop token rejected (401)' 'FAIL' "Got HTTP $code"
        }
    }

    # Round-trip: create + read project
    $testName = "smoke-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    try {
        $created = Invoke-RestMethod -Uri "$desktopBase/agent/projects" `
            -Headers $desktopHeaders -Method Post `
            -Body (@{ name = $testName } | ConvertTo-Json) `
            -ContentType 'application/json' -ErrorAction Stop
        if ($created.success -and $created.project.id) {
            Add-Result 'POST /agent/projects (round-trip create)' 'PASS' "id=$($created.project.id)"
            $script:smokeProjectId = $created.project.id
        } else {
            Add-Result 'POST /agent/projects (round-trip create)' 'FAIL' ($created | ConvertTo-Json -Compress)
        }
    } catch {
        Add-Result 'POST /agent/projects (round-trip create)' 'FAIL' $_.Exception.Message
    }

    if ($script:smokeProjectId) {
        try {
            $del = Invoke-RestMethod -Uri "$desktopBase/agent/projects/delete" `
                -Headers $desktopHeaders -Method Post `
                -Body (@{ id = $script:smokeProjectId } | ConvertTo-Json) `
                -ContentType 'application/json' -ErrorAction Stop
            if ($del.success) {
                Add-Result 'POST /agent/projects/delete (cleanup)' 'PASS'
            } else {
                Add-Result 'POST /agent/projects/delete (cleanup)' 'FAIL' ($del | ConvertTo-Json -Compress)
            }
        } catch {
            Add-Result 'POST /agent/projects/delete (cleanup)' 'FAIL' $_.Exception.Message
        }
    }
} else {
    Add-Result 'Desktop probes' 'SKIP' 'Desktop server not enabled'
}

# --------------------------------------------------------------------
# 4. CLI smoke
# --------------------------------------------------------------------
Write-Host "`n[4] CLI" -ForegroundColor Cyan
if (-not (Test-Path $cliEntry)) {
    Add-Result 'CLI build artifact present' 'FAIL' "Not found: $cliEntry. Run 'npm run build' in slates-mcp."
} else {
    Add-Result 'CLI build artifact present' 'PASS' $cliEntry

    try {
        $statusOut = & node $cliEntry status 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) {
            Add-Result 'slates status' 'PASS' ($statusOut.Trim() -split "`n" | Select-Object -First 2 | Out-String).Trim()
        } else {
            Add-Result 'slates status' 'FAIL' $statusOut.Trim()
        }
    } catch {
        Add-Result 'slates status' 'FAIL' $_.Exception.Message
    }

    try {
        $listOut = & node $cliEntry run --list 2>&1 | Out-String
        $opCount = ([regex]::Matches($listOut, '^slates_', 'Multiline')).Count
        if ($opCount -ge 20) {
            Add-Result 'slates run --list' 'PASS' "$opCount operations registered"
        } else {
            Add-Result 'slates run --list' 'FAIL' "Only $opCount operations found"
        }
    } catch {
        Add-Result 'slates run --list' 'FAIL' $_.Exception.Message
    }

    if ($conn -and $conn.cloud.token) {
        try {
            $balOut = & node $cliEntry run slates_get_credit_balance --json 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0 -and $balOut -match 'credit_balance_cents') {
                Add-Result 'slates run slates_get_credit_balance' 'PASS'
            } else {
                Add-Result 'slates run slates_get_credit_balance' 'FAIL' $balOut.Trim()
            }
        } catch {
            Add-Result 'slates run slates_get_credit_balance' 'FAIL' $_.Exception.Message
        }
    }

    if ($conn -and $conn.desktop.enabled -and $conn.desktop.port) {
        try {
            $projOut = & node $cliEntry run slates_list_projects --json 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0 -and $projOut -match 'projects') {
                Add-Result 'slates run slates_list_projects' 'PASS'
            } else {
                Add-Result 'slates run slates_list_projects' 'FAIL' $projOut.Trim()
            }
        } catch {
            Add-Result 'slates run slates_list_projects' 'FAIL' $_.Exception.Message
        }
    }
}

# --------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_.Status -eq 'PASS' }).Count
$failed = ($results | Where-Object { $_.Status -eq 'FAIL' }).Count
$skipped = ($results | Where-Object { $_.Status -eq 'SKIP' }).Count

Write-Host ("  PASS: {0}" -f $passed) -ForegroundColor Green
Write-Host ("  FAIL: {0}" -f $failed) -ForegroundColor Red
Write-Host ("  SKIP: {0}" -f $skipped) -ForegroundColor Yellow

if ($failed -gt 0) {
    Write-Host "`nFailed checks:" -ForegroundColor Red
    $results | Where-Object { $_.Status -eq 'FAIL' } | ForEach-Object {
        Write-Host ("  - {0}: {1}" -f $_.Name, $_.Detail) -ForegroundColor Red
    }
    exit 1
}

if ($skipped -gt 0) {
    Write-Host "`nSkipped checks (not failures, just missing prerequisites):" -ForegroundColor Yellow
    $results | Where-Object { $_.Status -eq 'SKIP' } | ForEach-Object {
        Write-Host ("  - {0}: {1}" -f $_.Name, $_.Detail) -ForegroundColor Yellow
    }
}

Write-Host "`nAll runnable checks passed.`n" -ForegroundColor Green
exit 0
