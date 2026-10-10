param([ValidateSet('Browser','Desktop','BrowserA','BrowserB')][string]$Target='Browser', [ValidateSet('activate','inspect','capture','invoke','expand','select','value','focus','keys','wait-ready','resize')][string]$Action='inspect', [string]$Name='', [string]$Id='', [string]$Value='', [string]$Keys='', [string]$Control='Button', [string]$Label='probe', [int]$Width=1280, [int]$Height=900)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WWWebProbe {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int cmd);
 [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int width,int height,bool redraw);
}
'@
if($Target -in @('BrowserA','BrowserB')){$targets=Get-Content -Raw (Join-Path $PSScriptRoot 'browser-targets.json') | ConvertFrom-Json;$targetInfo=$targets.$Target;$handle=[IntPtr]$targetInfo.handle;$expectedPid=[int]$targetInfo.pid;$expectedProcess='chrome'}elseif($Target -eq 'Browser'){$handle=[IntPtr]68526;$expectedPid=9908;$expectedProcess='chrome'}else{$handle=[IntPtr]198834;$expectedPid=5932;$expectedProcess='DeepSeek Harness'}
$root=[System.Windows.Automation.AutomationElement]::FromHandle($handle)
$proc=Get-Process -Id $expectedPid
if($root.Current.ProcessId -ne $expectedPid -or $proc.ProcessName -ne $expectedProcess -or $root.Current.Name -notmatch 'DeepSeek Harness'){throw 'Verified DSH window identity changed; refusing interaction'}
if($Target -in @('BrowserA','BrowserB')){
 $addressName=[string][char]0x5730+[char]0x5740+[char]0x548c+[char]0x641c+[char]0x7d22+[char]0x680f
 $tree=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 $address=@($tree | Where-Object {$_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit -and $_.Current.Name -in @($addressName,'Address and search bar')})
 if($address.Count -ne 1){throw 'Cannot safely verify current browser origin'}
 $raw=([System.Windows.Automation.ValuePattern]$address[0].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).Current.Value
 if($raw -notmatch '^https?://'){$raw='http://'+$raw}
 $origin=([uri]$raw).GetLeftPart([System.UriPartial]::Authority);$raw=$null
 if($origin -ne 'http://127.0.0.1:3081'){throw 'Browser left isolated test origin; refusing interaction'}
}
if($Action -eq 'activate'){[void][WWWebProbe]::ShowWindow($handle,9);[void][WWWebProbe]::SetForegroundWindow($handle)}
function Elements { $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) }
function Find-Target {
 $found=@((Elements) | Where-Object {if($Id){$_.Current.AutomationId -eq $Id}else{$_.Current.Name -eq $Name -and $_.Current.ControlType.ProgrammaticName -eq ('ControlType.'+$Control)}})
 if($found.Count -ne 1){throw "Expected one scoped target; got $($found.Count) ($Action $Name $Id)"}
 $found[0]
}
if($Action -in @('invoke','expand','select','value','focus')) {
 $el=Find-Target
 switch($Action){
 'invoke' {$p=$null;if($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$p)){([System.Windows.Automation.InvokePattern]$p).Invoke()}elseif($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern,[ref]$p)){([System.Windows.Automation.TogglePattern]$p).Toggle()}else{throw 'No supported button action'}}
 'expand' {([System.Windows.Automation.ExpandCollapsePattern]$el.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)).Expand()}
 'select' {([System.Windows.Automation.SelectionItemPattern]$el.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)).Select()}
 'value' {([System.Windows.Automation.ValuePattern]$el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).SetValue($Value)}
 'focus' {$el.SetFocus()}
 }
}
if($Action -eq 'keys'){
 [void][WWWebProbe]::SetForegroundWindow($handle)
 if([WWWebProbe]::GetForegroundWindow() -ne $handle){throw 'Wrong foreground window; keyboard input refused'}
 [System.Windows.Forms.SendKeys]::SendWait($Keys)
}
if($Action -eq 'wait-ready'){
 $ready=$false
 for($attempt=0;$attempt -lt 80;$attempt++){
  $condition=New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::AutomationIdProperty),'ww-title'
  $el=$root.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$condition)
  if($null -ne $el -and $el.Current.IsEnabled){$actual=([System.Windows.Automation.ValuePattern]$el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).Current.Value;if($actual -eq $Value){$ready=$true;break}}
  Start-Sleep -Milliseconds 100
 }
 if(-not $ready){throw 'Expected product UI value did not appear within eight seconds'}
}
$rect=$root.Current.BoundingRectangle
if($Action -eq 'resize'){
 if($Width -lt 500 -or $Width -gt 2000 -or $Height -lt 600 -or $Height -gt 1400){throw 'Unsafe test dimensions'}
 [void][WWWebProbe]::MoveWindow($handle,[int]$rect.Left,[int]$rect.Top,$Width,$Height,$true)
 $rect=$root.Current.BoundingRectangle
}
$record=[ordered]@{at=(Get-Date -Format o);target=$Target;pid=$expectedPid;handle=$handle.ToInt64();action=$Action;name=$Name;id=$Id;value=$Value;keys=$Keys;bounds=$rect.ToString();label=$Label}
if($Action -eq 'inspect'){
 $all=Elements
 $dialogs=@($all | Where-Object {$_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window -and $_.Current.Name -in @('Settings',([string][char]0x8bbe+[char]0x7f6e))})
 if($dialogs.Count -eq 1){$all=$dialogs[0].FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)}
 else{$documents=@($all | Where-Object {$_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Document -and $_.Current.Name -match 'DeepSeek Harness'});if($documents.Count -eq 1){$all=$documents[0].FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)}else{$all=@()};$all=@($all | Where-Object {$_.Current.AutomationId -like 'ww-*' -or ($_.Current.ControlType -in @([System.Windows.Automation.ControlType]::Button,[System.Windows.Automation.ControlType]::MenuItem,[System.Windows.Automation.ControlType]::Document) -and $_.Current.Name.Length -lt 180)})}
 $rows=foreach($el in $all){$c=$el.Current;$row=[ordered]@{type=$c.ControlType.ProgrammaticName;name=$c.Name;id=$c.AutomationId;enabled=$c.IsEnabled;offscreen=$c.IsOffscreen;bounds=$c.BoundingRectangle.ToString()};if($c.AutomationId -like 'ww-*'){$p=$null;if($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$p)){$row.value=([System.Windows.Automation.ValuePattern]$p).Current.Value}};[pscustomobject]$row}
 $record.elements=@($rows)
 $record | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot ($Label+'.json'))
 "Saved scoped UI evidence $Label.json"
}
if($Action -eq 'capture'){
 if($rect.IsEmpty){throw 'Target is minimized or not visible'}
 $bmp=New-Object System.Drawing.Bitmap ([int]$rect.Width),([int]$rect.Height);$g=[System.Drawing.Graphics]::FromImage($bmp)
 try{$dc=$g.GetHdc();try{$ok=[WWWebProbe]::PrintWindow($handle,$dc,2)}finally{$g.ReleaseHdc($dc)};if(-not $ok){throw 'PrintWindow failed'};if($Target -like 'Browser*'){$g.FillRectangle([System.Drawing.Brushes]::Black,0,0,$bmp.Width,120)};$bmp.Save((Join-Path $PSScriptRoot ($Label+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$bmp.Dispose()}
 "Saved target-only screenshot $Label.png (browser toolbar redacted)"
}
$record.Remove('elements')
$record | ConvertTo-Json -Compress | Add-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'actions.jsonl')
