from flask import Flask, render_template, jsonify
import pandas as pd
import os

app = Flask(__name__, static_folder='app/static', template_folder='app/templates')

# Load the crash data
@app.route('/api/data')
def get_data():
    df = pd.read_csv('data/Pedestrian and Crash data.csv')
    # Convert to the format expected by the frontend
    processed_data = []
    
    for _, row in df.iterrows():
        processed_row = {
            'latitude': row['Sum of Latitude'],
            'longitude': row['Sum of Longitude'],
            'year': row['Year'],
            'crash_type': 'pedestrian' if row['PedestrianInvolved'] == 'Yes' else 'vehicle',
            'severity': 1 if row['PedestrianInjuryType'] == 'No Apparent Injury' else
                       2 if row['PedestrianInjuryType'] == 'Minor/Possible Injury' else
                       4 if row['PedestrianInjuryType'] == 'Serious Injury' else
                       5 if row['PedestrianInjuryType'] == 'Dead' else 3,
            'injuries': row['Number_Of_Injuries'],
            'fatalities': row['Number_Of_Fatalities']
        }
        processed_data.append(processed_row)
    
    return jsonify(processed_data)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True) 