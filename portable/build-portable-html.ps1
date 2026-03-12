param(
  [string]$OutputDir = ".\portable-html\RunFlowRun-HTML",
  [string]$ZipPath = ".\portable-html\RunFlowRun-HTML.zip"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distDir = Join-Path $root "dist"
$outputDirFull = [System.IO.Path]::GetFullPath((Join-Path $root $OutputDir))
$zipPathFull = [System.IO.Path]::GetFullPath((Join-Path $root $ZipPath))
$outputParent = Split-Path -Parent $outputDirFull
$zipParent = Split-Path -Parent $zipPathFull

Push-Location $root
try {
  & cmd /c npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo npm run build"
  }

  if (-not (Test-Path $distDir)) {
    throw "No existe la carpeta dist"
  }

  New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
  New-Item -ItemType Directory -Force -Path $zipParent | Out-Null

  if (Test-Path $outputDirFull) {
    Remove-Item $outputDirFull -Recurse -Force
  }

  New-Item -ItemType Directory -Force -Path $outputDirFull | Out-Null
  Copy-Item -Path (Join-Path $distDir "*") -Destination $outputDirFull -Recurse -Force
  Copy-Item -Path (Join-Path $root "run-local.bat") -Destination $outputDirFull -Force
  Copy-Item -Path (Join-Path $root "run-local.ps1") -Destination $outputDirFull -Force

  $readmePath = Join-Path $outputDirFull "LEEME.txt"
  @"
Run Flow Run - version portable HTML

Opciones para abrirlo:
1. Doble click en run-local.bat
2. O en PowerShell:
   powershell -ExecutionPolicy Bypass -File .\run-local.ps1 -OpenBrowser

El juego se sirve localmente en:
http://localhost:4173
"@ | Set-Content -Path $readmePath -Encoding UTF8

  if (Test-Path $zipPathFull) {
    Remove-Item $zipPathFull -Force
  }

  Compress-Archive -Path (Join-Path $outputDirFull "*") -DestinationPath $zipPathFull -CompressionLevel Optimal

  Write-Host "Portable HTML generado en $outputDirFull"
  Write-Host "ZIP generado en $zipPathFull"
}
finally {
  Pop-Location
}
