from langchain.agents.output_parsers import JSONAgentOutputParser
from langchain_core.agents import AgentAction, AgentFinish

class CustomJSONAgentOutputParser(JSONAgentOutputParser):
    def parse(self, text: str) -> AgentAction | AgentFinish:
        i = text.find("{")
        text = text[i:]
        if "```" not in text:
            text = "\n```\n" + text
        return super().parse(text + "\n```\nObservation:")
