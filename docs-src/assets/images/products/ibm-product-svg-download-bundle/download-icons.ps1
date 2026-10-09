$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Invoke-WebRequest 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/SecurityVerify.svg' -OutFile 'ibm-security-verify.svg'
Invoke-WebRequest 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/GuardiumDataSecurityPostureManagement.svg' -OutFile 'ibm-guardium-discover-and-classify.svg'
Invoke-WebRequest 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/GuardiumDataCompliance.svg' -OutFile 'ibm-guardium-data-protection.svg'
Invoke-WebRequest 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/IBMQRadarSIEM.svg' -OutFile 'ibm-qradar-siem.svg'
Invoke-WebRequest 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/CloudOpenPagesWithWatson.svg' -OutFile 'ibm-openpages.svg'
Get-ChildItem ibm-*.svg
