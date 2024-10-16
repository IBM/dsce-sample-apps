context.message.body.readAsJSON(function (error, json) {
  if (error) {
    console.error("Embeddings readAsJSON response error: " + error);
  } else {
    console.error("Embeddings readAsJSON response json: ", json);

    var data = json.results.map(({ embedding }, i) => ({
      index: i,
      object: "embedding",
      embedding,
    }));

    // Initialize the new response body format
    var transformedResponseBody = {
      object: "list",
      model: json.model_id,
      data,
      usage: {
        prompt_tokens: json.input_token_count,
        total_tokens: json.input_token_count,
      },
    };

    session.output.write(transformedResponseBody);
  }
});

// session.output.write(context.message.body)
