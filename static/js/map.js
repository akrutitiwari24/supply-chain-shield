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
    const mapOptions = {
        center: {lat: 28.6315, lng: 77.2167}, // Centered on Delhi, India
        zoom: 13,
        styles: getDarkMapStyle(),
        disableDefaultUI: true,
        zoomControl: true
    };
    
    map = new google.maps.Map(document.getElementById('map'), mapOptions);
    return map;
}

/**
 * Returns a styled map array for a professional dark theme map.
 * @returns {Array} Array of style objects
 */
function getDarkMapStyle() {
    return [
        { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
        { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
        { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
        { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
        { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
        { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
        { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
        { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
        { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3C7680' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
        { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
        { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
        { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
        { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
        { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] }
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
