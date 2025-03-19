from src.core.sql import SQL  # Assuming the SQL class is in sql_class.py
import pandas as pd

# Initialize database connection
db = SQL()

def view_data_for_user(username="John"):
    data = db.read_by_username(username)
    if not data:
        print("No data found in market_data table.")
        return
    
    data_without_username = [row[:-1] for row in data]
    df = pd.DataFrame(data_without_username, columns=['ID', 'Security Name', 'Market Value (USD)', 'Y2Y %', 'Industry Sector'])
    print(df.to_markdown(index=False))

view_data_for_user(username="John D")
db.close()