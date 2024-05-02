async function makeLLMCallHandler(e, query) {
  const { element } = e.data;

  fetch("./gensql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question: query }),
  }).then(
    async (res) => {
      let llm = await res.json();
      if (llm && llm.type && llm.data && llm.data.length > 0) {
        let { type, data } = llm;
        element.innerHTML =
          type !== "text"
            ? data
            : data.replace("\nAnswer:", "").replaceAll("\n", "<br/>");
        messageChatbot("display custom element", true);
        return;
      }
      messageChatbot("Some error occured. Please retry later.", true);
    },
    (err) => {
      console.log("Danger zone: ", err);
      messageChatbot(
        "Unable to get answer based on your query, please retry with another query.",
        true
      );
    }
  );
}

/*
 *
 * Watson Assistant
 *
 */
var waInterval = setInterval(initWA, 2000);

var g_wa_instance;

function initWA() {
  window.watsonAssistantChatOptions = {
    integrationID: document.getElementById("wa-integration-id").value,
    region: document.getElementById("wa-region").value,
    serviceInstanceID: document.getElementById("wa-service-instance-id").value,
    showRestartButton: true,
    onLoad: function (instance) {
      g_wa_instance = instance;

      instance.on({
        type: "customResponse",
        handler: (event, instance) => {
          if (
            event.data.message.user_defined &&
            event.data.message.user_defined.user_defined_type === "call-sql"
          ) {
            makeLLMCallHandler(
              event,
              event.data.message.user_defined.user_query
            );
          }
        },
      });
      instance.updateCSSVariables({
        "BASE-max-height": "85%",
        "BASE-width": "33%",
      });
      instance.render();
    },
  };

  clearInterval(waInterval);
  setTimeout(function () {
    const t = document.createElement("script");
    t.src =
      "https://web-chat.global.assistant.watson.appdomain.cloud/versions/" +
      (window.watsonAssistantChatOptions.clientVersion || "latest") +
      "/WatsonAssistantChatEntry.js";
    document.head.appendChild(t);
  });
}

function messageChatbot(txt, silent = false) {
  var send_obj = { input: { message_type: "text", text: txt } };

  g_wa_instance.send(send_obj, { silent }).catch(function (error) {
    console.error("Sending message to chatbot failed");
  });
}
