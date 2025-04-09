# Virginia Crash Data Visualizer

An interactive web application for visualizing vehicle and pedestrian crash data in Virginia.

## Features

- Interactive MapLibre GL JS map of Virginia
- Draw custom polygons to filter crash data
- View crash data visualized in four chart quadrants:
  - Pedestrian crashes by year
  - Vehicular crashes by year
  - Total crashes by type
  - Severity and injury/fatality statistics

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
  - MapLibre GL JS for mapping
  - Mapbox GL Draw for polygon drawing
  - Turf.js for geospatial analysis
  - Chart.js for data visualization

- **Backend**: Flask (Python)
  - Pandas for data processing
  - CSV data source

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/virginia-crash-visualizer.git
   cd virginia-crash-visualizer
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run the application:
   ```
   python app.py
   ```

4. Open your browser and navigate to `http://localhost:5000`

## Deployment

This application is configured for deployment on Render.com. Follow these steps:

1. Create a new Web Service on Render
2. Connect your repository
3. Use the following settings:
   - Environment: Python
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`

## Data Source

The application uses a comprehensive pedestrian crash dataset located at `data/Pedestrian and Crash data.csv` with the following structure:

- Crash details (ID, type, date, time)
- Location information (latitude, longitude, jurisdiction)
- Pedestrian data (age, gender, actions, injuries)
- Environmental factors (weather, road conditions, intersection type)
- Severity outcomes (injuries, fatalities)

The dataset contains detailed information about pedestrian crashes in Virginia, allowing for in-depth analysis of crash patterns, contributing factors, and safety trends.

## License

MIT
