param(
  [string]$SourcePng = ".\src\assets\rfr.png",
  [string]$OutputIco = ".\portable\RunFlowRunPortable.ico",
  [int]$Size = 256
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourcePath = [System.IO.Path]::GetFullPath((Join-Path $root $SourcePng))
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $root $OutputIco))
$outputDir = Split-Path -Parent $outputPath

if (-not (Test-Path $sourcePath)) {
  throw "No se encontro el PNG fuente en $sourcePath"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$image = [System.Drawing.Image]::FromFile($sourcePath)
$bitmap = New-Object System.Drawing.Bitmap $Size, $Size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$memory = New-Object System.IO.MemoryStream
$file = $null
$writer = $null

try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($image, 0, 0, $Size, $Size)

  $bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBytes = $memory.ToArray()

  $file = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  $writer = New-Object System.IO.BinaryWriter($file)

  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]1)
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$pngBytes.Length)
  $writer.Write([UInt32]22)
  $writer.Write($pngBytes)

  Write-Host "Icono generado en $outputPath"
}
finally {
  if ($writer) { $writer.Dispose() }
  elseif ($file) { $file.Dispose() }
  if ($memory) { $memory.Dispose() }
  if ($graphics) { $graphics.Dispose() }
  if ($bitmap) { $bitmap.Dispose() }
  if ($image) { $image.Dispose() }
}
