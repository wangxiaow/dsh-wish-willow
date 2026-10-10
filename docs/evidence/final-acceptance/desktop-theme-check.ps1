$ErrorActionPreference='Stop'
$probe=Join-Path $PSScriptRoot 'desktop-probe.ps1'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::FromHandle((Get-Process -Id 5932).MainWindowHandle)
function Find-Button([string]$name) {
 $all=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 @($all | Where-Object {$_.Current.Name -eq $name -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button})
}
# Unicode UI labels are supplied as command arguments, not guessed key sequences.
$general=$args[0];$light=$args[1];$dark=$args[2];$system=$args[3];$account=$args[4];$settings=$args[5];$wish='Wish Willow '+[char]0xB7+' P0'
if ((Find-Button $wish).Count -eq 0) {
 & $probe -Action expand -Name $account
 & $probe -Action invoke -Name $settings -Control MenuItem
}
& $probe -Action invoke -Name $general
$selected=@()
foreach($name in @($light,$dark,$system)) {
 $button=(Find-Button $name)[0]
 $state=([System.Windows.Automation.TogglePattern]$button.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)).Current.ToggleState
 if($state -eq [System.Windows.Automation.ToggleState]::On){$selected+=$name}
}
if($selected.Count -ne 1){throw 'Cannot determine original theme; refuse to change it'}
try {
 foreach($item in @(@{name=$light;label='desktop-light-ready'},@{name=$dark;label='desktop-dark-ready'})) {
  & $probe -Action invoke -Name $item.name
  & $probe -Action invoke -Name $wish
  & $probe -Action wait-ready -Value '[P0 ACCEPTANCE TEST] Desktop edited'
  & $probe -Action capture -Label $item.label
  & $probe -Action invoke -Name $general
 }
} finally {
 & $probe -Action invoke -Name $selected[0]
}
[pscustomobject]@{observedAt=(Get-Date -Format o);originalTheme=$selected[0];restoredTheme=$selected[0];themesTested=@($light,$dark);productLoadedInBoth=$true;pid=5932} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'desktop-themes.json')
& $probe -Action invoke -Name $wish
& $probe -Action wait-ready -Value '[P0 ACCEPTANCE TEST] Desktop edited'
