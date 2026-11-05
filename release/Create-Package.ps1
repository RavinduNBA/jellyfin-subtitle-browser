param(
    [Parameter(Mandatory)][string]$BuildDirectory,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [string]$Version='0.1.0-alpha.1',
    [switch]$AllowDirty
)
$ErrorActionPreference='Stop'
$source=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dirty=@(git -C $source status --porcelain)
if($dirty.Count -and -not $AllowDirty){throw 'Commit the source before creating a public release package.'}
$commit=git -C $source rev-parse HEAD
$buildInfo=[IO.File]::ReadAllText((Join-Path $BuildDirectory 'release-build.json'))|ConvertFrom-Json
$name='JellyfinSubtitleBrowser-'+$Version+'-windows-x86'
$stage=Join-Path $OutputDirectory $name
if(Test-Path -LiteralPath $stage){throw 'Package staging folder already exists; use a fresh output directory.'}
New-Item -ItemType Directory -Path (Join-Path $stage 'payload\web-client\extension') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $BuildDirectory 'src\JellyfinSubtitleBrowser.exe') -Destination (Join-Path $stage 'payload')
foreach($item in Get-ChildItem -LiteralPath (Join-Path $source 'native')){Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $stage 'payload\web-client\extension') -Recurse -Force}
Copy-Item -LiteralPath (Join-Path $BuildDirectory 'subtitle-browser.js') -Destination (Join-Path $stage 'payload\web-client\extension') -Force
foreach($file in @('Install.ps1','Install.cmd','Uninstall.ps1','Uninstall.cmd','GETTING-STARTED.md')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $stage}
Copy-Item -LiteralPath (Join-Path $source 'LICENSE') -Destination (Join-Path $stage 'LICENSE-GPL-2.0.txt')
@'
Jellyfin Subtitle Browser is an unofficial, primarily AI-developed fork.
Based on Jellyfin Media Player 1.12.0 and its original contributors.
The complete upstream Git history and source credits are preserved in the fork.
Custom executable and client extension: GPL version 2, see LICENSE-GPL-2.0.txt.
Exact custom source accompanies this release/tag in the source archive.
Qt and MPV runtime DLLs are not included in this ZIP. The installer copies the
matching runtime from the user's existing official Jellyfin installation.
'@ | Set-Content -LiteralPath (Join-Path $stage 'CREDITS.txt') -Encoding utf8
$manifest=@{product='JellyfinSubtitleBrowser';version=$Version;platform='windows-x86';sourceCommit=$(if($dirty.Count){'WORKTREE-TEST-ONLY'}else{$commit});base='Jellyfin Media Player v1.12.0';signed=$false;runtimeIncluded=$false;requiredQt='5.15.2.0';minimumVcRuntime=$buildInfo.minimumVcRuntime}
$manifest|ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stage 'release.json') -Encoding utf8
$archive=Join-Path $OutputDirectory ($name+'.zip')
Compress-Archive -LiteralPath $stage -DestinationPath $archive -CompressionLevel Optimal
if(-not $dirty.Count){
    $sourceZip=Join-Path $OutputDirectory ('JellyfinSubtitleBrowser-'+$Version+'-source.zip')
    git -C $source archive --format=zip --prefix=JellyfinSubtitleBrowser-source/ --output=$sourceZip HEAD
    if($LASTEXITCODE){throw 'Source archive creation failed'}
}
$checksums=@(Get-ChildItem -LiteralPath $OutputDirectory -File | Where-Object Extension -eq '.zip' | Sort-Object Name | ForEach-Object {((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower())+'  '+$_.Name})
[IO.File]::WriteAllLines((Join-Path $OutputDirectory 'SHA256SUMS.txt'),$checksums,[Text.UTF8Encoding]::new($false))
Write-Output $archive
