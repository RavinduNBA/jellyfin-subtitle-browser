$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Extension.psm1') -Force
$output = Join-Path $PSScriptRoot 'subtitle-browser.js'
[IO.File]::WriteAllText($output, (Get-SubtitleBrowserBundle), [Text.UTF8Encoding]::new($false))
Write-Output 'Generated subtitle-browser.js from src/.'
