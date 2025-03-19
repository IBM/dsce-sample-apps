import {useState } from "react"

type UseChatbotProps = {
    defaultMessage: string,
    senderType: string,
    getResponse: Function
}
type ChatbotMessage = {
    message: string,
    sender: string,
    reasoning?: string

}
const useChatBot = ({defaultMessage, senderType, getResponse}:UseChatbotProps) => {

    const [messages, setMessages] = useState<ChatbotMessage[]>([{message : defaultMessage, sender: senderType}])
    const [waiting, setWaiting] = useState<boolean>(false)

    const sendMessage = async ({ message, sessionId, ...extraParams }: { 
        message: string; 
        sessionId: string; 
        [key: string]: any; 
    }) => {
        setMessages(prev => [...prev, {message, sender : "user"}])
        setWaiting(true)
        try {
            let reply = await getResponse(message, sessionId, extraParams)
            console.log(reply)
            setMessages(prev => [...prev, {message: reply.output, sender : "bot", reasoning: reply.reasoning}])
        } finally {
            setWaiting(false)
        }
    }

    const newChat = async () => {
        setMessages([{message : defaultMessage, sender: senderType}])
    }
    return {messages, waiting, sendMessage, newChat}

}

export default useChatBot