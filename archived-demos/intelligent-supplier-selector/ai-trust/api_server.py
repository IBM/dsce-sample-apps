"""
AI Guardrails REST API Server
Provides programmatic access to IBM watsonx.governance guardrail metrics
"""

import json
import os
import sys
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Add parent directory to path to import from app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import from the app module
from app import get_available_metrics, initialize_evaluator

load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Enable CORS for all routes, allowing requests from localhost:3000 and deployed endpoint
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://application-b6.23pfqhhem089.us-south.codeengine.appdomain.cloud",
            "https://dsce-prod-ce-wtx-smart-supplier-selection.1op8ay1afyb7.us-south.codeengine.appdomain.cloud"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Get all available metrics
ALL_METRICS = get_available_metrics()


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return (
        jsonify(
            {
                "status": "healthy",
                "service": "AI Guardrails API",
                "timestamp": datetime.now().isoformat(),
            }
        ),
        200,
    )


@app.route("/api/metrics", methods=["GET"])
def list_metrics():
    """List all available metrics"""
    metrics_list = []
    for name, config in ALL_METRICS.items():
        metrics_list.append(
            {
                "name": name,
                "category": config.get("category", "unknown"),
                "description": config.get("description", ""),
            }
        )

    # Group by category
    by_category = {}
    for metric in metrics_list:
        category = metric["category"]
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(metric)

    return (
        jsonify(
            {
                "metrics": metrics_list,
                "by_category": by_category,
                "total": len(metrics_list),
            }
        ),
        200,
    )


@app.route("/api/evaluate", methods=["POST"])
def evaluate_text():
    """
    Evaluate text with specified guardrail metrics.

    Request body:
    {
        "input_text": "User question or input",  # required
        "generated_text": "AI-generated response to evaluate",  # optional
        "context": "Additional context",  # optional
        "table_data": "JSON table data for narrative quality evaluation",  # optional
        "interaction_id": "Unique interaction identifier",  # optional
        "metrics": ["PII Detection", "Harm Detection"],  # optional, defaults to all
    }
    """
    try:
        # Parse request body
        data = request.get_json()

        if not data:
            return jsonify({"error": "Request body is required"}), 400

        input_text = data.get("input_text", "")
        generated_text = data.get("generated_text", "")
        context = data.get("context", "")
        table_data = data.get("table_data", "")
        interaction_id = data.get("interaction_id", "")
        requested_metrics = data.get("metrics", list(ALL_METRICS.keys()))

        if not input_text:
            return jsonify({"error": "input_text is required"}), 400

        # Validate requested metrics
        invalid_metrics = [m for m in requested_metrics if m not in ALL_METRICS]
        if invalid_metrics:
            return (
                jsonify(
                    {
                        "error": f"Invalid metrics: {invalid_metrics}",
                        "available_metrics": list(ALL_METRICS.keys()),
                    }
                ),
                400,
            )

        # Initialize evaluator
        evaluator = initialize_evaluator()
        if not evaluator:
            return (
                jsonify(
                    {"error": "Failed to initialize evaluator. Check credentials."}
                ),
                500,
            )

        # Prepare evaluation data
        eval_data = {
            "record_id": ["eval_1"],
            "input_text": [input_text],
            "generated_text": [generated_text],
        }
        if context:
            eval_data["context"] = [context]
        if table_data:
            eval_data["table_data"] = [table_data]

        eval_df = pd.DataFrame(eval_data)

        # Select metrics to evaluate
        metrics_to_evaluate = [ALL_METRICS[m]["metric"] for m in requested_metrics]

        # Run evaluation
        result = evaluator.evaluate(data=eval_df, metrics=metrics_to_evaluate)
        results_df = result.to_df()

        # Format results - use column_name from metrics config
        formatted_results = {}
        for metric_name in requested_metrics:
            column_name = ALL_METRICS[metric_name].get(
                "column_name", metric_name.lower().replace(" ", "_")
            )

            # Try to find the column in results
            matching_col = None
            for col in results_df.columns:
                if (
                    column_name in col
                    or metric_name.lower().replace(" ", "_") in col.lower()
                ):
                    matching_col = col
                    break

            if matching_col and matching_col in results_df.columns:
                score = results_df[matching_col].iloc[0]
                score_value = float(score) if pd.notna(score) else 0.0
                category = ALL_METRICS[metric_name]["category"]

                # Default threshold based on category (matching UI logic)
                if category == "rag":
                    threshold = 0.1
                elif category == "quality":
                    threshold = 0.5
                else:  # safety
                    threshold = 0.65

                # Determine guardrail action based on category (matching UI logic)
                if category == "rag":
                    # RAG metrics: low score = high risk
                    is_high_risk = score_value <= threshold
                    guardrail_action = "Block" if is_high_risk else "Pass"
                elif category == "quality":
                    # Quality metrics have different logic based on specific metric
                    metric_name_lower = metric_name.lower()
                    if "unsuccessful" in metric_name_lower:
                        # Unsuccessful Requests: high score = high risk, but no blocking
                        guardrail_action = "Pass"
                    elif "content length" in metric_name_lower:
                        # Content Length: high score = high risk
                        is_high_risk = score_value >= threshold
                        guardrail_action = "Block" if is_high_risk else "Pass"
                    else:
                        # Answer Completeness, Conciseness, Helpfulness, Narrative Quality: low score = high risk
                        is_high_risk = score_value <= threshold
                        guardrail_action = "Block" if is_high_risk else "Pass"
                else:  # safety
                    # Safety metrics: high score = high risk
                    is_high_risk = score_value >= threshold
                    guardrail_action = "Block" if is_high_risk else "Pass"

                formatted_results[metric_name] = {
                    "score": score_value,
                    "passed": not is_high_risk if category != "quality" or "unsuccessful" not in metric_name_lower else bool(score_value < 0.5),
                    "category": category,
                    "column": matching_col,
                    "guardrail_action": guardrail_action,
                }
            else:
                # Metric was requested but not found in results
                formatted_results[metric_name] = {
                    "score": None,
                    "passed": None,
                    "category": ALL_METRICS[metric_name]["category"],
                    "error": "Metric evaluation failed or column not found in results",
                }

        return (
            jsonify(
                {
                    "status": "success",
                    "interaction_id": interaction_id if interaction_id else "",
                    "results": formatted_results,
                    "input": {
                        "input_text": input_text,
                        "generated_text": generated_text,
                        "context": context if context else None,
                        "table_data": table_data if table_data else None,
                        "interaction_id": interaction_id if interaction_id else "",
                        "metrics_evaluated": requested_metrics,
                    },
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            200,
        )

    except Exception as e:
        import traceback

        return (
            jsonify(
                {
                    "status": "error",
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            500,
        )


@app.route("/api/evaluate/batch", methods=["POST"])
def evaluate_batch():
    """
    Evaluate multiple texts in batch.

    Request body:
    {
        "items": [
            {
                "input_text": "Question 1",
                "generated_text": "Response 1",
                "context": "Context 1",  # optional
                "table_data": "JSON table 1",  # optional
                "interaction_id": "interaction-123"  # optional
            },
            ...
        ],
        "metrics": ["PII Detection", "Harm Detection"]  # optional
    }
    """
    try:
        data = request.get_json()

        if not data or "items" not in data:
            return (
                jsonify({"error": "Request body with 'items' array is required"}),
                400,
            )

        items = data.get("items", [])
        requested_metrics = data.get("metrics", list(ALL_METRICS.keys()))

        if not items:
            return jsonify({"error": "At least one item is required"}), 400

        # Validate requested metrics
        invalid_metrics = [m for m in requested_metrics if m not in ALL_METRICS]
        if invalid_metrics:
            return (
                jsonify(
                    {
                        "error": f"Invalid metrics: {invalid_metrics}",
                        "available_metrics": list(ALL_METRICS.keys()),
                    }
                ),
                400,
            )

        # Initialize evaluator
        evaluator = initialize_evaluator()
        if not evaluator:
            return (
                jsonify(
                    {"error": "Failed to initialize evaluator. Check credentials."}
                ),
                500,
            )

        # Prepare evaluation data
        eval_data = {
            "record_id": [f"eval_{i+1}" for i in range(len(items))],
            "input_text": [item.get("input_text", "") for item in items],
            "generated_text": [item.get("generated_text", "") for item in items],
        }

        # Add context if any item has it
        if any("context" in item for item in items):
            eval_data["context"] = [item.get("context", "") for item in items]

        # Add table_data if any item has it
        if any("table_data" in item for item in items):
            eval_data["table_data"] = [item.get("table_data", "") for item in items]

        eval_df = pd.DataFrame(eval_data)

        # Select metrics to evaluate
        metrics_to_evaluate = [ALL_METRICS[m]["metric"] for m in requested_metrics]

        # Run evaluation
        result = evaluator.evaluate(data=eval_df, metrics=metrics_to_evaluate)
        results_df = result.to_df()

        # Format results for each item
        batch_results = []
        for i in range(len(items)):
            item_results = {}
            for metric_name in requested_metrics:
                column_name = ALL_METRICS[metric_name].get(
                    "column_name", metric_name.lower().replace(" ", "_")
                )

                # Try to find the column in results
                matching_col = None
                for col in results_df.columns:
                    if (
                        column_name in col
                        or metric_name.lower().replace(" ", "_") in col.lower()
                    ):
                        matching_col = col
                        break

                if matching_col and matching_col in results_df.columns:
                    score = results_df[matching_col].iloc[i]
                    score_value = float(score) if pd.notna(score) else 0.0
                    category = ALL_METRICS[metric_name]["category"]

                    # Default threshold based on category (matching UI logic)
                    if category == "rag":
                        threshold = 0.1
                    elif category == "quality":
                        threshold = 0.5
                    else:  # safety
                        threshold = 0.65

                    # Determine guardrail action based on category (matching UI logic)
                    if category == "rag":
                        # RAG metrics: low score = high risk
                        is_high_risk = score_value <= threshold
                        guardrail_action = "Block" if is_high_risk else "Pass"
                    elif category == "quality":
                        # Quality metrics have different logic based on specific metric
                        metric_name_lower = metric_name.lower()
                        if "unsuccessful" in metric_name_lower:
                            # Unsuccessful Requests: high score = high risk, but no blocking
                            guardrail_action = "Pass"
                        elif "content length" in metric_name_lower:
                            # Content Length: high score = high risk
                            is_high_risk = score_value >= threshold
                            guardrail_action = "Block" if is_high_risk else "Pass"
                        else:
                            # Answer Completeness, Conciseness, Helpfulness, Narrative Quality: low score = high risk
                            is_high_risk = score_value <= threshold
                            guardrail_action = "Block" if is_high_risk else "Pass"
                    else:  # safety
                        # Safety metrics: high score = high risk
                        is_high_risk = score_value >= threshold
                        guardrail_action = "Block" if is_high_risk else "Pass"

                    item_results[metric_name] = {
                        "score": score_value,
                        "passed": not is_high_risk if category != "quality" or "unsuccessful" not in metric_name_lower else bool(score_value < 0.5),
                        "category": category,
                        "guardrail_action": guardrail_action,
                    }

            batch_results.append(
                {
                    "record_id": f"eval_{i+1}",
                    "interaction_id": items[i].get("interaction_id", ""),
                    "input": items[i],
                    "results": item_results,
                }
            )

        return (
            jsonify(
                {
                    "status": "success",
                    "batch_results": batch_results,
                    "total_items": len(items),
                    "metrics_evaluated": requested_metrics,
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            200,
        )

    except Exception as e:
        import traceback

        return (
            jsonify(
                {
                    "status": "error",
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            500,
        )


if __name__ == "__main__":
    SERVICE_PORT = int(os.getenv("SERVICE_PORT", os.getenv("PORT", "8090")))
    DEBUG_MODE = os.getenv("DEBUG_MODE", "False").lower() == "true"

    print(f"Starting AI Guardrails API Server on port {SERVICE_PORT}")
    print(f"Available metrics: {len(ALL_METRICS)}")
    print(f"Debug mode: {DEBUG_MODE}")

    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE)
