const util = require("util");

context.request.body.readAsJSON(function (error, json) {
  if (error) {
    console.error("Embeddings readAsJSON request error: " + error);
  } else {
    console.error("Embeddings readAsJSON request json: ", json);

    var wx_inputs = [];
    if (util.isString(json.input)) {
      wx_inputs.push(json.input);
    } else if (util.isArray(json.input) && json.input.every(util.isString)) {
      wx_inputs = json.input;
    }

    // Initialize the new request body format
    var transformedRequestBody = {
      project_id: context.get("wx.projectid"),
      model_id: json.model,
      inputs: wx_inputs,
    };

    context.message.body.write(transformedRequestBody);
  }
});
