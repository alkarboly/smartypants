// Custom Quadrilateral Draw Mode
// Extends the standard polygon drawing mode but limits to exactly 4 points
class QuadrilateralMode {
    constructor(map, draw) {
        this.map = map;
        this.draw = draw;
        this.pointCount = 0;
        this.featureId = null;
        this.onClick = this.onClick.bind(this);
    }

    // Start drawing when mode is activated
    onSetup() {
        console.log('QuadrilateralMode: Starting quad mode');
        // Create a new feature
        const feature = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [[]]
            }
        };
        
        this.featureId = this.draw.add(feature)[0];
        this.pointCount = 0;
        
        // Set status message
        const statusDiv = document.getElementById('status-message');
        if (statusDiv) {
            statusDiv.innerHTML = '<p>Click to place 4 points to create a quadrilateral</p>';
        }
        
        // Setup event handlers
        this.map.on('click', this.onClick);
        
        return { featureId: this.featureId };
    }
    
    // Handle click to add points
    onClick(e) {
        console.log('QuadrilateralMode: Click detected');
        // Get coordinates of the click
        const coords = [e.lngLat.lng, e.lngLat.lat];
        
        // Add point to feature
        const feature = this.draw.get(this.featureId);
        if (!feature) {
            console.error('Feature not found:', this.featureId);
            return;
        }
        
        // Add coordinates to the feature
        const coordinates = feature.geometry.coordinates[0];
        coordinates.push(coords);
        this.pointCount++;
        
        console.log(`QuadrilateralMode: Added point ${this.pointCount}:`, coords);
        
        // Update the feature with the new coordinates
        try {
            this.draw.setFeatureProperty(this.featureId, 'pointCount', this.pointCount);
            
            // Update the feature
            feature.geometry.coordinates[0] = coordinates;
            this.draw.add(feature);
            
            // Update status message
            const statusDiv = document.getElementById('status-message');
            if (statusDiv) {
                statusDiv.innerHTML = `<p>Point ${this.pointCount} added. ${4 - this.pointCount} more point(s) needed.</p>`;
            }
            
            // Check if we've placed 4 points
            if (this.pointCount >= 4) {
                console.log('QuadrilateralMode: Completing quadrilateral');
                // Close the polygon by adding the first point again
                coordinates.push(coordinates[0]);
                
                // Update the feature
                feature.geometry.coordinates[0] = coordinates;
                this.draw.add(feature);
                
                // Update status message
                if (statusDiv) {
                    statusDiv.innerHTML = '<p>Quadrilateral completed!</p>';
                }
                
                // Finish drawing and switch to simple_select mode
                setTimeout(() => {
                    this.draw.changeMode('simple_select', { featureIds: [this.featureId] });
                    // Trigger update visualization
                    if (typeof updateVisualization === 'function') {
                        updateVisualization();
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error updating quadrilateral:', error);
        }
    }
    
    // Clean up when mode is exited
    onStop() {
        console.log('QuadrilateralMode: Stopping quad mode');
        this.map.off('click', this.onClick);
        const statusDiv = document.getElementById('status-message');
        if (statusDiv) {
            statusDiv.innerHTML = '<p>Draw a polygon or line on the map to filter data</p>';
        }
    }
    
    // Required for Mapbox GL Draw
    toDisplayFeatures(state, geojson, display) {
        display(geojson);
    }
    
    // Draw vertex styling
    styleFeature(feature, state) {
        if (feature.properties && feature.properties.active === 'true') {
            return {
                fill: '#2ecc71',
                stroke: '#2ecc71',
                'fill-opacity': 0.4,
                'stroke-width': 2,
                'stroke-opacity': 1
            };
        } else {
            return {
                fill: '#3498db',
                stroke: '#3498db',
                'fill-opacity': 0.3,
                'stroke-width': 2,
                'stroke-opacity': 1
            };
        }
    }
    
    // Make vertices visible
    startDisplay(state, e) {
        return {
            canTrash: false,
            canCombine: false,
            canSplit: false
        };
    }
}

// Export the mode for use in main.js
window.QuadrilateralMode = QuadrilateralMode;

// Simple Polygon Draw Mode
class SimplePolygonMode {
    constructor(map, draw) {
        this.map = map;
        this.draw = draw;
        this.pointCount = 0;
        this.featureId = null;
        this.onClick = this.onClick.bind(this);
        this.onDblClick = this.onDblClick.bind(this);
    }

    onSetup() {
        console.log('SimplePolygonMode: Starting');
        
        // Create a new feature
        const feature = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [[]]
            }
        };
        
        // Add it to draw
        this.featureId = this.draw.add(feature)[0];
        
        // Reset point count
        this.pointCount = 0;
        
        // Set status message
        const statusDiv = document.getElementById('status-message');
        if (statusDiv) {
            statusDiv.innerHTML = '<p>Click on the map to place points. Double-click to complete polygon.</p>';
        }
        
        // Turn on event listeners
        this.map.on('click', this.onClick);
        this.map.on('dblclick', this.onDblClick);
        
        return { featureId: this.featureId };
    }
    
    onClick(e) {
        console.log('SimplePolygonMode: Click detected');
        
        // Ignore if double-clicked
        if (e.originalEvent && e.originalEvent.detail > 1) {
            return;
        }
        
        // Get the feature
        const feature = this.draw.get(this.featureId);
        if (!feature) {
            console.error('Feature not found');
            return;
        }
        
        // Get click coordinates
        const coords = [e.lngLat.lng, e.lngLat.lat];
        console.log('Adding point:', coords);
        
        // Add to coordinates
        const coordinates = feature.geometry.coordinates[0];
        coordinates.push(coords);
        this.pointCount++;
        
        // Update feature
        feature.geometry.coordinates[0] = coordinates;
        this.draw.add(feature);
        
        // Update status
        const statusDiv = document.getElementById('status-message');
        if (statusDiv) {
            statusDiv.innerHTML = `<p>Point ${this.pointCount} added. Double-click to complete.</p>`;
        }
    }
    
    onDblClick(e) {
        console.log('SimplePolygonMode: Double-click detected');
        
        // Prevent default behavior
        e.preventDefault();
        e.stopPropagation();
        
        // Need at least 3 points
        if (this.pointCount < 3) {
            console.log('Need at least 3 points');
            return;
        }
        
        // Get the feature
        const feature = this.draw.get(this.featureId);
        if (!feature) return;
        
        // Close the polygon
        const coordinates = feature.geometry.coordinates[0];
        if (coordinates.length >= 3) {
            // Add first point to close the polygon
            coordinates.push(coordinates[0]);
            
            // Update feature
            feature.geometry.coordinates[0] = coordinates;
            this.draw.add(feature);
            
            console.log('Polygon completed with', this.pointCount, 'points');
            
            // Update status
            const statusDiv = document.getElementById('status-message');
            if (statusDiv) {
                statusDiv.innerHTML = '<p>Polygon completed!</p>';
            }
            
            // Switch to select mode
            this.draw.changeMode('simple_select', { featureIds: [this.featureId] });
            
            // Trigger visualization update
            if (typeof window.updateVisualization === 'function') {
                window.updateVisualization();
            }
        }
    }
    
    onStop() {
        console.log('SimplePolygonMode: Stopping');
        
        // Clean up event listeners
        this.map.off('click', this.onClick);
        this.map.off('dblclick', this.onDblClick);
    }
    
    toDisplayFeatures(state, geojson, display) {
        display(geojson);
    }
}

// Export mode for use in main.js
window.SimplePolygonMode = SimplePolygonMode; 