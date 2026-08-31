import json
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames
from langchain_ibm import ChatWatsonx
from ibm_watsonx_ai.foundation_models import ModelInference
import logging
import os
import datetime

from agents.tools.weather_tool import OpenMetoTool
from agents.tools.web_search_tool import DuckDuckGoSearchTool, GoogleSearchTool, WikipediaSearchTool, WebCrawlerTool
from agents.tools.date_tool import DateTimeTool

from config.app_config import AppConfig
from langgraph.graph import MessagesState, START, StateGraph
from langgraph.prebuilt import tools_condition, ToolNode
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, AIMessageChunk

import concurrent.futures

class TravelAgent:
    def __init__(self):
        self.app_config = AppConfig()
        self.llm = ChatWatsonx(
            model_id=self.app_config.MODEL.GRANITE_3_8_B_INSTRUCT,
            url=self.app_config.WX_ENDPOINT,
            project_id=self.app_config.WX_PROJECT_ID,
            params=self.app_config.PARAMETERS,
            apikey=self.app_config.IBM_CLOUD_API_KEY
        )
        self.tools = [
            DuckDuckGoSearchTool().duckduckgo_search_tool,
            OpenMetoTool().weather_tool, 
            WikipediaSearchTool().wikipedia_tool, 
            
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
            content="<|start_of_role|>system<|end_of_role|>You are a helpful assistant good at planning a travel itinerary.<|end_of_text|>"
        )
        return {"messages": [self.llm_with_tools.invoke([sys_msg] + state["messages"])]}

    def get_travel_info(self, user_message: str):
        messages = [HumanMessage(content=user_message)]
        messages = self.react_graph.invoke({"messages": messages})

        def invoke_llm():
            return self.format_chat_history(messages), messages['messages'][-1].content, messages['messages'][-1].response_metadata
        
        timeout = os.environ['LLM_TIMEOUT']  # seconds
        reasoning, response, metadata = (None, None, None)
        try:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(invoke_llm)
                reasoning, response, metadata = future.result(timeout=timeout)
                if self.app_config.UPDATE_AGENT_CACHE:
                    with open(self.app_config.AGENT_CACHE_LOCATION+'travel_agent_cache.json', 'w') as f:
                        json.dump({'reasoning': reasoning, 'response': response, 'metadata': metadata}, f)
        except concurrent.futures.TimeoutError:
            print("[INFO]: Agent request timed out, reading from cache...")
            with open(self.app_config.AGENT_CACHE_LOCATION+'travel_agent_cache.json', 'r') as f:
                cache = json.loads(f.read())
            reasoning, response, metadata = (cache.get('reasoning'), cache.get('response'), cache.get('metadata'))
        finally:
            return reasoning, response, metadata
        
    
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
                truncated_content = (content[:150] + ' ... (output truncated)') if len(content) > 50 else content
                formatted_output.append(f"**OBSERVATION: Tool ({tool_name}) Response:**\n{truncated_content}\n")

            # Extract tool calls correctly
            tool_calls = getattr(message, "tool_calls", [])
            for tool in tool_calls:
                tool_name = tool.get("name", "Unknown Tool")  # Get the function name
                tool_args = tool.get("args", {})  # Get arguments
                formatted_output.append(f"**ACTION: Tool Call - {tool_name}**\nArguments: {tool_args}\n")

        return "\n".join(formatted_output)

if __name__ == "__main__":
    assistant = TravelAgent()
    reasoning, response, metadata = assistant.get_travel_info(
        "I am planning a trip to New York city next week. Can you get me information about the tourist attractions, weather forecast and social events?"
    )
    print ("Result: ", response)
    print ("Reasoning: ", reasoning)
    print ("Metadata: ", metadata)
