import os
import pandas as pd
import logging
import concurrent.futures
import prestodb
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

class DatabaseManagerPresto:
    """
    Manages Presto connections (prestodb driver) and safe SELECT query execution.
    """

    def __init__(self):
        logger.debug("Initializing DatabaseManagerPresto...")

        self.host = os.environ.get("PRESTO_HOST")
        self.port = int(os.environ.get("PRESTO_PORT", 8080))
        self.catalog = os.environ.get("PRESTO_CATALOG", "hive")
        self.schema = os.environ.get("PRESTO_SCHEMA", "default")
        self.user = os.environ.get("PRESTO_USER", "presto")

        logger.info("Presto connection parameters initialized")

    def _get_connection(self):
        """
        Create a new Presto connection using prestodb.
        """
        return prestodb.dbapi.connect(
        host=os.getenv("PRESTO_HOST"),
        port=int(os.getenv("PRESTO_PORT")),
        user=os.getenv("PRESTO_USER"),
        catalog=os.getenv("PRESTO_CATALOG"),
        schema=os.getenv("PRESTO_SCHEMA"),
        auth=prestodb.auth.BasicAuthentication(
            os.getenv("PRESTO_USER"),
            os.getenv("PRESTO_PASSWORD")
        ),
        http_scheme=os.getenv("PRESTO_HTTP_SCHEME", "https"),
    )

    def execute_query(self, sql_query: str, params: tuple = None,frames : bool =False ,verbose: bool = False) -> pd.DataFrame:
        """
        Executes safe SELECT/SHOW/DESCRIBE queries and returns a DataFrame.
        """
        logger.debug(f"execute_query called with SQL: {sql_query} | params: {params}")
        print("49")
        try:
            ALLOWED_STATEMENTS = ("SELECT", "WITH", "DESCRIBE", "SHOW", "EXPLAIN")

            cleaned = sql_query.strip().upper()
            if verbose:
                logger.debug(f"Verbose mode: SQL to execute: {sql_query}")

            if not cleaned.startswith(ALLOWED_STATEMENTS):
                logger.warning("Blocked non-read query for safety.")
                return None

            conn = self._get_connection()
            cursor = conn.cursor()
            logger.debug("Presto connection opened")

            if params:
                sql_query = sql_query.format(*params)
                logger.debug(f"SQL after params substitution: {sql_query}")

            cursor.execute(sql_query)
            rows = cursor.fetchall()
            col_names = [desc[0] for desc in cursor.description] if cursor.description else []

            if not rows:
                return "No results found."
            if frames:
                df = pd.DataFrame(rows, columns=col_names) if rows else pd.DataFrame()
            else:
                lines = []
                for row in rows:
                    line = ", ".join(f"{col}: {val}" for col, val in zip(col_names, row))
                    lines.append(line)

                df = "\n".join(lines)
                logger.info(f"Query executed successfully, rows returned: {len(rows)}")

            cursor.close()
            conn.close()
            logger.debug("Presto connection closed")

            logger.info(f"Query executed successfully, rows returned: {len(df)}")
            return df

        except Exception as e:
            logger.error(f"Error executing query: {e}")
            return None


    def execute_multiple_sql_queries(self, sql_queries: list, max_workers: int = 5) -> list:
        """
        Executes multiple SELECT queries concurrently.
        """
        logger.debug(f"execute_multiple_sql_queries with {len(sql_queries)} queries, max_workers={max_workers}")
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(self.execute_query, sql_queries))
        logger.info("Completed concurrent execution of SQL queries")
        return results