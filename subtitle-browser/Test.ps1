param([string]$Node = (Get-Command node.exe -ErrorAction Stop).Source)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Build-Extension.ps1')
& $Node --test (Join-Path $PSScriptRoot 'tests\core.test.cjs') (Join-Path $PSScriptRoot 'tests\integration.test.cjs')
if ($LASTEXITCODE) { throw 'Subtitle Browser tests failed.' }
