window.watsonAssistantChatOptions = {
  integrationID: "", // The ID of this integration.
  region: "", // The region your integration is hosted in.
  serviceInstanceID: "", // The ID of your service instance.
  showRestartButton: true,
  onLoad: function (instance) {
    instance.render();
    function receive(event) {
      var summary =
        event.data.context.skills["main skill"].user_defined.summary;
      var sentiment =
        event.data.context.skills["main skill"].user_defined.sentiment;
      var entities =
        event.data.context.skills["main skill"].user_defined.chat_entities;
      splittedEntities = entities.split(",");
      let entities_val = Object.values(splittedEntities);
      if (entities_val.length > 0) {
        for (let j = 0; j < entities_val.length; j++) {
          if (entities_val[j].includes(":")) {
            entity_key = entities_val[j].split(":");
            entity_key[0] = "<b>" + entity_key[0] + ":</b>";
            entities_val[j] = entity_key.join("");
          }
        }
      }
      if (summary != "") {
        document.getElementById("background").style.display = "none";
        document.getElementById("wa-output-summ-title").innerHTML =
          "<b>Summary</b>";
        document.getElementById("wa-output-summ").innerHTML = summary;
      }

      if (
        sentiment != "" &&
        sentiment != "undefined" &&
        sentiment != undefined
      ) {
        document.getElementById("wa-output-sentiment-title").innerHTML =
          "<b>Sentiment</b>";
        document.getElementById("wa-output-sentiment").innerHTML = sentiment;
      }

      if (entities_val != "<b>:</b>") {
        document.getElementById("wa-output-entities-title").innerHTML =
          "<b>Key entities</b>";
        document.getElementById("wa-output-entities").innerHTML =
          entities_val.join("<br/>");
      }
    }

    instance.on({ type: "receive", handler: receive });

    function restart(event) {
      document.getElementById("background").style.display = "block";
      document.getElementById("wa-output-summ-title").innerHTML = "";
      document.getElementById("wa-output-summ").innerHTML = "";
      document.getElementById("wa-output-sentiment-title").innerHTML = "";
      document.getElementById("wa-output-sentiment").innerHTML = "";
      document.getElementById("wa-output-entities-title").innerHTML = "";
      document.getElementById("wa-output-entities").innerHTML = "";
      document.getElementById("wa-output-entities-title").innerHTML = "";
      document.getElementById("wa-output-entities").innerHTML = "";
    }
    instance.on({ type: "restartConversation", handler: restart });
    instance.updateCSSVariables({
      "BASE-max-height": "85%",
      "BASE-width": "33%",
    });
  },
};
setTimeout(function () {
  const t = document.createElement("script");
  t.src =
    "https://web-chat.global.assistant.watson.appdomain.cloud/versions/" +
    (window.watsonAssistantChatOptions.clientVersion || "latest") +
    "/WatsonAssistantChatEntry.js";
  document.head.appendChild(t);
});
