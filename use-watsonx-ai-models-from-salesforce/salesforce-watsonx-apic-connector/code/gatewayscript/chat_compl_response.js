context.message.body.readAsJSON(function (error, json) {
  if (error) {
    console.error("Chat Completions readAsJSON response error: " + error);
  } else {
    console.error("Chat Completions readAsJSON response json: ", json);

    var ts = Math.floor(new Date(json.created_at).getTime() / 1000);
    var results = json["results"][0];
    // Initialize the new response body format
    var transformedResponseBody = {
      id: "chatcmpl-default-" + ts,
      object: "chat.completion",
      created: ts,
      model: json.model_id,
      choices: [
        {
          finish_reason: "stop",
          index: 0,
          message: {
            role: "assistant",
            content: results.generated_text,
          },
        },
      ],
      usage: {
        completion_tokens: results.generated_token_count,
        prompt_tokens: results.input_token_count,
        total_tokens: results.generated_token_count + results.input_token_count,
      },
    };

    session.output.write(transformedResponseBody);
  }
});
// session.output.write(context.message.body)
