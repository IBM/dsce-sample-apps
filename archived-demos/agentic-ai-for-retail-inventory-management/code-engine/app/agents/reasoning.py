# app/agents/reasoning.py

def analyze_forecast(forecast_df):
    """
    Analyze forecasted data and return insights like trends, spikes, or warnings.
    """
    if forecast_df.empty:
        return ["No forecast data available."]

    trend = forecast_df['yhat'].diff().mean()

    insights = []

    if trend > 0:
        insights.append("Sales are expected to increase.")
    elif trend < 0:
        insights.append("Sales are expected to decline.")
    else:
        insights.append("Sales are expected to remain stable.")

    max_value = forecast_df['yhat'].max()
    min_value = forecast_df['yhat'].min()

    if max_value > 2 * min_value:
        insights.append("Significant peak expected in future sales.")

    return insights

