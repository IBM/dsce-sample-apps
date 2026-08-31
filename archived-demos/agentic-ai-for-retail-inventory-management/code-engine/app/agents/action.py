class ActionAgent:
    def run(self, reasoning_result):
        if reasoning_result["risk"] == "high":
            reorder_qty = int(reasoning_result["projected_stockout"] + 20)
            return {"action": "reorder", "quantity": reorder_qty}
        return {"action": "no_action"}

