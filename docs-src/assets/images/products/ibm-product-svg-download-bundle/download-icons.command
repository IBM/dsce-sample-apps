#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

curl -L 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/SecurityVerify.svg' -o ibm-security-verify.svg
curl -L 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/GuardiumDataSecurityPostureManagement.svg' -o ibm-guardium-discover-and-classify.svg
curl -L 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/GuardiumDataCompliance.svg' -o ibm-guardium-data-protection.svg
curl -L 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/IBMQRadarSIEM.svg' -o ibm-qradar-siem.svg
curl -L 'https://raw.githubusercontent.com/carbon-design-system/design-language-website/master/src/images/app-icons/light-theme/CloudOpenPagesWithWatson.svg' -o ibm-openpages.svg

echo
printf 'Downloaded:\n'
ls -1 ibm-*.svg
