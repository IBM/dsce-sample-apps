"""
LangGraph-based Q&A agent for reports.
"""

from typing import Annotated, TypedDict, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_ibm import ChatWatsonx
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool
from langchain_community.vectorstores import FAISS
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams
import operator


class AgentState(TypedDict):
    """State for the agent graph."""
    messages: Annotated[Sequence[BaseMessage], operator.add]
    context: str


class RAGQandAAgent:
    """LangGraph agent for answering questions from reports."""

    def __init__(self, vectorstore: FAISS, watsonx_credentials: dict):
        """
        Initialize the Q&A agent.

        Args:
            vectorstore: FAISS vector store with document embeddings
            watsonx_credentials: Dictionary with watsonx.ai credentials and config
        """
        self.vectorstore = vectorstore
        self.retriever = vectorstore.as_retriever(search_kwargs={"k": 6})

        # Initialize watsonx.ai Chat LLM
        parameters = {
            GenParams.DECODING_METHOD: "greedy",
            GenParams.MAX_NEW_TOKENS: 2048,
            GenParams.MIN_NEW_TOKENS: 1,
            GenParams.TEMPERATURE: 0.1,
            GenParams.REPETITION_PENALTY: 1.1
        }

        self.llm = ChatWatsonx(
            model_id=watsonx_credentials.get('llm_model', 'meta-llama/llama-3-3-70b-instruct'),
            url=watsonx_credentials['url'],
            apikey=watsonx_credentials['apikey'],
            project_id=watsonx_credentials['project_id'],
            params=parameters
        )

        self.graph = self._build_graph()
        self.conversation_history = []

    def _create_retrieval_tool(self):
        """Create a tool for document retrieval."""

        @tool
        def search_health_coverage_docs(query: str) -> str:
            """
            Search reports for relevant information.
            Use this tool when you need to find specific information about reports.

            Args:
                query: The search query about health coverage

            Returns:
                Relevant excerpts from health coverage documents
            """
            docs = self.retriever.invoke(query)

            # Print retrieved context
            print("\n" + "="*80)
            print("🔍 RETRIEVED CONTEXT:")
            print("-"*80)
            print(f"Query: {query}")
            print(f"Number of documents retrieved: {len(docs)}")
            print("-"*80)

            context = "\n\n".join([
                f"Source: {doc.metadata.get('source_file', 'unknown')}\n{doc.page_content}"
                for doc in docs
            ])

            # Print the actual context being used (truncated if too long)
            if len(context) > 1000000:
                print(context[:1000] + "...\n[Context truncated for display]")
            else:
                print(context)
            print("="*80 + "\n")

            return context

        return search_health_coverage_docs

    def _build_graph(self):
        """Build the LangGraph agent workflow."""

        # Create retrieval tool
        retrieval_tool = self._create_retrieval_tool()
        tools = [retrieval_tool]

        # Bind tools to LLM
        llm_with_tools = self.llm.bind_tools(tools)

        # Define the agent node
        def agent_node(state: AgentState) -> AgentState:
            """Agent reasoning node."""
            messages = state["messages"]

            # Add system message to always search documents first
            system_msg = {
                "role": "system",
                "content": """You are a health insurance customer service agent. When answering questions:
1. ALWAYS use the search_health_coverage_docs tool to find specific information from the reports
2. Extract exact numbers, percentages, and dollar amounts from the retrieved documents
3. Never give generic answers - always provide specific details from the documents
4. If asked about costs, deductibles, or coverage, you MUST search the documents first"""
            }

            messages_with_system = [system_msg] + list(messages)
            response = llm_with_tools.invoke(messages_with_system)
            return {"messages": [response]}

        # Define tool execution node
        tool_node = ToolNode(tools)

        # Define routing logic
        def should_continue(state: AgentState) -> str:
            """Determine if we should continue to tools or end."""
            messages = state["messages"]
            last_message = messages[-1]

            # If there are no tool calls, end
            if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
                return "end"
            return "continue"

        # Define response generation node
        def generate_response(state: AgentState) -> AgentState:
            """Generate final response using retrieved context."""
            messages = state["messages"]

            # Create a prompt that emphasizes using retrieved information
            system_prompt = """You are a knowledgeable and friendly health insurance customer service agent.

CRITICAL INSTRUCTIONS:
1. You have just retrieved specific information from the reports
2. Your answer MUST include the exact numbers, amounts, and details from those documents
3. ALWAYS start your answer with the specific information requested (deductible amount, copay, etc.)
4. Then add conversational context and helpful explanations

Guidelines for your responses:
- Lead with facts: State specific dollar amounts, percentages, and coverage details FIRST
- Be precise: Quote exact numbers from the documents (e.g., "$3,400", "25%", etc.)
- Then be conversational: After stating facts, explain what they mean in plain language
- If you don't see the specific information in the retrieved documents, say "I don't see that specific information in the reports"
- Remember the conversation context and refer back to previous questions when relevant
- Provide helpful context about how things work, but ALWAYS anchor in specific document details

Example good response: "The individual deductible is $3,400 per year. That means you'll pay the full cost of most medical services until you've spent $3,400 out of pocket. After that, the plan starts sharing costs with you."

Example bad response: "There is a deductible you need to meet. Some services are covered before the deductible."
"""

            prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="messages"),
            ])

            chain = prompt | self.llm
            response = chain.invoke({"messages": messages})

            return {"messages": [response]}

        # Build the graph
        workflow = StateGraph(AgentState)

        # Add nodes
        workflow.add_node("agent", agent_node)
        workflow.add_node("tools", tool_node)
        workflow.add_node("generate", generate_response)

        # Set entry point
        workflow.set_entry_point("agent")

        # Add edges
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {
                "continue": "tools",
                "end": "generate"
            }
        )

        workflow.add_edge("tools", "agent")
        workflow.add_edge("generate", END)

        return workflow.compile()

    def query(self, question: str) -> str:
        """
        Query the agent with a question, maintaining conversation history.

        Args:
            question: Question about health coverage

        Returns:
            Answer from the agent
        """
        # Add user question to conversation history
        self.conversation_history.append(HumanMessage(content=question))

        # Create state with full conversation history
        state = {
            "messages": self.conversation_history.copy(),
            "context": ""
        }

        # Get response from agent
        result = self.graph.invoke(state)

        # Extract the agent's response
        agent_response = result["messages"][-1].content

        # Add agent's response to conversation history
        self.conversation_history.append(AIMessage(content=agent_response))

        return agent_response

    def query_with_context(self, question: str) -> dict:
        """
        Query the agent and return question, context, and response.

        Args:
            question: Question to ask

        Returns:
            Dictionary with question, context, and response
        """
        # Retrieve context directly from the retriever
        docs = self.retriever.invoke(question)
        context = "\n\n".join([
            f"Source: {doc.metadata.get('source_file', 'unknown')}\n{doc.page_content}"
            for doc in docs
        ])

        # Get the response from the agent
        response = self.query(question)

        return {
            "question": question,
            "context": context,
            "response": response
        }

    def reset_conversation(self):
        """Reset the conversation history."""
        self.conversation_history = []

    def stream_query(self, question: str):
        """
        Stream the agent's response to a question.

        Args:
            question: Question about health coverage

        Yields:
            Chunks of the response
        """
        # Add user question to conversation history
        self.conversation_history.append(HumanMessage(content=question))

        state = {
            "messages": self.conversation_history.copy(),
            "context": ""
        }

        for chunk in self.graph.stream(state):
            yield chunk
