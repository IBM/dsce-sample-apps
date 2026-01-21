
from langchain_community.utilities import SQLDatabase
import os
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import text
class DataRetriever:
    """
    A class to retrieve and process data from the retail database
    for an optimization model.
    """
    def __init__(self, db_path: str):
        """
        Initializes the DataRetriever with a path to the SQLite database.
        
        Args:
            db_path (str): The file path to the SQLite database.
        """
        if not os.path.exists(db_path):
            raise FileNotFoundError(f"Database file not found at: {db_path}")
        
        self.db = SQLDatabase.from_uri(f"sqlite:///{db_path}")
        self.engine = self.db._engine

    def _execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> List[Tuple]:
        """
        A private helper method to execute a given SQL query safely.

        Args:
            query (str): The SQL query to execute.
            params (dict, optional): Parameters to bind to the query. Defaults to None.

        Returns:
            List[Tuple]: A list of result rows.
        """
        with self.engine.connect() as connection:
            result_proxy = connection.execute(text(query), params or {})
            return result_proxy.all()

    def _build_sku_filter_clause(self, sku_list: Optional[List[str]]) -> Tuple[str, Dict]:
        """
        Builds a SQL WHERE clause and parameters for SKU filtering.

        Args:
            sku_list (list, optional): A list of SKU IDs to filter by.

        Returns:
            Tuple[str, Dict]: A tuple containing the WHERE clause string and the
                             parameters dictionary for SQLAlchemy.
        """
        if not sku_list:
            return "", {}
        
        param_names = [f"sku_{i}" for i in range(len(sku_list))]
        where_clause = f"WHERE sku_id IN ({', '.join(':' + p for p in param_names)})"
        params = dict(zip(param_names, sku_list))
        return where_clause, params

    def get_supplier_sku_data(self, sku_list: Optional[List[str]] = None) -> Dict[Tuple[str, str], Dict]:
        """
        Retrieves supplier-sku cost and lead time data.

        Args:
            sku_list (list, optional): If provided, retrieves data only for these SKUs.

        Returns:
            Dict: {(sku_id, supplier_id): {'cost': cost, 'lead_time': lead_time}}
        """
        print("Fetching supplier SKU data...")
        where_clause, params = self._build_sku_filter_clause(sku_list)
        query = f"""
            SELECT sku_id, supplier_id, min_price, lead_time_days 
            FROM supplier_skus
            {where_clause}
        """
        
        raw_data = self._execute_query(query, params)
        
        return {
            (row[0], row[1]): {'cost': row[2], 'lead_time': row[3]}
            for row in raw_data
        }

    def get_product_data(self, sku_list: Optional[List[str]] = None) -> Dict[str, Dict]:
        """
        Retrieves product-level data like category, stock, and capacity.
        
        Args:
            sku_list (list, optional): If provided, retrieves data only for these SKUs.

        Returns:
            Dict: {sku_id: {'product_category': ..., 'current_stock': ...}}
        """
        print("Fetching product data...")
        where_clause, params = self._build_sku_filter_clause(sku_list)
        query = f"""
            SELECT sku_id, product_category, category, current_stock, reorder_threshold, max_capacity, current_selling_price 
            FROM products
            {where_clause}
        """
        
        raw_data = self._execute_query(query, params)
        
        return {
            row[0]: {
                'product_category': row[1],
                'category': row[2],
                'current_stock': row[3],
                'reorder_threshold': row[4],
                'max_capacity': row[5], 
                'selling_price': row[6] 
            }
            for row in raw_data
        }
    
    def get_product_list(self) -> Dict[str, Dict]:
       
        print("Fetching product data...")
        query = f"""
            SELECT Distinct(sku_id)
            FROM products
        """
        
        raw_data = self._execute_query(query)
        return [data[0] for data in raw_data]
    

    def get_forecast_data(self, sku_list: Optional[List[str]] = None) -> Dict[str, int]:
        """
        Retrieves demand forecast data.

        Args:
            sku_list (list, optional): If provided, retrieves data only for these SKUs.

        Returns:
            Dict: {sku_id: forecasted_quantity}
        """
        print("Fetching forecast data...")
        where_clause, params = self._build_sku_filter_clause(sku_list)
        query = f"""
            SELECT sku_id, MAX(total_forecasted_demand) AS quantity
            FROM out_of_stock 
            {where_clause}
            GROUP BY sku_id;
        """
        raw_data = self._execute_query(query, params)
        return {row[0]: row[1] for row in raw_data}