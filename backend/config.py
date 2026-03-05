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

    # Pengaturan Cookie agar bisa dibaca oleh React (Localhost)
    SECRET_KEY = os.getenv('SECRET_KEY')
    SESSION_COOKIE_SAMESITE = 'Lax'     # Mengizinkan pengiriman cookie antar port localhost
    SESSION_COOKIE_SECURE = False      # Set ke False karena kita masih pakai HTTP (bukan HTTPS)
    SESSION_COOKIE_HTTPONLY = True     # Mencegah akses cookie dari JavaScript luar demi keamanan