import math
import pandas as pd

def check_oos_with_forecast(inventory_df, forecast_df, horizon=7, today=None):
    if today is None:
        today = pd.to_datetime(inventory_df['date']).max()
    
    # Sum forecasted sales over horizon
    forecast_sum = (
        forecast_df
        .groupby(['sku_id', 'store_id'])['forecasted_sales']
        .sum()
        .reset_index()
        .rename(columns={'forecasted_sales': 'total_forecasted_demand'})
    )
    
    df = inventory_df.merge(forecast_sum, on=['sku_id', 'store_id'], how='left')
    df['total_forecasted_demand'] = df['total_forecasted_demand'].fillna(0)
    df['avg_daily_forecast'] = df['total_forecasted_demand'] / horizon
    
    # OOS flags
    df['already_oos'] = (df['current_stock'] == 0) & (df['total_forecasted_demand'] > 0)
    df['below_reorder_threshold'] = df['current_stock'] <= df['reorder_threshold']
    df['will_go_oos'] = (df['current_stock'] < df['total_forecasted_demand']) & ~df['already_oos']
    
    # Days until OOS
    def safe_days_until_oos(row):
        if row['already_oos']:
            return 0
        if row['avg_daily_forecast'] <= 0:
            return horizon
        days = row['current_stock'] / row['avg_daily_forecast']
        return math.ceil(days) if days > 0 and days != float('inf') else 0
    
    df['days_until_oos'] = df.apply(safe_days_until_oos, axis=1)
    df['oos_date'] = pd.to_datetime(today) + pd.to_timedelta(df['days_until_oos'], unit='D')
    
    # Risk flags
    df['oos_before_restock'] = (
        pd.notnull(df['next_restock_date']) &
        (df['oos_date'] < pd.to_datetime(df['next_restock_date']))
    )
    df['urgent_reorder'] = df['days_until_oos'] < df['lead_time_days']
    
    # Financials
    df['margin_per_unit'] = df['current_selling_price'] - df['cost_price']
    df['lost_sales_value'] = df.apply(
        lambda row: row['avg_daily_forecast'] * row['current_selling_price'] * horizon
        if row['already_oos'] else 0,
        axis=1
    )
    
    # Priority score (0–100 scale)
    def calc_priority(row):
        base = 0
        # Urgency
        if row['already_oos']:
            base += 50
        elif row['urgent_reorder']:
            base += 30
        elif row['will_go_oos']:
            base += max(0, 20 - row['days_until_oos'])  # closer days = higher score
        
        # Impact
        demand_weight = min(20, row['total_forecasted_demand'])  # cap
        margin_weight = min(20, row['margin_per_unit'] * row['total_forecasted_demand'] / 100)  # scaled
        loss_weight = min(10, row['lost_sales_value'] / 1000)  # scaled
        
        return min(100, base + demand_weight + margin_weight + loss_weight)
    
    df['priority_score'] = df.apply(calc_priority, axis=1)
    
    return df[['sku_id','store_id','date','current_stock','total_forecasted_demand',
               'already_oos','below_reorder_threshold','will_go_oos','days_until_oos',
               'oos_date','oos_before_restock','urgent_reorder','lost_sales_value',
               'priority_score']].sort_values('priority_score', ascending=False)

def generate_binary_labels(inventory_df, sales_df, horizon=7):
    labels = []
    for _, row in inventory_df.iterrows():
        sku, store, date, stock = row['sku_id'], row['store_id'], pd.to_datetime(row['date']), row['current_stock']
        
        # Look ahead horizon days
        future_sales = sales_df[
            (sales_df['sku_id'] == sku) &
            (sales_df['store_id'] == store) &
            (pd.to_datetime(sales_df['date']) > date) &
            (pd.to_datetime(sales_df['date']) <= date + pd.Timedelta(days=horizon))
        ]['quantity'].sum()
        
        if stock == 0 or (stock - future_sales <= 0):
            labels.append(1)  # OOS risk
        else:
            labels.append(0)  # Safe
    inventory_df['oos_label'] = labels
    return inventory_df

def build_features(df, horizon=7):
    df = df.copy()
    df['margin'] = df['current_selling_price'] - df['cost_price']
    df['days_since_last_restock'] = (pd.to_datetime(df['date']) - pd.to_datetime(df['last_restock_date'])).dt.days
    df['days_until_next_restock'] = (pd.to_datetime(df['next_restock_date']) - pd.to_datetime(df['date'])).dt.days
    
    feature_cols = [
        'current_stock', 'reorder_threshold', 'lead_time_days',
        'margin', 'cost_price', 'current_selling_price',
        'days_since_last_restock', 'days_until_next_restock'
    ]
    return df[feature_cols], df['oos_label']


