param([ValidateSet('inspect','capture','click','keys','invoke','value','focus','select','expand','wait-ready','activate')][string]$Action='inspect', [string]$Label='desktop', [int]$X=0, [int]$Y=0, [string]$Keys='', [string]$Name='', [string]$Id='', [string]$Value='', [string]$Control='Button', [int]$TargetPid=5932)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WWDesktopProbe {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
}
'@
$proc=Get-Process -Id $TargetPid
if ($proc.ProcessName -ne 'DeepSeek Harness' -or $proc.MainWindowHandle -eq 0) { throw 'Expected Desktop window unavailable; do not target another window.' }
$handle=$proc.MainWindowHandle
if ($Action -eq 'activate') { [void][WWDesktopProbe]::ShowWindow($handle,9); [void][WWDesktopProbe]::SetForegroundWindow($handle) }
if ($Action -in @('click','keys')) { [void][WWDesktopProbe]::SetForegroundWindow($handle) }
$root=[System.Windows.Automation.AutomationElement]::FromHandle($handle)
$rect=$root.Current.BoundingRectangle
if ($Action -in @('click','keys') -and [WWDesktopProbe]::GetForegroundWindow() -ne $handle) { throw 'Foreground acquisition failed; refuse input to another application.' }
if ($Action -eq 'click') {
 if ($X -lt 0 -or $Y -lt 0 -or $X -ge $rect.Width -or $Y -ge $rect.Height) {throw 'Click outside target window'}
 [void][WWDesktopProbe]::SetCursorPos([int]$rect.Left+$X,[int]$rect.Top+$Y)
 [WWDesktopProbe]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
 [WWDesktopProbe]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
}
if ($Action -eq 'keys') { [System.Windows.Forms.SendKeys]::SendWait($Keys) }
if ($Action -in @('invoke','value','focus','select','expand')) {
 $elements=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 $matches=@($elements | Where-Object { if ($Id) { $_.Current.AutomationId -eq $Id } else { $_.Current.Name -eq $Name -and $_.Current.ControlType.ProgrammaticName -eq ('ControlType.'+$Control) } })
 if ($matches.Count -ne 1) {throw "Expected exactly one target, got $($matches.Count)"}
 $element=$matches[0]
 if ($Action -eq 'invoke') {
  $pattern=$null
  if ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)) { ([System.Windows.Automation.InvokePattern]$pattern).Invoke() }
  elseif ($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern,[ref]$pattern)) { ([System.Windows.Automation.TogglePattern]$pattern).Toggle() }
  else { throw 'No supported Invoke or Toggle action; refuse generic input fallback.' }
 }
 if ($Action -eq 'value') { ([System.Windows.Automation.ValuePattern]$element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).SetValue($Value) }
 if ($Action -eq 'select') { ([System.Windows.Automation.SelectionItemPattern]$element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)).Select() }
 if ($Action -eq 'focus') { $element.SetFocus() }
 if ($Action -eq 'expand') { ([System.Windows.Automation.ExpandCollapsePattern]$element.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)).Expand() }
}
if ($Action -eq 'wait-ready') {
 $ready=$false
 for($attempt=0;$attempt -lt 50;$attempt++) {
  $condition=New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::AutomationIdProperty),'ww-title'
  $input=$root.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$condition)
  if ($null -ne $input -and $input.Current.IsEnabled) {
   $actual=([System.Windows.Automation.ValuePattern]$input.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).Current.Value
   if($actual -eq $Value) {$ready=$true;break}
  }
  Start-Sleep -Milliseconds 100
 }
 if(-not $ready){throw "Product UI did not recover expected title within five seconds: $Value"}
}
[pscustomobject]@{at=(Get-Date -Format o);action=$Action;label=$Label;name=$Name;id=$Id;value=$Value;keys=$Keys;x=$X;y=$Y;pid=$proc.Id} | ConvertTo-Json -Compress | Add-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'desktop-actions.jsonl')
if ($Action -eq 'inspect') {
 $items=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 $rows=for($i=0;$i -lt $items.Count;$i++) { $c=$items[$i].Current; [pscustomobject]@{type=$c.ControlType.ProgrammaticName;name=$c.Name;id=$c.AutomationId;enabled=$c.IsEnabled} }
 [pscustomobject]@{observedAt=(Get-Date -Format o);pid=$proc.Id;title=$proc.MainWindowTitle;bounds=$rect.ToString();elementCount=$items.Count;elements=$rows} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot ($Label+'.json'))
 "Saved accessibility probe: $Label.json; elements=$($items.Count); bounds=$rect"
}
if($Action -eq 'capture') {
 $bmp=New-Object System.Drawing.Bitmap ([int]$rect.Width),([int]$rect.Height)
 $g=[System.Drawing.Graphics]::FromImage($bmp)
 try { $dc=$g.GetHdc(); try { $ok=[WWDesktopProbe]::PrintWindow($handle,$dc,2) } finally { $g.ReleaseHdc($dc) }; if (-not $ok) {throw 'Target-only PrintWindow failed'}; $bmp.Save((Join-Path $PSScriptRoot ($Label+'.png')),[System.Drawing.Imaging.ImageFormat]::Png) } finally {$g.Dispose();$bmp.Dispose()}
 "Saved native Desktop screenshot: $Label.png"
}
