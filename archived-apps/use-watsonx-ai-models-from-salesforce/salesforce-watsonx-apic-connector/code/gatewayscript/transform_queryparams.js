const qs = require("querystring");

var parsedqs = qs.parse(context.request.querystring);

console.error(
  "==================================================================\nEndpoint: ",
  context.get("request.uri")
);

var region = context.get("api.properties.wx-endpoint-us-south");
if (parsedqs["region"] === "eu-gb")
  region = context.get("api.properties.wx-endpoint-eu-gb");
else if (parsedqs["region"] === "eu-de")
  region = context.get("api.properties.wx-endpoint-eu-de");
else if (parsedqs["region"] === "jp-tok")
  region = context.get("api.properties.wx-endpoint-jp-tok");
else if (parsedqs["region"] === "au-syd")
  region = context.get("api.properties.wx-endpoint-au-syd");
else if (parsedqs["region"] === "ca-tor")
  region = context.get("api.properties.wx-endpoint-ca-tor");
else if (parsedqs["region"] !== undefined)
  region = "https://" + parsedqs["region"] + ".ml.cloud.ibm.com/ml/v1";

var default_projectid = context.get("api.properties.default-project-id");
context.set("wx.projectid", parsedqs["projectid"] || default_projectid);
context.set("wx.endpoint", region);
context.set(
  "wx.apikey",
  context.request.headers["X-IBM-API-KEY"] ||
    context.request.headers["x-ibm-api-key"]
);
