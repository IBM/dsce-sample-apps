# SRE Copilot — ADK Project

This directory contains the watsonx Orchestrate agent definition and tools.
Deploy this ONCE before running the demo stack.

## Prerequisites
- ibm-watsonx-orchestrate ADK installed: `pip install ibm-watsonx-orchestrate`
- WXO environment configured: `orchestrate env add ...`

## Deploy
```bash
chmod +x deploy.sh teardown.sh
./deploy.sh
```

## Teardown
```bash
./teardown.sh
```
