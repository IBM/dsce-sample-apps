# Site Security Maintenance - Dependabot
A new folder has been added [./demos/dependabot-security](./demos/dependabot-security) with scripts that can be provided to IBM Bob to auto-fix the majority of the package dependency-related security errors.  

1. Open a new task with Bob and the DSCE repo open.
2. Paste url for dependabot security report.  E.g. like [IBM OSPO #231](https://github.com/IBM/dsce-sample-apps/issues/231)
3. Tell Bob to read and execute the plan in [demos/dependabot-security/README.md](demos/dependabot-security/README.md)
4. Check-in Bob's changes
5. Go to the Security and Quality tab in the DSCE repo. Click on `Dependabot > Vulnerabilities` then `Refresh Dependabot Alerts].
   
<img width="1198" height="350" alt="image" src="https://github.com/user-attachments/assets/30a99c17-4a8b-4a94-931f-6d313823ec6e" />


