$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
# Electron binaries are downloaded separately from the npm registry.
# Use the mirror documented by Electron unless the caller selected a source.
$downloadVariables = @('ELECTRON_MIRROR', 'ELECTRON_GET_USE_PROXY')
$previousDownloadEnvironment = @{}
foreach ($name in $downloadVariables) {
    $previousDownloadEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    if (!$env:ELECTRON_MIRROR -and !$env:npm_config_electron_mirror) {
        $env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
    }
    if (($env:HTTPS_PROXY -or $env:HTTP_PROXY) -and !$env:ELECTRON_GET_USE_PROXY) {
        $env:ELECTRON_GET_USE_PROXY = '1'
    }
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        Write-Host "Installing dependencies (attempt $attempt/3)..."
        & npm.cmd ci --no-audit --no-fund
        if ($LASTEXITCODE -eq 0) { break }
        if ($attempt -eq 3) {
            throw 'npm ci failed after 3 attempts. Check the network/proxy or set ELECTRON_MIRROR to an accessible Electron mirror, then run release.cmd again.'
        }
        Write-Warning 'Dependency installation failed; retrying in 3 seconds. Completed Electron downloads can be reused from cache.'
        Start-Sleep -Seconds 3
    }
} finally {
    foreach ($name in $downloadVariables) {
        [Environment]::SetEnvironmentVariable($name, $previousDownloadEnvironment[$name], 'Process')
    }
}
& npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
$appVersion = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$buildTimestamp = Get-Date -Format 'yyyyMMdd'
$previousBuildTimestamp = $env:WOWGEARMATRIX_BUILD_TIMESTAMP
try {
    $env:WOWGEARMATRIX_BUILD_TIMESTAMP = $buildTimestamp
    & npm.cmd run dist:win
    if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
} finally {
    $env:WOWGEARMATRIX_BUILD_TIMESTAMP = $previousBuildTimestamp
}
& (Join-Path $PSScriptRoot 'verify-release.ps1') -ExePath (Join-Path $projectRoot "dist/WoWGearMatrix-$appVersion-$buildTimestamp-win-x64-portable.exe")
$sourceFiles = Get-ChildItem -LiteralPath $projectRoot | Where-Object Name -notin @('node_modules', 'dist', '.git', '.tmp', 'build-wasm', 'build-workspace-test')
Compress-Archive -LiteralPath $sourceFiles.FullName -DestinationPath (Join-Path $projectRoot "dist/WoWGearMatrix-$appVersion-$buildTimestamp-source.zip") -Force
Write-Host "Release ready: $projectRoot\dist"
