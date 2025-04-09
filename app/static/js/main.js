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
    trafficControl: null,
    motorcycle: null
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
    
    // Virginia center coordinates
    const vaCenter = [-78.6, 37.5];
    const defaultZoom = 7;
    
    // Initialize the map
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://demotiles.maplibre.org/style.json', // Free MapLibre demo tiles that don't require an API key
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
    boxButton.style.top = '110px';
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
    statusDiv.className = 'map-overlay';
    statusDiv.innerHTML = '<p>Click the square icon to draw a selection box</p>';
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
            statusDiv.innerHTML = '<p>Click the square icon to draw a selection box</p>';
        } else {
            // Turn on selection mode
            isSelecting = true;
            boxButton.style.backgroundColor = '#e6f2ff';
            boxButton.style.color = '#0078FF';
            mapCanvas.style.cursor = 'crosshair';
            statusDiv.innerHTML = '<p>Click and drag to draw a selection box</p>';
            
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
            { name: 'Bristol', coordinates: [-82.1887, 36.5961] }
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
        
        // Add crash data to map
        addCrashDataToMap();
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
    statusDiv.innerHTML = '<p>Click the square icon to draw a rectangle</p>';
    
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
    
    // Initialize motorcycle crashes by action chart
    updateMotorcycleChart(data);
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
    updateMotorcycleChart(data);
}

// Update motorcycle crashes by action chart
function updateMotorcycleChart(data) {
    const ctx = document.getElementById('motorcycleChart').getContext('2d');
    
    // Filter motorcycle data
    const motorcycleData = data.filter(crash => crash.crash_type === 'motorcycle');
    
    // Count crashes by motorcycle action category
    const actionCounts = {};
    motorcycleData.forEach(crash => {
        let action = crash.motorcycle_action || 'Unknown';
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
    if (charts.motorcycle) {
        charts.motorcycle.destroy();
    }
    
    // Create new chart
    charts.motorcycle = new Chart(ctx, {
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
                    text: 'Motorcycle Crashes by Action',
                    font: {
                        size: 11
                    }
                }
            }
        }
    });
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
    
    // Motorcycle crashes
    const motorcycleCrashes = data.filter(crash => crash.motorcycle_involved === true).length;
    document.getElementById('bicycle-crashes').textContent = motorcycleCrashes;
    
    // Bicycle crashes 
    const bicycleCrashes = data.filter(crash => crash.bicycle_involved === true).length;
    // Update the label to reflect motorcycle counts instead of bicycle
    const bicycleLabel = document.querySelector('.metric-card:last-child .metric-label');
    if (bicycleLabel) {
        bicycleLabel.textContent = 'Motorcycle';
    }
    
    // Add a new metric card for bicycle if it doesn't exist
    const metricsContainer = document.querySelector('.metrics-container');
    if (metricsContainer && !document.getElementById('bicycle-crashes-card')) {
        const bicycleCard = document.createElement('div');
        bicycleCard.className = 'metric-card';
        bicycleCard.id = 'bicycle-crashes-card';
        bicycleCard.innerHTML = `
            <div id="bicycle-crashes-count" class="metric-value">${bicycleCrashes}</div>
            <div class="metric-label">Bicycle</div>
        `;
        metricsContainer.appendChild(bicycleCard);
    } else if (document.getElementById('bicycle-crashes-count')) {
        document.getElementById('bicycle-crashes-count').textContent = bicycleCrashes;
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
            statusDiv.innerHTML = '<p>No crashes found in the selected area</p>';
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
    statusDiv.innerHTML = '<p>Click the square icon to draw a selection box</p>';
    
    // Hide counter box
    document.getElementById('counter-box').style.display = 'none';
} 