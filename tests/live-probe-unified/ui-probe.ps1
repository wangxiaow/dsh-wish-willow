param(
  [ValidateSet('discover','inspect','capture','invoke','value','focus','select','keys','click','click-id','click-name','activate','focused','tab-to','wait-id','wait-name','dump-ids')][string]$Action='inspect',
  [string]$Id='', [string]$Name='', [string]$Value='', [string]$Keys='', [string]$Control='', [string]$Label='probe',
  [string]$Origin='http://127.0.0.1:3081', [int]$X=0, [int]$Y=0, [int]$Width=1400, [int]$Height=1000, [int]$TimeoutMs=20000,
  [int]$DebugPort=9333, [string]$ChromeProfile='G:\dsh\Wish-Willow\.test-data\chrome-home-unified-3081', [string]$OutDir=''
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WWUnifiedProbe {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int cmd);
 [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int width,int height,bool redraw);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h,bool altTab);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,IntPtr pid);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from,uint to,bool attach);
}
'@
# Windows only lets the foreground process call SetForegroundWindow; attach our input
# queue to the target thread first, then restore focus deterministically.
# Chromium's focused element is often a child HWND, so compare against the root ancestor
# of the current foreground window instead of the raw handle.
function Test-Focused([IntPtr]$targetHandle){
 $foreground=[WWUnifiedProbe]::GetForegroundWindow()
 if($foreground -eq $targetHandle){return $true}
 if($foreground -eq [IntPtr]::Zero){return $false}
 return ([WWUnifiedProbe]::GetAncestor($foreground,2) -eq $targetHandle)
}
function Focus-Target([IntPtr]$targetHandle){
 [void][WWUnifiedProbe]::ShowWindow($targetHandle,9)
 for($attempt=0;$attempt -lt 6;$attempt++){
  [WWUnifiedProbe]::SwitchToThisWindow($targetHandle,$false)
  $targetThread=[WWUnifiedProbe]::GetWindowThreadProcessId($targetHandle,[IntPtr]::Zero)
  $current=[WWUnifiedProbe]::GetCurrentThreadId()
  if($targetThread -ne $current){[void][WWUnifiedProbe]::AttachThreadInput($current,$targetThread,$true)}
  [void][WWUnifiedProbe]::SetForegroundWindow($targetHandle)
  if($targetThread -ne $current){[void][WWUnifiedProbe]::AttachThreadInput($current,$targetThread,$false)}
  Start-Sleep -Milliseconds 250
  if(Test-Focused $targetHandle){return $true}
 }
 return $false
}
$here=Split-Path -Parent $MyInvocation.MyCommand.Path
if($OutDir -eq ''){$OutDir=Join-Path (Split-Path -Parent (Split-Path -Parent $here)) 'docs/evidence/p1-unification/web'}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
function Fail([string]$message){throw $message}
# Independent origin verification: the browser's own debug endpoint reports the pages it
# serves, so the driver never trusts an address-bar string or a window title.
function Get-DebugPages {
 $raw=$null
 try { $raw=Invoke-RestMethod "http://127.0.0.1:$DebugPort/json/list" -TimeoutSec 10 } catch { return }
 if($null -eq $raw){return}
 foreach($item in @($raw)){ $item }
}
function Assert-Origin {
 $pages=@(Get-DebugPages | Where-Object { "$($_.url)" -match '^https?://' })
 if($pages.Count -lt 1){Fail "The isolated browser at debug port $DebugPort exposes no http page; refusing to interact"}
 $origins=@($pages | ForEach-Object { $u=[uri]"$($_.url)"; "$($u.Scheme)://$($u.Authority)" } | Select-Object -Unique)
 if($origins.Count -ne 1 -or $origins[0] -ne $Origin){Fail "Browser origin mismatch: expected $Origin, saw $($origins -join ', '); refusing to interact"}
 return "$($pages[0].title)"
}
# The target window is the top-level window of the browser process started with our
# dedicated user-data-dir: process identity, not a title or an address-bar guess.
function Find-Targets {
 $browsers=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*--user-data-dir=$ChromeProfile*" -and $_.CommandLine -notlike '*--type=*' })
 if($browsers.Count -ne 1){Fail "Expected exactly one isolated browser process for $ChromeProfile; found $($browsers.Count)"}
 $browserPid=$browsers[0].ProcessId
 $windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
 @(foreach($w in $windows){
  $c=$w.Current
  if($c.ControlType -ne [System.Windows.Automation.ControlType]::Window -or $c.ProcessId -ne $browserPid){continue}
  [pscustomobject]@{window=$w;handle=$c.NativeWindowHandle;pid=$c.ProcessId;bounds=$c.BoundingRectangle.ToString()}
 })
}
$pageTitle=Assert-Origin
$targets=@(Find-Targets)
if($Action -eq 'activate'){
 if($targets.Count -ne 1){Fail "Expected exactly one browser window; found $($targets.Count)"}
 $activated=Focus-Target $targets[0].handle
 $foreground=[WWUnifiedProbe]::GetForegroundWindow()
 "activate result=$activated handle=$($targets[0].handle) foreground=$foreground root=$([WWUnifiedProbe]::GetAncestor($foreground,2))"
 if(-not $activated){Fail 'activation failed'}
 exit 0
}
if($Action -eq 'discover'){
 if($targets.Count -ne 1){Fail "Expected exactly one browser window; found $($targets.Count)"}
 $mapping=[ordered]@{at=(Get-Date -Format o);origin=$Origin;debugPort=$DebugPort;chromeProfile=$ChromeProfile;pageTitle=$pageTitle
  targets=@($targets | ForEach-Object {[ordered]@{handle=$_.handle;pid=$_.pid;bounds=$_.bounds}})}
 $mapping | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $OutDir 'browser-targets.json')
 $mapping | ConvertTo-Json -Depth 4
 exit 0
}
if($targets.Count -ne 1){Fail "Expected exactly one browser window; found $($targets.Count). Refusing to guess."}
$handle=$targets[0].handle; $pidValue=$targets[0].pid; $root=$targets[0].window
function Elements { $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) }
function Find-One([string]$automationId,[string]$name,[string]$control){
 $all=Elements
 $matches=@($all | Where-Object {
  if($automationId){ $_.Current.AutomationId -eq $automationId }
  elseif($control){ $_.Current.Name -eq $name -and $_.Current.ControlType.ProgrammaticName -eq ('ControlType.'+$control) }
  else { $_.Current.Name -eq $name }
 })
 if($matches.Count -ne 1){Fail "Expected exactly one target (id='$automationId', name='$name', got $($matches.Count))"}
 $matches[0]
}
if($Action -eq 'click'){
 [void][WWUnifiedProbe]::ShowWindow($handle,9); [void][WWUnifiedProbe]::SetForegroundWindow($handle)
 if(-not (Focus-Target $handle)){Fail 'Foreground acquisition failed; refusing synthetic input'}
 $rect=$root.Current.BoundingRectangle
 if($X -lt 0 -or $Y -lt 0 -or $X -ge $rect.Width -or $Y -ge $rect.Height){Fail 'Click outside the isolated browser window'}
 [void][WWUnifiedProbe]::SetCursorPos([int]$rect.Left+$X,[int]$rect.Top+$Y)
 [WWUnifiedProbe]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [WWUnifiedProbe]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
}
if($Action -in @('click-id','click-name')){
 $element=Find-One $(if($Action -eq 'click-id'){$Id}else{''}) $(if($Action -eq 'click-id'){''}else{$Name}) $Control
 $r=$element.Current.BoundingRectangle
 if($r.IsEmpty -or $r.Width -le 0){Fail 'Target element exposes no clickable rectangle'}
 if(-not (Focus-Target $handle)){Fail 'Foreground acquisition failed; refusing synthetic input'}
 $point=[System.Windows.Point]::new([int]($r.Left+$r.Width/2),[int]($r.Top+$r.Height/2))
 [void][WWUnifiedProbe]::SetCursorPos([int]$point.X,[int]$point.Y)
 $at=[System.Windows.Automation.AutomationElement]::FromPoint($point)
 "hit-test at $($r.ToString()): $($at.Current.ControlType.ProgrammaticName) '$($at.Current.Name)' id='$($at.Current.AutomationId)'"
 [WWUnifiedProbe]::mouse_event(1,0,0,0,[UIntPtr]::Zero)
 [WWUnifiedProbe]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [WWUnifiedProbe]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
 "clicked '$($element.Current.Name)' at $($r.ToString())"
}
if($Action -in @('invoke','value','focus','select','keys')){
 if($Action -ne 'keys'){ if(-not (Focus-Target $handle)){Fail 'Foreground acquisition failed for the element target'} }
 if($Action -eq 'invoke'){
  $element=Find-One $Id $Name $Control
  $pattern=$null
  if($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){([System.Windows.Automation.InvokePattern]$pattern).Invoke()}
  elseif($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern,[ref]$pattern)){([System.Windows.Automation.TogglePattern]$pattern).Toggle()}
  elseif($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pattern)){([System.Windows.Automation.SelectionItemPattern]$pattern).Select()}
  else {Fail 'No supported action pattern on the target'}
 }
 if($Action -eq 'value'){ $element=Find-One $Id $Name $Control; ([System.Windows.Automation.ValuePattern]$element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).SetValue($Value) }
 if($Action -eq 'focus'){ (Find-One $Id $Name $Control).SetFocus() }
 if($Action -eq 'select'){ $element=Find-One $Id $Name $Control; ([System.Windows.Automation.SelectionItemPattern]$element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)).Select() }
 if($Action -eq 'keys'){
  if(-not (Focus-Target $handle)){Fail 'Wrong foreground window; keyboard input refused'}
  [System.Windows.Forms.SendKeys]::SendWait($Keys)
 }
}
if($Action -eq 'focused'){
 $f=[System.Windows.Automation.AutomationElement]::FocusedElement
 if($null -eq $f){'focused: <none>';exit 0}
 "focused: $($f.Current.ControlType.ProgrammaticName) name='$($f.Current.Name)' id='$($f.Current.AutomationId)' process=$($f.Current.ProcessId)"
 exit 0
}
# Real keyboard navigation: walk the page's focus order with TAB until the requested
# element owns focus, then activate it with ENTER. Used where a DOM node exposes no
# reliable UIA hit area but must still be driven as a user would.
if($Action -eq 'tab-to'){
 if(-not (Focus-Target $handle)){Fail 'Foreground acquisition failed; keyboard input refused'}
 $deadline=(Get-Date).AddMilliseconds($TimeoutMs); $step=0
 while((Get-Date) -lt $deadline){
  $f=[System.Windows.Automation.AutomationElement]::FocusedElement
  if($null -ne $f -and $f.Current.Name -eq $Name){
   [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
   "tab-to: reached '$Name' after $step TABs and pressed ENTER"
   exit 0
  }
  [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
  $step++
  Start-Sleep -Milliseconds 120
 }
 $current=[System.Windows.Automation.AutomationElement]::FocusedElement
 Fail "tab-to: '$Name' not reached after $step TABs; focused='$($current.Current.Name)'"
}
if($Action -in @('wait-id','wait-name')){
 $deadline=(Get-Date).AddMilliseconds($TimeoutMs); $ok=$false
 while((Get-Date) -lt $deadline){
  $all=Elements
  $hit=@($all | Where-Object { if($Action -eq 'wait-id'){$_.Current.AutomationId -eq $Id}else{$_.Current.Name -eq $Name} })
  if($hit.Count -ge 1){
   if($Value -eq ''){$ok=$true;break}
   $p=$null
   if($hit[0].TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$p) -and ([System.Windows.Automation.ValuePattern]$p).Current.Value -eq $Value){$ok=$true;break}
  }
  Start-Sleep -Milliseconds 150
 }
 if(-not $ok){Fail "Timed out waiting for $Action id='$Id' name='$Name' value='$Value' within $TimeoutMs ms"}
}
$record=[ordered]@{at=(Get-Date -Format o);origin=$Origin;pid=$pidValue;handle=$handle;action=$Action;id=$Id;name=$Name;value=$Value;keys=$Keys;label=$Label}
if($Action -eq 'inspect' -or $Action -eq 'dump-ids'){
 $all=Elements
 $filtered=if($Action -eq 'dump-ids'){ @($all | Where-Object { $_.Current.AutomationId }) } else { $all }
 $rows=foreach($el in $filtered){ $c=$el.Current
  $row=[ordered]@{type=$c.ControlType.ProgrammaticName;name=$c.Name;id=$c.AutomationId;enabled=$c.IsEnabled;offscreen=$c.IsOffscreen;bounds=$c.BoundingRectangle.ToString()}
  $p=$null; if($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$p)){$row.value=([System.Windows.Automation.ValuePattern]$p).Current.Value}
  [pscustomobject]$row }
 $record.elementCount=$rows.Count
 $record.elements=@($rows)
 $record | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $OutDir ($Label+'.json'))
 "Saved $($rows.Count) elements to $Label.json"
}
if($Action -eq 'capture'){
 $rect=$root.Current.BoundingRectangle
 if($rect.IsEmpty){Fail 'Target is minimized or not visible'}
 $bmp=New-Object System.Drawing.Bitmap ([int]$rect.Width),([int]$rect.Height)
 $g=[System.Drawing.Graphics]::FromImage($bmp)
 try{ $dc=$g.GetHdc(); try{$ok=[WWUnifiedProbe]::PrintWindow($handle,$dc,2)}finally{$g.ReleaseHdc($dc)}
  if(-not $ok){Fail 'PrintWindow failed'}; $bmp.Save((Join-Path $OutDir ($Label+'.png')),[System.Drawing.Imaging.ImageFormat]::Png) } finally {$g.Dispose();$bmp.Dispose()}
 "Saved screenshot $Label.png"
}
$record.Remove('elements'); $record.Remove('elementCount')
$record | ConvertTo-Json -Compress | Add-Content -Encoding UTF8 (Join-Path $OutDir 'actions.jsonl')




