param(
  [string]$ManualDir = "[REDACTED]"
)

$ErrorActionPreference = "Stop"
$dkjRoot = Split-Path $PSScriptRoot -Parent
$targetDir = Join-Path $dkjRoot "assets\docs\DKJ-M-01"
$dataPath = Join-Path $dkjRoot "data\doc-assets.json"
$bundlePath = Join-Path $dkjRoot "js\doc-assets.bundle.js"

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$pdf = Get-ChildItem -Path $ManualDir -Recurse -File -Include *.pdf -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$docx = Get-ChildItem -Path $ManualDir -Recurse -File -Include *.docx -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($pdf) { Copy-Item $pdf.FullName (Join-Path $targetDir "latest.pdf") -Force }
if ($docx) { Copy-Item $docx.FullName (Join-Path $targetDir "latest.docx") -Force }

if (Test-Path $dataPath) {
  $rawObj = Get-Content $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $map = @{
    updatedAt = (Get-Date -Format "yyyy-MM-dd")
    map = @{}
  }
  if ($rawObj.map) {
    $rawObj.map.PSObject.Properties | ForEach-Object {
      $map.map[$_.Name] = @{
        pdf = $_.Value.pdf
        source = $_.Value.source
      }
    }
  }
}
else {
  $map = @{
    updatedAt = (Get-Date -Format "yyyy-MM-dd")
    map = @{}
  }
}

$map.updatedAt = (Get-Date -Format "yyyy-MM-dd")
$map.map["DKJ-M-01"] = @{ pdf = "assets/docs/DKJ-M-01/latest.pdf"; source = "assets/docs/DKJ-M-01/latest.docx" }
$map | ConvertTo-Json -Depth 8 | Set-Content -Path $dataPath -Encoding UTF8
("window.DKJ_DOC_ASSETS=" + (Get-Content $dataPath -Raw) + ";") | Set-Content -Path $bundlePath -Encoding UTF8

node (Join-Path $PSScriptRoot "build-pdf-manifest.mjs")

Write-Host "manual latest synced"
Write-Host "pdf: $($pdf.FullName)"
Write-Host "docx: $($docx.FullName)"
