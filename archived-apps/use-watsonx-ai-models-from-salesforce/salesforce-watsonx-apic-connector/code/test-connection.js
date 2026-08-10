// Disable certificate verification
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const options = {
  method: "POST",
  headers: {
    "X-IBM-API-KEY": "<your-wx-api-key>",
    "Content-Type": "application/json",
  },
  body: '{"model":"ibm/granite-13b-instruct-v2","messages":[{"role":"user","content":"How many faces cube has?"}],"max_tokens":800}',
};

fetch(
  "https://apic-gw-gateway-integration.apps.66ba4b07545446001ef6af7d.ocp.techzone.ibm.com/apic-org/sandbox/chat/completions?projectid=<your-wx-project-id>&region=<your-wx-region-code>",
  options
)
  .then((response) => response.json())
  .then((response) => console.log("Response from APIC -----> %j", response))
  .catch((err) => console.error(err));
