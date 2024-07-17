import os
from flask import Flask, request, render_template
from dotenv import load_dotenv
from util import search_image

load_dotenv()

app = Flask(__name__)

@app.route('/find')
def find_results():
    filename = "/static/{}".format(request.args.get('filename'))
    results = search_image(filename)
    return {'products': results}

@app.route('/')
def index_page():
    return render_template('index.html')

if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE)