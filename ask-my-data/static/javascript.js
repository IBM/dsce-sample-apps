let chat_ctx = [],
  uploaded_file_type = new Set();

function loadHomePage() {
  const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
  });

  document.addEventListener("cds-dropdown-selected", (e) => {
    if (e.target.id === "ai-task") aiTaskSelected();
  });
}

function getModelsList() {
  fetch("./models-list", {
    headers: {
      APIAUTHCODE: document.getElementById("api_a_code").value,
    },
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error("response was not ok");
    }
    const models = await res.json();

    const items = models.map(
      (m) =>
        `<cds-dropdown-item value="${m.id}">
      ${m.label}
      </cds-dropdown-item>`
    );

    const modelSelector = `<cds-dropdown
      value="meta-llama/llama-2-13b-chat"
      id="models"
      title-text="Model"
      style="width: 50%; padding-top: 1rem"
    >
    ${items.join("")}
    </cds-dropdown>`;
    document.getElementById("model-selection").innerHTML = modelSelector;
  });
}

function getPrompt(userId, aiTask) {
  document.getElementById("prompt-status").innerText = "";
  if (!userId) {
    document.getElementById("prmpt-txt-area").value =
      "verify yourself via watsonx assistant";
    return;
  }
  fetch(`./get-prompt/${userId}/${aiTask}`).then(async (res) => {
    let { data, type } = await res.json();
    if (aiTask === "sql_gen" && data === "No data available") {
      data = {
        prompt: "Upload a csv to generate the sql prompt",
        model_id: "bigcode/starcoder",
        max_new_tokens: "100",
        stop_sequences: ";",
      };
    }

    document.getElementById("prmpt-txt-area").value = data.prompt;
    document.getElementById("max-token").value = data.max_new_tokens;
    document.getElementById("stop-sequences").value = data.stop_sequences;
    document.getElementById("models").value = data.model_id;
    document.getElementById("ai-task").value = type;
  });
}

function showHidePromptInput() {
  if (document.getElementById("prompt").style.display === "flex") {
    document.getElementById("params-area-parent-div").style.display = "none";
    document.getElementById("prompt").style.display = "none";
    document.getElementById("submit-prompt").style.display = "none";
    document.getElementById("help-text-div").style.display = "flex";
  } else {
    document.getElementById("prompt").style.display = "flex";
    document.getElementById("params-area-parent-div").style.display = "grid";
    document.getElementById("submit-prompt").style.display = "block";
    document.getElementById("help-text-div").style.display = "none";
    const userId = localStorage.getItem("userId");
    getPrompt(userId, "none");
  }
}

function manageVisibilityForPromptGear(visibility) {
  document.getElementById("open-prompt-div").style.display = visibility
    ? ""
    : "none";
}

function displaySource(visibility, d) {
  document.getElementById("view-source-div").style.display = visibility
    ? ""
    : "none";
  if (d && d.length > 0)
    document.getElementById("source-content-pre").innerHTML = d;
}

function validateInput(prompt, aiTask) {
  let validation = false;
  let promptCopy = prompt.trim();
  if (aiTask !== "rag") {
    validation =
      promptCopy &&
      promptCopy.startsWith("Instruction:") &&
      (promptCopy.match(/Input:/g) || []).length ===
        (promptCopy.match(/Output:/g) || []).length;
  } else if (aiTask === "rag") {
    validation =
      promptCopy &&
      promptCopy.includes("{context}") &&
      promptCopy.includes("{question}");
  }
  return validation;
}

function submitPrompt() {
  const userId = localStorage.getItem("userId");
  const prompt = document.getElementById("prmpt-txt-area").value;
  const max_new_tokens = document.getElementById("max-token").value;
  const ai_task = document.getElementById("ai-task").value;
  let stop_sequences = document.getElementById("stop-sequences").value.trim();
  if (stop_sequences.length) stop_sequences = stop_sequences.split(",");
  else stop_sequences = [];
  const model_id = document.getElementById("models").value;

  if (!validateInput(prompt, ai_task)) {
    document.getElementById("prompt-status").innerText =
      "Invalid instruction & examples format. Please try again.";
    return;
  }

  document.getElementById("prompt-status").innerText = "submitting...";
  if (userId) {
    fetch(`./update-prompt/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        new_prompt: prompt,
        model_id,
        max_new_tokens,
        stop_sequences,
        ai_task,
      }),
    }).then(async (res) => {
      if (res.ok)
        document.getElementById("prompt-status").innerText = "Prompt updated";
      else
        document.getElementById("prompt-status").innerText =
          "something went wrong. Please try again";
    });
  }
}

function onHowBtnClick() {
  document.getElementById("how-it-work-modal").open = true;
}

function aiTaskSelected() {
  const userId = localStorage.getItem("userId");
  const aiTask = document.getElementById("ai-task").value;
  displaySource(aiTask === "rag" || aiTask === "sql_gen");
  getPrompt(userId, aiTask);
}

async function verifyEmailHandler(e, email) {
  const { element } = e.data;
  const queryParams = new URLSearchParams(window.location.search);
  const p = queryParams.get("p");
  const t = queryParams.get("t");
  const p1 = queryParams.get("p1");
  fetch("./verify_user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, p, t, p1 }),
  }).then(
    async (res) => {
      let respJson = await res.json();
      if (respJson && respJson.status) {
        let { status, doc_status, file_types } = respJson;
        if (status === "verified") {
          localStorage.setItem("userId", email.split("@")[0]);
        }
        if (file_types && file_types.length > 0) {
          let last_file_type;
          file_types.forEach((ft, i) => {
            uploaded_file_type.add(ft.toLowerCase());
            last_file_type = ft;
          });
          manageVisibilityForToggleButon(last_file_type);
        }
        manageVisibilityForPromptGear(status === "verified");
        if (status === "verified" && doc_status === "_available") {
          console.log(file_types);
          let fileUploaded = "";
          if (file_types.length === 2) {
            console.log("both files");
            fileUploaded = "'resume-sample.pdf' and 'hrdata.csv files'";
          } else if (file_types[0] === ".pdf") {
            console.log("in pdf");
            fileUploaded = "'resume-sample.pdf' file";
          } else if (file_types[0] === ".csv") {
            console.log("in csv");
            fileUploaded = "'hrdata.csv' file";
          }
          messageChatbot(
            `Thank you for verifying.<br/>You have ${fileUploaded} uploaded. Would you like to ask questions based on the information in these files, or do you wish to upload another file?`,
            true
          );
        } else {
          messageChatbot(status + doc_status, true);
        }
        return;
      }
      messageChatbot("Some error occured. Please retry later.", true);
    },
    (err) => {
      console.log("Danger zone: ", err);
      messageChatbot("Unable to verify, please provide proper email.", true);
    }
  );
}

function askQuestionHandler(event, question) {
  document.getElementById("prompt-status").innerText = "";
  document.getElementById("like-ans").style.display = "flex";
  const { element } = event.data;
  const userId = localStorage.getItem("userId");
  fetch(`./query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      question,
      question_type: document.getElementById("question-type").checked
        ? document.getElementById("question-type").value
        : "other",
    }),
  })
    .then(async (response) => {
      let respJson = await response.json();
      if (respJson.ok) {
        element.innerHTML = respJson.ans;
        getPrompt(userId, "none");
        messageChatbot(respJson.ans, true);
        setTimeout(() => {
          const aiTask = document.getElementById("ai-task").value;
          console.log("Ai task: ", aiTask);
          displaySource(
            aiTask === "rag" || aiTask === "sql_gen",
            respJson.source
          );
        }, 1000);
      } else {
        messageChatbot("Unable to get the answer. Please try again.", true);
        throw new Error(respJson.ans);
      }
    })
    .catch((error) => {
      messageChatbot("Unable to get the answer. Please try again.", true);
      console.error("Error:", error);
    });
}

function manageVisibilityForToggleButon(file_type) {
  document.getElementById("div-toggle-parent").style.display =
    uploaded_file_type.has(".csv") && uploaded_file_type.has(".pdf")
      ? "flex"
      : "none";

  document.getElementById("question-type").checked = file_type === ".csv";
}

// Perform upload
function uploadFileFromAsst(selectedFile, button) {
  if (selectedFile) {
    const formData = new FormData();
    formData.append("file1", selectedFile);
    const userId = localStorage.getItem("userId");
    button.disabled = true; // disable upload file button

    //Upload file
    fetch(`./load/${userId}`, {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        if (response.ok) {
          data = await response.json();
          let toast = document.getElementById("cdsInlineNotification");
          if (data.errMsg && data.errMsg !== "None") {
            messageChatbot("File upload failed.", true);
            button.disabled = false;
            console.log(data.errMsg);
            toast.textContent = data.errMsg;
            toast.style.display = "";
            toast.open = true;
            setTimeout(() => {
              toast.style.display = "none";
              toast.open = false;
            }, 60000); // ms
            return;
          }
          getPrompt(userId, "none");
          file_type = data.file.toLowerCase();
          uploaded_file_type.add(file_type);
          manageVisibilityForToggleButon(file_type);
          console.log("calling file upload");
          // messageChatbot("File uploaded", true);
          setTimeout(() => {
            messageChatbot(`${selectedFile.name} is uploaded`, true);
          }, 3000);

          toast.textContent = "";
          toast.style.display = "none";
        } else {
          button.disabled = false;
          messageChatbot("File upload failed.", true);
          throw new Error("File upload failed.");
        }
      })
      .catch((error) => {
        messageChatbot("File upload failed.", true);
        console.error("Error:", error);
      });
    messageChatbot(`${selectedFile.name} upload in progress...`, true);
    if (selectedFile.name.split(".")[1] === "csv") {
      console.log("In csv");
      setTimeout(() => {
        messageChatbot("uploading-csv", true);
      }, 3000);
    }
  } else {
    console.error("No file selected.");
  }
}

function fileUploadCustomResponseHandler(event, instance) {
  const { element, message } = event.data;

  element.innerHTML = `
    <div style="padding-top: 1rem;">
        <input type="file" id="uploadInput" style="display: none;">
        <button id="uploadButton-report" class="WAC__button--primary cds--btn cds--btn--primary"> Upload File </button>
    </div>`;

  const uploadInput = element.querySelector("#uploadInput");
  const button = element.querySelector("#uploadButton-report");
  button.addEventListener("click", () => {
    uploadInput.click();
  });
  uploadInput.addEventListener("change", (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      // You can access the selected file using selectedFile variable
      // console.log("Selected file:", selectedFile.name);
      uploadFileFromAsst(selectedFile, button);
    }
  });
}
/*
 *
 * Watson Assistant
 *
 */

var g_wa_instance;
function setUpChatbot() {
  const queryParams = new URLSearchParams(window.location.search);

  // const customElement = document.querySelector("#WebChatContainer");
  window.watsonAssistantChatOptions = {
    integrationID: document.getElementById("wa_integration_id").value,
    region: document.getElementById("wa_region").value,
    serviceInstanceID: document.getElementById("wa_service_instance_id").value,
    showRestartButton: true,
    openChatByDefault: true,
    hideCloseButton: true,
    carbonTheme: "white",
    // element: customElement,
    onLoad: async function (instance) {
      g_wa_instance = instance;
      instance.on({
        type: "customResponse",
        handler: (event, instance) => {
          if (
            event.data.message.user_defined &&
            event.data.message.user_defined.user_defined_type === "verify-email"
          ) {
            verifyEmailHandler(
              event,
              event.data.message.user_defined.user_query
            );
          } else if (
            event.data.message.user_defined &&
            event.data.message.user_defined.user_defined_type ===
              "user-file-upload"
          ) {
            fileUploadCustomResponseHandler(event, instance);
          } else if (
            event.data.message.user_defined &&
            event.data.message.user_defined.user_defined_type === "ask-question"
          ) {
            askQuestionHandler(
              event,
              event.data.message.user_defined.user_query
            );
          }
        },
      });
      instance.updateCSSVariables({
        "BASE-max-height": "90%",
        "BASE-width": "47%",
        "BASE-font-size-med": "var(--WatsonAssistantChat-BASE-font-size-large)",
        "BASE-line-height-med":
          "var(--WatsonAssistantChat-BASE-line-height-large)",
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
