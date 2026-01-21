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
from services.presto import DatabaseManagerPresto
import json
def load_json(path):
    with open(path, 'r', encoding='utf-8') as fp:
        return json.load(fp)


load_dotenv(dotenv_path="../.env")


from langchain_community.utilities.sql_database import SQLDatabase

class PrestoSQLDatabase(SQLDatabase):
    def __init__(self, db_manager: DatabaseManagerPresto):
        self.db_manager = db_manager
    
    def run(self, query: str):
        return self.db_manager.execute_query(query)




DB=DatabaseManagerPresto()
DB_INFO_PATH=os.getenv("SCHEMA_PATH","presto_data_dictionary.json")
# Wrap your custom DB
db = PrestoSQLDatabase(DB)

custom_table_info_dict = load_json(DB_INFO_PATH)
MAX_RETRIES = os.getenv('MAX_RETRIES',3)
SQL_PROMPT_TEMPLATE = os.getenv(
    "SQL_AGENT_PROMPT_TEMPLATE",
    """You are an expert SQL assistant for answering queries for a loan processing agent
Given a user's question, you must generate syntactically correct SQL queries for a Presto datalakehiuse
Only return the SQL query and nothing else. Do not include ```sql or any explanations.
Make sure you explicity convert date fields into date, even if they are date.
All date columns are VARCHAR.
Never use date(column) or CAST(column AS DATE).
Always use try(date_parse(column, '<correct_format>')) when filtering or ordering by dates in Presto.
**Rules for generating the query:**
1.  If a user requests multiple changes (e.g., "update X and remove Y"), you **MUST** generate multiple SQL statements separated by a semicolon (;).
2.  Do not generate queries that require you to have forecasting properties
3.  For questions asking to "show", "list", "find", "get", or "what is", generate a `SELECT` query.
4.  For questions asking to "update", "change", or "modify", generate an `UPDATE` query.
5.  For questions asking to "remove" or "delete", generate a `DELETE` query.
8.  Unless the user specifies a number, limit `SELECT` results to {top_k}.
9. It is important to include {catalog} and {presto_db_schema} in the query

Sample query : 'Select * from catalog.preston_db_schema.table_name'

**Database Schema:**
{schema}

**User Question:**
{question}
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
- If the query was to find data (a SELECT query), summarize the results in a readable format (like a list).
- If the query was to update data (an UPDATE query), simply confirm that the action was completed successfully.
- Do not mention SQL, databases, or columns unless the user's question was about them.
- Your entire response must be in English.
"""
)



parameters = {
        "frequency_penalty": 0,
        "max_tokens": 2000,
        "presence_penalty": 0,
        "temperature": 0,
        "top_p": 1
    }
llm = ChatWatsonx(
        #model_id="meta-llama/llama-3-3-70b-instruct", # 
        model_id= os.getenv('WATSONX_MODEL_ID',"openai/gpt-oss-120b"),
        #model_id= "meta-llama/llama-4-maverick-17b-128e-instruct-fp8",
        url=os.getenv("WATSONX_URL"),
        project_id=os.getenv("WATSONX_PROJECT_ID"),
        apikey=os.getenv("WATSONX_API_KEY"),
        params=parameters
    )

# query_tool = QuerySQLDataBaseTool(db=DB)

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
        "schema": custom_table_info_dict,
        "top_k": 10,
        "additional_context": additional_context_content,
        "catalog":os.getenv("PRESTO_CATALOG"),
        "presto_db_schema": os.getenv("PRESTO_SCHEMA")

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
            result = DB.execute_query(stmt)
            print("169",type(result))
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
        "Give me details of branch id : B005"
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
