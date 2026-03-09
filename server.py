import os
from flask import Flask, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_files(path):
    if os.path.isdir(os.path.join('.', path)):
        return send_from_directory('.', os.path.join(path, 'index.html'))
    return send_from_directory('.', path)

if __name__ == '__main__':
    app.run(port=8000, debug=True) 