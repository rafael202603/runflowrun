param(
  [int]$Port = 4173,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$distPath = Join-Path $PSScriptRoot "dist"

if (-not (Test-Path $distPath)) {
  Write-Error "No encontre la carpeta 'dist'. Ejecuta un build antes de levantar el juego."
}

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
  ".txt" = "text/plain; charset=utf-8"
  ".map" = "application/json; charset=utf-8"
}

function Get-ContentType([string]$path) {
  $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($contentTypes.ContainsKey($extension)) {
    return $contentTypes[$extension]
  }
  return "application/octet-stream"
}

function Resolve-RequestPath([string]$rawPath) {
  $cleanPath = [Uri]::UnescapeDataString($rawPath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($cleanPath)) {
    return (Join-Path $distPath "index.html")
  }

  $candidate = Join-Path $distPath $cleanPath
  if ((Test-Path $candidate) -and -not (Get-Item $candidate).PSIsContainer) {
    return $candidate
  }

  return (Join-Path $distPath "index.html")
}

function Write-HttpResponse($stream, [int]$statusCode, [string]$contentType, [byte[]]$body) {
  $statusText = if ($statusCode -eq 200) { "OK" } else { "Internal Server Error" }
  $header = "HTTP/1.1 $statusCode $statusText`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($body, 0, $body.Length)
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)

try {
  $listener.Start()
  $prefix = "http://localhost:$Port/"
  Write-Host "Juego disponible en $prefix"
  Write-Host "Presiona Ctrl+C para detener el servidor."

  if ($OpenBrowser) {
    Start-Process $prefix | Out-Null
  }

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      while (($line = $reader.ReadLine()) -ne "") {
        if ($null -eq $line) {
          break
        }
      }

      $parts = $requestLine.Split(" ")
      $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { "/" }
      $filePath = Resolve-RequestPath $rawPath
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      Write-HttpResponse $stream 200 (Get-ContentType $filePath) $bytes
    } catch {
      $message = [System.Text.Encoding]::UTF8.GetBytes("Error interno del servidor.")
      if ($stream) {
        Write-HttpResponse $stream 500 "text/plain; charset=utf-8" $message
      }
    } finally {
      if ($reader) { $reader.Dispose() }
      if ($stream) { $stream.Dispose() }
      $client.Close()
      $reader = $null
      $stream = $null
    }
  }
} finally {
  $listener.Stop()
}
