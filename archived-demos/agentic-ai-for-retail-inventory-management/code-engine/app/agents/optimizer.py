# app/agents/optimizer.py

import pandas as pd
from pulp import LpProblem, LpVariable, lpSum, LpInteger, LpMaximize, PulpError

def optimize_reorder_plan(forecast_df: pd.DataFrame, budget: float = 50000.0, objective: str = "Maximize demand"):
    try:
        prob = LpProblem("ReorderOptimization", LpMaximize)

        reorder_vars = {
            row["sku"]: LpVariable(f"reorder_{row['sku']}", lowBound=row["min_qty"], cat=LpInteger)
            for _, row in forecast_df.iterrows()
        }

        if objective == "Maximize demand":
            prob += lpSum([
                row["yhat"] * reorder_vars[row["sku"]]
                for _, row in forecast_df.iterrows()
            ])
        elif objective == "Fair allocation":
            prob += lpSum([
                (row["yhat"] * (1 + row["stockout_risk"])) * reorder_vars[row["sku"]]
                for _, row in forecast_df.iterrows()
            ])

        prob += lpSum([
            row["unit_cost"] * reorder_vars[row["sku"]]
            for _, row in forecast_df.iterrows()
        ]) <= budget

        prob.solve()

        optimized_data = []
        for _, row in forecast_df.iterrows():
            sku = row["sku"]
            qty = int(reorder_vars[sku].varValue)
            cost = qty * row["unit_cost"]
            optimized_data.append({
                "sku": sku,
                "forecast": row["yhat"],
                "unit_cost": row["unit_cost"],
                "stockout_risk": row["stockout_risk"],
                "min_qty": row["min_qty"],
                "reorder_qty": qty,
                "reorder_cost": cost
            })

        return pd.DataFrame(optimized_data)

    except PulpError as e:
        raise RuntimeError(f"Optimization failed: {e}")

