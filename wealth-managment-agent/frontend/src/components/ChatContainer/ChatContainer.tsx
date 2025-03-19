import { Button, Column, IconButton, Row, TextInput, Tile } from "@carbon/react"
import { Close, Add, SendFilled, IbmWatsonxAssistant} from '@carbon/icons-react';
import { KeyboardEventHandler, ReactNode, useEffect, useRef, useState } from "react"
import CustomAILabel from "../CustomAILabel/CustomAILabel"

type ChatContainerProps = {
    children: ReactNode
    handleNewChat: Function,
    disableChat: boolean,
    getCurrentMessage: Function
}

const ChatContainer = ({ children, handleNewChat, disableChat, getCurrentMessage }: ChatContainerProps) => {

    const [message, setMessage] = useState("")
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {

        // Scroll to the bottom of the chat container
        if (chatContainerRef.current) {
            chatContainerRef.current.scroll({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [children])

    const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            getCurrentMessage(message)
            setMessage("")
        }
    };
    return <Row>
        <Column sm={4} md={8} lg={16} style={{ height: `${window.innerHeight}px` }}>
            <Tile decorator={<CustomAILabel />} id="tile-1" style={{ height: "100%", background: "#161616" }}>
                {/*<header className="sales-bg-div">
                    <div style={{ float: 'right' }}>
                        <IconButton
                            kind="ghost"
                            size="sm"
                            className="icon-btn"
                            onClick={() => { copyChatToClipboard() }}
                            label="Copy Chat to clipboard"
                        >
                            <Copy />
                        </IconButton>
                    </div>
</header>*/}
                <div ref={chatContainerRef} style={{ height: "85%", padding: "2rem 8rem 2rem 8rem", overflow: "auto", width: "60%", margin: "0 auto", scrollbarWidth: "none" }}>

                    <div style={{ textAlign: "center" }}>
                        <IbmWatsonxAssistant size="32" />
                        <p>{import.meta.env.VITE_CHATBOT_NAME}</p>
                    </div>
                    {children}

                </div>
                <Row
                    style={{ marginTop: '-6rem' }}
                >
                    <Column sm={4} md={8} lg={15} >
                        <div style={{ display: 'flex', position: 'absolute', width: "60%", left: "20%", bottom: "8%" }}>
                            <TextInput
                                type="text"
                                labelText="Text input label"
                                hideLabel
                                onKeyDown={handleKeyDown}
                                placeholder="Type something"
                                disabled={disableChat}
                                onChange={(event) => {
                                    setMessage(event.target.value);
                                }
                                }
                                helperText={
                                    <span>
                                        {/* <span>Please ask your question</span> */}
                                        <span>
                                            <Button
                                                kind="ghost"
                                                renderIcon={Add}
                                                onClick={() => { handleNewChat(false) }}
                                                style={{ float: 'right', color: 'white' }}
                                                size="sm"

                                                className="icon-btn"

                                            >New chat
                                            </Button>
                                        </span>
                                    </span>

                                }
                                id="text-input-ai-label"
                                // decorator={aiLabel}
                                value={message}
                                style={{ flex: 1, paddingRight: '2rem', marginLeft: '6rem' }} // Ensure room for the icon
                            />
                            {message && (
                                <IconButton
                                    kind="ghost"
                                    size="sm"
                                    className="icon-btn"
                                    onClick={() => setMessage("")}
                                    style={{
                                        position: 'absolute',
                                        top: '28%',
                                        right: '2rem',
                                        transform: 'translateY(-50%)',
                                        // padding: 0,
                                        backgroundColor: 'transparent',
                                    }}
                                    label="Clear search"
                                >
                                    <Close size={16} />
                                </IconButton>
                            )}
                        </div>
                        <div style={{
                        padding: "0", position: 'absolute',
                        right: "17%",
                        bottom: "12%"
                    }}>
                        <IconButton
                            kind="ghost"
                            size="sm"
                            onClick={() => { getCurrentMessage(message); setMessage("") }}
                            className="icon-btn"
                            disabled={disableChat || message.trim() == ""}
                            style={{

                            }}
                            label="Enter"
                        >
                            <SendFilled size={16} />
                        </IconButton>
                    </div>
                    </Column>


                </Row>

            </Tile>

        </Column>
    </Row>
}

export default ChatContainer