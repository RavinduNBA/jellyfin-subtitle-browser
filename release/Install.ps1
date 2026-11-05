param(
    [string]$RuntimeDirectory,
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'JellyfinSubtitleBrowserApp'),
    [switch]$NoLaunch,
    [switch]$NonInteractive
)
$ErrorActionPreference='Stop'
function Show-Error([string]$Text){
    if($NonInteractive){throw $Text}
    Add-Type -AssemblyName System.Windows.Forms
    [void][Windows.Forms.MessageBox]::Show($Text,'Jellyfin Subtitle Browser','OK','Error')
    exit 1
}
function Get-Machine([string]$File){
    $bytes=[IO.File]::ReadAllBytes($File)
    if($bytes.Length -lt 64){throw 'Invalid Windows runtime file'}
    $offset=[BitConverter]::ToInt32($bytes,60)
    return [BitConverter]::ToUInt16($bytes,$offset+4)
}
$destination=[IO.Path]::GetFullPath($InstallRoot)
if([IO.Path]::GetFileName($destination.TrimEnd('\')) -notlike 'JellyfinSubtitleBrowserApp*'){Show-Error 'Choose a dedicated JellyfinSubtitleBrowserApp installation folder.'}
try {
    $payload=Join-Path $PSScriptRoot 'payload'
    if(-not(Test-Path -LiteralPath (Join-Path $payload 'JellyfinSubtitleBrowser.exe'))){throw 'Extract the complete release ZIP before running Install.cmd.'}
    $systemDirectory=if([Environment]::Is64BitOperatingSystem){'SysWOW64'}else{'System32'}
    $vcRuntime=Join-Path (Join-Path $env:WINDIR $systemDirectory) 'msvcp140.dll'
    if(-not(Test-Path -LiteralPath $vcRuntime)){throw 'Install the latest Microsoft Visual C++ v14 Redistributable (x86) first. The official Microsoft link is in GETTING-STARTED.md.'}
    $vcInfo=(Get-Item -LiteralPath $vcRuntime).VersionInfo
    $vcVersion=[version]::new($vcInfo.FileMajorPart,$vcInfo.FileMinorPart,$vcInfo.FileBuildPart,$vcInfo.FilePrivatePart)
    $release=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'release.json'))|ConvertFrom-Json
    if($vcVersion -lt [version]$release.minimumVcRuntime){throw 'Update Microsoft Visual C++ v14 Redistributable (x86) using the official link in GETTING-STARTED.md.'}
    if(-not $RuntimeDirectory){
        foreach($candidate in @((Join-Path $env:ProgramFiles 'Jellyfin\Jellyfin Media Player'),(Join-Path ${env:ProgramFiles(x86)} 'Jellyfin\Jellyfin Media Player'))){
            $candidateCore=Join-Path $candidate 'Qt5Core.dll'
            if((Test-Path -LiteralPath $candidateCore) -and (Test-Path -LiteralPath (Join-Path $candidate 'libmpv-2.dll'))){
                if((Get-Machine $candidateCore) -eq 0x14c -and (Get-Item -LiteralPath $candidateCore).VersionInfo.FileVersion -eq '5.15.2.0'){$RuntimeDirectory=$candidate;break}
            }
        }
    }
    if(-not $RuntimeDirectory){throw 'This Windows x86 alpha requires Jellyfin Media Player 1.12.0 (32-bit) installed first. See GETTING-STARTED.md for the official download.'}
    $core=Join-Path $RuntimeDirectory 'Qt5Core.dll'
    $mpv=Join-Path $RuntimeDirectory 'libmpv-2.dll'
    if(-not(Test-Path -LiteralPath $core) -or -not(Test-Path -LiteralPath $mpv)){throw 'The selected directory is not a complete Jellyfin Media Player installation.'}
    if((Get-Item -LiteralPath $core).VersionInfo.FileVersion -ne '5.15.2.0' -or (Get-Machine $core) -ne 0x14c -or (Get-Machine $mpv) -ne 0x14c){throw 'This release needs the Qt 5.15.2 x86 runtime from Jellyfin Media Player 1.12.0 for Windows x86. A 64-bit installation is incompatible with this alpha.'}
    if(-not(Test-Path -LiteralPath (Join-Path $RuntimeDirectory 'QtWebEngineProcess.exe'))){throw 'The required WebEngine runtime is missing. Repair the official player installation first.'}
    foreach($process in @(Get-Process JellyfinSubtitleBrowser -ErrorAction SilentlyContinue)){
        if($process.Path -and $process.Path.StartsWith($destination+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Close Jellyfin Subtitle Browser before updating it. Stock Jellyfin can stay open.'}
    }
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    $existingState=Join-Path $destination 'installation.json'
    if(Test-Path -LiteralPath (Join-Path $destination 'app')){
        if(-not(Test-Path -LiteralPath $existingState) -or ([IO.File]::ReadAllText($existingState)|ConvertFrom-Json).product -ne 'JellyfinSubtitleBrowser'){throw 'The destination contains an unrecognized application. Nothing was replaced.'}
    }
    $stage=Join-Path $destination ('app.staging-'+[Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    foreach($item in Get-ChildItem -LiteralPath $RuntimeDirectory){
        if($item.PSIsContainer -or $item.Extension -ne '.exe' -or $item.Name -eq 'QtWebEngineProcess.exe'){
            Copy-Item -LiteralPath $item.FullName -Destination $stage -Recurse -Force
        }
    }
    foreach($item in Get-ChildItem -LiteralPath $payload){Copy-Item -LiteralPath $item.FullName -Destination $stage -Recurse -Force}
    $app=Join-Path $destination 'app';$backup=Join-Path $destination 'previous'
    if(Test-Path -LiteralPath $backup){throw 'A previous update backup exists. Keep it or remove it before another update.'}
    if(Test-Path -LiteralPath $app){Move-Item -LiteralPath $app -Destination $backup}
    try{Move-Item -LiteralPath $stage -Destination $app}catch{if(Test-Path -LiteralPath $backup){Move-Item -LiteralPath $backup -Destination $app};throw}
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Uninstall.ps1') -Destination $destination -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Uninstall.cmd') -Destination $destination -Force
    $state=@{product='JellyfinSubtitleBrowser';schema=1;runtimeSource=$RuntimeDirectory;installedAt=(Get-Date).ToString('o')}|ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $destination 'installation.json'),$state,[Text.UTF8Encoding]::new($false))
    if(-not $NonInteractive){
        $shell=New-Object -ComObject WScript.Shell
        $shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'Jellyfin Subtitle Browser.lnk'))
        $shortcut.TargetPath=Join-Path $app 'JellyfinSubtitleBrowser.exe';$shortcut.WorkingDirectory=$app;$shortcut.Description='Unofficial Jellyfin player with subtitle history';$shortcut.Save()
    }
    if(-not $NoLaunch){Start-Process -FilePath (Join-Path $app 'JellyfinSubtitleBrowser.exe') -WindowStyle Normal}
    Write-Output ('Installed side-by-side at '+$destination)
} catch {Show-Error $_.Exception.Message}
