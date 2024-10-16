const util = require("util");

function format_messages(messages) {
  var formatted_input = "";
  for (let message of messages) {
    var role = message.role;
    var content = message.content;

    if (role === "system") {
      formatted_input += content + "\n";
    } else if (role === "user" && util.isString(content)) {
      formatted_input += "user: " + content + "\n";
    } else if (role === "user" && util.isArray(content)) {
      for (let cont of content) {
        let cont_type = cont.type;
        if (cont_type === "text") {
          formatted_input += "user:" + cont.text + "\n";
        }
      }
    } else if (role === "assistant") {
      formatted_input += "assistant: " + content + "\n";
    }
  }

  return formatted_input.trim();
}

context.request.body.readAsJSON(function (error, json) {
  if (error) {
    console.error("Chat Completions readAsJSON request error: " + error);
  } else {
    console.error("Chat Completions readAsJSON request json: ", json);

    const { messages, model, max_tokens, n, temperature, parameters } = json;
    // Initialize the new request body format
    var transformedRequestBody = {
      project_id: context.get("wx.projectid"),
      model_id: model,
      input: format_messages(messages),
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
