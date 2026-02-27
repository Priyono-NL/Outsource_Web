import os
from dotenv import load_dotenv

load_dotenv('local.env')

class Config:    
    USER = os.getenv('DB_USER')
    PW = os.getenv('DB_PASSWORD')
    HOST = os.getenv('DB_HOST')
    DB_NAME = os.getenv('DB_NAME')
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{USER}:{PW}@{HOST}/{DB_NAME}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False