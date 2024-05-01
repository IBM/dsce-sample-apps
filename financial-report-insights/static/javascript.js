let chat_ctx = [];

// Add click event for source modal
function fnViewSource() {
  document.getElementById("source-modal").open = true;
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function makeQuestionCallHandler(e, query) {
  const { element } = e.data;

  fetch("./question", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question: query, chat_history: chat_ctx }),
  }).then(
    async (res) => {
      let respJson = await res.json();
      if (respJson && respJson.answer && respJson.chat_history) {
        let { answer, chat_history, source_document } = respJson;
        chat_ctx = chat_history;
        let data = answer.replace("\nAnswer:", "").replaceAll("\n", "<br/>");
        messageChatbot(data, true);

        document.getElementById("source-p").innerHTML =
          source_document !== ""
            ? source_document
            : "<i>Source document will be displayed here after you ask a question to chatbot.</i>";

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

var g_wa_instance;

function setUpChatbot() {
  window.watsonAssistantChatOptions = {
    integrationID: document.getElementById("wa_integration_id").value,
    region: document.getElementById("wa_region").value,
    serviceInstanceID: document.getElementById("wa_service_instance_id").value,
    showRestartButton: true,
    onLoad: function (instance) {
      g_wa_instance = instance;

      instance.on({
        type: "customResponse",
        handler: (event, instance) => {
          if (
            event.data.message.user_defined &&
            event.data.message.user_defined.user_defined_type ===
              "call-question"
          ) {
            makeQuestionCallHandler(
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

  const t = document.createElement("script");
  t.src =
    "https://web-chat.global.assistant.watson.appdomain.cloud/versions/" +
    (window.watsonAssistantChatOptions.clientVersion || "latest") +
    "/WatsonAssistantChatEntry.js";
  document.head.appendChild(t);
}

function messageChatbot(txt, silent = false) {
  // https://web-chat.global.assistant.watson.cloud.ibm.com/docs.html?to=api-instance-methods#send
  const maxChars = 2040;
  txt = txt.substring(0, maxChars);
  var send_obj = { input: { message_type: "text", text: txt } };

  g_wa_instance.send(send_obj, { silent }).catch(function (error) {
    console.error("Sending message to chatbot failed");
  });
}
