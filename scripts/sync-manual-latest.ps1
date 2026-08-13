param(
  # 원본 폴더 경로는 공개 배포되지 않도록 data/asset-sources.local.json(gitignore)에서 읽는다
  [string]$ManualDir = ""
)

$ErrorActionPreference = "Stop"
$dkjRoot = Split-Path $PSScriptRoot -Parent

if (-not $ManualDir) {
  $localCfg = Join-Path $dkjRoot "data\asset-sources.local.json"
  if (-not (Test-Path $localCfg)) {
    throw "통합매뉴얼 폴더를 -ManualDir 로 주거나 data\asset-sources.local.json 을 두세요."
  }
  $cfg = Get-Content $localCfg -Raw -Encoding UTF8 | ConvertFrom-Json
  $ManualDir = Join-Path $cfg.fsscRoot $cfg.paths.manual
}
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
