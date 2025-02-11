from ibm_watsonx_ai.metanames import GenTextParamsMetaNames
from langchain_ibm import ChatWatsonx
from ibm_watsonx_ai.foundation_models import ModelInference
import logging
import os
import datetime

from agents.tools.arxiv_tool import ArxivTool
from agents.tools.date_tool import DateTimeTool

from agents.tools.web_search_tool import WebCrawlerTool, WikipediaSearchTool
from config.app_config import AppConfig
from langgraph.graph import MessagesState, START, StateGraph
from langgraph.prebuilt import tools_condition, ToolNode
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, AIMessageChunk

class ResearchAgent:
    def __init__(self):
        self.app_config = AppConfig()
        self.llm = ChatWatsonx(
            model_id=self.app_config.MODEL.LLAMA_3_70_B_INSTRUCT,
            url=self.app_config.WX_ENDPOINT,
            project_id=self.app_config.WX_PROJECT_ID,
            params=self.app_config.PARAMETERS,
            apikey=self.app_config.IBM_CLOUD_API_KEY
        )
        self.tools = [
            DateTimeTool().date_time_tool,
            ArxivTool().arxiv_tool
        ]
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        self.react_graph = self._build_graph()

    def _build_graph(self):
        builder = StateGraph(MessagesState)
        builder.add_node("assistant", self.assistant)
        builder.add_node("tools", ToolNode(self.tools))
        builder.add_edge(START, "assistant")
        builder.add_conditional_edges("assistant", tools_condition)
        builder.add_edge("tools", "assistant")
        return builder.compile()

    def assistant(self, state: MessagesState):
        now = datetime.datetime.now()
        today = now.strftime('%mm-%dd-%YYYY')
        sys_msg = SystemMessage(
            content="You are a helpful research assistant having a conversation with a human. Keep the tone conversational."
            "Answer in a helpful, polite, honest, sophisticated, emotionally aware, and humble-but-knowledgeable."
            "The assistant prioritizes caution over usefulness, refusing to answer questions that it considers unsafe, immoral, unethical or dangerous."
            f"Today's date is {today} in mm-dd-yyyy format. This is for you to stay relevant to current events."
            "You can use markdown to format your responses in a structured manner."
            "Your task is to gather and synthesize information, to generate comprehensive literature reviews or research summaries."
            "Cite the references at the end of your response so that human can read more about the research paper and articles."
        )
        return {"messages": [self.llm_with_tools.invoke([sys_msg] + state["messages"])]}

    def get_research_info(self, user_message: str):
        messages = [HumanMessage(content=user_message)]
        messages = self.react_graph.invoke({"messages": messages})
        return self.format_chat_history(messages), messages['messages'][-1].content, messages['messages'][-1].response_metadata
    
    def format_chat_history(self, data):
        formatted_output = []

        for message in data.get("messages", []):
            msg_type = getattr(message, "type", "")
            content = getattr(message, "content", "")

            if msg_type == "human":
                formatted_output.append(f"**User:** {content}\n")
            elif msg_type == "ai":
                if content:
                    formatted_output.append(f"**AI Agent:**\n{content}\n")
            elif msg_type == "tool":
                tool_name = getattr(message, "name", "Unknown Tool")
                truncated_content = (content[:100] + ' ... (output truncated)') if len(content) > 50 else content
                formatted_output.append(f"**Tool ({tool_name}) Response:**\n{truncated_content}\n")

            # Extract tool calls correctly
            tool_calls = getattr(message, "tool_calls", [])
            for tool in tool_calls:
                tool_name = tool.get("name", "Unknown Tool")  # Get the function name
                tool_args = tool.get("args", {})  # Get arguments
                formatted_output.append(f"**Tool Call - {tool_name}**\nArguments: {tool_args}\n")

        return "\n".join(formatted_output)

if __name__ == "__main__":
    assistant = ResearchAgent()
    reasoning, response, metadata = assistant.get_research_info(
        "What are some advancements in machine learning applications in healthcare?"
    )
    print ("Result: ", response)
    print ("Reasoning: ", reasoning)
    print ("Metadata: ", metadata)
