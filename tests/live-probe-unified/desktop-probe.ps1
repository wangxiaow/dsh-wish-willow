param(
  [ValidateSet('find','inspect','capture','activate','click-name','click-id','expand','invoke-name','value','keys','focused','tab-to','panel','dump-ids')][string]$Action='inspect',
  [string]$Id='', [string]$Name='', [string]$Value='', [string]$Keys='', [string]$Control='', [string]$Label='desktop',
  [int]$TimeoutMs=20000, [string]$OutDir=''
)
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
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int cmd);
 [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h,bool altTab);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,IntPtr pid);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from,uint to,bool attach);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
}
'@
$here=Split-Path -Parent $MyInvocation.MyCommand.Path
if($OutDir -eq ''){$OutDir=Join-Path (Split-Path -Parent (Split-Path -Parent $here)) 'docs/evidence/p1-unification/desktop'}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
function Fail([string]$message){throw $message}
# The only acceptable target is the real Desktop application window.
function Find-Desktop {
 $procs=@(Get-Process 'DeepSeek Harness' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 })
 if($procs.Count -ne 1){Fail "Expected exactly one DeepSeek Harness window; found $($procs.Count)"}
 $proc=$procs[0]
 $root=[System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)
 if($root.Current.ProcessId -ne $proc.Id){Fail 'Window identity changed; refusing to interact'}
 [pscustomobject]@{handle=$proc.MainWindowHandle;pid=$proc.Id;title=$proc.MainWindowTitle;root=$root;bounds=$root.Current.BoundingRectangle.ToString()}
}
function Test-Focused([IntPtr]$targetHandle){
 $foreground=[WWDesktopProbe]::GetForegroundWindow()
 if($foreground -eq $targetHandle){return $true}
 if($foreground -eq [IntPtr]::Zero){return $false}
 return ([WWDesktopProbe]::GetAncestor($foreground,2) -eq $targetHandle)
}
function Focus-Target([IntPtr]$targetHandle){
 [void][WWDesktopProbe]::ShowWindow($targetHandle,9)
 for($attempt=0;$attempt -lt 6;$attempt++){
  [WWDesktopProbe]::SwitchToThisWindow($targetHandle,$false)
  $targetThread=[WWDesktopProbe]::GetWindowThreadProcessId($targetHandle,[IntPtr]::Zero)
  $current=[WWDesktopProbe]::GetCurrentThreadId()
  if($targetThread -ne $current){[void][WWDesktopProbe]::AttachThreadInput($current,$targetThread,$true)}
  [void][WWDesktopProbe]::SetForegroundWindow($targetHandle)
  if($targetThread -ne $current){[void][WWDesktopProbe]::AttachThreadInput($current,$targetThread,$false)}
  Start-Sleep -Milliseconds 250
  if(Test-Focused $targetHandle){return $true}
 }
 return $false
}
$target=Find-Desktop
$handle=$target.handle; $root=$target.root; $pidValue=$target.pid
function Elements { $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) }
function Find-One([string]$automationId,[string]$elementName,[string]$controlType){
 $all=Elements
 $matches=@($all | Where-Object {
  if($automationId){ $_.Current.AutomationId -eq $automationId }
  elseif($controlType){ $_.Current.Name -eq $elementName -and $_.Current.ControlType.ProgrammaticName -eq ('ControlType.'+$controlType) }
  else { $_.Current.Name -eq $elementName }
 })
 if($matches.Count -ne 1){Fail "Expected exactly one target (id='$automationId', name='$elementName', control='$controlType'); got $($matches.Count)"}
 $matches[0]
}
function Invoke-Element($element){
 $pattern=$null
 if($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){([System.Windows.Automation.InvokePattern]$pattern).Invoke(); return 'invoke'}
 if($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern,[ref]$pattern)){([System.Windows.Automation.TogglePattern]$pattern).Toggle(); return 'toggle'}
 if($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pattern)){([System.Windows.Automation.SelectionItemPattern]$pattern).Select(); return 'select'}
 return $null
}
$record=[ordered]@{at=(Get-Date -Format o);pid=$pidValue;handle=$handle;action=$Action;id=$Id;name=$Name;value=$Value;keys=$Keys;label=$Label}
if($Action -eq 'find'){ $target | Select-Object handle,pid,title,bounds | ConvertTo-Json -Compress; exit 0 }
if($Action -eq 'activate'){
 if(-not (Focus-Target $handle)){Fail 'activation failed'}
 "activated pid=$pidValue title='$($target.title)'"
}
if($Action -in @('click-name','click-id')){
 $element=Find-One $(if($Action -eq 'click-id'){$Id}else{''}) $(if($Action -eq 'click-id'){''}else{$Name}) $Control
 if(-not (Focus-Target $handle)){Fail 'Foreground acquisition failed; refusing synthetic input'}
 $used=Invoke-Element $element
 if(-not $used){
  $r=$element.Current.BoundingRectangle
  if($r.IsEmpty){Fail 'Target exposes no clickable rectangle and no action pattern'}
  $point=[System.Windows.Point]::new([int]($r.Left+$r.Width/2),[int]($r.Top+$r.Height/2))
  [void][WWDesktopProbe]::SetCursorPos([int]$point.X,[int]$point.Y)
  [WWDesktopProbe]::mouse_event(1,0,0,0,[UIntPtr]::Zero)
  [WWDesktopProbe]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [WWDesktopProbe]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  $used='click'
 }
 "[$used] '$($element.Current.Name)' id='$($element.Current.AutomationId)'"
}
if($Action -eq 'expand'){
 $element=Find-One $Id $Name $Control
 $pattern=$null
 if(-not $element.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern,[ref]$pattern)){Fail "No ExpandCollapsePattern on '$Name'"}
 ([System.Windows.Automation.ExpandCollapsePattern]$pattern).Expand()
 Start-Sleep -Milliseconds 600
 "expanded '$($element.Current.Name)'"
}
if($Action -eq 'invoke-name'){
 $element=Find-One $Id $Name $Control
 $used=Invoke-Element $element
 if(-not $used){Fail "No Invoke/Toggle/SelectionItem pattern on '$Name'"}
 "[$used] '$($element.Current.Name)'"
}
if($Action -eq 'value'){
 $element=Find-One $Id $Name $Control
 ([System.Windows.Automation.ValuePattern]$element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).SetValue($Value)
 "value set on '$($element.Current.AutomationId)'"
}
if($Action -eq 'keys'){
 if(-not (Focus-Target $handle)){Fail 'Wrong foreground window; keyboard input refused'}
 [System.Windows.Forms.SendKeys]::SendWait($Keys)
 "keys sent: $Keys"
}
if($Action -eq 'focused'){
 $f=[System.Windows.Automation.AutomationElement]::FocusedElement
 if($null -eq $f){'focused: <none>'} else {"focused: $($f.Current.ControlType.ProgrammaticName) name='$($f.Current.Name)' id='$($f.Current.AutomationId)'"}
}
if($Action -eq 'tab-to'){
 if(-not (Focus-Target $handle)){Fail 'Foreground acquisition failed; keyboard input refused'}
 $deadline=(Get-Date).AddMilliseconds($TimeoutMs); $step=0
 while((Get-Date) -lt $deadline){
  $f=[System.Windows.Automation.AutomationElement]::FocusedElement
  if($null -ne $f -and $f.Current.Name -eq $Name){ [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); "tab-to: reached '$Name' after $step TABs"; exit 0 }
  [System.Windows.Forms.SendKeys]::SendWait('{TAB}'); $step++; Start-Sleep -Milliseconds 120
 }
 Fail "tab-to: '$Name' not reached after $step TABs"
}
if($Action -eq 'panel'){
 $all=Elements
 $ids=@{}
 foreach($el in $all){ $c=$el.Current; if($c.AutomationId -and -not $ids.ContainsKey($c.AutomationId)){ $ids[$c.AutomationId]=$c.Name } }
 $valueOf = { param($key) if($ids.ContainsKey($key)){ $ids[$key] } else { $null } }
 $texts=@($all | ForEach-Object { $_.Current.Name } | Where-Object { $_ })
 $summary=[ordered]@{}
 $summary.at=(Get-Date -Format o)
 $summary.panelPresent=$ids.ContainsKey('ww-app')
 $summary.errorElement=$ids.ContainsKey('ww-error')
 $summary.errorText=(& $valueOf 'ww-error')
 $summary.notice=(& $valueOf 'ww-notice')
 $summary.productTitle=(& $valueOf 'ww-product-title')
 $summary.status=(& $valueOf 'ww-status-label')
 $summary.revision=(& $valueOf 'ww-revision')
 $summary.version=(& $valueOf 'ww-version')
 $summary.startCommand=(& $valueOf 'ww-start-command')
 $summary.suggestion=(& $valueOf 'ww-suggestion')
 $summary.buildStatus=(& $valueOf 'ww-build-status')
 $summary.taskCount=@($all | Where-Object { $_.Current.AutomationId -like 'ww-task-*' }).Count
 $summary.taskGroups=@($texts | Where-Object { $_ -match '^(待执行|执行中|已完成|失败|阻塞|状态待确认) \(\d+\)$' })
 $summary.runCount=@($all | Where-Object { $_.Current.AutomationId -like 'ww-run-*' }).Count
 $summary.evidenceCount=@($all | Where-Object { $_.Current.AutomationId -like 'ww-evidence-*' }).Count
 $summary.versionCount=@($all | Where-Object { $_.Current.AutomationId -like 'ww-version-*' }).Count
 $summary.productButtons=@($all | Where-Object { $_.Current.AutomationId -like 'ww-product-*' } | ForEach-Object { $_.Current.Name })
 $summary.legacyButtons=@($all | Where-Object { $_.Current.AutomationId -like 'ww-legacy-product-*' } | ForEach-Object { $_.Current.Name })
 $summary.failureTexts=@($texts | Where-Object { $_ -match '操作失败|开发未交付|状态待确认' } | Select-Object -First 5)
 $summary.focusList=@($all | Where-Object { $_.Current.AutomationId -like 'ww-wish*' -or $_.Current.AutomationId -eq 'ww-submit' } | ForEach-Object { $_.Current.AutomationId })
 $overview=@($all | Where-Object { $_.Current.AutomationId -eq 'ww-overview' })
 if($overview.Count -eq 1){
  $children=@($overview[0].FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name } | Where-Object { $_ })
  $summary.overview=$children
 } else { $summary.overview=@() }
 $summary | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $OutDir ($Label+'.json'))
 $summary | ConvertTo-Json -Depth 5 -Compress
 exit 0
}
if($Action -eq 'inspect' -or $Action -eq 'dump-ids'){
 $all=Elements
 $filtered=if($Action -eq 'dump-ids'){ @($all | Where-Object { $_.Current.AutomationId }) } else { $all }
 $rows=foreach($el in $filtered){ $c=$el.Current
  $row=[ordered]@{type=$c.ControlType.ProgrammaticName;name=$c.Name;id=$c.AutomationId;enabled=$c.IsEnabled;offscreen=$c.IsOffscreen;bounds=$c.BoundingRectangle.ToString()}
  $p=$null; if($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$p)){$row.value=([System.Windows.Automation.ValuePattern]$p).Current.Value}
  [pscustomobject]$row }
 $record.elementCount=$rows.Count; $record.elements=@($rows)
 $record | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $OutDir ($Label+'.json'))
 "Saved $($rows.Count) elements to $Label.json"
}
if($Action -eq 'capture'){
 $rect=$root.Current.BoundingRectangle
 if($rect.IsEmpty){Fail 'Target is minimized or not visible'}
 $bmp=New-Object System.Drawing.Bitmap ([int]$rect.Width),([int]$rect.Height)
 $g=[System.Drawing.Graphics]::FromImage($bmp)
 try{ $dc=$g.GetHdc(); try{$ok=[WWDesktopProbe]::PrintWindow($handle,$dc,2)}finally{$g.ReleaseHdc($dc)}
  if(-not $ok){Fail 'PrintWindow failed'}; $bmp.Save((Join-Path $OutDir ($Label+'.png')),[System.Drawing.Imaging.ImageFormat]::Png) } finally {$g.Dispose();$bmp.Dispose()}
 "Saved desktop screenshot $Label.png"
}
$record.Remove('elements'); $record.Remove('elementCount')
$record | ConvertTo-Json -Compress | Add-Content -Encoding UTF8 (Join-Path $OutDir 'desktop-actions.jsonl')
