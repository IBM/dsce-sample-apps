import { useState, useEffect } from "react";


import useChatBot from "../../hooks/useChatBot";
import ChatContainer from "../../components/ChatContainer/ChatContainer";
import ChatMessage from "../../components/ChatMessage/ChatMessage";
import { CircleLoader } from "react-spinners";
import "./ChatPage.scss"
import { askDocument, startChatSession } from "../../services/llm.service";
import { Column, Row } from "@carbon/react";
import SamplePrompt from "../../components/SamplePrompt/SamplePrompt";





const ChatPage = () => {
  let defaultMessage = import.meta.env.VITE_WELCOME_MESSAGE
  const [sessionId, setSessionId] = useState("")
  const [loading, setLoading] = useState(false)


  const samplePrompts = [
    "Give me a report on John Doe's stock investment portfolio",
    "Get the transcript from my previous meeting with John Doe and create an email",
    "How does the US equity market compare to the rest of world?"
  ]


  const { messages, waiting, sendMessage, newChat } = useChatBot({ defaultMessage, senderType: "bot", getResponse: askDocument })

  const getSessionId = async () => {
    setLoading(true)
    try {
      let response = await startChatSession()
      console.log(response)
      setSessionId(response.session_id)
    } finally {
      setLoading(false)
    }
  }



  useEffect(() => {
    if (!sessionId) {
      getSessionId()
    }
  }, [sessionId])

  const submit = (message: string) => {
    sendMessage({ message, sessionId })
  }



  return (
    <>




      <ChatContainer
        handleNewChat={() => { setSessionId(""); newChat() }}
        disableChat={import.meta.env.VITE_ENABLE_CHAT === "false" || waiting}
        getCurrentMessage={submit}>
        {messages.map(message =>
          <ChatMessage message={message.message} sender={message.sender} reasoning={message.reasoning ? message.reasoning : ""} key={Math.random().toString(36).substring(2, 5)} />

        )}
        <Row style={{marginLeft: "1rem"}}>
            {messages.length <= 6 && !waiting && samplePrompts.map(prompt =>
            <Column md={2} key={prompt}>
              <SamplePrompt message={prompt} sendMessage={sendMessage} disabled={waiting} sessionId={sessionId} />
            </Column>
            )}
        </Row>
        {messages.length > 1 && waiting && <ChatMessage message="" sender="watsonx" reasoning={""} />}

      </ChatContainer>

      {loading &&
        // <Loading withOverlay={true}></Loading>
        <div className="loading-overlay">
          <div className="loading-content">
            <CircleLoader
              color={'blue'}
              loading={true}
              size={50}
              aria-label="Loading Spinner"
              data-testid="loader"
            />
            <span>Please wait, initializing chat session...</span>
          </div>
        </div>
      }
    </>
  );
};


export default ChatPage