import csv

from src.core.sql import SQL
from config.app_config import AppConfig

app_config = AppConfig()

# Path to your CSV file
CSV_FILE_PATH = app_config.CSV_FILE_PATH

# Initialize database connection
db = SQL()

def insert_data_from_csv(csv_file):
    with open(csv_file, newline='', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)

        # Fix headers if BOM is present
        reader.fieldnames = [name.lstrip('\ufeff') for name in reader.fieldnames]

        for row in reader:
            db.create(
                security_name=row["security_name"].strip(),
                market_value_usd=int(row["market_value_usd"].strip()),
                y2y_percent=int(row["y2y_percent"].strip()),
                industry_sector=row["industry_sector"].strip(),
                username=row["username"].strip()
            )

insert_data_from_csv(CSV_FILE_PATH)
db.close()
print("Data successfully inserted into market_data table.")
