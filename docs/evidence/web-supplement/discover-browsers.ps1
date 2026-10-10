$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$found=@(foreach($w in $windows){
 $c=$w.Current
 if($c.ControlType -ne [System.Windows.Automation.ControlType]::Window -or $c.Name -notmatch 'DeepSeek Harness' -or $c.BoundingRectangle.IsEmpty){continue}
 $proc=Get-Process -Id $c.ProcessId
 if($proc.ProcessName -ne 'chrome'){continue}
 $all=$w.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 $addressName=[string][char]0x5730+[char]0x5740+[char]0x548c+[char]0x641c+[char]0x7d22+[char]0x680f
 $address=@($all | Where-Object {$_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit -and $_.Current.Name -in @($addressName,'Address and search bar')})
 if($address.Count -ne 1){continue}
 $raw=([System.Windows.Automation.ValuePattern]$address[0].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).Current.Value
 if($raw -notmatch '^https?://'){$raw='http://'+$raw}
 $origin=([uri]$raw).GetLeftPart([System.UriPartial]::Authority);$raw=$null
 if($origin -eq 'http://127.0.0.1:3081'){[pscustomobject]@{handle=$c.NativeWindowHandle;pid=$c.ProcessId;origin=$origin;bounds=$c.BoundingRectangle.ToString()}}
})
if($found.Count -lt 1 -or $found.Count -gt 2){throw "Expected one or two isolated DSH windows; found $($found.Count)"}
$path=Join-Path $PSScriptRoot 'browser-targets.json'
if(Test-Path $path){$old=Get-Content -Raw $path | ConvertFrom-Json;$first=@($found | Where-Object {$_.handle -eq $old.BrowserA.handle});if($first.Count -ne 1){throw 'Previously verified browser A is unavailable'};$second=@($found | Where-Object {$_.handle -ne $old.BrowserA.handle})}else{$first=@($found[0]);$second=@($found | Select-Object -Skip 1)}
$mapping=[ordered]@{at=(Get-Date -Format o);BrowserA=$first[0]}
if($second.Count -eq 1){$mapping.BrowserB=$second[0]}
$mapping | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $path
$mapping | ConvertTo-Json -Depth 4
