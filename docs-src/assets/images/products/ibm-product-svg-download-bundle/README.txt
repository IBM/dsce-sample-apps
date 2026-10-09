IBM product SVG download bundle

This bundle downloads the official light-theme SVG assets from IBM's public Carbon / IBM Design Language repository and renames them to the requested filenames.

Requested filenames:
- ibm-security-verify.svg
- ibm-guardium-discover-and-classify.svg
- ibm-guardium-data-protection.svg
- ibm-qradar-siem.svg
- ibm-openpages.svg

macOS:
Double-click download-icons.command. If macOS blocks it, right-click > Open, or run ./download-icons.sh in Terminal.

Linux:
Run: ./download-icons.sh

Windows PowerShell:
Run: .\\download-icons.ps1

Important note:
IBM's current app-icon library does not appear to contain a distinct icon named Guardium Discover and Classify. The downloader uses IBM Guardium Data Security Posture Management for ibm-guardium-discover-and-classify.svg because IBM's app-icon metadata associates that icon with discover/classify terminology. The other four mappings are exact product matches based on IBM's current metadata.
