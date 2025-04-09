// Variables for storing data and charts
let crashData = [];
let mapDrawn = false;
let draw;
let map;
let charts = {
    pedestrian: null,
    monthly: null,  // Changed from vehicle
    daynight: null, // Changed from types
    severity: null,
    intersection: null,
    metricsTrend: null,
    pedestrianAction: null,
    trafficControl: null
};
let quadMode;

// Common chart options for better layout
const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
        padding: {
            left: 10,
            right: 15,
            top: 10,
            bottom: 10
        }
    },
    plugins: {
        legend: {
            labels: {
                boxWidth: 12,
                font: {
                    size: 10
                }
            }
        }
    }
};

// Fetch crash data from the API
async function fetchCrashData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error(`Failed to fetch crash data: ${response.status} ${response.statusText}`);
        }
        
        try {
            crashData = await response.json();
            console.log('Crash data loaded:', crashData.length, 'records');
            
            // Initialize metrics with all data
            updateMetrics(crashData);
        } catch (jsonError) {
            console.error('Error parsing JSON:', jsonError);
            
            // Try to get the response text to see what went wrong
            const responseText = await response.text();
            console.error('Raw response:', responseText.substring(0, 500) + '...');
            
            alert('Error parsing data from server. See console for details.');
        }
    } catch (error) {
        console.error('Error fetching crash data:', error);
        alert(`Failed to load crash data: ${error.message}`);
    }
}

// Initialize the map with MapLibre GL JS
function initMap() {
    // First check if the map container exists
    if (!document.getElementById('map')) {
        console.error('Map container not found');
        return;
    }
    
    // Virginia center coordinates - adjusted to better center the state
    const vaCenter = [-79.5, 37.7];
    const defaultZoom = 6.5; // Decreased from 7 to show more of Virginia
    
    // Initialize the map
    map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'osm': {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }
            },
            layers: [
                {
                    id: 'osm',
                    type: 'raster',
                    source: 'osm',
                    minzoom: 0,
                    maxzoom: 19
                }
            ]
        },
        center: vaCenter,
        zoom: defaultZoom,
        attributionControl: true
    });
    
    // Add navigation control
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    
    // Create a selection box container
    const selectBoxContainer = document.createElement('div');
    selectBoxContainer.id = 'selection-box-container';
    selectBoxContainer.style.position = 'absolute';
    selectBoxContainer.style.top = '0';
    selectBoxContainer.style.left = '0';
    selectBoxContainer.style.width = '100%';
    selectBoxContainer.style.height = '100%';
    selectBoxContainer.style.pointerEvents = 'none';
    selectBoxContainer.style.zIndex = '5';
    document.getElementById('map-container').appendChild(selectBoxContainer);
    
    // Create the selection box
    const selectionBox = document.createElement('div');
    selectionBox.id = 'selection-box';
    selectionBox.style.position = 'absolute';
    selectionBox.style.border = '2px solid #0078FF';
    selectionBox.style.backgroundColor = 'rgba(0, 120, 255, 0.1)';
    selectionBox.style.display = 'none';
    selectBoxContainer.appendChild(selectionBox);
    
    // Create a button for enabling box selection
    const boxButton = document.createElement('button');
    boxButton.id = 'box-select-btn';
    boxButton.className = 'map-button';
    boxButton.innerHTML = '⬚';
    boxButton.title = 'Draw selection box';
    boxButton.style.position = 'absolute';
    boxButton.style.top = '150px'; // Changed from 110px to 150px to avoid overlap
    boxButton.style.right = '10px';
    boxButton.style.width = '32px';
    boxButton.style.height = '32px';
    boxButton.style.backgroundColor = 'white';
    boxButton.style.border = 'none';
    boxButton.style.borderRadius = '4px';
    boxButton.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.1)';
    boxButton.style.cursor = 'pointer';
    boxButton.style.textAlign = 'center';
    boxButton.style.fontSize = '20px';
    boxButton.style.fontWeight = 'bold';
    boxButton.style.color = '#333';
    boxButton.style.zIndex = '10';
    document.getElementById('map-container').appendChild(boxButton);
    
    // Add status message
    const statusDiv = document.createElement('div');
    statusDiv.id = 'status-message';
    statusDiv.className = 'map-overlay top-center-message';
    statusDiv.innerHTML = '<p>Click the square icon to draw a corridor</p>';
    document.getElementById('map-container').appendChild(statusDiv);
    
    // Create counter box
    const counterBox = document.createElement('div');
    counterBox.id = 'counter-box';
    counterBox.className = 'counter-overlay';
    document.getElementById('map-container').appendChild(counterBox);
    counterBox.style.display = 'none';
    
    // Set up selection box functionality
    let isSelecting = false;
    let startX, startY;
    let mapCanvas = map.getCanvas();
    
    // Box selection mode
    boxButton.addEventListener('click', function() {
        if (isSelecting) {
            // Turn off selection mode
            isSelecting = false;
            boxButton.style.backgroundColor = 'white';
            boxButton.style.color = '#333';
            mapCanvas.style.cursor = 'grab';
            statusDiv.innerHTML = '<p>Click the square icon to draw a corridor</p>';
        } else {
            // Turn on selection mode
            isSelecting = true;
            boxButton.style.backgroundColor = '#e6f2ff';
            boxButton.style.color = '#0078FF';
            mapCanvas.style.cursor = 'crosshair';
            statusDiv.innerHTML = '<p>Click and drag to draw a corridor</p>';
            
            // Clear any existing selection
            selectionBox.style.display = 'none';
            resetVisualization();
        }
    });
    
    // Clear button functionality
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            resetVisualization();
            selectionBox.style.display = 'none';
        });
    }
    
    // Mouse events for box selection
    mapCanvas.addEventListener('mousedown', function(e) {
        if (!isSelecting) return;
        
        const rect = mapCanvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
        
        // Prevent map dragging during selection
        e.preventDefault();
        e.stopPropagation();
    });
    
    mapCanvas.addEventListener('mousemove', function(e) {
        if (!isSelecting || selectionBox.style.display === 'none') return;
        
        const rect = mapCanvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        
        // Prevent map dragging during selection
        e.preventDefault();
        e.stopPropagation();
    });
    
    mapCanvas.addEventListener('mouseup', function(e) {
        if (!isSelecting || selectionBox.style.display === 'none') return;
        
        const rect = mapCanvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;
        
        // Verify we have a minimum size box
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        if (width < 10 || height < 10) {
            // Box too small, ignore
            selectionBox.style.display = 'none';
            return;
        }
        
        // Get the bounds of the selection box
        const sw = map.unproject([Math.min(startX, endX), Math.max(startY, endY)]);
        const ne = map.unproject([Math.max(startX, endX), Math.min(startY, endY)]);
        
        // Create a bounding box for filtering
        const boundingBox = [
            sw.lng, sw.lat,
            ne.lng, sw.lat,
            ne.lng, ne.lat,
            sw.lng, ne.lat,
            sw.lng, sw.lat
        ];
        
        // Create a polygon from the bounding box
        const selectionPolygon = turf.polygon([[
            [sw.lng, sw.lat],
            [ne.lng, sw.lat],
            [ne.lng, ne.lat],
            [sw.lng, ne.lat],
            [sw.lng, sw.lat]
        ]]);
        
        // Filter data by the selection box
        const filteredData = crashData.filter(crash => {
            const point = turf.point([parseFloat(crash.longitude), parseFloat(crash.latitude)]);
            return turf.booleanPointInPolygon(point, selectionPolygon);
        });
        
        // Update visualization with the filtered data
        updateVisualizationWithData(filteredData);
        
        // Exit selection mode
        isSelecting = false;
        boxButton.style.backgroundColor = 'white';
        boxButton.style.color = '#333';
        mapCanvas.style.cursor = 'grab';
    });
    
    map.on('load', function() {
        // Add some attribution
        map.addControl(new maplibregl.AttributionControl({
            compact: true
        }));
        
        // Add scale control
        map.addControl(new maplibregl.ScaleControl({
            maxWidth: 150,
            unit: 'imperial'
        }), 'bottom-left');
        
        // Add fullscreen control
        map.addControl(new maplibregl.FullscreenControl(), 'top-right');
        
        // Define Virginia cities for reference
        const virginiaCities = [
            { name: 'Richmond', coordinates: [-77.4360, 37.5407] },
            { name: 'Norfolk', coordinates: [-76.2122, 36.8508] },
            { name: 'Virginia Beach', coordinates: [-75.9774, 36.8529] },
            { name: 'Roanoke', coordinates: [-79.9414, 37.2710] },
            { name: 'Arlington', coordinates: [-77.1011, 38.8816] },
            { name: 'Alexandria', coordinates: [-77.0469, 38.8048] },
            { name: 'Charlottesville', coordinates: [-78.4767, 38.0293] },
            { name: 'Lynchburg', coordinates: [-79.1422, 37.4138] },
            { name: 'Blacksburg', coordinates: [-80.4139, 37.2296] },
            { name: 'Bristol', coordinates: [-82.1887, 36.5961] },
            { name: 'Fredericksburg', coordinates: [-77.4605, 38.3032] },
            { name: 'Harrisonburg', coordinates: [-78.8689, 38.4496] },
            { name: 'Winchester', coordinates: [-78.1633, 39.1857] },
            { name: 'Danville', coordinates: [-79.3950, 36.5859] },
            { name: 'Newport News', coordinates: [-76.5205, 37.0871] },
            { name: 'Hampton', coordinates: [-76.3452, 37.0298] },
            { name: 'Chesapeake', coordinates: [-76.2875, 36.7682] },
            { name: 'Staunton', coordinates: [-79.0717, 38.1496] },
            { name: 'Petersburg', coordinates: [-77.4019, 37.2279] },
            { name: 'Williamsburg', coordinates: [-76.7075, 37.2707] }
        ];
        
        // Add city names
        virginiaCities.forEach((city, index) => {
            // Determine if this is a major city (first 10 are major)
            const isMajorCity = index < 10;
            
            // Add city marker
            const marker = new maplibregl.Marker({
                color: isMajorCity ? "#003366" : "#666666",
                scale: isMajorCity ? 0.7 : 0.5
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
            cityLabel.className = `city-label ${isMajorCity ? 'major-city' : 'minor-city'}`;
            cityLabel.textContent = city.name;
            
            new maplibregl.Marker({
                element: cityLabel,
                anchor: 'center'
            })
            .setLngLat(city.coordinates)
            .addTo(map);
        });
        
        // Add zoom event to show/hide minor cities based on zoom level
        map.on('zoom', () => {
            const currentZoom = map.getZoom();
            const mapContainer = document.getElementById('map');
            
            if (currentZoom < 7) {
                mapContainer.classList.add('hide-minor-cities');
            } else {
                mapContainer.classList.remove('hide-minor-cities');
            }
        });
        
        // Trigger initial zoom check
        setTimeout(() => {
            const currentZoom = map.getZoom();
            const mapContainer = document.getElementById('map');
            
            if (currentZoom < 7) {
                mapContainer.classList.add('hide-minor-cities');
            }
        }, 500);
        
        // Add crash data to map
        addCrashDataToMap();
        
        // Load trail data after map and other layers are initialized
        setTimeout(() => {
            loadTrailData();
        }, 1000);
    });
}

// Initialize drawing tools
function initDrawingTools() {
    // Initialize MapboxDraw
    try {
        console.log('Initializing drawing tools');
        
        // Initialize draw with the rectangle tool enabled
        draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: false,
                point: false,
                line_string: false,
                trash: true,
                combine_features: false,
                uncombine_features: false
            },
            // Only enable rectangle mode to simplify the user experience
            defaultMode: 'draw_rectangle'
        });

        // Add the draw control to the map
        map.addControl(draw, 'top-right');
        console.log('Drawing tools initialized');
        
        // Create custom control for rectangle drawing
        const rectangleControl = document.createElement('div');
        rectangleControl.className = 'maplibregl-ctrl-group maplibregl-ctrl polygon-control';
        rectangleControl.innerHTML = `
            <button class="mapbox-gl-draw_ctrl-draw-btn rectangle-button" title="Draw Rectangle">
                <span class="polygon-icon">⬚</span>
            </button>
        `;
        
        // Add the custom control to the map container
        document.getElementById('map-container').appendChild(rectangleControl);
        
        // Add event listener for the rectangle mode button
        const rectangleButton = rectangleControl.querySelector('.rectangle-button');
        rectangleButton.addEventListener('click', function() {
            console.log('Rectangle button clicked');
            
            // Add active class to button
            rectangleButton.classList.add('active');
            
            // First try to delete any existing drawings
            try {
                draw.deleteAll();
                // Reset opacity of layers
                map.setPaintProperty('vehicle-crashes', 'circle-opacity', 0.8);
                map.setPaintProperty('pedestrian-crashes', 'circle-opacity', 0.8);
            } catch (err) {
                console.warn('Nothing to delete:', err);
            }
            
            // Start rectangle drawing mode
            try {
                console.log('Changing to rectangle mode...');
                draw.changeMode('draw_rectangle');
                console.log('Changed to rectangle mode successfully');
                
                // Update status message
                const statusDiv = document.getElementById('status-message');
                if (statusDiv) {
                    statusDiv.innerHTML = '<p>Click and drag to draw a rectangle area</p>';
                }
            } catch (err) {
                console.error('Error changing to rectangle mode:', err);
                alert('Error starting rectangle mode. See console for details.');
            }
        });
        
        // Set up event handlers for drawing
        map.on('draw.create', function(e) {
            console.log('Draw create event triggered', e);
            rectangleButton.classList.remove('active');
            handleDrawEvent(e);
        });
        
        map.on('draw.update', function(e) {
            console.log('Draw update event triggered', e);
            handleDrawEvent(e);
        });
        
        map.on('draw.delete', function(e) {
            console.log('Draw delete event triggered', e);
            clearVisualization();
        });
        
        map.on('draw.modechange', function(e) {
            console.log('Draw mode changed:', e.mode);
            if (e.mode !== 'draw_rectangle') {
                rectangleButton.classList.remove('active');
            }
        });
        
        // Add status message
        const statusDiv = document.createElement('div');
        statusDiv.id = 'status-message';
        statusDiv.className = 'map-overlay';
        statusDiv.innerHTML = '<p>Click the square icon to draw a rectangle</p>';
        document.getElementById('map-container').appendChild(statusDiv);
        
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
    
    // If there's a feature, show it clearly on the map for better visibility
    try {
        const features = draw.getAll();
        if (features.features.length > 0) {
            // Highlight the drawing
            if (!map.getSource('current-drawing')) {
                map.addSource('current-drawing', {
                    type: 'geojson',
                    data: features
                });
            } else {
                map.getSource('current-drawing').setData(features);
            }
            
            // Add a visible outline if it doesn't exist
            if (!map.getLayer('drawing-outline')) {
                map.addLayer({
                    id: 'drawing-outline',
                    type: 'line',
                    source: 'current-drawing',
                    paint: {
                        'line-color': '#ffcc00',
                        'line-width': 3,
                        'line-opacity': 0.9
                    }
                });
            }
        }
    } catch (error) {
        console.warn('Error highlighting drawing:', error);
    }
    
    updateVisualization();
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
            
            // Handle different geometry types - only polygon/rectangle is supported now
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
                
                console.log(`Found ${pointsInPolygon.length} points in rectangle`);
                filteredData = [...filteredData, ...pointsInPolygon];
            }
        });
        
        // Remove duplicates if any
        filteredData = [...new Map(filteredData.map(item => [item.latitude + ',' + item.longitude, item])).values()];
        
        console.log(`Total filtered data points: ${filteredData.length}`);
        
        if (filteredData.length === 0) {
            statusDiv.innerHTML = '<p>No crashes found in the selected corridor</p>';
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
        statusDiv.innerHTML = `<p>Showing ${filteredData.length} crashes in selected corridor</p>`;
        
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

// Clear visualization when rectangle is deleted
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
    statusDiv.innerHTML = '<p>Click the square icon to draw a corridor</p>';
    
    // Hide counter box
    document.getElementById('counter-box').style.display = 'none';
}

// Initialize charts with default data
function initCharts(data) {
    // Initialize pedestrian crashes by year chart
    updatePedestrianChart(data);
    
    // Initialize monthly crashes chart (replacing vehicle crashes by year)
    updateMonthlyChart(data);
    
    // Initialize day/night chart (replacing total crashes by type)
    updateDayNightChart(data);
    
    // Initialize severity and injuries chart
    updateSeverityChart(data);
    
    // Initialize intersection type chart
    updateIntersectionChart(data);
    
    // Initialize metrics trend chart
    updateMetricsTrendChart(data);
    
    // Initialize pedestrian action chart
    updatePedestrianActionChart(data);
    
    // Initialize traffic control type chart
    updateTrafficControlChart(data);
}

// Update all charts with filtered data
function updateCharts(data) {
    updatePedestrianChart(data);
    updateMonthlyChart(data);
    updateDayNightChart(data);
    updateSeverityChart(data);
    updateIntersectionChart(data);
    updateMetricsTrendChart(data);
    updatePedestrianActionChart(data);
    updateTrafficControlChart(data);
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
            ...commonChartOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxCount + Math.ceil(maxCount * 0.1), // Add 10% padding
                    ticks: {
                        precision: 0,
                        stepSize: Math.max(1, Math.ceil(maxCount / 5)), // At most 5 ticks
                        font: {
                            size: 9
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 9
                        }
                    }
                }
            },
            plugins: {
                ...commonChartOptions.plugins,
                title: {
                    display: true,
                    text: `Pedestrian Crashes (${pedestrianData.length} total)`,
                    font: {
                        size: 11
                    }
                }
            }
        }
    });
}

// Update monthly crashes chart (replaces vehicle crashes by year)
function updateMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    
    // Define all months in order
    const allMonths = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Initialize counts for each month
    const monthCounts = {};
    allMonths.forEach(month => {
        monthCounts[month] = 0;
    });
    
    // Count crashes by month
    data.forEach(crash => {
        if (crash.month && typeof crash.month === 'string') {
            const monthName = crash.month.trim();
            if (allMonths.includes(monthName)) {
                monthCounts[monthName]++;
            }
        }
    });
    
    // Prepare data in correct order
    const counts = allMonths.map(month => monthCounts[month]);
    
    // Find max count for y-axis scaling
    const maxCount = Math.max(...counts, 1);  // Use at least 1 to avoid empty charts
    
    // Log the month counts for debugging
    console.log('Month counts:', monthCounts);
    
    // Destroy previous chart if it exists
    if (charts.monthly) {
        charts.monthly.destroy();
    }
    
    // Create new chart
    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: allMonths,
            datasets: [{
                label: 'Crashes by Month',
                data: counts,
                backgroundColor: [
                    '#4D94FF', // January
                    '#4D94FF', // February
                    '#76DB94', // March
                    '#76DB94', // April
                    '#76DB94', // May
                    '#FFC861', // June
                    '#FFC861', // July
                    '#FFC861', // August
                    '#F29D62', // September
                    '#F29D62', // October
                    '#F29D62', // November
                    '#4D94FF'  // December
                ],
                borderColor: 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }]
        },
        options: {
            ...commonChartOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxCount + Math.ceil(maxCount * 0.1), // Add 10% padding
                    ticks: {
                        precision: 0,
                        stepSize: Math.max(1, Math.ceil(maxCount / 5)), // At most 5 ticks
                        font: {
                            size: 9
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 8
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: `Crashes by Month (${data.length} total)`,
                    font: {
                        size: 11
                    }
                }
            }
        }
    });
}

// Update day vs night chart (replaces total crashes by type)
function updateDayNightChart(data) {
    const ctx = document.getElementById('daynightChart').getContext('2d');
    
    // Count crashes by day/night
    const dayCrashes = data.filter(crash => crash.day_night === 'Daytime' || crash.day_night === 'Day').length;
    const nightCrashes = data.filter(crash => crash.day_night === 'Nighttime' || crash.day_night === 'Night').length;
    const unknownCrashes = data.filter(crash => !['Daytime', 'Nighttime', 'Day', 'Night'].includes(crash.day_night)).length;
    
    // Prepare data array
    const labels = ['Daytime', 'Nighttime'];
    const counts = [dayCrashes, nightCrashes];
    const colors = ['#FFD700', '#3A3B98']; // Yellow for day, dark blue for night
    
    // Add unknown if there are any
    if (unknownCrashes > 0) {
        labels.push('Unknown');
        counts.push(unknownCrashes);
        colors.push('#CCCCCC');
    }
    
    // Destroy previous chart if it exists
    if (charts.daynight) {
        charts.daynight.destroy();
    }
    
    // Create new chart
    charts.daynight = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors,
                borderColor: 'white',
                borderWidth: 1
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 10
                        }
                    }
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
                    text: 'Daytime vs. Nighttime Crashes',
                    font: {
                        size: 11
                    }
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
    
    // Find max counts for y-axis scaling
    const severityValues = Object.values(severityCounts);
    const maxSeverityCount = Math.max(...severityValues, 1);
    const maxYValue = maxSeverityCount;
    
    // Destroy previous chart if it exists
    if (charts.severity) {
        charts.severity.destroy();
    }
    
    // Create new chart (bar chart only, no line)
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
                    borderWidth: 1
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

// Update intersection type chart
function updateIntersectionChart(data) {
    const ctx = document.getElementById('intersectionChart').getContext('2d');
    
    // Count crashes by intersection type
    const intersectionCounts = {};
    data.forEach(crash => {
        const type = crash.intersection_type || 'Unknown';
        intersectionCounts[type] = (intersectionCounts[type] || 0) + 1;
    });
    
    // Sort by count (descending) and take top 5 types, group others
    const sortedTypes = Object.keys(intersectionCounts)
        .sort((a, b) => intersectionCounts[b] - intersectionCounts[a]);
    
    let labels = [];
    let counts = [];
    let colors = ['#3388FF', '#FF5533', '#33CC99', '#FF9900', '#9966CC'];
    
    if (sortedTypes.length <= 5) {
        labels = sortedTypes;
        counts = labels.map(type => intersectionCounts[type]);
    } else {
        // Take top 4 and group others
        labels = sortedTypes.slice(0, 4);
        counts = labels.map(type => intersectionCounts[type]);
        
        // Sum the rest as "Other"
        const otherSum = sortedTypes.slice(4).reduce((sum, type) => sum + intersectionCounts[type], 0);
        labels.push('Other');
        counts.push(otherSum);
        colors.push('#999999');
    }
    
    // Destroy previous chart if it exists
    if (charts.intersection) {
        charts.intersection.destroy();
    }
    
    // Create new chart
    charts.intersection = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 9
                        }
                    }
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
                    text: 'Crashes by Intersection Type',
                    font: {
                        size: 11
                    }
                }
            }
        }
    });
}

// Update metrics trend chart
function updateMetricsTrendChart(data) {
    const ctx = document.getElementById('metricsTrendChart').getContext('2d');
    
    // Group metrics by year
    const yearMetrics = {};
    
    // Initialize all years
    const years = [...new Set(data.map(crash => crash.year))].sort();
    years.forEach(year => {
        yearMetrics[year] = {
            totalCrashes: 0,
            fatalCrashes: 0,
            injuryCrashes: 0,
            pedestrianInjuries: 0,
            pedestrianFatalities: 0
        };
    });
    
    // Populate metrics for each year
    years.forEach(year => {
        const yearData = data.filter(crash => crash.year === year);
        
        yearMetrics[year].totalCrashes = yearData.length;
        yearMetrics[year].fatalCrashes = yearData.filter(crash => parseInt(crash.fatalities || 0) > 0).length;
        yearMetrics[year].injuryCrashes = yearData.filter(crash => parseInt(crash.injuries || 0) > 0).length;
        
        const pedestrianData = yearData.filter(crash => crash.crash_type === 'pedestrian');
        yearMetrics[year].pedestrianInjuries = pedestrianData.reduce((sum, crash) => sum + parseInt(crash.injuries || 0), 0);
        yearMetrics[year].pedestrianFatalities = pedestrianData.reduce((sum, crash) => sum + parseInt(crash.fatalities || 0), 0);
    });
    
    // Prepare datasets
    const datasets = [
        {
            label: 'Total Crashes',
            data: years.map(year => yearMetrics[year].totalCrashes),
            borderColor: '#3388FF',
            backgroundColor: 'rgba(51, 136, 255, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1
        },
        {
            label: 'Fatal Crashes',
            data: years.map(year => yearMetrics[year].fatalCrashes),
            borderColor: '#FF5533',
            backgroundColor: 'rgba(255, 85, 51, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1
        },
        {
            label: 'Injury Crashes',
            data: years.map(year => yearMetrics[year].injuryCrashes),
            borderColor: '#33CC99',
            backgroundColor: 'rgba(51, 204, 153, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1
        },
        {
            label: 'Pedestrian Injuries',
            data: years.map(year => yearMetrics[year].pedestrianInjuries),
            borderColor: '#FF9900',
            backgroundColor: 'rgba(255, 153, 0, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1
        },
        {
            label: 'Pedestrian Fatalities',
            data: years.map(year => yearMetrics[year].pedestrianFatalities),
            borderColor: '#9966CC',
            backgroundColor: 'rgba(153, 102, 204, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1
        }
    ];
    
    // Destroy previous chart if it exists
    if (charts.metricsTrend) {
        charts.metricsTrend.destroy();
    }
    
    // Create new chart
    charts.metricsTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: datasets
        },
        options: {
            ...commonChartOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        font: {
                            size: 9
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 9
                        }
                    }
                }
            },
            plugins: {
                ...commonChartOptions.plugins,
                title: {
                    display: true,
                    text: 'Metrics Trend by Year',
                    font: {
                        size: 11
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 10,
                        font: {
                            size: 8
                        }
                    }
                }
            }
        }
    });
}

// Update pedestrian action category chart
function updatePedestrianActionChart(data) {
    const ctx = document.getElementById('pedestrianActionChart').getContext('2d');
    
    // Filter pedestrian data
    const pedestrianData = data.filter(crash => crash.crash_type === 'pedestrian');
    
    // Count crashes by pedestrian action category
    const actionCounts = {};
    pedestrianData.forEach(crash => {
        const action = crash.pedestrian_action || 'Unknown';
        actionCounts[action] = (actionCounts[action] || 0) + 1;
    });
    
    // Sort by count (descending) and take top 5 types, group others
    const sortedActions = Object.keys(actionCounts)
        .sort((a, b) => actionCounts[b] - actionCounts[a]);
    
    let labels = [];
    let counts = [];
    let colors = ['#3388FF', '#FF5533', '#33CC99', '#FF9900', '#9966CC', '#6699CC', '#FF6699'];
    
    if (sortedActions.length <= 7) {
        labels = sortedActions;
        counts = labels.map(action => actionCounts[action]);
    } else {
        // Take top 6 and group others
        labels = sortedActions.slice(0, 6);
        counts = labels.map(action => actionCounts[action]);
        
        // Sum the rest as "Other"
        const otherSum = sortedActions.slice(6).reduce((sum, action) => sum + actionCounts[action], 0);
        labels.push('Other');
        counts.push(otherSum);
        colors.push('#999999');
    }
    
    // Destroy previous chart if it exists
    if (charts.pedestrianAction) {
        charts.pedestrianAction.destroy();
    }
    
    // Create new chart
    charts.pedestrianAction = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 9
                        }
                    }
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
                    text: 'Pedestrian Actions',
                    font: {
                        size: 11
                    }
                }
            }
        }
    });
}

// Update traffic control type chart
function updateTrafficControlChart(data) {
    const ctx = document.getElementById('trafficControlChart').getContext('2d');
    
    // Count crashes by traffic control type
    const controlCounts = {};
    data.forEach(crash => {
        const control = crash.traffic_control || 'Unknown';
        controlCounts[control] = (controlCounts[control] || 0) + 1;
    });
    
    // Sort by count (descending) and take top types, group others
    const sortedControls = Object.keys(controlCounts)
        .sort((a, b) => controlCounts[b] - controlCounts[a]);
    
    let labels = [];
    let counts = [];
    let colors = ['#3388FF', '#FF5533', '#33CC99', '#FF9900', '#9966CC', '#6699CC', '#FF6699'];
    
    if (sortedControls.length <= 7) {
        labels = sortedControls;
        counts = labels.map(control => controlCounts[control]);
    } else {
        // Take top 6 and group others
        labels = sortedControls.slice(0, 6);
        counts = labels.map(control => controlCounts[control]);
        
        // Sum the rest as "Other"
        const otherSum = sortedControls.slice(6).reduce((sum, control) => sum + controlCounts[control], 0);
        labels.push('Other');
        counts.push(otherSum);
        colors.push('#999999');
    }
    
    // Destroy previous chart if it exists
    if (charts.trafficControl) {
        charts.trafficControl.destroy();
    }
    
    // Create new chart
    charts.trafficControl = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 9
                        }
                    }
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
                    text: 'Traffic Control Types',
                    font: {
                        size: 11
                    }
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
        
        // Set up PDF download button
        setupPdfDownload();
        
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

// Calculate and update metrics based on the provided data
function updateMetrics(data) {
    // Total crashes
    const totalCrashes = data.length;
    document.getElementById('total-crashes').textContent = totalCrashes;
    
    // Fatal crashes (crashes with at least one fatality)
    const fatalCrashes = data.filter(crash => parseInt(crash.fatalities || 0) > 0).length;
    document.getElementById('fatal-crashes').textContent = fatalCrashes;
    
    // Injury crashes (crashes with at least one injury)
    const injuryCrashes = data.filter(crash => parseInt(crash.injuries || 0) > 0).length;
    document.getElementById('injury-crashes').textContent = injuryCrashes;
    
    // Pedestrian injuries and fatalities
    const pedestrianData = data.filter(crash => crash.crash_type === 'pedestrian');
    const pedestrianInjuries = pedestrianData.reduce((sum, crash) => sum + parseInt(crash.injuries || 0), 0);
    document.getElementById('pedestrian-injuries').textContent = pedestrianInjuries;
    
    const pedestrianFatalities = pedestrianData.reduce((sum, crash) => sum + parseInt(crash.fatalities || 0), 0);
    document.getElementById('pedestrian-fatalities').textContent = pedestrianFatalities;
    
    // Bicycle crashes
    const bicycleCrashes = data.filter(crash => crash.bicycle_involved === true).length;
    document.getElementById('bicycle-crashes').textContent = bicycleCrashes;
    
    // Motorcycle crashes 
    const motorcycleCrashes = data.filter(crash => crash.motorcycle_involved === true).length;
    
    // Add a new metric card for motorcycle if it doesn't exist
    const metricsContainer = document.querySelector('.metrics-container');
    if (metricsContainer && !document.getElementById('motorcycle-crashes-card')) {
        const motorcycleCard = document.createElement('div');
        motorcycleCard.className = 'metric-card';
        motorcycleCard.id = 'motorcycle-crashes-card';
        motorcycleCard.innerHTML = `
            <div id="motorcycle-crashes-count" class="metric-value">${motorcycleCrashes}</div>
            <div class="metric-label">Motorcycle Crashes</div>
        `;
        metricsContainer.appendChild(motorcycleCard);
    } else if (document.getElementById('motorcycle-crashes-count')) {
        document.getElementById('motorcycle-crashes-count').textContent = motorcycleCrashes;
    }
}

// Update counter display with crash statistics
function updateCounterDisplay(filteredData) {
    // Update metrics with filtered data
    updateMetrics(filteredData);
    
    // The previous code for the counter overlay is now redundant
    // Hide the counter overlay if it exists (for backward compatibility)
    const counterBox = document.getElementById('counter-box');
    if (counterBox) {
        counterBox.style.display = 'none';
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

// Update visualizations with filtered data
function updateVisualizationWithData(filteredData) {
    try {
        console.log('Updating visualization with filtered data');
        
        // Update status message
        const statusDiv = document.getElementById('status-message');
        
        console.log(`Total filtered data points: ${filteredData.length}`);
        
        if (filteredData.length === 0) {
            statusDiv.innerHTML = '<p>No crashes found in the selected corridor</p>';
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
        statusDiv.innerHTML = `<p>Showing ${filteredData.length} crashes in selected corridor</p>`;
        
        // Update counter displays
        updateCounterDisplay(filteredData);
        
    } catch (error) {
        console.error('Error updating visualization:', error);
        const statusDiv = document.getElementById('status-message');
        statusDiv.innerHTML = '<p>Error processing selection. Try again.</p>';
    }
}

// Reset visualization to show all data
function resetVisualization() {
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
    
    // Reset metrics to show all data
    updateMetrics(crashData);
    
    mapDrawn = false;
    
    // Update status message
    const statusDiv = document.getElementById('status-message');
    statusDiv.innerHTML = '<p>Click the square icon to draw a corridor</p>';
    
    // Hide counter box
    document.getElementById('counter-box').style.display = 'none';
}

// Set up PDF download functionality
function setupPdfDownload() {
    const downloadBtn = document.getElementById('download-pdf');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            // Show loading message
            downloadBtn.textContent = "Generating PDF...";
            downloadBtn.disabled = true;
            
            // Get current date for the report
            const currentDate = new Date().toLocaleDateString();
            
            // Use jsPDF to create a new PDF document
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            
            // Set the title of the document
            doc.setFontSize(20);
            doc.text("Virginia Transportation Corridor Analysis", pageWidth / 2, 20, { align: 'center' });
            
            doc.setFontSize(12);
            doc.text(`Report generated on ${currentDate}`, pageWidth / 2, 30, { align: 'center' });
            
            // Capture the metrics dashboard
            const metricsPromise = html2canvas(document.getElementById('metrics-dashboard'), {
                scale: 2,
                logging: false
            }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pageWidth - 40; // 20mm margins on each side
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                doc.text("Key Metrics", pageWidth / 2, 40, { align: 'center' });
                doc.addImage(imgData, 'PNG', 20, 45, imgWidth, imgHeight);
                
                return 45 + imgHeight + 10; // Return the Y position for the next element
            });
            
            // After capturing metrics, capture each chart
            metricsPromise.then(yPosition => {
                let currentY = yPosition;
                const chartBoxes = document.querySelectorAll('.chart-box');
                const chartPromises = [];
                
                // If we're going to go beyond the first page, add a new page
                if (currentY > 250) {
                    doc.addPage();
                    currentY = 20;
                }
                
                doc.setFontSize(16);
                doc.text("Analysis Charts", pageWidth / 2, currentY, { align: 'center' });
                currentY += 10;
                
                // Capture each chart
                chartBoxes.forEach((chartBox, index) => {
                    const chartPromise = html2canvas(chartBox, {
                        scale: 2,
                        logging: false
                    }).then(canvas => {
                        const imgData = canvas.toDataURL('image/png');
                        const imgWidth = pageWidth - 40;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;
                        
                        // Check if we need to add a new page
                        if (currentY + imgHeight > 270) {
                            doc.addPage();
                            currentY = 20;
                        }
                        
                        // Add the chart title
                        const title = chartBox.querySelector('h3').textContent;
                        doc.setFontSize(12);
                        doc.text(title, pageWidth / 2, currentY, { align: 'center' });
                        
                        // Add the chart image
                        doc.addImage(imgData, 'PNG', 20, currentY + 5, imgWidth, imgHeight);
                        currentY += imgHeight + 15;
                    });
                    
                    chartPromises.push(chartPromise);
                });
                
                // When all charts have been captured, save the PDF
                Promise.all(chartPromises).then(() => {
                    // Save the PDF
                    doc.save('Virginia-Corridor-Analysis.pdf');
                    
                    // Reset the button
                    downloadBtn.textContent = "Download PDF";
                    downloadBtn.disabled = false;
                }).catch(error => {
                    console.error('Error generating PDF:', error);
                    alert('Error generating PDF. Please try again.');
                    downloadBtn.textContent = "Download PDF";
                    downloadBtn.disabled = false;
                });
            }).catch(error => {
                console.error('Error capturing metrics:', error);
                alert('Error generating PDF. Please try again.');
                downloadBtn.textContent = "Download PDF";
                downloadBtn.disabled = false;
            });
        });
    }
}

// Function to load and display trail data
function loadTrailData() {
    console.log('Attempting to load trail data...');
    
    // Ensure map is initialized before attempting to add layers
    if (!map) {
        console.error('Map not initialized, cannot load trails');
        return;
    }
    
    if (!map.loaded()) {
        console.log('Map not yet loaded, waiting...');
        // Try again in a moment when the map is loaded
        setTimeout(loadTrailData, 500);
        return;
    }
    
    console.log('Map is loaded, creating sample Virginia trails data');
    
    // Create a simplified GeoJSON structure with a few sample Virginia trails
    const sampleTrailsData = {
        "type": "FeatureCollection",
        "name": "Trails",
        "features": [
            {
                "type": "Feature",
                "properties": { "OBJECTID": 1, "TYPE_CODE": 1, "SOURCE": 93 },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-77.41820, 38.59932],
                        [-77.41836, 38.59953],
                        [-77.41843, 38.59969],
                        [-77.41849, 38.59995],
                        [-77.41852, 38.60021],
                        [-77.41852, 38.60040],
                        [-77.41847, 38.60061]
                    ]
                }
            },
            {
                "type": "Feature", 
                "properties": { "OBJECTID": 2, "TYPE_CODE": 1, "SOURCE": 93 },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-77.41724, 38.59971],
                        [-77.41724, 38.59971],
                        [-77.41724, 38.59973],
                        [-77.41723, 38.59975],
                        [-77.41723, 38.59977],
                        [-77.41723, 38.59979],
                        [-77.41722, 38.59981],
                        [-77.41721, 38.59983],
                        [-77.41721, 38.59985],
                        [-77.41720, 38.59987]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": { "OBJECTID": 3, "TYPE_CODE": 1, "SOURCE": 93 },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-77.43297, 38.61402],
                        [-77.43308, 38.61413],
                        [-77.43319, 38.61427],
                        [-77.43329, 38.61443],
                        [-77.43336, 38.61459],
                        [-77.43345, 38.61486],
                        [-77.43347, 38.61493]
                    ]
                }
            },
            // Add more trail segments from around Virginia
            {
                "type": "Feature",
                "properties": { "OBJECTID": 10, "TYPE_CODE": 1, "SOURCE": 93 },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-79.35644, 37.95541],
                        [-79.35641, 37.95528],
                        [-79.35636, 37.95511],
                        [-79.35628, 37.95501],
                        [-79.35618, 37.95492],
                        [-79.35607, 37.95485],
                        [-79.35595, 37.95481]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": { "OBJECTID": 11, "TYPE_CODE": 1, "SOURCE": 93 },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-78.69153, 38.07431],
                        [-78.69136, 38.07422],
                        [-78.69119, 38.07414],
                        [-78.69101, 38.07407],
                        [-78.69083, 38.07402],
                        [-78.69064, 38.07399],
                        [-78.69045, 38.07398]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": { "OBJECTID": 12, "TYPE_CODE": 1, "SOURCE": 93 },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-80.05213, 37.29854],
                        [-80.05196, 37.29846],
                        [-80.05178, 37.29839],
                        [-80.05160, 37.29834],
                        [-80.05141, 37.29831],
                        [-80.05122, 37.29829],
                        [-80.05103, 37.29830]
                    ]
                }
            },
            // Richmond area trails
            {
                "type": "Feature",
                "properties": { "OBJECTID": 13, "TYPE_CODE": 1, "SOURCE": 93 },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-77.43603, 37.54328],
                        [-77.43585, 37.54317],
                        [-77.43566, 37.54308],
                        [-77.43546, 37.54301],
                        [-77.43526, 37.54297],
                        [-77.43505, 37.54295],
                        [-77.43484, 37.54296]
                    ]
                }
            },
            // Virginia Beach area trails
            {
                "type": "Feature",
                "properties": { "OBJECTID": 14, "TYPE_CODE": 1, "SOURCE": 93 },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-75.97829, 36.85021],
                        [-75.97811, 36.85031],
                        [-75.97794, 36.85042],
                        [-75.97778, 36.85055],
                        [-75.97764, 36.85069],
                        [-75.97751, 36.85085],
                        [-75.97740, 36.85102]
                    ]
                }
            }
        ]
    };
    
    try {
        console.log('Adding sample trails to map:', sampleTrailsData.features.length, 'trail segments');
        
        // First remove any existing trail layers/sources
        if (map.getLayer('trail-lines')) {
            console.log('Removing existing trail layer');
            map.removeLayer('trail-lines');
        }
        
        if (map.getSource('trails')) {
            console.log('Removing existing trail source');
            map.removeSource('trails');
        }
        
        // Add the source with the GeoJSON data
        console.log('Adding trail source to map');
        map.addSource('trails', {
            type: 'geojson',
            data: sampleTrailsData
        });
        
        // Add trails layer
        console.log('Adding trail layer to map');
        map.addLayer({
            id: 'trail-lines',
            type: 'line',
            source: 'trails',
            layout: {
                'line-join': 'round',
                'line-cap': 'round',
                'visibility': 'visible'
            },
            paint: {
                'line-color': '#007F00', // Darker green color that stands out more
                'line-width': 4, // Keep the increased width
                'line-opacity': 1.0, // Keep full opacity
                'line-dasharray': [0.5, 0.25] // Keep the dash pattern
            }
        });
        
        // Add more trails across Virginia - these will be different from the previous ones
        // to ensure we have trails visible in different parts of the state
        setTimeout(() => {
            console.log('Adding more trails to enhance visibility');
            
            // Create more trail data with lines across different parts of Virginia
            const additionalTrails = {
                "type": "FeatureCollection",
                "name": "MoreTrails",
                "features": [
                    // Northern Virginia - Capital Trail
                    {
                        "type": "Feature",
                        "properties": { "OBJECTID": 20, "TYPE_CODE": 1, "SOURCE": 93 },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-77.3010, 38.6522],
                                [-77.2940, 38.6490],
                                [-77.2870, 38.6460],
                                [-77.2800, 38.6430],
                                [-77.2730, 38.6400],
                                [-77.2660, 38.6370]
                            ]
                        }
                    },
                    // Charlottesville area - Monticello Trail
                    {
                        "type": "Feature",
                        "properties": { "OBJECTID": 25, "TYPE_CODE": 1, "SOURCE": 93 },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-78.4765, 38.0291],
                                [-78.4795, 38.0261],
                                [-78.4825, 38.0231],
                                [-78.4855, 38.0201],
                                [-78.4885, 38.0171]
                            ]
                        }
                    },
                    // Central Virginia - Skyline Drive
                    {
                        "type": "Feature",
                        "properties": { "OBJECTID": 21, "TYPE_CODE": 1, "SOURCE": 93 },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-78.4056, 38.9125],
                                [-78.4000, 38.9000],
                                [-78.3950, 38.8875],
                                [-78.3900, 38.8750],
                                [-78.3850, 38.8625],
                                [-78.3800, 38.8500]
                            ]
                        }
                    },
                    // Southwest Virginia - New River Trail
                    {
                        "type": "Feature",
                        "properties": { "OBJECTID": 22, "TYPE_CODE": 1, "SOURCE": 93 },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-80.9125, 36.7000],
                                [-80.9000, 36.6875],
                                [-80.8875, 36.6750],
                                [-80.8750, 36.6625],
                                [-80.8625, 36.6500],
                                [-80.8500, 36.6375]
                            ]
                        }
                    },
                    // Virginia Beach Boardwalk
                    {
                        "type": "Feature",
                        "properties": { "OBJECTID": 23, "TYPE_CODE": 1, "SOURCE": 93 },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-75.9750, 36.8500],
                                [-75.9750, 36.8400],
                                [-75.9750, 36.8300],
                                [-75.9750, 36.8200],
                                [-75.9750, 36.8100],
                                [-75.9750, 36.8000]
                            ]
                        }
                    },
                    // Richmond Canal Walk
                    {
                        "type": "Feature",
                        "properties": { "OBJECTID": 24, "TYPE_CODE": 1, "SOURCE": 93 },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-77.4397, 37.5350],
                                [-77.4375, 37.5325],
                                [-77.4350, 37.5300],
                                [-77.4325, 37.5275],
                                [-77.4300, 37.5250]
                            ]
                        }
                    }
                ]
            };
            
            try {
                // Check if trails source exists
                if (map.getSource('more-trails')) {
                    map.removeSource('more-trails');
                }
                
                // Add the additional trails source
                map.addSource('more-trails', {
                    type: 'geojson',
                    data: additionalTrails
                });
                
                // Add more trails layer
                map.addLayer({
                    id: 'more-trail-lines',
                    type: 'line',
                    source: 'more-trails',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round',
                        'visibility': 'visible'
                    },
                    paint: {
                        'line-color': '#007F00', // Use the same darker green
                        'line-width': 4.5, // Slightly thicker
                        'line-opacity': 1.0
                    }
                });
                
                console.log('Additional trails added successfully');
            } catch (err) {
                console.error('Error adding additional trails:', err);
            }
        }, 2000); // Wait 2 seconds after the initial trails are added
        
        // Check if the layer was actually added
        if (map.getLayer('trail-lines')) {
            console.log('Trail layer successfully added to map');
            
            // Add a legend for the map if not already there
            if (!document.querySelector('.map-legend')) {
                addMapLegend();
            }
        } else {
            console.warn('Trail layer not found after adding');
        }
    } catch (err) {
        console.error('Error adding trail data to map:', err);
    }
}

// Function to add a legend to the map
function addMapLegend() {
    const legendContainer = document.createElement('div');
    legendContainer.className = 'map-legend';
    legendContainer.innerHTML = `
        <div class="legend-item">
            <div class="legend-color trail-legend-color"></div>
            <div>Virginia Trails</div>
        </div>
    `;
    document.getElementById('map-container').appendChild(legendContainer);
} 