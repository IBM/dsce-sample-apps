const util = require("util");

context.request.body.readAsJSON(function (error, json) {
  if (error) {
    console.error("Completions readAsJSON request error: " + error);
  } else {
    console.error("Completions readAsJSON request json: ", json);

    const { prompt, model, max_tokens, n, temperature, parameters } = json;
    var rprompt = "";
    if (util.isString(prompt)) {
      rprompt = prompt;
    } else if (util.isArray(prompt) && prompt.every(util.isString)) {
      rprompt = prompt.join("\n");
    }

    // Initialize the new request body format
    var transformedRequestBody = {
      project_id: context.get("wx.projectid"),
      model_id: model,
      input: rprompt,
      parameters: {
        decoding_method: "greedy",
        stop_sequences: [],
        repetition_penalty: 1,
        min_new_tokens: 1,
        max_new_tokens: max_tokens || 500,
        ...(temperature ? { temperature } : {}),
        ...parameters,
      },
    };

    context.message.body.write(transformedRequestBody);
  }
});
