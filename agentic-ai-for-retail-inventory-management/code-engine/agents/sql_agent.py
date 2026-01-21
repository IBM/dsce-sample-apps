import os
from typing import TypedDict, List, Annotated
import operator
from dotenv import load_dotenv
from langchain_community.utilities import SQLDatabase
from langchain_community.tools.sql_database.tool import QuerySQLDataBaseTool
#from langchain_community.tools import QuerySQLDatabaseTool
from langchain_ibm import ChatWatsonx
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END

import json
def load_json(path):
    with open(path, 'r', encoding='utf-8') as fp:
        return json.load(fp)


load_dotenv()

DB_FILE = os.getenv('DB_PATH','data/retail_analytics.db')
DB_INFO_PATH='data/db_table_info.json'

custom_table_info_dict = load_json(DB_INFO_PATH)
TOP_K = os.getenv('TOP_K',10)
MAX_RETRIES = os.getenv('MAX_RETRIES',3)
SQL_PROMPT_TEMPLATE = os.getenv(
    "SQL_AGENT_PROMPT_TEMPLATE",
    """You are an expert SQL assistant for an inventory management system.
Given a user's question, you must generate syntactically correct SQL queries for a SQLite database.
Only return the SQL query and nothing else. Do not include ```sql or any explanations.

**Rules for generating the query:**
1.  If a user requests multiple changes (e.g., "update X and remove Y"), you **MUST** generate multiple SQL statements separated by a semicolon (;).
2.  For any request to view, modify, update, or delete from the **current draft purchase order**, you **MUST** query the `draft_purchase_order` table.
3.  For general questions about product information (like stock levels, categories, reorder thresholds), you **MUST** query the `products` table.
4.  For questions asking to "show", "list", "find", "get", or "what is", generate a `SELECT` query.
5.  For questions asking to "update", "change", or "modify", generate an `UPDATE` query.
6.  For questions asking to "remove" or "delete", generate a `DELETE` query.
7.  Pay close attention to the `sku_id` in the user's question for `WHERE` clauses.
8.  Unless the user specifies a number, limit `SELECT` results to {top_k}.
**Database Schema:**
{schema}

**User Question:**
{question}
{additional_context}
**SQL Query:**
"""
)
RESPONSE_PROMPT_TEMPLATE = os.getenv(
    "SQL_RESPONSE_PROMPT_TEMPLATE",
"""You are a helpful inventory management assistant.
A user asked the following question: "{question}"

The database returned the following information:
{results}

Provide a clear, concise, and friendly natural language response based on the database results.
- If the query was to find data (a SELECT query), summarize the results in a readable format (like a table or list).
- If the query was to update data (an UPDATE query), simply confirm that the action was completed successfully.
- Do not mention SQL, databases, or columns unless the user's question was about them.
- Your entire response must be in English.
"""
)


db = SQLDatabase.from_uri(f"sqlite:///{DB_FILE}", custom_table_info=custom_table_info_dict)

parameters = {
        "frequency_penalty": 0,
        "max_tokens": 2000,
        "presence_penalty": 0,
        "temperature": 0,
        "top_p": 1
    }
llm = ChatWatsonx(
        #model_id="meta-llama/llama-3-3-70b-instruct", # 
        model_id= os.getenv('WATSONX_MODEL_ID',"meta-llama/llama-3-2-90b-vision-instruct"),
        #model_id= "meta-llama/llama-4-maverick-17b-128e-instruct-fp8",
        url=os.getenv("WATSONX_URL"),
        project_id=os.getenv("WATSONX_PROJECT_ID"),
        apikey=os.getenv("WATSONX_API_KEY"),
        params=parameters
    )

query_tool = QuerySQLDataBaseTool(db=db)

class GraphState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    sql_query: str
    db_results: str
    error: str
    retry_count: int


def generate_sql_node(state: GraphState):
    """Generates the SQL query based on the user's question."""
    print("---NODE: GENERATE SQL---")
    
    user_question = state["messages"][-1].content
    additional_context_content = ""
    
    if state.get("error") and state.get("sql_query"):
        print(f" -> Preparing correction context for retry attempt {state['retry_count']}")
        failed_sql = state["sql_query"]
        error_message = state["error"]
        additional_context_content = f"""
        ATTENTION! CORRECTION REQUIRED:
        The previous attempt to generate a SQL query failed. Your task is to generate a new, corrected query.
        - Failed Query: ```sql\n{failed_sql}\n```
        - Database Error: `{error_message}`
        Analyze the error and the failed query. Then, based on the original user question and the schema, create the correct query.
        """

    prompt = ChatPromptTemplate.from_template(SQL_PROMPT_TEMPLATE)
    sql_generator_chain = prompt | llm | StrOutputParser()
    
    query = sql_generator_chain.invoke({
        "question": user_question,
        "schema": db.get_table_info(),
        "top_k": TOP_K,
        "additional_context": additional_context_content
    })
    
    query = query.strip().replace("```sql", "").replace("```", "")
    print(f" -> Generated SQL: {query}")
    
    return {"sql_query": query, "error": None}


def execute_sql_node(state: GraphState):
    """
    Executes one or more SQL queries separated by semicolons.
    This allows handling of multi-step user requests.
    """
    print("---NODE: EXECUTE SQL---")
    
    query_string = state["sql_query"]
    print('Full query string received:', query_string)
    #split multiple queries
    statements = [stmt.strip() for stmt in query_string.split(';') if stmt.strip()]
    
    if not statements:
        return {"db_results": "No valid SQL query was generated.", "error": None}

    try:
        results = []
        for i, stmt in enumerate(statements):
            print(f" -> Executing statement {i+1}/{len(statements)}: {stmt}")
            result = db.run(stmt)
            results.append(result)

        if len(statements) > 1:
            final_result = f"Successfully executed {len(statements)} database operations."
            
            for statement,result in zip(statements,results):
                if result!='':
                    final_result += f"\n statement {statement} \n result: {result}"
                    

            
        else:
            final_result = results[0]
            if final_result=='':
                final_result = f"Successfully executed {len(statements)} database operations."

        print(f" -> DB Results: {final_result}")
        return {"db_results": final_result, "error": None}

    except Exception as e:
        error_message = str(e)
        current_retries = state.get('retry_count', 0)
        print(f" -> ERROR executing query: {error_message}")
        return {
            "error": f"Error executing SQL query: {error_message}",
            "db_results": '',
            "retry_count": current_retries + 1
        }

def handle_sql_error(state: GraphState):
    """Decision point: After executing SQL, check for errors and decide next step."""
    print("---DECISION: Handle SQL Error---")
    error = state.get("error")
    retry_count = state.get("retry_count", 0)

    if not error:
        print(" -> SUCCESS: No error. Branching to 'synthesize_response'.")
        return "synthesize_response"
    
    if retry_count >= MAX_RETRIES:
        print(f" -> FAILURE: Max retries ({MAX_RETRIES}) exceeded. Reporting final error.")
        final_error_message = f"I'm sorry, I couldn't execute that request. I tried multiple times but encountered a persistent error: {error}"
        return {"messages": [AIMessage(content=final_error_message)]}

    print(f" -> RETRY: SQL Error detected. Looping back to 'generate_sql'.")
    return "generate_sql"


def synthesize_response_node(state: GraphState):
    """Generates the final natural language response."""
    print("---NODE: SYNTHESIZE RESPONSE---")

    user_question = state["messages"][-1].content
    db_results = state.get("db_results")

    if state.get("error"):
         return {"messages": [AIMessage(content=f"Sorry, I encountered a technical error: {state['error']}")]}
         
    if not db_results:
        return {"messages": [AIMessage(content="I'm sorry, I couldn't find any data matching your request.")]}

    prompt = ChatPromptTemplate.from_template(RESPONSE_PROMPT_TEMPLATE)
    synthesis_chain = prompt | llm | StrOutputParser()
    
    response = synthesis_chain.invoke({
        "question": user_question,
        "results": db_results
    })
    
    return {"messages": [AIMessage(content=response)]}


def create_sql_agent():
    workflow = StateGraph(GraphState)

    workflow.add_node("generate_sql", generate_sql_node)
    workflow.add_node("execute_sql", execute_sql_node)
    workflow.add_node("synthesize_response", synthesize_response_node)

    workflow.set_entry_point("generate_sql")
    workflow.add_edge("generate_sql", "execute_sql")

    workflow.add_conditional_edges("execute_sql",handle_sql_error,
        {"synthesize_response": "synthesize_response","generate_sql": "generate_sql",END: END})
    workflow.add_edge("synthesize_response", END)

    app = workflow.compile()
    return app


if __name__ == "__main__":
    agent_app = create_sql_agent()
    
    questions = [
        "Please update draft_purchase_order the quantity_to_order for SKU0045 to 20 units. Also, remove SKU0082 from the order",
        #"i would like to update the inventory max capacity of SKU0020, SKU0021 and SKU0022 to 150",
        #"i would like to change the reorder threshold to 0 for SKU0021",
        #"show me all inventory thats stagnated",
    ]

    for question_text in questions:

        inputs = {"messages": [HumanMessage(content=question_text)], "retry_count": 0}
        
        print(f"\n\n RUNNING AGENT FOR: '{question_text}")
        
        final_state = None

        for event in agent_app.stream(inputs, {"recursion_limit": 10}):
            for key, value in event.items():
                print(f"--- (Event from Node: {key}) ---")
                # print(json.dumps(value, indent=3))
            final_state = list(event.values())[0]

        print(f"\n\n{'='*30}\nFINAL RESPONSE\n{'='*30}\n")
        if final_state and final_state.get("messages"):
            final_response_message = final_state["messages"][-1]
            print(final_response_message.content)