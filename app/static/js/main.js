// Variables for storing data and charts
let crashData = [];
let mapDrawn = false;
let draw;
let map;
let charts = {
    pedestrian: null,
    vehicle: null,
    types: null,
    severity: null
};
let quadMode;

// Fetch crash data from the API
async function fetchCrashData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error('Failed to fetch crash data');
        }
        crashData = await response.json();
        console.log('Crash data loaded:', crashData.length, 'records');
    } catch (error) {
        console.error('Error fetching crash data:', error);
        alert('Failed to load crash data. Please try again later.');
    }
}

// Initialize the map with MapLibre GL JS
function initMap() {
    // First check if the map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    // Create the map with a better basemap that includes streets
    map = new maplibregl.Map({
        container: 'map',
        style: {
            'version': 8,
            'sources': {
                'osm': {
                    'type': 'raster',
                    'tiles': [
                        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    ],
                    'tileSize': 256,
                    'attribution': '© OpenStreetMap Contributors'
                }
            },
            'layers': [
                {
                    'id': 'osm',
                    'type': 'raster',
                    'source': 'osm',
                    'minzoom': 0,
                    'maxzoom': 19
                }
            ]
        },
        center: [-78.5, 37.8], // Center of Virginia
        zoom: 7
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    // Add scale control
    map.addControl(new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: 'imperial'
    }), 'bottom-left');

    // Once map is loaded, add additional layers
    map.on('load', function() {
        console.log('Map loaded, initializing layers and tools');
        
        // Add state boundaries
        map.addSource('states', {
            type: 'geojson',
            data: 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson'
        });
        
        map.addLayer({
            'id': 'state-boundaries',
            'type': 'line',
            'source': 'states',
            'layout': {},
            'paint': {
                'line-color': '#444',
                'line-width': 2,
                'line-opacity': 0.5
            }
        });
        
        // Attempt to add a streets layer (for major roads)
        try {
            // Add major highways layer
            map.addLayer({
                'id': 'highways-highlight',
                'type': 'line',
                'source': 'osm',
                'source-layer': 'transportation',
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#f44336',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        8, 0.5,
                        10, 1.5,
                        13, 4
                    ],
                    'line-opacity': 0.7
                },
                'filter': ['==', 'class', 'highway']
            });
            
            console.log('Added highways layer');
        } catch (err) {
            console.warn('Could not add detailed roads layer, using OSM basemap only:', err);
        }
        
        // Add city labels for Virginia cities
        const virginiaCities = [
            { name: "Richmond", coordinates: [-77.4360, 37.5407] },
            { name: "Virginia Beach", coordinates: [-76.0581, 36.8529] },
            { name: "Norfolk", coordinates: [-76.2859, 36.8508] },
            { name: "Chesapeake", coordinates: [-76.2575, 36.7682] },
            { name: "Arlington", coordinates: [-77.1003, 38.8816] },
            { name: "Alexandria", coordinates: [-77.0469, 38.8048] },
            { name: "Roanoke", coordinates: [-79.9414, 37.2710] },
            { name: "Charlottesville", coordinates: [-78.4767, 38.0293] },
            { name: "Lynchburg", coordinates: [-79.1422, 37.4138] },
            { name: "Newport News", coordinates: [-76.4343, 37.0871] },
            { name: "Hampton", coordinates: [-76.3452, 37.0299] },
            { name: "Blacksburg", coordinates: [-80.4139, 37.2296] },
            { name: "Danville", coordinates: [-79.3950, 36.5859] },
            { name: "Fredericksburg", coordinates: [-77.4605, 38.3032] },
            { name: "Manassas", coordinates: [-77.4753, 38.7509] }
        ];
        
        // Add city names
        virginiaCities.forEach(city => {
            // Add city marker
            const marker = new maplibregl.Marker({
                color: "#003366",
                scale: 0.7
            })
            .setLngLat(city.coordinates)
            .setPopup(new maplibregl.Popup({
                closeButton: false,
                offset: 25
            }).setHTML(`<strong>${city.name}</strong>`))
            .addTo(map);
            
            // Add click event to marker to open popup
            marker.getElement().addEventListener('click', () => {
                marker.togglePopup();
            });
            
            // Add text label
            const cityLabel = document.createElement('div');
            cityLabel.className = 'city-label';
            cityLabel.textContent = city.name;
            
            new maplibregl.Marker({
                element: cityLabel,
                anchor: 'center'
            })
            .setLngLat(city.coordinates)
            .addTo(map);
        });
        
        // Initialize drawing tools and add crash data
        initDrawingTools();
        addCrashDataToMap();
    });
}

// Initialize drawing tools
function initDrawingTools() {
    // Initialize MapboxDraw
    try {
        console.log('Initializing drawing tools');
        
        // Check if drawing modes are available
        if (typeof window.SimplePolygonMode !== 'function') {
            console.error('SimplePolygonMode not found. Make sure quadpoly.js is loaded first.');
            return;
        }
        
        // Create custom modes
        const customModes = Object.assign({}, MapboxDraw.modes);
        customModes.draw_polygon = SimplePolygonMode;
        
        // Initialize draw with custom modes
        draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: false,  // Disable standard polygon
                line_string: true,
                trash: true
            },
            modes: customModes
        });

        // Add the draw control to the map
        map.addControl(draw, 'top-right');
        console.log('Drawing tools initialized');
        
        // Create custom control for Polygon drawing
        const polygonControl = document.createElement('div');
        polygonControl.className = 'maplibregl-ctrl-group maplibregl-ctrl polygon-control';
        polygonControl.innerHTML = `
            <button class="mapbox-gl-draw_ctrl-draw-btn polygon-button" title="Draw Polygon">
                <span class="polygon-icon">⬚</span>
            </button>
        `;
        
        // Add the custom control to the map container
        document.getElementById('map-container').appendChild(polygonControl);
        
        // Add event listener for the polygon mode button
        const polygonButton = polygonControl.querySelector('.polygon-button');
        polygonButton.addEventListener('click', function() {
            console.log('Polygon button clicked');
            // Add active class to button
            polygonButton.classList.add('active');
            
            // Start polygon drawing mode
            try {
                draw.changeMode('draw_polygon');
                console.log('Changed to polygon draw mode');
            } catch (err) {
                console.error('Error changing to polygon mode:', err);
            }
        });
        
        // Set up event handlers for drawing
        map.on('draw.create', function(e) {
            console.log('Draw create event triggered');
            polygonButton.classList.remove('active');
            handleDrawEvent(e);
        });
        
        map.on('draw.update', function(e) {
            console.log('Draw update event triggered');
            handleDrawEvent(e);
        });
        
        map.on('draw.delete', function(e) {
            console.log('Draw delete event triggered');
            clearVisualization();
        });
        
        map.on('draw.modechange', function(e) {
            console.log('Draw mode changed:', e.mode);
            if (e.mode !== 'draw_polygon') {
                polygonButton.classList.remove('active');
            }
        });
        
        // Add status message
        const statusDiv = document.createElement('div');
        statusDiv.id = 'status-message';
        statusDiv.className = 'map-overlay';
        statusDiv.innerHTML = '<p>Click the square icon to draw a polygon</p>';
        document.getElementById('map-container').appendChild(statusDiv);
        
        // Add buffer control for corridors
        const bufferControlDiv = document.createElement('div');
        bufferControlDiv.className = 'buffer-control';
        bufferControlDiv.innerHTML = `
            <div>
                <label for="buffer-distance">Buffer distance (km): </label>
                <input type="number" id="buffer-distance" value="0.5" min="0.1" max="5" step="0.1">
                <button id="create-buffer">Create Buffer</button>
            </div>
        `;
        document.getElementById('map-container').appendChild(bufferControlDiv);
        
        // Add event listener for buffer creation
        document.getElementById('create-buffer').addEventListener('click', createCorridorBuffer);
        
        // Create counter box
        const counterBox = document.createElement('div');
        counterBox.id = 'counter-box';
        counterBox.className = 'counter-overlay';
        document.getElementById('map-container').appendChild(counterBox);
        counterBox.style.display = 'none';
        
    } catch (error) {
        console.error('Error initializing drawing tools:', error);
    }
}

// Handler for draw events
function handleDrawEvent(e) {
    console.log('Draw event triggered:', e.type);
    updateVisualization();
}

// Create a buffer around a line to form a corridor
function createCorridorBuffer() {
    try {
        const features = draw.getSelected();
        if (features.features.length === 0) {
            alert('Please select a line first');
            return;
        }
        
        const selectedFeature = features.features[0];
        if (selectedFeature.geometry.type !== 'LineString') {
            alert('Please select a line to create a corridor');
            return;
        }
        
        // Get buffer distance from input (convert km to meters)
        const bufferDistance = parseFloat(document.getElementById('buffer-distance').value) || 0.5;
        
        // Create a buffer around the line
        const buffered = turf.buffer(selectedFeature, bufferDistance, {units: 'kilometers'});
        
        // Remove the line
        draw.delete(selectedFeature.id);
        
        // Add the buffer as a polygon
        draw.add(buffered);
        
        // Update visualization with the new polygon
        updateVisualization();
        
        console.log(`Created corridor with ${bufferDistance}km buffer`);
        
        // Update status message
        const statusDiv = document.getElementById('status-message');
        statusDiv.innerHTML = `<p>Corridor created with ${bufferDistance}km buffer</p>`;
    } catch (error) {
        console.error('Error creating corridor buffer:', error);
    }
}

// Add crash data as points on the map
function addCrashDataToMap() {
    // Rest of the function remains unchanged
    try {
        // Check if data is available
        if (!crashData || crashData.length === 0) {
            console.error('No crash data available to display on map');
            return;
        }
        
        console.log('Adding crash data to map, points:', crashData.length);

        // Add a source for crash data
        map.addSource('crashes', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: crashData.map(crash => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(crash.longitude), parseFloat(crash.latitude)]
                    },
                    properties: {
                        year: crash.year,
                        crash_type: crash.crash_type,
                        severity: crash.severity,
                        injuries: crash.injuries,
                        fatalities: crash.fatalities
                    }
                }))
            }
        });

        // Add a layer for vehicle crashes
        map.addLayer({
            id: 'vehicle-crashes',
            type: 'circle',
            source: 'crashes',
            filter: ['==', ['get', 'crash_type'], 'vehicle'],
            paint: {
                'circle-radius': 5,
                'circle-color': '#FF5533',
                'circle-opacity': 0.8
            }
        });

        // Add a layer for pedestrian crashes
        map.addLayer({
            id: 'pedestrian-crashes',
            type: 'circle',
            source: 'crashes',
            filter: ['==', ['get', 'crash_type'], 'pedestrian'],
            paint: {
                'circle-radius': 5,
                'circle-color': '#3388FF',
                'circle-opacity': 0.8
            }
        });

        // Add a source for selected crashes (initially empty)
        map.addSource('selected-crashes', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });
        
        // Add a layer for selected crashes
        map.addLayer({
            id: 'selected-crashes',
            type: 'circle',
            source: 'selected-crashes',
            paint: {
                'circle-radius': 6,
                'circle-color': [
                    'match',
                    ['get', 'crash_type'],
                    'pedestrian', '#3388FF',
                    'vehicle', '#FF5533',
                    '#FFBF00'
                ],
                'circle-opacity': 1,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        // Add popup on hover
        setupPopups();
        
        console.log('Crash data added to map successfully');
        
    } catch (error) {
        console.error('Error adding crash data to map:', error);
    }
}

// Helper function to get severity text description
function getSeverityText(severity) {
    switch(parseInt(severity)) {
        case 1: return 'No Apparent Injury';
        case 2: return 'Minor/Possible Injury';
        case 3: return 'Moderate Injury';
        case 4: return 'Serious Injury';
        case 5: return 'Fatal';
        default: return 'Unknown';
    }
}

// Update visualizations when a polygon is drawn
function updateVisualization() {
    try {
        console.log('Updating visualization based on drawn shapes');
        
        // Get all drawn features
        const features = draw.getAll();
        if (features.features.length === 0) {
            clearVisualization();
            return;
        }

        // Update status message
        const statusDiv = document.getElementById('status-message');
        statusDiv.innerHTML = '<p>Processing selected area...</p>';

        // Get crashes within the drawn shape(s)
        let filteredData = [];
        const shapesFeatures = features.features;
        
        console.log(`Processing ${shapesFeatures.length} drawn shapes`);
        
        // Process each shape individually
        shapesFeatures.forEach(shape => {
            console.log(`Processing shape of type: ${shape.geometry.type}`);
            
            // Handle different geometry types
            if (shape.geometry.type === 'Polygon') {
                // For polygons, check points inside
                const pointsInPolygon = crashData.filter(crash => {
                    try {
                        const point = turf.point([parseFloat(crash.longitude), parseFloat(crash.latitude)]);
                        return turf.booleanPointInPolygon(point, shape);
                    } catch (err) {
                        console.error('Error checking point in polygon:', err);
                        return false;
                    }
                });
                
                console.log(`Found ${pointsInPolygon.length} points in polygon`);
                filteredData = [...filteredData, ...pointsInPolygon];
            } else if (shape.geometry.type === 'LineString') {
                // For lines, buffer them to create a corridor and check points inside
                try {
                    const bufferDistance = parseFloat(document.getElementById('buffer-distance').value) || 0.5;
                    const buffered = turf.buffer(shape, bufferDistance, {units: 'kilometers'});
                    
                    const pointsNearLine = crashData.filter(crash => {
                        const point = turf.point([parseFloat(crash.longitude), parseFloat(crash.latitude)]);
                        return turf.booleanPointInPolygon(point, buffered);
                    });
                    
                    console.log(`Found ${pointsNearLine.length} points near line (${bufferDistance}km buffer)`);
                    filteredData = [...filteredData, ...pointsNearLine];
                } catch (err) {
                    console.error('Error processing line buffer:', err);
                }
            }
        });
        
        // Remove duplicates if any
        filteredData = [...new Map(filteredData.map(item => [item.latitude + ',' + item.longitude, item])).values()];
        
        console.log(`Total filtered data points: ${filteredData.length}`);
        
        if (filteredData.length === 0) {
            statusDiv.innerHTML = '<p>No crashes found in the selected area</p>';
            // Keep the charts with all data
            return;
        }
        
        // Update the selected crashes layer
        updateSelectedCrashesLayer(filteredData);
        
        // Reduce opacity of unselected crashes
        map.setPaintProperty('vehicle-crashes', 'circle-opacity', 0.2);
        map.setPaintProperty('pedestrian-crashes', 'circle-opacity', 0.2);

        // Update charts with filtered data
        updateCharts(filteredData);
        mapDrawn = true;
        
        // Update status message
        statusDiv.innerHTML = `<p>Showing ${filteredData.length} crashes in selected area</p>`;
        
        // Update counter displays
        updateCounterDisplay(filteredData);
        
    } catch (error) {
        console.error('Error updating visualization:', error);
        const statusDiv = document.getElementById('status-message');
        statusDiv.innerHTML = '<p>Error processing selection. Try again.</p>';
    }
}

// Make updateVisualization available globally for the custom draw mode
window.updateVisualization = updateVisualization;

// Clear visualization when polygon is deleted
function clearVisualization() {
    if (!mapDrawn) return;
    
    // Reset map layers
    map.setPaintProperty('vehicle-crashes', 'circle-opacity', 0.8);
    map.setPaintProperty('pedestrian-crashes', 'circle-opacity', 0.8);
    
    // Clear selected crashes
    map.getSource('selected-crashes').setData({
        type: 'FeatureCollection',
        features: []
    });
    
    // Reset charts
    initCharts(crashData);
    mapDrawn = false;
    
    // Update status message
    const statusDiv = document.getElementById('status-message');
    statusDiv.innerHTML = '<p>Draw a polygon or corridor to filter crash data</p>';
    
    // Hide buffer controls
    document.querySelector('.buffer-control').style.display = 'none';
    
    // Hide counter box
    document.getElementById('counter-box').style.display = 'none';
}

// Initialize charts with default data
function initCharts(data) {
    // Initialize pedestrian crashes by year chart
    updatePedestrianChart(data);
    
    // Initialize vehicle crashes by year chart
    updateVehicleChart(data);
    
    // Initialize total crashes by type chart
    updateTypesChart(data);
    
    // Initialize severity and injuries chart
    updateSeverityChart(data);
}

// Update all charts with filtered data
function updateCharts(data) {
    updatePedestrianChart(data);
    updateVehicleChart(data);
    updateTypesChart(data);
    updateSeverityChart(data);
}

// Update pedestrian crashes by year chart
function updatePedestrianChart(data) {
    const ctx = document.getElementById('pedestrianChart').getContext('2d');
    
    // Filter pedestrian crashes
    const pedestrianData = data.filter(crash => crash.crash_type === 'pedestrian');
    
    // Group by year
    const yearCounts = {};
    pedestrianData.forEach(crash => {
        const year = crash.year;
        yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    
    const years = Object.keys(yearCounts).sort();
    const counts = years.map(year => yearCounts[year]);
    
    // Find max count for y-axis scaling
    const maxCount = Math.max(...counts, 1);  // Use at least 1 to avoid empty charts
    
    // Destroy previous chart if it exists
    if (charts.pedestrian) {
        charts.pedestrian.destroy();
    }
    
    // Create new chart
    charts.pedestrian = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [{
                label: 'Pedestrian Crashes',
                data: counts,
                borderColor: '#3388FF',
                backgroundColor: 'rgba(51, 136, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxCount + Math.ceil(maxCount * 0.1), // Add 10% padding
                    ticks: {
                        precision: 0,
                        stepSize: Math.max(1, Math.ceil(maxCount / 5)) // At most 5 ticks
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `Pedestrian Crashes (${pedestrianData.length} total)`
                }
            }
        }
    });
}

// Update vehicle crashes by year chart
function updateVehicleChart(data) {
    const ctx = document.getElementById('vehicleChart').getContext('2d');
    
    // Filter vehicle crashes
    const vehicleData = data.filter(crash => crash.crash_type === 'vehicle');
    
    // Group by year
    const yearCounts = {};
    vehicleData.forEach(crash => {
        const year = crash.year;
        yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    
    const years = Object.keys(yearCounts).sort();
    const counts = years.map(year => yearCounts[year]);
    
    // Find max count for y-axis scaling
    const maxCount = Math.max(...counts, 1);  // Use at least 1 to avoid empty charts
    
    // Destroy previous chart if it exists
    if (charts.vehicle) {
        charts.vehicle.destroy();
    }
    
    // Create new chart
    charts.vehicle = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [{
                label: 'Vehicle Crashes',
                data: counts,
                borderColor: '#FF5533',
                backgroundColor: 'rgba(255, 85, 51, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxCount + Math.ceil(maxCount * 0.1), // Add 10% padding
                    ticks: {
                        precision: 0,
                        stepSize: Math.max(1, Math.ceil(maxCount / 5)) // At most 5 ticks
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `Vehicle Crashes (${vehicleData.length} total)`
                }
            }
        }
    });
}

// Update total crashes by type chart
function updateTypesChart(data) {
    const ctx = document.getElementById('typesChart').getContext('2d');
    
    // Count crashes by type
    const pedestrianCount = data.filter(crash => crash.crash_type === 'pedestrian').length;
    const vehicleCount = data.filter(crash => crash.crash_type === 'vehicle').length;
    
    // Destroy previous chart if it exists
    if (charts.types) {
        charts.types.destroy();
    }
    
    // Create new chart
    charts.types = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Pedestrian', 'Vehicle'],
            datasets: [{
                data: [pedestrianCount, vehicleCount],
                backgroundColor: ['#3388FF', '#FF5533']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: `Crash Types (${data.length} total)`
                }
            }
        }
    });
}

// Update severity and injuries chart
function updateSeverityChart(data) {
    const ctx = document.getElementById('severityChart').getContext('2d');
    
    // Count by severity levels
    const severityCounts = {
        1: 0, // No Apparent Injury
        2: 0, // Minor/Possible Injury
        3: 0, // Moderate
        4: 0, // Serious
        5: 0  // Fatal
    };
    
    data.forEach(crash => {
        const severity = parseInt(crash.severity);
        if (severity >= 1 && severity <= 5) {
            severityCounts[severity]++;
        }
    });
    
    // Count injuries and fatalities
    const totalInjuries = data.reduce((sum, crash) => sum + parseInt(crash.injuries || 0), 0);
    const totalFatalities = data.reduce((sum, crash) => sum + parseInt(crash.fatalities || 0), 0);
    
    // Find max counts for y-axis scaling
    const severityValues = Object.values(severityCounts);
    const maxSeverityCount = Math.max(...severityValues, 1);
    const maxInjuryCount = Math.max(totalInjuries, totalFatalities, 1);
    const maxYValue = Math.max(maxSeverityCount, maxInjuryCount);
    
    // Destroy previous chart if it exists
    if (charts.severity) {
        charts.severity.destroy();
    }
    
    // Create new chart (dual axis chart)
    charts.severity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['No Injury', 'Minor', 'Moderate', 'Serious', 'Fatal'],
            datasets: [
                {
                    label: 'Crash Severity',
                    data: [
                        severityCounts[1],
                        severityCounts[2],
                        severityCounts[3],
                        severityCounts[4],
                        severityCounts[5]
                    ],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(255, 205, 86, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(201, 42, 42, 0.7)'
                    ],
                    borderColor: [
                        'rgb(75, 192, 192)',
                        'rgb(255, 205, 86)',
                        'rgb(255, 159, 64)',
                        'rgb(255, 99, 132)',
                        'rgb(201, 42, 42)'
                    ],
                    borderWidth: 1,
                    order: 1
                },
                {
                    label: 'Injuries & Fatalities',
                    data: [0, 0, 0, totalInjuries, totalFatalities],
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgb(54, 162, 235)',
                    type: 'line',
                    order: 0,
                    pointStyle: 'circle',
                    pointRadius: 8,
                    pointHoverRadius: 10
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxYValue + Math.ceil(maxYValue * 0.1), // Add 10% padding
                    ticks: {
                        precision: 0,
                        stepSize: Math.max(1, Math.ceil(maxYValue / 5)) // At most 5 ticks
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            let value = context.raw || 0;
                            return `${label}: ${value}`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: `Crash Severity (${data.length} total)`
                }
            }
        }
    });
}

// Clear selection button event listener
document.getElementById('clear-btn').addEventListener('click', function() {
    draw.deleteAll();
    clearVisualization();
});

// Initialize app
async function initApp() {
    try {
        console.log('Initializing application');
        await fetchCrashData();
        initMap();
        
        // Set up clear button
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                if (draw) {
                    draw.deleteAll();
                    clearVisualization();
                }
            });
        }
        
        // Initialize charts with all data
        initCharts(crashData);
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
    }
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Update the layer showing selected crashes
function updateSelectedCrashesLayer(filteredData) {
    const selectedFeatures = filteredData.map(crash => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [parseFloat(crash.longitude), parseFloat(crash.latitude)]
        },
        properties: {
            year: crash.year,
            crash_type: crash.crash_type,
            severity: crash.severity,
            injuries: crash.injuries,
            fatalities: crash.fatalities
        }
    }));
    
    // Update the source data for selected crashes
    map.getSource('selected-crashes').setData({
        type: 'FeatureCollection',
        features: selectedFeatures
    });
}

// Update the counter display
function updateCounterDisplay(filteredData) {
    const pedestrianCount = filteredData.filter(crash => crash.crash_type === 'pedestrian').length;
    const vehicleCount = filteredData.filter(crash => crash.crash_type === 'vehicle').length;
    
    const counterBox = document.getElementById('counter-box');
    if (counterBox) {
        counterBox.innerHTML = `
            <div>Total crashes: <strong>${filteredData.length}</strong></div>
            <div>Pedestrian: <strong>${pedestrianCount}</strong></div>
            <div>Vehicle: <strong>${vehicleCount}</strong></div>
        `;
        counterBox.style.display = 'flex';
    }
}

// Set up popups for crash points
function setupPopups() {
    const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false
    });
    
    // Add popup for pedestrian crashes
    map.on('mouseenter', 'pedestrian-crashes', (e) => {
        showPopup(e, popup);
    });
    
    // Add popup for vehicle crashes
    map.on('mouseenter', 'vehicle-crashes', (e) => {
        showPopup(e, popup);
    });
    
    // Add popup for selected crashes
    map.on('mouseenter', 'selected-crashes', (e) => {
        showPopup(e, popup, true);
    });
    
    // Remove popups on mouseleave
    map.on('mouseleave', 'pedestrian-crashes', () => {
        removePopup(popup);
    });
    
    map.on('mouseleave', 'vehicle-crashes', () => {
        removePopup(popup);
    });
    
    map.on('mouseleave', 'selected-crashes', () => {
        removePopup(popup);
    });
}

// Show popup for a crash point
function showPopup(e, popup, isSelected = false) {
    if (!e.features || e.features.length === 0) return;
    
    map.getCanvas().style.cursor = 'pointer';
    
    const coordinates = e.features[0].geometry.coordinates.slice();
    const props = e.features[0].properties;
    
    const crashType = props.crash_type === 'pedestrian' ? 'Pedestrian' : 'Vehicle';
    const severityText = getSeverityText(props.severity);
    
    let html = `
        <h4>${crashType} Crash (${props.year})</h4>
        <p>Severity: ${severityText}</p>
        <p>Injuries: ${props.injuries}</p>
        <p>Fatalities: ${props.fatalities}</p>
    `;
    
    if (isSelected) {
        html += `<p><strong>Selected for analysis</strong></p>`;
    }
    
    popup.setLngLat(coordinates).setHTML(html).addTo(map);
}

// Remove a popup
function removePopup(popup) {
    map.getCanvas().style.cursor = '';
    popup.remove();
} 