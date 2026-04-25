/**
 * Fetches real-time routes from the backend API, utilizing Google Directions API.
 * @param {Object} origin - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @returns {Array} Array of route objects
 */
async function getRealTimeRoutes(origin, destination) {
    try {
        const response = await fetch(`/api/realtime-routes?origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destination.lat}&dest_lng=${destination.lng}`);
        if (!response.ok) throw new Error("Failed to fetch real-time routes");
        const routes = await response.json();
        return routes;
    } catch (err) {
        console.error("Error fetching real-time routes:", err);
        return [];
    }
}

/**
 * Calculates the distance between two coordinates in km using the Haversine formula.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Compares routes based on risk exposure and real-time traffic delay.
 * @param {Array} routes - Array of route objects
 * @param {Array} riskZones - Array of current risk zones
 * @returns {Object} The best route
 */
function compareRoutesRealTime(routes, riskZones) {
    if (!routes || routes.length === 0) return null;
    if (!riskZones) riskZones = [];

    let bestRoute = routes[0];
    let minScore = Infinity;

    routes.forEach(route => {
        let riskExposure = 0;

        // Check if route waypoints pass near any risk zones
        if (route.waypoints && riskZones.length > 0) {
            route.waypoints.forEach(wp => {
                riskZones.forEach(zone => {
                    const distKm = calculateDistance(wp.lat, wp.lng, zone.lat, zone.lng);
                    // If waypoint is within 2km of a risk zone
                    if (distKm < 2.0) {
                        riskExposure += zone.currentRisk || 0;
                    }
                });
            });
        }

        // Traffic delay penalty (difference between normal duration and traffic duration)
        // Assume durations are in seconds, convert to minutes
        const trafficDelaySeconds = Math.max(0, (route.duration_in_traffic || 0) - (route.duration_normal || 0));
        const trafficDelayPenalty = trafficDelaySeconds / 60; 

        // Weight the risk and the traffic delay (e.g. 1 point of risk = 10 minutes of delay)
        const totalScore = (riskExposure * 10) + trafficDelayPenalty;
        
        route.riskScore = totalScore;

        if (totalScore < minScore) {
            minScore = totalScore;
            bestRoute = route;
        }
    });

    return bestRoute;
}

window.getRealTimeRoutes = getRealTimeRoutes;
window.compareRoutesRealTime = compareRoutesRealTime;
