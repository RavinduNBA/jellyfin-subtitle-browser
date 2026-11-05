param([switch]$NonInteractive)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($PSScriptRoot)
$stateFile=Join-Path $root 'installation.json'
if(-not(Test-Path -LiteralPath $stateFile)){throw 'No matching Subtitle Browser installation manifest was found.'}
$state=[IO.File]::ReadAllText($stateFile)|ConvertFrom-Json
if($state.product -ne 'JellyfinSubtitleBrowser' -or [IO.Path]::GetFileName($root) -notlike 'JellyfinSubtitleBrowserApp*'){throw 'Unexpected installation directory; nothing was removed.'}
if(Get-Process JellyfinSubtitleBrowser -ErrorAction SilentlyContinue){throw 'Close Jellyfin Subtitle Browser before uninstalling.'}
if(-not $NonInteractive){
    Add-Type -AssemblyName System.Windows.Forms
    $answer=[Windows.Forms.MessageBox]::Show('Remove this unofficial player? Your stock Jellyfin installation, saved account and preferences will be kept.','Remove Jellyfin Subtitle Browser','YesNo','Question')
    if($answer -ne 'Yes'){exit}
}
foreach($name in @('app','previous')){
    $target=Join-Path $root $name
    if(Test-Path -LiteralPath $target){
        $resolved=(Resolve-Path -LiteralPath $target).Path
        if(-not $resolved.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected uninstall path'}
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
$shortcut=Join-Path ([Environment]::GetFolderPath('Programs')) 'Jellyfin Subtitle Browser.lnk'
if(-not $NonInteractive -and (Test-Path -LiteralPath $shortcut)){
    $shell=New-Object -ComObject WScript.Shell;$link=$shell.CreateShortcut($shortcut)
    if($link.TargetPath.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $shortcut}
}
Remove-Item -LiteralPath $stateFile
Write-Output 'Application removed. Your separate profile and stock Jellyfin were preserved.'
