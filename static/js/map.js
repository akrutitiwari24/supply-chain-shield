// Global Map Variables
let map = null;
let markers = [];
let circles = [];
let polylines = [];

/**
 * Initializes the Google Map with custom dark styling.
 * @returns {google.maps.Map} The initialized map instance.
 */
function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error("Map container 'map' not found!");
        return null;
    }

    const mapOptions = {
        center: {lat: 28.6315, lng: 77.2167}, // Centered on Delhi, India
        zoom: 12,
        styles: getDarkMapStyle(),
        disableDefaultUI: true,
        zoomControl: true,
        backgroundColor: '#0a0e27'
    };
    
    map = new google.maps.Map(mapElement, mapOptions);
    window.map = map; // CRITICAL: Update global reference
    
    enableTrafficLayer();
    return map;
}

/**
 * Enables the Google Maps Traffic Layer to show real-time traffic conditions.
 * Green = fast, Yellow = medium, Red = slow, Dark red = very slow.
 * @returns {google.maps.TrafficLayer} The created traffic layer
 */
function enableTrafficLayer() {
  const trafficLayer = new google.maps.TrafficLayer();
  trafficLayer.setMap(map);
  // Ensure traffic layer sits below risk zones
  trafficLayer.setOptions({ zIndex: 1 });
  window.trafficLayer = trafficLayer; // expose for debugging
  return trafficLayer;
}

/**
 * Returns a styled map array for a professional dark theme map.
 * @returns {Array} Array of style objects
 */
function getDarkMapStyle() {
    return [
        { elementType: 'geometry', stylers: [{ color: '#161b33' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1f3a' }] },
        { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#2a3555' }] },
        { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0d122b' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1c2445' }] },
        { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#111a36' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a3555' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a4565' }] },
        { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1c2445' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0e27' }] }
    ];
}

/**
 * Draws a polyline route on the map.
 * @param {Array} waypoints - Array of LatLng literals [{lat, lng}, ...]
 * @param {string} color - Hex color code for the route line
 * @param {number} strokeWeight - Line thickness
 * @returns {google.maps.Polyline} The created polyline object
 */
function drawRoute(waypoints, color = '#007AFF', strokeWeight = 4) {
    const routePolyline = new google.maps.Polyline({
        path: waypoints,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: strokeWeight,
        map: (typeof map !== 'undefined') ? map : window.map
    });
    
    polylines.push(routePolyline);
    return routePolyline;
}

/**
 * Clears all polylines (routes) from the map.
 */
function clearPolylines() {
    for (let i = 0; i < polylines.length; i++) {
        polylines[i].setMap(null);
    }
    polylines = [];
}

/**
 * Draws a circular risk zone on the map.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radius - Radius in meters
 * @param {string} color - Hex color for fill and stroke
 * @param {number} opacity - Fill opacity
 * @returns {google.maps.Circle} The created circle object
 */
function drawRiskCircle(lat, lng, radius, color, opacity = 0.25) {
    const riskCircle = new google.maps.Circle({
        center: {lat, lng},
        radius: radius,
        fillColor: color,
        fillOpacity: opacity,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map: (typeof map !== 'undefined') ? map : window.map
    });
    
    circles.push(riskCircle);
    return riskCircle;
}

/**
 * Clears all risk circles from the map.
 */
function clearRiskCircles() {
    for (let i = 0; i < circles.length; i++) {
        circles[i].setMap(null);
    }
    circles = [];
}

// Export functions and variables to global window object
window.map = map;
window.markers = markers;
window.circles = circles;
window.polylines = polylines;
window.initializeMap = initializeMap;
window.drawRoute = drawRoute;
window.clearPolylines = clearPolylines;
window.drawRiskCircle = drawRiskCircle;
window.clearRiskCircles = clearRiskCircles;
window.enableTrafficLayer = enableTrafficLayer;
