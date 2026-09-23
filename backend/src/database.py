import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
from .config import DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT

try:
    connection_pool = psycopg2.pool.SimpleConnectionPool(
        minconn=1,
        maxconn=20,
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=DB_PORT
    )
except Exception as e:
    connection_pool = None
    print(f"Warning: Database pool initialization deferred: {e}")

@contextmanager
def get_db_connection():
    if not connection_pool:
        conn = psycopg2.connect(
            host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS, port=DB_PORT
        )
        try:
            yield conn
        finally:
            conn.close()
    else:
        conn = connection_pool.getconn()
        try:
            yield conn
        finally:
            connection_pool.putconn(conn)