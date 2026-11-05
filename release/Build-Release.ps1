param(
    [Parameter(Mandatory)][string]$QtRoot,
    [Parameter(Mandatory)][string]$MpvRoot,
    [Parameter(Mandatory)][string]$BuildDirectory,
    [string]$Python = (Get-Command python.exe -ErrorAction Stop).Source
)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'NativeBuild.psm1') -Force
$tools=Get-NativeBuildTools
Enter-NativeBuildEnvironment -Tools $tools
$source=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
& lib.exe /nologo ('/def:'+(Join-Path $MpvRoot 'mpv.def')) ('/out:'+(Join-Path $MpvRoot 'libmpv-2.dll.lib')) /MACHINE:X86
if($LASTEXITCODE){throw 'MPV import library generation failed'}
$args=@('-S',$source,'-B',$BuildDirectory,'-G','Ninja',('-DCMAKE_MAKE_PROGRAM='+$tools.Ninja),'-DCMAKE_POLICY_VERSION_MINIMUM=3.5','-DCMAKE_BUILD_TYPE=Release',('-DQTROOT='+$QtRoot),('-DMPV_INCLUDE_DIR='+(Join-Path $MpvRoot 'include')),('-DMPV_LIBRARY='+(Join-Path $MpvRoot 'libmpv-2.dll.lib')),('-DPYTHON_EXECUTABLE='+$Python),'-DENABLE_CEC=OFF','-DENABLE_SDL2=OFF')
& $tools.CMake @args
if($LASTEXITCODE){throw 'Release configuration failed'}
& $tools.CMake --build $BuildDirectory --target JellyfinMediaPlayer --parallel 6
if($LASTEXITCODE){throw 'Release compilation failed'}
$compiler=(Get-Item -LiteralPath (Get-Command cl.exe).Source).VersionInfo
$minimumRuntime='14.'+$compiler.FileMinorPart+'.'+$compiler.FileBuildPart+'.'+$compiler.FilePrivatePart
@{minimumVcRuntime=$minimumRuntime;toolset=$tools.ToolsetVersion;architecture='x86'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $BuildDirectory 'release-build.json') -Encoding utf8
