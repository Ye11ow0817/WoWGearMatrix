$ErrorActionPreference = 'Stop'
$version = (Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version
$exe = Join-Path $PSScriptRoot "dist/WoWGearMatrix-$version-win-x64.exe"
if (!(Test-Path -LiteralPath $exe)) { throw "Missing release: $exe" }
$output = Join-Path ([IO.Path]::GetTempPath()) ('wowgearmatrix-release-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $output | Out-Null
$names = @('SIMC_TEST_OUTPUT', 'SIMC_TEST_SCRIPT', 'SIMC_TEST_RESTORE')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:SIMC_TEST_OUTPUT = $output
    $env:SIMC_TEST_SCRIPT = Join-Path $PSScriptRoot 'test-ui.cjs'
    foreach ($restore in @('0', '1')) {
        $env:SIMC_TEST_RESTORE = $restore
        $process = Start-Process -FilePath $exe -ArgumentList '--smoke-test' -WorkingDirectory $output -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $output "stderr-$restore.txt") -RedirectStandardOutput (Join-Path $output "stdout-$restore.txt")
        # Retain the native handle to keep ExitCode available after launcher exit.
        $null = $process.Handle
        if (!$process.WaitForExit(180000)) { $process.Kill(); throw "Release test timed out. Logs: $output" }
        $marker = if ($restore -eq '1') { 'restart-test.txt' } else { 'ui-test.txt' }
        $process.WaitForExit() # Drain redirected output before reading logs.
        $exitCode = $process.ExitCode
        $passed = Test-Path (Join-Path $output $marker)
        $exitText = if ($null -eq $exitCode) { '<unavailable>' } else { [string]$exitCode }
        $status = "restore=$restore; exitCode=$exitText; marker=$marker; markerExists=$passed"
        $status | Set-Content (Join-Path $output "status-$restore.txt")
        if ($null -eq $exitCode -or $exitCode -ne 0 -or !$passed) {
            Get-Content (Join-Path $output "stderr-$restore.txt") -ErrorAction SilentlyContinue
            Get-Content (Join-Path $output "stdout-$restore.txt") -ErrorAction SilentlyContinue
            throw "Release test failed ($status). Logs: $output"
        }
        Get-Content (Join-Path $output $marker)
    }
    Write-Host "Release verification passed. Evidence: $output"
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
