import logging
import json
import sqlite3
import os

logging.basicConfig(level=os.getenv('LOG_LEVEL', 'ERROR'))
logger = logging.getLogger(__name__)

class SQL:
    def __init__(self):
        self.conn = sqlite3.connect('db/portfolio.db')
        self.cursor = self.conn.cursor()
        self.create_table()

    def create_table(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS market_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                security_name TEXT NOT NULL,
                market_value_usd INTEGER NOT NULL,
                y2y_percent INTEGER NOT NULL,
                industry_sector TEXT NOT NULL,
                username TEXT NOT NULL
            )
        ''')
        self.conn.commit()

    def create(self, security_name: str, market_value_usd: int, y2y_percent: int, industry_sector: str, username: str):
        self.cursor.execute(
            "INSERT INTO market_data (security_name, market_value_usd, y2y_percent, industry_sector, username) VALUES (?, ?, ?, ?, ?)", 
            (security_name, market_value_usd, y2y_percent, industry_sector, username)
        )
        self.conn.commit()

    def read(self, id: int):
        self.cursor.execute("SELECT * FROM market_data WHERE id=?", (id,))
        return self.cursor.fetchone()   
    
    def read_by_username(self, username: str):
        self.cursor.execute("SELECT * FROM market_data WHERE username=?", (username,))
        return self.cursor.fetchall()
    
    def read_all(self):
        self.cursor.execute("SELECT * FROM market_data")
        return self.cursor.fetchall()

    def update(self, id: int, security_name: str, market_value_usd: int, y2y_percent: int, industry_sector: str, username: str):
        self.cursor.execute(
            "UPDATE market_data SET security_name=?, market_value_usd=?, y2y_percent=?, industry_sector=?, username=? WHERE id=?", 
            (security_name, market_value_usd, y2y_percent, industry_sector, username, id)
        )
        self.conn.commit()

    def delete(self, id: int):
        self.cursor.execute("DELETE FROM market_data WHERE id=?", (id,))
        self.conn.commit()  

    def close(self):
        self.conn.close()