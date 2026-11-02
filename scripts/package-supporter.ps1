$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$deliveryRoot = Join-Path $projectRoot 'artifacts\supporter'
$customerRoot = Join-Path $deliveryRoot 'customer'
$manifest = Get-Content -LiteralPath (Join-Path $customerRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $manifest.files) {
    $target = [IO.Path]::GetFullPath((Join-Path $customerRoot $entry.file))
    if (-not $target.StartsWith($customerRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path is outside customer directory.' }
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Checksum mismatch: $($entry.file)" }
}
if (@($manifest.files | Where-Object { $_.file -like 'previews/*' }).Count -ne 6) { throw 'Generate all six previews before packaging.' }
$customerFiles = @('supporter-all.json', 'profiles', 'previews', 'START-HERE.html', 'LICENSE.txt', 'GPL-3.0.txt', 'manifest.json') | ForEach-Object { Join-Path $customerRoot $_ }
Compress-Archive -LiteralPath $customerFiles -DestinationPath (Join-Path $deliveryRoot 'Dynamic-Island-Supporter-1.0.0.zip') -Force
Compress-Archive -LiteralPath (Join-Path $deliveryRoot 'marketing') -DestinationPath (Join-Path $deliveryRoot 'Supporter-Marketing-Kit.zip') -Force
Get-FileHash -LiteralPath (Join-Path $deliveryRoot 'Dynamic-Island-Supporter-1.0.0.zip'), (Join-Path $deliveryRoot 'Supporter-Marketing-Kit.zip') -Algorithm SHA256
