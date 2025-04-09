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
- Dashboard metrics showing key statistics:
  - Total crashes
  - Fatal crashes
  - Injury crashes
  - Pedestrian injuries & fatalities
  - Bicycle crashes

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

### Map Styling Options

The application uses free MapLibre demo tiles by default, which don't require an API key. If you want to use a different map style:

1. Open `app/static/js/main.js`
2. Find the map initialization code (around line 45)
3. Change the `style` URL to one of these options:
   - Continue using free tiles: `'https://demotiles.maplibre.org/style.json'`
   - Use MapTiler (requires free API key): `'https://api.maptiler.com/maps/streets/style.json?key=YOUR_API_KEY'`
   - Use Mapbox (requires free API key): `'https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=YOUR_API_KEY'`

To get a free API key:
- MapTiler: Sign up at [MapTiler Cloud](https://cloud.maptiler.com/auth/signup/)
- Mapbox: Sign up at [Mapbox](https://account.mapbox.com/auth/signup/)

## Deployment

### Deploy to Render

This application is configured for easy deployment on Render.com using either of the following methods:

#### Method 1: Use the Dashboard UI

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use the following settings:
   - Environment: Python
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn -c gunicorn.conf.py wsgi:app`
   - Select appropriate Python version (3.9+)

#### Method 2: Use render.yaml (Infrastructure as Code)

1. Push all files to your GitHub repository, including `render.yaml`
2. Log in to Render dashboard
3. Click on "New" and select "Blueprint"
4. Connect to your repository
5. Render will automatically detect the render.yaml file and configure the service accordingly

### Environmental Variables

No special environment variables are required for basic functionality.

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
