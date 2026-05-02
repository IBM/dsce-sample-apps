# Current Deployment Summary

**Last Updated:** December 18, 2025

## Production Environment

### Application Details
- **Name:** guardrails-api
- **Platform:** IBM Code Engine
- **Project:** ai-guardrails
- **Project ID:** ac18175c-f279-415a-88be-77183393c0b8
- **Region:** us-south
- **Resource Group:** default

### Application URL
**Production API:** https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud

### API Endpoints
- **Health Check:** https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/health
- **List Metrics:** https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/metrics
- **Evaluate:** https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/evaluate (POST)
- **Batch Evaluate:** https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/evaluate/batch (POST)

### Container Image
- **Registry:** us.icr.io
- **Namespace:** ai-guardrails-demo
- **Image:** us.icr.io/ai-guardrails-demo/ai-guardrails-app:latest
- **Digest:** sha256:c39250697e3674b3c4f1c314aac4ac4b8e8297eacd6448e699a08a38759ced15
- **Size:** ~856MB

### Resource Configuration
- **CPU:** 1 vCPU per instance
- **Memory:** 2GB per instance
- **Port:** 8080
- **Min Scale:** 1 instance (always running)
- **Max Scale:** 5 instances (auto-scale)
- **Concurrency:** 100 requests per instance
- **Timeout:** 300 seconds

### Environment Variables
```
WATSONX_APIKEY: Jp2M5hW2pOMNr0Wo5_gUIXg-gezGVHNjFFvETYJa0x17
WXG_SERVICE_INSTANCE_ID: b98f7b3a-27f4-4d77-b5a7-e41785182aeb
WATSONX_URL: https://us-south.ml.cloud.ibm.com
WXG_PROJECT_ID: 8ddd7a9e-f39d-4ad4-8e4a-1846673c7aa2
DEBUG_MODE: False
```

### Registry Access
- **Secret Name:** icr-access
- **Registry Server:** us.icr.io
- **Authentication:** IBM Cloud IAM API Key

## Available Metrics (19 Total)

### Safety Metrics (10)
1. HAP (Hate, Abuse, Profanity)
2. PII Detection
3. Harm Detection
4. Social Bias
5. Jailbreak Detection
6. Violence Detection
7. Profanity Detection
8. Unethical Behavior
9. Sexual Content
10. Evasiveness

### RAG Metrics (3)
1. Answer Relevance
2. Context Relevance
3. Faithfulness

### Quality Metrics (6)
1. Unsuccessful Requests
2. Answer Completeness (LLM Judge - Llama 3.3 70B)
3. Conciseness (LLM Judge - Llama 3.3 70B)
4. Helpfulness (LLM Judge - Llama 3.3 70B)
5. Narrative Quality (LLM Judge - Llama 3.3 70B)
6. Action Oriented Validator

## Deployment History

### December 18, 2025 - Initial Production Deployment
- Built and pushed Docker image to IBM Container Registry
- Created Code Engine project "ai-guardrails"
- Created registry access secret for image pulling
- Deployed application with updated credentials
- Verified all metrics are functional

## Quick Commands

### View Application Status
```bash
ibmcloud ce app get --name guardrails-api
```

### View Application Logs
```bash
ibmcloud ce app logs --name guardrails-api --tail 100
```

### Update Application
```bash
# After rebuilding and pushing new image
ibmcloud ce app update --name guardrails-api \
  --image us.icr.io/ai-guardrails-demo/ai-guardrails-app:latest
```

### Scale Application
```bash
# Update scaling configuration
ibmcloud ce app update --name guardrails-api \
  --min-scale 2 \
  --max-scale 10
```

### Update Environment Variables
```bash
ibmcloud ce app update --name guardrails-api \
  --env WATSONX_APIKEY="new_api_key"
```

### Test Deployment
```bash
# Health check
curl https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/health

# List metrics
curl https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/metrics | jq

# Test evaluation
curl -X POST https://guardrails-api.242j7r134zgj.us-south.codeengine.appdomain.cloud/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"generated_text":"Test text","metrics":["PII Detection"]}' | jq
```

## Monitoring

### Check Running Instances
```bash
ibmcloud ce app get --name guardrails-api
```

Look for the "Instances" section to see running pods and their status.

### View Events
```bash
ibmcloud ce app events --name guardrails-api
```

### Follow Logs in Real-time
```bash
ibmcloud ce app logs --name guardrails-api --follow
```

## Cost Information

### Current Configuration Costs
- **1 instance running 24/7:** ~$30-40/month
- **Auto-scaling to 5 instances:** Variable based on traffic

### Cost Optimization Options
```bash
# Scale to zero when idle (cold start on first request)
ibmcloud ce app update --name guardrails-api --min-scale 0

# Reduce max instances for dev/test
ibmcloud ce app update --name guardrails-api --max-scale 2
```

## Troubleshooting

### Application Not Responding
1. Check application status: `ibmcloud ce app get --name guardrails-api`
2. Check logs: `ibmcloud ce app logs --name guardrails-api --tail 100`
3. Verify instances are running in the status output

### Image Pull Errors
1. Verify registry secret exists: `ibmcloud ce registry list`
2. Check image exists: `ibmcloud cr images --restrict ai-guardrails-demo`
3. Recreate registry secret if needed

### Performance Issues
1. Check current instance count and CPU/memory usage
2. Scale up min instances: `ibmcloud ce app update --name guardrails-api --min-scale 3`
3. Increase resources: `ibmcloud ce app update --name guardrails-api --cpu 2 --memory 4G`

## Related Documentation
- [README.md](README.md) - Complete project documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment guide
- [API_TESTING.md](API_TESTING.md) - API testing examples
- [.env.template](.env.template) - Environment variable template

## Support Contacts
- **Application Issues:** Repository maintainers
- **IBM Code Engine:** IBM Cloud Support
- **watsonx.governance:** IBM watsonx Support
