import os
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Environment mode (testing vs production)
IS_TESTING = os.getenv("ENV_MODE") == "testing"

MYSQL_USER = os.getenv("MYSQL_USER", "")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")

if IS_TESTING:
    MYSQL_DB = "test_assetflow_db"
else:
    MYSQL_DB = os.getenv("MYSQL_DATABASE", "assetflow_db")

# Connection configurations
db_config = {
    "user": MYSQL_USER,
    "password": MYSQL_PASSWORD,
    "host": MYSQL_HOST,
    "port": int(MYSQL_PORT),
    "database": MYSQL_DB
}

# Create connection pool. Wrap in a try-except to handle initial bootstrap
# when the database doesn't exist yet.
connection_pool = None
try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="assetflow_pool",
        pool_size=15,
        **db_config
    )
except mysql.connector.Error:
    pass

def get_db_connection():
    """Retrieve a direct connection or a connection from the pool."""
    global connection_pool
    if connection_pool is None:
        return mysql.connector.connect(
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            host=MYSQL_HOST,
            port=int(MYSQL_PORT),
            database=MYSQL_DB
        )
    return connection_pool.get_connection()

def get_db():
    """FastAPI dependency to retrieve a database connection."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
