from flask import Flask, render_template, jsonify
import pandas as pd
import os
import numpy as np
from datetime import datetime

app = Flask(__name__, static_folder='app/static', template_folder='app/templates')

# Load the crash data
@app.route('/api/data')
def get_data():
    df = pd.read_csv('data/Pedestrian and Crash data.csv')
    
    # Replace NaN values with 'Unknown' before processing
    df = df.fillna('Unknown')
    
    # Convert to the format expected by the frontend
    processed_data = []
    
    for _, row in df.iterrows():
        # Get month from MonthName field directly
        month = str(row.get('MonthName', 'Unknown'))
        
        processed_row = {
            'latitude': float(row['Sum of Latitude']),
            'longitude': float(row['Sum of Longitude']),
            'year': row['Year'],
            'month': month,  # Add month data
            'crash_type': 'pedestrian' if row['PedestrianInvolved'] == 'Yes' else 'vehicle',
            'severity': 1 if row['PedestrianInjuryType'] == 'No Apparent Injury' else
                       2 if row['PedestrianInjuryType'] == 'Minor/Possible Injury' else
                       4 if row['PedestrianInjuryType'] == 'Serious Injury' else
                       5 if row['PedestrianInjuryType'] == 'Dead' else 3,
            'injuries': int(row['Number_Of_Injuries']) if row['Number_Of_Injuries'] != 'Unknown' else 0,
            'fatalities': int(row['Number_Of_Fatalities']) if row['Number_Of_Fatalities'] != 'Unknown' else 0,
            'intersection_type': str(row.get('IntersectionType', 'Unknown')),
            'pedestrian_action': str(row.get('PedestrianAction_Category', 'Unknown')),
            'traffic_control': str(row.get('TrafficControlType', 'Unknown')),
            'day_night': str(row.get('DaytimeNighttime_NHTSA', 'Unknown')),
            'motorcycle_involved': str(row.get('MotorcycleInvolved', 'Unknown')) == 'Yes',
            'bicycle_involved': str(row.get('BicycleInvolved', 'Unknown')) == 'Yes'
        }
        processed_data.append(processed_row)
    
    return jsonify(processed_data)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True) 