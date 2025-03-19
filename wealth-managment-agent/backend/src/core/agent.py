import json
import os
import logging
import time
import random
import string
from langchain.tools import Tool
from langchain.tools.render import render_text_description
from langchain.agents import AgentExecutor
from langchain_core.agents import AgentAction, AgentFinish
from langchain.agents.output_parsers import JSONAgentOutputParser
from langchain.agents.format_scratchpad import format_log_to_str
from langchain.prompts import ChatPromptTemplate
from langchain.prompts.chat import MessagesPlaceholder
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames
from langchain_ibm import WatsonxLLM
from langchain_core.runnables import RunnablePassthrough
from langchain_core.runnables.history import RunnableWithMessageHistory
from .output_parser import CustomJSONAgentOutputParser

from config.app_config import AppConfig
app_config = AppConfig()

# Set up logging
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

class Agent:
    def __init__(
            self,
            tools,
            planning,
            memory
        ) -> None:
        self.tools = tools
        self.planning = planning
        self.memory = memory

        # Load configuration with defaults

        self.WX_ENDPOINT = app_config.WX_ENDPOINT
        self.IBM_CLOUD_API_KEY = app_config.IBM_CLOUD_API_KEY
        self.WX_PROJECT_ID = app_config.WX_PROJECT_ID
        self.MODEL_ID = app_config.MODEL.LLAMA_3_70_B_INSTRUCT
        self.PARAMETERS = app_config.PARAMETERS
        self.AGENT_VERBOSE = app_config.AGENT_VERBOSE

    def init_agent(self) -> dict:
        """Initializes the LLM agent with WatsonxLLM and custom settings."""
        try:
            logger.info("initializing llm...")
            self.llm = WatsonxLLM(
                url=self.WX_ENDPOINT,
                apikey=self.IBM_CLOUD_API_KEY,
                project_id=self.WX_PROJECT_ID,
                model_id=self.MODEL_ID,
                params=self.PARAMETERS
            )
            # logger.info("testing llm...", self.llm.invoke("Hello"))
            
            system_prompt = self.planning
            user_input = '{input}\n{agent_scratchpad}\n(reminder to respond in a JSON blob no matter what and use tools only if necessary)'

            tool_descriptions = "\n".join([f"- {tool.name}: {tool.description}" for tool in self.tools])
            tool_names = ", ".join([tool.name for tool in self.tools])

            system_prompt = self.planning.replace("{tools}", tool_descriptions).replace("{tool_names}", tool_names)

            prompt = ChatPromptTemplate.from_messages(
                [
                    ("system", system_prompt),
                    MessagesPlaceholder(variable_name="chat_history", optional=True),
                    ("user", user_input)
                ]
            )

            tools_chat = self.tools
            prompt_chat = prompt.partial(
                tools=render_text_description(list(tools_chat)),
                tool_names=", ".join([t.name for t in tools_chat]),
            )

            # Create the chain of runnables for agent chat handling
            agent_chat = (
                RunnablePassthrough.assign(
                    agent_scratchpad=lambda x: format_log_to_str(x["intermediate_steps"]),
                )
                | prompt_chat
                | self.llm.bind(stop=["}\n"])
                | CustomJSONAgentOutputParser()
            )

            # Set up the agent executor
            self.agent_executor_chat = AgentExecutor(
                agent=agent_chat,
                tools=tools_chat,
                verbose=self.AGENT_VERBOSE,
                handle_parsing_errors=True,
                return_intermediate_steps=True
            )
            
            # Message history for session management
            if self.memory == 'Conversation buffer memory':
                from langchain.memory import ConversationBufferMemory
                message_history = ConversationBufferMemory()
            elif self.memory == 'Chat history memory':
                from langchain_community.chat_message_histories import ChatMessageHistory
                message_history = ChatMessageHistory()

            self.agent_with_chat_history = RunnableWithMessageHistory(
                self.agent_executor_chat,
                get_session_history=lambda session_id: message_history,
                input_messages_key="input",
                history_messages_key="chat_history",
            )
            
            return {"output": "New session created", "session_id": self.generate_random_session_id()}
        
        except Exception as e:
            logger.error(f"Error initializing agent: {e}")
            return {"output": "Failed to create a new session", "session_id": None }
    
    def generate_random_session_id(self):
        number = random.randint(0, 999)
        letter = random.choice(string.ascii_lowercase)
        return f"wx-session-{number}{letter}"

    def summarize_agent_actions(self, response) -> str:
        formatted_reasoning = ""
        for i in range(len(response)):
            tool_name = response[i][0].tool
            tool_input = response[i][0].tool_input
            tool_output = str(response[i][1]).strip()
            
            formatted_reasoning += f"**Tool name:**\n {tool_name}\n\n"
            formatted_reasoning += f"**Tool input:**\n {tool_input if tool_input != '' else 'None'}\n\n"
            truncated_content = (tool_output[:250].rsplit(' ', 1)[0] + ' ... (output truncated)') if len(tool_output) > 250 else tool_output
            formatted_reasoning += f"**Tool output:**\n```\n{truncated_content}\n```\n"
            formatted_reasoning += "\n---\n\n"
        return formatted_reasoning

    def invoke_agent(self, session_id: str, input_: str) -> dict:
        """Invokes the agent to process the input and return the result."""

        try:
            logger.info("Input: ", input_)
            start_time = time.time()
            answer = self.agent_with_chat_history.invoke(
                {"input": input_},
                config={"configurable": {"session_id": session_id}}
            )
            end_time = time.time()
            execution_time = round(end_time - start_time, 2)

            logger.info(f"Agent execution completed in {execution_time} seconds.")
            
            return {
                "output": answer['output'],
                "reasoning": self.summarize_agent_actions(answer['intermediate_steps']),
                "execution_time": f"{execution_time} sec"
            }
        
        except Exception as e:
            logger.error(f"Error during agent invocation: {e}")
            return {
                "output": "Sorry, something went wrong, please try again.",
                "reasoning": None,
                "execution_time": None
            }
