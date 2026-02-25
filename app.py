import pandas as pd, os, io
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from flask import Flask, render_template, Response, request, redirect, url_for

load_dotenv()
app = Flask(__name__)

user = os.getenv('DB_USER')
pw = os.getenv('DB_PASSWORD')
host = os.getenv('DB_HOST')
db_name = os.getenv('DB_NAME')
engine = create_engine(f"mysql+pymysql://{user}:{pw}@{host}/{db_name}")

@app.route('/')
def index():    
    with engine.connect() as conn:
        cc_sql = text('SELECT cost_center, org_name FROM `org_cost_center`')
        cc_result = conn.execute(cc_sql)
        cc = cc_result.fetchall()
        return render_template("index.html",cc_select=cc)    
    

@app.route('/add')
def add():
    with engine.connect() as conn:
        cc_sql = text('SELECT cost_center, org_name FROM `org_cost_center`')
        cc_result = conn.execute(cc_sql)
        cc = cc_result.fetchall()
        return render_template("add.html",cc_select=cc)

if __name__ == '__main__':
    app.run(debug=True)