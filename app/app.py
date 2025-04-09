from flask import Flask, render_template, jsonify, request, send_file, Response
import os
import pandas as pd
import json
import sys

app = Flask(__name__)

# Get the absolute path to the data directory, making sure to go up one level from app directory
APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(APP_DIR, '..', 'data'))
print(f"Python version: {sys.version}")
print(f"App directory: {APP_DIR}")
print(f"Data directory set to: {DATA_DIR}")

# List files in the data directory for debugging
try:
    print(f"Files in data directory: {os.listdir(DATA_DIR)}")
except Exception as e:
    print(f"Error listing data directory: {str(e)}")

# Load the crash data
@app.route('/crash-data', methods=['GET'])
def get_crash_data():
    try:
        crash_file = 'Pedestrian and Crash data.csv'
        data_path = os.path.join(DATA_DIR, crash_file)
        print(f"Looking for crash data at: {data_path}")
        
        # Check if file exists
        if not os.path.exists(data_path):
            print(f"Crash data file not found at: {data_path}")
            return jsonify({'error': 'Crash data file not found'}), 404
            
        print(f"Found crash file, size: {os.path.getsize(data_path)} bytes")
        
        df = pd.read_csv(data_path)
        df = df.dropna(subset=['latitude', 'longitude'])
        crash_data = df.to_dict(orient='records')
        return jsonify(crash_data)
    except Exception as e:
        print(f"Error loading crash data: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Serve the trails GeoJSON file by directly reading and returning its contents
@app.route('/trails', methods=['GET'])
def get_trails():
    try:
        trail_file = 'Trails.geojson'
        trails_path = os.path.join(DATA_DIR, trail_file)
        print(f"Looking for trail file at: {trails_path}")
        
        # Check if file exists
        if not os.path.exists(trails_path):
            print(f"Trail file not found at: {trails_path}")
            
            # List all files in DATA_DIR to debug
            print(f"Files in {DATA_DIR}: {os.listdir(DATA_DIR)}")
            
            return jsonify({'error': f'Trails file not found: {trail_file}'}), 404
        
        print(f"Found trail file, size: {os.path.getsize(trails_path)} bytes")
        
        # Read the file contents directly instead of using send_file
        with open(trails_path, 'r') as f:
            geojson_data = json.load(f)
            
        print(f"Successfully loaded GeoJSON with {len(geojson_data.get('features', []))} features")
        
        # Return the GeoJSON data
        return jsonify(geojson_data)
    except json.JSONDecodeError as e:
        print(f"JSON parsing error for trail file: {str(e)}")
        return jsonify({'error': f'Invalid GeoJSON format: {str(e)}'}), 500
    except Exception as e:
        print(f"Error serving trail file: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def api_data():
    return get_crash_data()

if __name__ == '__main__':
    print(f"Working directory: {os.getcwd()}")
    app.run(debug=True, host='0.0.0.0', port=5000) 