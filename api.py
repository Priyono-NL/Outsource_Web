import os, pandas as pd, io
from dotenv import load_dotenv
from datetime import datetime
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import OperationalError

load_dotenv()
user = os.getenv('DB_USER')
pw = os.getenv('DB_PASSWORD')
host = os.getenv('DB_HOST')
db_name = os.getenv('DB_NAME')
engine = create_engine(f"mysql+pymysql://{user}:{pw}@{host}/{db_name}")

if __name__ == "__main__":
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            if result:
                print("✅ Koneksi Berhasil! Database merespons.")
        inspector = inspect(engine)
        schemas = inspector.get_schema_names()
        print(f"Schema yang tersedia: {schemas}\n")
        tables = inspector.get_table_names()        
        if tables:
            print("✅ Tabel yang ditemukan:")
            for table in tables:
                print(f"   - {table}")
    except Exception as e:
        print(f"❌ Terjadi kesalahan: {e}")