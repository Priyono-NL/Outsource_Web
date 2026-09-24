import os
from dotenv import load_dotenv
from sqlalchemy.pool import NullPool

env_file = os.getenv('ENV_FILE', '../.env.development')
load_dotenv(dotenv_path=env_file)

class Config:    
    USER = os.getenv('DB_USER')
    PW = os.getenv('DB_PASSWORD')
    HOST = os.getenv('DB_HOST')
    DB_NAME = os.getenv('DB_NAME')
    
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{USER}:{PW}@{HOST}/{DB_NAME}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    SQLALCHEMY_ENGINE_OPTIONS = {
        'poolclass': NullPool
    }
    
    SECRET_KEY = os.getenv('SECRET_KEY')
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_HTTPONLY = True

    CORS_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
