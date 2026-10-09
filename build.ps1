$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if ($env:HTTPS_PROXY -or $env:HTTP_PROXY) { $env:ELECTRON_GET_USE_PROXY = '1' }
& npm.cmd ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
& npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
$buildTimestamp = Get-Date -Format 'yyyyMMdd'
$previousBuildTimestamp = $env:WOWGEARMATRIX_BUILD_TIMESTAMP
try {
    $env:WOWGEARMATRIX_BUILD_TIMESTAMP = $buildTimestamp
    & npm.cmd run dist:win
    if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
} finally {
    $env:WOWGEARMATRIX_BUILD_TIMESTAMP = $previousBuildTimestamp
}
& (Join-Path $PSScriptRoot 'verify-release.ps1') -ExePath (Join-Path $PSScriptRoot "dist/WoWGearMatrix-$buildTimestamp-win-x64.exe")
$sourceFiles = Get-ChildItem -LiteralPath $PSScriptRoot | Where-Object Name -notin @('node_modules', 'dist', '.git')
Compress-Archive -LiteralPath $sourceFiles.FullName -DestinationPath (Join-Path $PSScriptRoot "dist/WoWGearMatrix-$buildTimestamp-source.zip") -Force
Write-Host "Release ready: $PSScriptRoot\dist"
