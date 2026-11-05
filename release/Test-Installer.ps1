param([Parameter(Mandatory)][string]$PackageDirectory,[Parameter(Mandatory)][string]$TestRoot,[string]$RuntimeDirectory='C:\Program Files\Jellyfin\Jellyfin Media Player')
$ErrorActionPreference='Stop'
$install=Join-Path $TestRoot ('JellyfinSubtitleBrowserApp-Test-'+[Guid]::NewGuid().ToString('N'))
$stock=Join-Path $RuntimeDirectory 'JellyfinMediaPlayer.exe'
$before=(Get-FileHash -LiteralPath $stock -Algorithm SHA256).Hash
& (Join-Path $PackageDirectory 'Install.ps1') -RuntimeDirectory $RuntimeDirectory -InstallRoot $install -NoLaunch -NonInteractive
if(-not(Test-Path -LiteralPath (Join-Path $install 'app\JellyfinSubtitleBrowser.exe'))){throw 'Installer did not deploy the player'}
if(Test-Path -LiteralPath (Join-Path $install 'app\JellyfinMediaPlayer.exe')){throw 'Stock executable should not be deployed as a second launcher'}
if((Get-FileHash -LiteralPath $stock -Algorithm SHA256).Hash -ne $before){throw 'Installer changed the stock player'}
& (Join-Path $install 'Uninstall.ps1') -NonInteractive
if(Test-Path -LiteralPath (Join-Path $install 'app')){throw 'Uninstall left application binaries behind'}
if((Get-FileHash -LiteralPath $stock -Algorithm SHA256).Hash -ne $before){throw 'Uninstall changed the stock player'}
Write-Output 'Side-by-side install/uninstall passed; stock executable unchanged.'
