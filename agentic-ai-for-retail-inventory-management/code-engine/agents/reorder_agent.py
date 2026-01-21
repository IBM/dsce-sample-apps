import pulp
import uuid
import pandas as pd
from datetime import datetime, timedelta
from typing import TypedDict, List
from langchain_core.messages import BaseMessage, ToolMessage, HumanMessage, AIMessage, SystemMessage
from langchain.tools import tool
from langgraph.graph import StateGraph, END
import sqlite3
from agents.sql_agent import create_sql_agent, llm as shared_llm
import numpy as np
from agents.data_retriever import DataRetriever
from dotenv import load_dotenv
import os
from typing import Optional
import json
load_dotenv()
DB_PATH = os.getenv('DB_PATH','data/retail_analytics.db')
data_retriever = DataRetriever(db_path=DB_PATH)


sql_agent_app = create_sql_agent()


REORDER_AGENT_PROMPT_TEMPLATE = os.getenv(
    "REORDER_AGENT_PROMPT_TEMPLATE",
 """You are a supervisor agent for an inventory management system. Your job is to analyze the user's request and delegate it to the appropriate specialized tool based on the full conversation history.

**Core Workflow Tools:**
1.  `generate_purchase_order_recommendation`: Use this to create a NEW purchase order recommendations. This tool requires a budget and a strategy.
    - **Crucial Reasoning Step:** Your primary responsibility is to determine the correct strategy based on the user's request. You MUST use the list of available strategies below as your source of truth.
    - **Available Strategies:**
      {strategy_list}

    - **How to Choose:**
      - **If the user provides an exact strategy name** from the list (e.g., "use 'Peak Season Prep'"), pass that name directly.
      - **If the user describes a business goal or intent** (e.g., "help me stock up on seasonal items," "I need to be conservative with spending"), you MUST select the most appropriate strategy from the **Available Strategies list above**. Compare the user's goal to each strategy's description to find the best match.
        - *Example 1:* User says "help me stock up for the holidays." You should see that this aligns with the **'Peak Season Prep'** description and call the tool with `strategy='Peak Season Prep'`.
        - *Example 2:* User says "I have a very tight budget and need to save cash." You should see that this aligns with the **'Cash Preservation'** description and call the tool with `strategy='Cash Preservation'`.
      - **If the user's request is ambiguous** and does not clearly map to any strategy in the list, you can call the tool without the `strategy` argument, which will then prompt the user to choose.
2.  `confirm_and_submit_purchase_order`: Use this ONLY to finalize and submit the current order.
3.  `call_sql_agent`: Use this for database tasks...

**Strategy & Configuration Tools:**
4.  `get_strategy_configuration`: Use this when the user wants to see settings.
    - If the user asks for a SPECIFIC strategy (e.g., "what are the details for Peak Season Prep?"), provide its name to the `strategy_name` argument.
    - If the user asks a GENERAL question (e.g., "show me my settings"), call it without arguments.
5.  `modify_strategy_priority`: Use this when the user wants to change a priority...
6.  `modify_safety_stock`: Use this to change the safety stock percentage...
7.  `create_new_strategy`: Use this ONLY when the user explicitly asks to create a NEW strategy. You MUST ask the user for a name, a brief description, and priority values (1-10) for profit, service level, cost, and speed before calling this tool.
"""
)
# SQL_REORDER_AGENT_PROMPT_TEMPLATE = os.getenv(
#     "",
#     )

class StrategyConfigManager:
    """A singleton class to manage strategy configurations in-memory for the agent's session."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(StrategyConfigManager, cls).__new__(cls)
            # Initialize with default values
            cls._instance.strategy_presets = {
                'Balanced Profit': {'priorities': {'profit': 8, 'service_level': 6, 'cost_minimization': 5, 'delivery_speed': 3},'description': 'A well-rounded approach prioritizing profitability while maintaining good service levels and managing costs.'},
                'Peak Season Prep': {'priorities': {'service_level': 10, 'delivery_speed': 9, 'profit': 3, 'cost_minimization': 2},'description': 'Aggressively stocks up to prevent stockouts during high-demand periods, prioritizing service level and speed over cost.'},
                'Cash Preservation': {'priorities': {'cost_minimization': 10, 'profit': 4, 'service_level': 2, 'delivery_speed': 1},'description': 'Minimizes immediate spending by ordering only the most essential items, focusing on low costs and preserving capital.'},
                'Service Excellence': {'priorities': {'service_level': 10, 'profit': 8, 'delivery_speed': 6, 'cost_minimization': 3},'description': 'Focuses on maximizing customer satisfaction by maintaining high stock levels for all items, ensuring availability.'}
            }
            cls._instance.category_priorities = {
                'Top Sellers': 'High', 'Seasonal Items': 'High', 'New Arrivals': 'Medium', 'Other': 'Low'
            }
            cls._instance.service_levels = {
                'High':   {'safety_stock_factor': 0.50, 'penalty': 1000},
                'Medium': {'safety_stock_factor': 0.25, 'penalty': 100},
                'Low':    {'safety_stock_factor': 0.05, 'penalty': 10}
            }
        return cls._instance
    
    

    def get_all_settings_as_str(self) -> str:
        """Returns a formatted string of all current settings."""
        import json
        settings = {
            "Reordering Strategy Presets": self.strategy_presets,
            "Product Category Priority Levels": self.category_priorities,
            "Service Level Configuration (Safety Stock)": self.service_levels
        }
        return json.dumps(settings, indent=2)
    
    def get_strategy_details(self, strategy_name: str) -> dict:
        """Returns the details for a single strategy, or an error message."""
        if strategy_name in self.strategy_presets:
            return {strategy_name: self.strategy_presets[strategy_name]}
        else:
            return {"error": f"Strategy '{strategy_name}' not found."}

    def update_strategy_priority(self, strategy_name: str, priority: str, value: int) -> str:
        """Updates a single priority value for a given strategy."""
        if strategy_name not in self.strategy_presets:
            return f"Error: Strategy '{strategy_name}' not found."
        if priority not in self.strategy_presets[strategy_name]['priorities']:
            return f"Error: Priority '{priority}' not found for this strategy."
        self.strategy_presets[strategy_name]['priorities'][priority] = value
        return f"Success: Updated '{strategy_name}' strategy. '{priority}' is now set to {value}."

    def update_safety_stock_factor(self, priority_level: str, new_factor: float) -> str:
        """Updates the safety stock factor for a service level (High, Medium, Low)."""
        if priority_level not in self.service_levels:
            return f"Error: Priority level '{priority_level}' not found."
        self.service_levels[priority_level]['safety_stock_factor'] = new_factor
        return f"Success: Safety stock factor for '{priority_level}' priority items is now {new_factor:.2%}."

    def create_new_strategy(self, name: str, description: str, profit: int, service_level: int, cost: int, speed: int) -> str:
        """Creates a new reordering strategy preset."""
        if name in self.strategy_presets:
            return f"Error: A strategy named '{name}' already exists. Please choose a different name or edit the existing one."
        self.strategy_presets[name] = {
            'description': description,
            'priorities': {
                'profit': profit,
                'service_level': service_level,
                'cost_minimization': cost,
                'delivery_speed': speed
            }
        }
        return f"Success: New strategy '{name}' has been created."
    

# Create a single, globally accessible instance of the manager
config_manager = StrategyConfigManager()


def create_and_solve_reordering_model(
    data_retriever,
    priorities,
    category_priority_levels_config: dict, 
    service_level_config_map: dict,         
    budget=2000,
):
    """
    Creates and solves a more realistic reordering model incorporating:
    - Safety Stock based on category priority.
    - Reorder Thresholds to trigger ordering.
    - Clearer Target Inventory Level logic.
    """
    print('Generating a realistic recommendation...')

    supply_options = data_retriever.get_supplier_sku_data()
    sku_data = data_retriever.get_product_data()
    demand_forecast = data_retriever.get_forecast_data()
    skus = data_retriever.get_product_list()
    suppliers = list(set(key[1] for key in supply_options.keys()))

    w_profit = priorities.get('profit', 5)
    w_service_level = priorities.get('service_level', 5)
    w_delivery_speed = priorities.get('delivery_speed', 5)
    w_cost_minimization = priorities.get('cost_minimization', 5)

    safety_stock = {}
    target_inventory = {}
    category_penalties = {}
    
    print("\nCalculating Target Inventory Levels (Forecast + Safety Stock)...")
    for sku in skus:
        category = sku_data[sku].get('category', 'Other')
        priority = category_priority_levels_config.get(category, 'Low')
        config = service_level_config_map[priority]
        
        forecast = demand_forecast.get(sku, 0)
        
        # Safety Stock = Forecast * Safety Stock Factor for its priority
        safety_stock[sku] = forecast * config['safety_stock_factor']
        
        # Target Inventory = What we expect to sell + our safety buffer
        target_inventory[sku] = forecast + safety_stock[sku]
        
        # Penalty for not meeting demand (used in the objective function)
        category_penalties[sku] = config['penalty']
        
        # print(f"SKU: {sku}, Priority: {priority}, Forecast: {forecast}, Safety Stock: {safety_stock[sku]:.0f}, Target Inv: {target_inventory[sku]:.0f}")


    model = pulp.LpProblem("Realistic_Reordering_Optimization", pulp.LpMaximize)

    order_qty = pulp.LpVariable.dicts("OrderQty", ((s, sup) for s, sup in supply_options.keys()), lowBound=0, cat='Integer')

    inventory_shortfall = pulp.LpVariable.dicts("InventoryShortfall", skus, lowBound=0)
    
    is_ordered = pulp.LpVariable.dicts("IsOrdered", skus, cat='Binary')

    
    # Shortfall beyond the forecast is a service level issue, not lost revenue in this period.
    unmet_forecast_demand = pulp.LpVariable.dicts("UnmetForecastDemand", skus, lowBound=0)
    
    total_revenue = pulp.lpSum((demand_forecast[sku] - unmet_forecast_demand[sku]) * sku_data[sku]['selling_price'] for sku in skus)
    total_cost_of_goods = pulp.lpSum(order_qty[(s, sup)] * supply_options[(s, sup)]['cost'] for s, sup in supply_options.keys())
    
    # Penalty is now based on the total shortfall from our target inventory level.
    service_level_penalty = pulp.lpSum(inventory_shortfall[sku] * category_penalties[sku] for sku in skus)
    
    delivery_time_penalty = pulp.lpSum(
        order_qty[(s, sup)] * supply_options[(s, sup)]['lead_time']
        for s, sup in supply_options.keys()
    )

    model += (
        (w_profit * total_revenue) -
        (w_cost_minimization * total_cost_of_goods) -
        (w_service_level * service_level_penalty) -
        (w_delivery_speed * delivery_time_penalty)
    ), "Weighted_Objective_Function"

    # --- 6. Constraints ---
    model += total_cost_of_goods <= budget, "Budget_Constraint"

    # A very large number for "Big-M" constraints
    M = 100000 

    for sku in skus:
        total_ordered_for_sku = pulp.lpSum(order_qty.get((sku, sup), 0) for sup in suppliers if (sku, sup) in supply_options)
        
        # Final inventory (stock + ordered) should meet the target, or we acknowledge a shortfall.
        model += (sku_data[sku]['current_stock'] + total_ordered_for_sku + inventory_shortfall[sku] >= target_inventory[sku], 
                  f"Target_Inventory_Balance_for_{sku}")

        # Unmet demand is the part of the shortfall that eats into the actual forecast.
        model += (unmet_forecast_demand[sku] >= inventory_shortfall[sku] - safety_stock[sku], f"Unmet_Forecast_Calc_{sku}")

        # Capacity constraint remains the same
        model += sku_data[sku]['current_stock'] + total_ordered_for_sku <= sku_data[sku]['max_capacity'], f"Capacity_for_{sku}"


        if sku_data[sku]['current_stock'] > sku_data[sku]['reorder_threshold']:
             model += is_ordered[sku] == 0, f"Disable_Order_Above_Threshold_{sku}"
        
        # Link the decision to order (is_ordered) with the actual order quantity.
        # If is_ordered[sku] is 0, then total_ordered_for_sku must also be 0.
        # If is_ordered[sku] is 1, then total_ordered_for_sku can be up to M (a large number).
        model += total_ordered_for_sku <= M * is_ordered[sku], f"Link_Order_Trigger_{sku}"
        

    # --- 7. Solve and Report ---
    model.solve(pulp.PULP_CBC_CMD(msg=0))
    results = {
        'status': pulp.LpStatus[model.status],
        'priorities': priorities,
        'objective_value': None,
        'total_cost': 0,
        'reordering_plan': [],
        'tradeoffs_made (inventory_shortfall)': []
    }
    
    if pulp.LpStatus[model.status] == 'Optimal':
        results['objective_value'] = pulp.value(model.objective)
        results['total_cost'] = pulp.value(total_cost_of_goods)
        
        for s, sup in sorted(supply_options.keys()):
            if order_qty[(s, sup)].varValue > 0.1:
                results['reordering_plan'].append({
                    'sku_id': s,
                    'supplier': sup,
                    'quantity_to_order': int(order_qty[(s, sup)].varValue),
                    'cost': order_qty[(s, sup)].varValue * supply_options[(s, sup)]['cost'],
                    'lead_time': supply_options[(s, sup)]['lead_time']
                })
                
        for s in skus:
            if inventory_shortfall[s].varValue > 0.1:
                results['tradeoffs_made (inventory_shortfall)'].append({
                    'sku_id': s,
                    'category': sku_data[s]['category'],
                    'priority': category_priority_levels_config.get(sku_data[s]['category'], 'Low'),
                    'target_inventory': round(target_inventory[s], 2),
                    'final_inventory': round(sku_data[s]['current_stock'] + sum(order_qty.get((s, sup), 0).varValue for sup in suppliers if (s, sup) in supply_options), 2),
                    'units_of_shortfall': round(inventory_shortfall[s].varValue, 2)
                })

    # print(results)
    return results


def view_purchase_order_recommendations() -> str:
    conn = sqlite3.connect(DB_PATH)
    draft_df = pd.read_sql_query("SELECT sku_id, supplier_id, quantity_to_order, cost_per_unit, (quantity_to_order * cost_per_unit) as total_cost, lead_time FROM draft_purchase_order", conn)

    products_df = pd.read_sql_query("SELECT sku_id, product_name, product_category, category, current_stock, reorder_threshold,max_capacity FROM products", conn)

    demand_forecast_df = pd.read_sql_query("SELECT sku_id, MAX(total_forecasted_demand) AS forecast FROM out_of_stock GROUP BY sku_id;", conn)

    two_weeks_ago = (datetime.now() - timedelta(days=60)).strftime('%Y-%m-%d %H:%M:%S')
    sales_df = pd.read_sql_query( f"SELECT sku_id, sale_date, quantity FROM sales WHERE sale_date >= '{two_weeks_ago}'", conn, parse_dates=['sale_date'])

    last_week_start = datetime.now() - timedelta(days=30)

    sales_df['sales_last'] = sales_df.apply(
                lambda row: row['quantity'] if row['sale_date'] >= last_week_start else 0, axis=1
            )
    sales_df['sales_prev'] = sales_df.apply(
                lambda row: row['quantity'] if row['sale_date'] < last_week_start else 0, axis=1
            )
    
    sales_summary = sales_df.groupby('sku_id').agg(
                total_sales = ('quantity','sum'),
                total_sales_last=('sales_last', 'sum'),
                total_sales_prev=('sales_prev', 'sum')
            ).reset_index()
    
    sales_summary['trend(%)'] = np.where(sales_summary['total_sales_prev'] > 0,
                round(((sales_summary['total_sales_last'] - sales_summary['total_sales_prev']) / sales_summary['total_sales_prev']) * 100,1),100)
    sales_summary.drop(['total_sales_prev'],axis=1, inplace=True)

    enriched_df = pd.merge(draft_df, products_df, on='sku_id', how='left')
    enriched_df = pd.merge(enriched_df,demand_forecast_df, on ='sku_id',how='left')
    enriched_df = pd.merge(enriched_df, sales_summary.fillna(0), on='sku_id', how='left')#.fillna(0)
    enriched_df= enriched_df[['product_name','sku_id','supplier_id','product_category','forecast','quantity_to_order','current_stock','reorder_threshold','max_capacity','total_sales_last','trend(%)','cost_per_unit','total_cost','category']]

    markdown_table = enriched_df.to_markdown(index=False, floatfmt=".2f")
    return markdown_table

@tool
def get_strategy_configuration(strategy_name: Optional[str] = None) -> str:
    """
    Retrieves strategy and configuration settings.

    - If a specific `strategy_name` is provided, it will return the details for only that strategy.
    - If `strategy_name` is omitted, it will return ALL current settings for strategies, categories, and service levels.

    Use this when a user asks to see settings. Be sure to provide the strategy_name if they ask about a specific one.
    """
    if strategy_name:
        print(f"Fetching details for specific strategy: {strategy_name}")
        details = config_manager.get_strategy_details(strategy_name)
    else:
        print("Fetching all configuration settings.")
        # We reuse the existing method for the full dump
        return config_manager.get_all_settings_as_str()

    return json.dumps(details, indent=2)

@tool
def modify_strategy_priority(strategy_name: str, priority: str, new_value: int) -> str:
    """
    Modifies the priority value (e.g., 'profit', 'service_level') for an existing reordering strategy.

    Args:
        strategy_name (str): The exact name of the strategy to edit (e.g., 'Balanced Profit').
        priority (str): The priority to change. Must be one of 'profit', 'service_level', 'cost_minimization', 'delivery_speed'.
        new_value (int): The new priority value, typically from 1 to 10.
    """
    return config_manager.update_strategy_priority(strategy_name, priority, new_value)

@tool
def modify_safety_stock(priority_level: str, new_factor: float) -> str:
    """
    Adjusts the safety stock factor for a given priority level.

    Args:
        priority_level (str): The priority level to change. Must be one of 'High', 'Medium', or 'Low'.
        new_factor (float): The new safety stock factor as a decimal (e.g., 0.65 for 65%).
    """
    return config_manager.update_safety_stock_factor(priority_level, new_factor)

@tool
def create_new_strategy(strategy_name: str, description: str, profit: int, service_level: int, cost_minimization: int, delivery_speed: int) -> str:
    """
    Creates a completely new reordering strategy from scratch with specified priority values and a description.
    You must ask the user for a brief description of the new strategy's purpose.

    Args:
        strategy_name (str): The name for the new strategy.
        description (str): A brief explanation of what the strategy is for.
        profit (int): The priority value for profit (1-10).
        service_level (int): The priority value for service level (1-10).
        cost_minimization (int): The priority value for cost minimization (1-10).
        delivery_speed (int): The priority value for delivery speed (1-10).
    """
    return config_manager.create_new_strategy(strategy_name, description, profit, service_level, cost_minimization, delivery_speed)


@tool
def view_draft_purchase_order():
    """
    This shows you all details related to the currently drafted purchase order.
    """
    return view_purchase_order_recommendations()


@tool
def generate_purchase_order_recommendation(budget: float, strategy: Optional[str] = None) -> str:
    """
    Generates a new purchase order (PO) recommendation. This action CLEARS any existing draft PO.
    If no strategy is provided, it will list the available options for the user to choose from.

    Args:
        budget (float): The maximum budget for this purchase order.
        strategy (Optional[str]): The desired reordering strategy. If omitted, the agent will ask the user to select one.
    """
    # This is the key conversational change
    if not strategy or strategy not in config_manager.strategy_presets:
        strategy_options = []
        for name, config in config_manager.strategy_presets.items():
            strategy_options.append(f"- **{name}**: {config['description']}")
        
        formatted_options = "\n".join(strategy_options)
        
        return (
            "You need to select a valid strategy to generate a recommendation. Here are your options:\n"
            f"{formatted_options}\n\n"
            "Please choose one, or you can ask me to view the settings, edit a strategy, or create a new one."
        )
    
    print(f"Generating recommendation with '{strategy}' strategy and current settings...")
    
    # The tool now pulls the LATEST config from our manager
    plan = create_and_solve_reordering_model(
        data_retriever,
        config_manager.strategy_presets[strategy]['priorities'],
        config_manager.category_priorities,
        config_manager.service_levels,
        budget
    )
    print(plan)
    recommended_po = plan.get('reordering_plan', [])

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM draft_purchase_order;") # Clear previous draft
        for item in recommended_po:
            cost_per_unit = item['cost'] / item['quantity_to_order'] if item.get('quantity_to_order') else 0
            cursor.execute("INSERT INTO draft_purchase_order (sku_id, supplier_id, quantity_to_order, cost_per_unit, lead_time) VALUES (?, ?, ?, ?, ?)",
                           (item['sku_id'], item['supplier'], item['quantity_to_order'], cost_per_unit, item['lead_time']))
        conn.commit()

        markdown_table = view_purchase_order_recommendations()
    except Exception as e:
        return f"Database error: {e}"
    finally:
        if conn: conn.close()

    return (
        f"Generated PO recommendation with a '{strategy}' strategy and a budget of ${budget:,.2f}.\n"
        f"Total predicted cost: ${plan.get('total_cost', 0):,.2f}\n\n"
        "**Draft Purchase Order:**\n"
        f"{markdown_table}"
    )


@tool
def confirm_and_submit_purchase_order() -> str:
    """
    Confirms the current draft purchase order, saves it to the permanent 'reorders' table,
    and then clears the draft. This is a final action for the current PO.
    """
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT sku_id, supplier_id, quantity_to_order, cost_per_unit, lead_time FROM draft_purchase_order;")
        draft_items = cursor.fetchall()

        if not draft_items:
            return "There is no purchase order to confirm. Please generate one first."

        reorder_id = f"PO-{uuid.uuid4().hex[:8].upper()}"
        reorder_datetime_obj = datetime.now()
        reorder_date_str = reorder_datetime_obj.strftime("%Y-%m-%d %H:%M:%S")
        status = "Pending"

        for row in draft_items:
            sku_id, supplier_id, reorder_qty, price_per_unit, lead_time = row
            
            fulfilment_date_obj = reorder_datetime_obj + timedelta(days=lead_time)
            fulfilment_date_str = fulfilment_date_obj.strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute("""
                INSERT INTO reorders (reorder_id, sku_id,reorder_qty, reorder_date, status, supplier_id, price_per_unit, reorder_fulfilment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, ( reorder_id,  sku_id, reorder_qty, reorder_date_str, status, supplier_id, price_per_unit, fulfilment_date_str ))

        cursor.execute("DELETE FROM draft_purchase_order;")
        conn.commit()
        
        return f"Successfully submitted purchase order {reorder_id} with {len(draft_items)} items. The draft is now empty."
    
    except sqlite3.Error as e:
        conn.rollback()
        return f"An error occurred during submission: {e}"
    
    finally:
        if conn:
            conn.close()


@tool
def call_sql_agent(query: str) -> str:
    """
    Use this tool for any of the following tasks:
    - Modifying the current draft purchase order (e.g., "update the quantity", "remove an item").
    - Viewing the current state of the draft purchase order.
    - Answering general questions about products, stock, or inventory by querying the database.
    - Making changes to product metadata (e.g., "update the reorder threshold").

    Args:
        query (str): The user's natural language request to be sent to the SQL agent.
    """
    print(f"[Supervisor]: Delegating to SQL Agent with query: '{query}'---")
    
    sql_agent_inputs = {"messages": [HumanMessage(content=query)], "retry_count": 0}
    response_state = sql_agent_app.invoke(sql_agent_inputs)
    sql_agent_response = response_state['messages'][-1].content

    modification_keywords = ['update', 'change', 'modify', 'remove', 'delete', 'set']
    was_modification = any(keyword in query.lower() for keyword in modification_keywords)

    if was_modification:
        print("[Supervisor]: Modification detected. Fetching updated PO state.---")
        try:
            markdown_table = view_purchase_order_recommendations()
            return f"{sql_agent_response}\n\n**Updated Purchase Order:**\n{markdown_table}"
        
        except Exception as e:
            return f"{sql_agent_response}\n\nError fetching updated PO view: {e}"

    else:
        return sql_agent_response

tools = [
    generate_purchase_order_recommendation,
    confirm_and_submit_purchase_order,
    call_sql_agent,
    view_draft_purchase_order,
    # additional configuration tools

    get_strategy_configuration,
    modify_strategy_priority,
    modify_safety_stock,
    create_new_strategy,
]
llm_with_tools = shared_llm.bind_tools(tools)



class ReorderingAgentState(TypedDict):
    messages: List[BaseMessage]

def _get_formatted_strategy_list() -> str:
        """
        Retrieves strategy presets from the config manager and formats them into a markdown string
        """
        strategy_options = []
        for name, config in config_manager.strategy_presets.items():
            strategy_options.append(f"- **{name}**: {config['description']}")
        return "\n".join(strategy_options)




def supervisor_node(state: ReorderingAgentState):
    """
    The main node of the supervisor agent. It receives the user's request,
    decides which tool to use, and invokes the LLM to generate the tool call.
    """
    print("---[Supervisor]: Processing user request---")
    formatted_strategies = _get_formatted_strategy_list()
    final_prompt_content = REORDER_AGENT_PROMPT_TEMPLATE.format(strategy_list=formatted_strategies)
    messages_with_prompt = [SystemMessage(content=final_prompt_content)] + state["messages"]
    response = llm_with_tools.invoke(messages_with_prompt)
    return {"messages": [response]}

def tool_node(state: ReorderingAgentState):
    """
    Executes the tool call generated by the supervisor node.
    """
    print("---[Supervisor]: Executing tool---")
    last_message = state["messages"][-1]
    if not last_message.tool_calls:
        return {"messages": [last_message]}
    
    tool_messages = []
    for tool_call in last_message.tool_calls:
        tool_name = tool_call['name']
        print(f" -> Calling tool: {tool_name}")
        
        selected_tool = next((t for t in tools if t.name == tool_name), None)
        if not selected_tool:
            raise ValueError(f"Tool '{tool_name}' not found.")

        
        observation = selected_tool.invoke(tool_call['args'])
        tool_messages.append(ToolMessage(content=str(observation), tool_call_id=tool_call['id']))
        
    return {"messages": tool_messages}


def create_reorder_agent():
    workflow = StateGraph(ReorderingAgentState)
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("tools", tool_node)
    workflow.set_entry_point("supervisor")
    workflow.add_edge("supervisor", "tools")
    workflow.add_edge("tools", END)
    app = workflow.compile()
    return app

if __name__ == "__main__":

    app = create_reorder_agent()

    questions = []
    questions = ["can i see all inventory under the reorder threshold in a table",
    "Can you generate a purchase order recommendation for me? Let's use the 'Balanced Profit' strategy with a budget of $20,000.",
    "Okay, let's make some changes. Please update the quantity for SKU0045 to 20 units. Also, remove SKU0082 from the order",
    "Okay, can you submit the purchase order"]

    print("Welcome to the Inventory Reordering Supervisor Agent!")
    state = {"messages": []}

    #while True:
    for question in questions:
        #user_input = input("\nUser > ")
        user_input = question
        print('User Question: ', user_input)
        if user_input.lower() in ["quit", "exit"]: break
        
        state["messages"].append(HumanMessage(content=user_input))
        
        final_state = app.invoke(state)
        
        final_response_message = final_state['messages'][-1]
        print(f"\nAgent > {final_response_message.content}")

        state['messages'].extend(final_state['messages'])