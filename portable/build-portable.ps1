param(
  [string]$OutputPath = ".\portable\RunFlowRunPortable.exe"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$source = Join-Path $PSScriptRoot "RunFlowRunPortable.cs"
$output = [System.IO.Path]::GetFullPath((Join-Path $root $OutputPath))
$outputDir = Split-Path -Parent $output
$distDir = Join-Path $root "dist"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $csc)) {
  throw "No se encontro csc.exe en $csc"
}

Push-Location $root
try {
  & cmd /c npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo npm run build"
  }

  if (-not (Test-Path $distDir)) {
    throw "No existe la carpeta dist"
  }

  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  if (Test-Path $output) {
    Remove-Item $output -Force
  }

  $resourceArgs = @()
  $rootUri = New-Object System.Uri(($root.TrimEnd('\') + '\'))
  Get-ChildItem $distDir -Recurse -File | ForEach-Object {
    $relative = $rootUri.MakeRelativeUri((New-Object System.Uri($_.FullName))).ToString()
    $resourceArgs += "/resource:`"$($_.FullName)`",$relative"
  }

  & $csc /nologo /target:exe /optimize+ /out:$output $source @resourceArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo la compilacion portable"
  }

  Write-Host "Portable generado en $output"
}
finally {
  Pop-Location
}
