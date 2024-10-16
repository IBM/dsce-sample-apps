const util = require("util");

let body = {
  "model": "ibm/granite-13b-instruct-v2",
  "messages": [
      {
          "role": "system",
          "content": "You are a helpful assistant"
      },
      {
          "role": "user",
          "content": "How many faces cube has?"
      },
      {
          "role": "assistant",
          "content": "6"
      },
      {
          "role": "user",
          "content": "Who is CEO of Meta?"
      }
  ],
  "max_tokens": 500,
  "n": 1,
  "temperature": 2,
  "parameters": {
      "top_p": 0.5,
      "min_new_tokens":300
  }
};

let context = {
  get: function (a) {
    return a;
  },
  message: {
    body: {
      write: function (a) {
        return a;
      },
    },
  },
  request: {
    body,
  },
};

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

function test(json) {
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
      max_new_tokens: max_tokens || 100,
      ...(temperature ? { temperature } : {}),
      ...parameters,
    },
  };

  context.message.body.write(transformedRequestBody);

  console.log(transformedRequestBody);
}

test(context.request.body);
