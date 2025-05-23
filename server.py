from flask import Flask, send_from_directory, redirect
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def serve_cover_generator():
    return send_from_directory('.', 'cover.html')

@app.route('/cover-generator.html')
def redirect_to_cover():
    return redirect('/cover.html')

@app.route('/<path:path>')
def serve_files(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    app.run(port=8000, debug=True) 