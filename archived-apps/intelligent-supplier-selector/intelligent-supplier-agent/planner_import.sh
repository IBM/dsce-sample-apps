#!/usr/bin/env bash
set -e

# Import planner tools
# Data retrieval tools
orchestrate tools import -k python -f tools/get_country_risk_levels.py -r tools/requirements.txt -p tools/
orchestrate tools import -k python -f tools/get_item_code_catalog.py -r tools/requirements.txt -p tools/
orchestrate tools import -k python -f tools/get_supplier_names.py -r tools/requirements.txt -p tools/
orchestrate tools import -k python -f tools/get_supplier_countries.py -r tools/requirements.txt -p tools/
orchestrate tools import -k python -f tools/get_supplier_delivery_days.py -r tools/requirements.txt -p tools/
orchestrate tools import -k python -f tools/get_suppliers_by_item_type.py -r tools/requirements.txt -p tools/
orchestrate tools import -k python -f tools/get_supplier_details.py -r tools/requirements.txt -p tools/
orchestrate tools import -k python -f tools/get_supplier_risk_data.py -r tools/requirements.txt -p tools/
orchestrate tools import -k python -f tools/get_supplier_trade_stats.py -r tools/requirements.txt -p tools/
orchestrate tools import -k python -f tools/get_brazil_coffee_market_info.py -r tools/requirements.txt -p tools/

# Filtering and formatting tools
orchestrate tools import -k python -f tools/filter_data.py -r tools/requirements.txt -p tools/
# orchestrate tools import -k python -f tools/format_supply_insights_results.py -r tools/requirements.txt -p tools/
orchestrate agents remove --name Demo_101_Supplier_Performance_Agent_planner --kind native
orchestrate agents remove --name Demo_101_Item_Code_Catalog_Agent_planner --kind native
orchestrate agents remove --name Demo_101_Country_Risk_Agent_planner --kind native
orchestrate agents remove --name Demo_101_Product_Supplier_Info_Agent_planner --kind native
orchestrate agents remove --name Demo_101_Brazil_Coffee_Market_Agent_planner --kind native

orchestrate agents import -f agents/Brazil_Coffee_Market_Agent.yaml
# Import planner domain agents
orchestrate agents import -f agents/Supplier_Performance_Agent.yaml
orchestrate agents import -f agents/Product_Supplier_Info_Agent.yaml
orchestrate agents import -f agents/Item_Code_Catalog_Agent.yaml
orchestrate agents import -f agents/Country_Risk_Agent.yaml

# Import the main planner that collaborates with the domain agents
orchestrate agents import -f agents/Planner_Supply_Insights.yaml

echo "Planner tools and agents imported."
