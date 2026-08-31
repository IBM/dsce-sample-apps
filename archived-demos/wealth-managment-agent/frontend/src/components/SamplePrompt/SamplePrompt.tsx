import { ClickableTile} from "@carbon/react"
import {ArrowRight} from "@carbon/icons-react"
import "./SamplePrompt.scss"
type SamplePromptProps = {
    message: string,
    sendMessage: Function,
    disabled: boolean,
    sessionId: string
}

const SamplePrompt = ({ message, sendMessage, disabled, sessionId}: SamplePromptProps) => {
    return <ClickableTile className="prompt-tile" onClick={() => sendMessage({message, sessionId})} disabled={disabled}>
        <p style={{fontSize: "12px"}}>{message}</p>
        <div style={{float: "right", marginBottom: "0.5rem"}}>
        <ArrowRight fill="#5d7aab" style={{position:"absolute", bottom: "1rem", right:"1rem"}}/>
        </div>
    </ClickableTile>
}

export default SamplePrompt