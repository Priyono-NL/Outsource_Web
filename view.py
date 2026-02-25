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
table = 'os_org'

@app.route('/')
def index():    
    with engine.connect() as conn:
        query = f"SELECT *FROM `{table}`"
        df = pd.read_sql(query, conn)
        total_rows = len(df)
        table_html = df.to_html(classes='table table-striped table-hover', index=False)
        return render_template("view.html",table=table, table_html=table_html, total_rows=total_rows)     

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file_excel' not in request.files:
        return redirect(url_for('index'))    
    
    file = request.files['file_excel']
    if file.filename == '':
        return redirect(url_for('index'))
    
    if file and file.filename.endswith('.csv'):
        try:
            df = pd.read_csv(
                io.StringIO(file.read().decode('utf-8')), 
                sep=',',
                dtype=str
            )
            with engine.connect() as conn:                
                df.to_sql(table, con=conn, if_exists='append', index=False)
                conn.commit()                
            return redirect(url_for('index'))
        except Exception as e:
            return f"Error: {str(e)}"    
    return "Format file harus .csv"

if __name__ == '__main__':
    app.run(debug=True)