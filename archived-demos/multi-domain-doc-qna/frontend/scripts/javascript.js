function operateModal(id, open) {
  document.getElementById(id).open = !!open;
  document.getElementById(id).style.visibility = !!open ? "visible" : "hidden";
}

const sampleQuestions = {
  "verizon-and-panw-security-and-private-5g-network-white-paper.pdf": [
    "What is SEPP?",
    "How does network exposure function compare between 5G and 4G LTE?",
    "Why is device security very important for network security?",
  ],
  "CSCO_2020_10K.pdf": [
    "What are the main competitive factors for Cisco in the market?",
    "How much has Cisco spent on R&D until July 2020? Only state facts in the document.",
    "Who is the COO of Cisco?",
    "How many employees does Cisco have in the USA?",
    "What were the total assets declared by Cisco in 2020?",
  ],
  "ibm-consulting-and-palo-alto-networks-security-for-devsecops.pdf": [
    "What are the differences between cloud and traditional systems for workload provisioning?",
    "What are the differences between cloud and traditional systems for workload provisioning? Mention the page number and document name of the source.",
  ],
  "owners-manual-w11580822-revC.pdf": [
    "What are the steps for condenser cleaning?",
    "What is the sensitivity to ethylene for lettuce?",
    "How many styles does the door handle of the fridge have?",
    "What should be the ideal water pressure in the fridge? Also, mention the document name and page number of the source.",
    "What is the maximum permissible concentration of chlorobenzene?",
  ],
};

// Send suggestion questions to webchat interface
function suggestNextQuestion(event) {
  const {
    element,
    fullMessage: { context },
  } = event.data;
  const { question, reference_file_name } =
    context.skills["actions skill"].skill_variables;

  let suggestions = sampleQuestions[reference_file_name]
    .filter((q) => q !== question)
    .join("<li>");

  element.innerHTML = [
    "<div class='ibm-web-chat--default-styles'><ul><li>",
    suggestions,
    "</ul></div>",
  ].join("");
}

window.watsonAssistantChatOptions = {
  integrationID: "<your-watsonx-Assistant-integration-id>",
  region: "us-south",
  serviceInstanceID: "<your-watsonx-Assistant-service-instance-id>",
  showRestartButton: true,
  onLoad: function (instance) {
    instance.on({
      type: "customResponse",
      handler: (event, instance) => {
        if (
          event.data.message.user_defined &&
          event.data.message.user_defined.user_defined_type ===
            "suggest-next-question"
        ) {
          suggestNextQuestion(event);
        }
      },
    });
    instance.render();
    function receive(event) {
      try {
        let references =
          event.data.context.skills["actions skill"].skill_variables
            .extsn_references;
        let allReferences = "";
        references.map((reference) => {
          let fileName = reference.node.metadata.file_name;
          allReferences = allReferences.concat(
            `<b><u>Resource document: ${fileName}</u></b><br/><pre style="text-wrap: wrap">${reference.node.text}</pre><br/><br/>`
          );
        });
        document.getElementById("resources").innerHTML = allReferences;
      } catch {}
    }

    function restart(event) {
      document.getElementById("resources").innerText =
        "Answer source will be displayed here";
    }
    // https://web-chat.global.assistant.watson.cloud.ibm.com/docs.html?to=api-instance-methods#send
    function messageChatbot(txt, silent = false) {
      let send_obj = { input: { message_type: "text", text: txt } };

      instance.send(send_obj, { silent }).catch(function (error) {
        console.error("Sending message to chatbot failed");
      });
    }
    instance.on({ type: "receive", handler: receive });
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
