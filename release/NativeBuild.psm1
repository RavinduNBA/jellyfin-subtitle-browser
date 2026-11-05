$ErrorActionPreference = 'Stop'

function Get-NativeBuildTools {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path -LiteralPath $vswhere)) { throw 'Install Visual Studio with the Desktop development with C++ workload.' }
    $visualStudio = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if (-not $visualStudio) { throw 'Visual Studio C++ tools were not found.' }
    $msvcRoot = Join-Path $visualStudio 'VC\Tools\MSVC'
    $versions = @(Get-ChildItem -LiteralPath $msvcRoot -Directory | Sort-Object { [version]$_.Name } -Descending)
    $toolset = $versions | Where-Object Name -like '14.44.*' | Select-Object -First 1
    if (-not $toolset) { $toolset = $versions | Select-Object -First 1 }
    if (-not $toolset) { throw 'No MSVC toolset was found.' }
    $cmake = Join-Path $visualStudio 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
    $ninja = Join-Path $visualStudio 'Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe'
    foreach ($path in @($cmake,$ninja)) { if (-not (Test-Path -LiteralPath $path)) { throw 'Install the Visual Studio C++ CMake tools component.' } }
    return [pscustomobject]@{
        CMake = $cmake; Ninja = $ninja
        VcVars = Join-Path $visualStudio 'VC\Auxiliary\Build\vcvars32.bat'
        ToolsetVersion = $toolset.Name
        Dumpbin = Join-Path $toolset.FullName 'bin\Hostx64\x86\dumpbin.exe'
    }
}

function Enter-NativeBuildEnvironment {
    param([Parameter(Mandatory)]$Tools)
    $command = 'call "' + $Tools.VcVars + '" -vcvars_ver=' + $Tools.ToolsetVersion + ' >nul && set'
    $variables = & $env:ComSpec /d /c $command
    if ($LASTEXITCODE) { throw 'Could not initialize the Visual Studio x86 build environment.' }
    foreach ($line in $variables) {
        $index = $line.IndexOf('=')
        if ($index -gt 0) { [Environment]::SetEnvironmentVariable($line.Substring(0,$index), $line.Substring($index+1), 'Process') }
    }
}

Export-ModuleMember -Function Get-NativeBuildTools, Enter-NativeBuildEnvironment
