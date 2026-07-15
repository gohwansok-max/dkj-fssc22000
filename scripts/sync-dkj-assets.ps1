# DKJ document center asset sync (excerpts + PDF via Word)
# Run from tenants/dkj:
#   powershell -ExecutionPolicy Bypass -File scripts\sync-dkj-assets.ps1 -ExcerptsOnly
#   powershell -ExecutionPolicy Bypass -File scripts\sync-dkj-assets.ps1 -PdfOnly

param(
    [switch]$ExcerptsOnly,
    [switch]$PdfOnly
)

$ErrorActionPreference = 'Stop'
$dkjRoot = Split-Path $PSScriptRoot -Parent

if (-not $PdfOnly) {
    Write-Host "Syncing excerpts via Node..."
    node (Join-Path $PSScriptRoot 'sync-excerpts.mjs')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($ExcerptsOnly) { exit 0 }

$sourcesFile = Join-Path $dkjRoot 'data\asset-sources.json'
$sources = Get-Content $sourcesFile -Raw -Encoding UTF8 | ConvertFrom-Json
$fsscRoot = $sources.fsscRoot
$pdfOut = Join-Path $dkjRoot 'assets\pdf'
$manifestPath = Join-Path $dkjRoot 'data\pdf-manifest.json'

if (-not (Test-Path $fsscRoot)) {
    Write-Warning "FSSC root not found: $fsscRoot"
    exit 1
}

New-Item -ItemType Directory -Force -Path $pdfOut | Out-Null
$pdfManifest = @{ updatedAt = (Get-Date -Format 'yyyy-MM-dd'); files = @() }

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
}
catch {
    Write-Warning "Microsoft Word not available. Copy PDFs manually to assets/pdf/"
    $word = $null
}

function Export-DocToPdf {
    param([string]$SrcPath, [string]$PdfName, [string]$DocId)
    if (-not (Test-Path $SrcPath)) { return }
    $pdfPath = Join-Path $pdfOut $PdfName
    if ($word) {
        $doc = $word.Documents.Open($SrcPath, $false, $true)
        $doc.ExportAsFixedFormat($pdfPath, 17)
        $doc.Close($false)
    }
    if (Test-Path $pdfPath) {
        $script:pdfManifest.files += @{ id = $DocId; pdf = "assets/pdf/$PdfName" }
        Write-Host "PDF OK:" $PdfName
    }
}

if ($word) {
    $procDir = Join-Path $fsscRoot $sources.paths.procedures
    Get-ChildItem $procDir -Filter 'DKJ-P-*.docx' -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.BaseName -match '(DKJ-P-\d+)') {
            Export-DocToPdf -SrcPath $_.FullName -PdfName ($Matches[1] + '.pdf') -DocId $Matches[1]
        }
    }
    $word.Quit()
    [void][System.Runtime.Interopservices.Marshal]::ReleaseComObject($word)
}

Get-ChildItem $pdfOut -Filter '*.pdf' -ErrorAction SilentlyContinue | ForEach-Object {
    $id = $_.BaseName
    $rel = "assets/pdf/$($_.Name)"
    if (-not ($pdfManifest.files | Where-Object { $_.id -eq $id })) {
        $pdfManifest.files += @{ id = $id; pdf = $rel }
    }
}

$pdfManifest | ConvertTo-Json -Depth 5 | Set-Content $manifestPath -Encoding UTF8
Write-Host "pdf-manifest.json count:" $pdfManifest.files.Count

node (Join-Path $PSScriptRoot 'build-pdf-manifest.mjs')
