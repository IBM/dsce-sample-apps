import { Accordion, AccordionItem, Button, TagSkeleton } from "@carbon/react";
import Markdown from "markdown-to-jsx";
import "./ChatMessage.scss";
import { downloadPdf } from "../../services/llm.service";

type ChatMessageProps = {
  message: string;
  sender: string;
  reasoning: string;
};

const ChatMessage = ({ message, sender, reasoning }: ChatMessageProps) => {
  const downloadReport = async () => {
    try {
      let data = await downloadPdf();
      console.log(data, "----");
      const url = window.URL.createObjectURL(data);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `portfolio_report.pdf`);

      // Append to document
      document.body.appendChild(link);

      // Trigger download
      link.click();

      // Cleanup
      link.remove();
    } catch {
      console.log("Error occurred.");
    }
  };

  const generateMailtoLink = (subject: string, body: string) => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    return `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
  };

  const extractSubjectAndBody = (emailText: string) => {
    const subjectMatch = emailText.match(/^Subject:\s*(.*)/m);
    const subject = subjectMatch ? subjectMatch[1] : "No Subject";
    const body = emailText.replace(/^Subject:\s*.*\n/, "").trim();
    return { subject, body };
  };

  const sendEmail = async (emailText: string) => {
    try {
      const { subject, body } = extractSubjectAndBody(emailText);
      const url = generateMailtoLink(subject, body);
      const link = document.createElement("a");
      link.href = url;

      // Append to document
      document.body.appendChild(link);

      // Trigger email client
      link.click();

      // Cleanup
      link.remove();
    } catch (error) {
      console.log("Error occurred while sending email:", error);
    }
  };

  return (
    <>
      {sender !== "user" ? (
        <div className="sender">
          <div style={{ display: "flex", justifyContent: "" }}>
            <div>
              <img
                src={"./watsonx-app-icon-dark-mode.svg"}
                height={28}
                width={28}
                alt=""
                className="_w3--watsonx-avatar_18pme_1"
              />
            </div>
            <div style={{ alignContent: "center" }}>
              <span style={{ marginLeft: "1rem", alignContent: "center" }}>
                watsonx
              </span>
            </div>
          </div>

          <div style={{ padding: "1rem" }}>
            {message === "" ? (
              <TagSkeleton style={{ color: "blue" }}></TagSkeleton>
            ) : (
              <>
                <p
                  className="Markdown-module--paragraph--29381 Markdown-module--paragraph--responsive--7fcac"
                  style={{ paddingLeft: "1rem" }}
                >
                  <Markdown style={{ fontSize: "14px" }}>
                    {message.replaceAll("WatsonX", "watsonx")}
                  </Markdown>
                </p>
                {reasoning && (
                  <Accordion className="reason">
                    <AccordionItem title="How did I get this answer?">
                      <Markdown style={{ fontSize: "14px" }}>
                        {reasoning}
                      </Markdown>
                    </AccordionItem>
                  </Accordion>
                )}
                {reasoning.includes("save_pdf_to_disk") && (
                  <Button
                    kind="tertiary"
                    onClick={downloadReport}
                    style={{ marginTop: "1rem" }}
                  >
                    Download Report
                  </Button>
                )}
                {reasoning.includes("transcript_retriever_tool") && (
                  <Button
                    kind="tertiary"
                    onClick={() => sendEmail(message)}
                    style={{ marginTop: "1rem" }}
                  >
                    Send Email
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="receiver">
          <div>
            <div className="chat-message-details">
              <span>You </span>
            </div>
            <div className="_w3--chat-message__content_i5j4f_35">
              <div className="chat-bubble">
                <p style={{ fontSize: "14px" }}>{message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatMessage;
