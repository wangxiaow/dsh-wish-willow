param([string]$Label='panel', [string]$OutDir='G:\dsh\Wish-Willow\docs\evidence\p1-unification\desktop-after-restart', [switch]$SkipOpen)
$ErrorActionPreference='Continue'
$probe = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'desktop-probe.ps1'
# The settings modal can close while the app re-renders, so every capture first
# re-establishes it: account menu (when present) → Settings → Wish Willow. Each step
# tolerates a missing target because an already-open modal has none of them.
if(-not $SkipOpen){
 & powershell -NoProfile -ExecutionPolicy Bypass -File $probe -Action expand -Name '账号菜单' -OutDir $OutDir > $null 2>&1
 & powershell -NoProfile -ExecutionPolicy Bypass -File $probe -Action invoke-name -Name '设置' -OutDir $OutDir > $null 2>&1
 Start-Sleep -Milliseconds 900
 & powershell -NoProfile -ExecutionPolicy Bypass -File $probe -Action invoke-name -Name 'Wish Willow' -OutDir $OutDir > $null 2>&1
 Start-Sleep -Milliseconds 1500
}
& powershell -NoProfile -ExecutionPolicy Bypass -File $probe -Action panel -Label $Label -OutDir $OutDir 2>&1 |
 Where-Object { $_ -match '^\s*\{' } | Select-Object -Last 1
