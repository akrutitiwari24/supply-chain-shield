/**
 * Truck class representing an animated marker moving along a route.
 */
class Truck {
    /**
     * @param {google.maps.Map} map - The Google Map instance
     * @param {Array} route - Array of LatLng literals to follow
     * @param {string} shipmentId - Identifier for the shipment
     * @param {string} iconUrl - URL to the truck icon SVG or a priority string ('high', 'medium', 'low')
     */
    constructor(map, route, shipmentId = 'Unknown', iconUrl = 'high') {
        this.map = map;
        this.route = route;
        this.shipmentId = shipmentId;
        this.positionIndex = 0;
        this.active = true;
        this.rerouted = false;
        this.interval = null;

        // Determine if iconUrl is a priority string, if so generate the color-coded SVG
        let finalIconUrl = iconUrl;
        if (['high', 'medium', 'low'].includes(iconUrl.toLowerCase())) {
            finalIconUrl = this.generateIcon(iconUrl.toLowerCase());
        }

        this.createMarker(finalIconUrl);
        this.startMoving();
    }

    /**
     * Generates a dynamic SVG truck icon based on priority color.
     * @param {string} priority - 'high', 'medium', or 'low'
     * @returns {string} Data URI of the SVG
     */
    generateIcon(priority) {
        let color = '#FFD60A'; // High: Yellow
        if (priority === 'medium') color = '#0A84FF'; // Medium: Blue
        if (priority === 'low') color = '#34C759'; // Low: Green

        const svg = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="14" width="22" height="14" rx="1" fill="${color}" stroke="black" stroke-width="1.5"/>
          <rect x="25" y="18" width="10" height="10" rx="2" fill="${color}" stroke="black" stroke-width="1.5"/>
          <rect x="29" y="20" width="4" height="4" rx="1" fill="white" stroke="black" stroke-width="1"/>
          <line x1="35" y1="26" x2="36" y2="26" stroke="black" stroke-width="2"/>
          <circle cx="10" cy="32" r="3.5" fill="#333" stroke="black" stroke-width="1.5"/>
          <circle cx="30" cy="32" r="3.5" fill="#333" stroke="black" stroke-width="1.5"/>
          <circle cx="10" cy="32" r="1" fill="white"/>
          <circle cx="30" cy="32" r="1" fill="white"/>
        </svg>`;
        
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    /**
     * Initializes the Google Maps marker at the starting position.
     * @param {string} iconUrl - URL for the truck icon
     */
    createMarker(iconUrl) {
        this.marker = new google.maps.Marker({
            position: this.route[0],
            map: this.map,
            icon: {
                url: iconUrl,
                scaledSize: new google.maps.Size(40, 40),
                rotation: 0
            },
            title: 'Active Shipment: ' + this.shipmentId
        });
    }

    /**
     * Calculates bearing between two lat/lng coordinates
     * @returns {number} Angle in degrees
     */
    calculateBearing(lat1, lng1, lat2, lng2) {
        const toRad = Math.PI / 180;
        const toDeg = 180 / Math.PI;

        const rl1 = lat1 * toRad;
        const rl2 = lat2 * toRad;
        const dlng = (lng2 - lng1) * toRad;

        const x = Math.sin(dlng) * Math.cos(rl2);
        const y = Math.cos(rl1) * Math.sin(rl2) - Math.sin(rl1) * Math.cos(rl2) * Math.cos(dlng);
        
        let bearing = Math.atan2(x, y) * toDeg;
        bearing = (bearing + 360) % 360;
        return bearing;
    }

    /**
     * Starts the movement timeline with smooth interpolation between points.
     */
    startMoving() {
        let frame = 0;
        const totalFrames = 20;

        const tick = () => {
            if (!this.active) return;
            
            if (window.isPaused) {
                this.interval = setTimeout(tick, 100);
                return;
            }

            if (this.positionIndex < this.route.length - 1) {
                const startPoint = this.route[this.positionIndex];
                const endPoint = this.route[this.positionIndex + 1];
                
                // Calculate fractional progress and interpolate coordinates
                const progress = frame / totalFrames;
                const currentLat = startPoint.lat + (endPoint.lat - startPoint.lat) * progress;
                const currentLng = startPoint.lng + (endPoint.lng - startPoint.lng) * progress;
                const currentPos = { lat: currentLat, lng: currentLng };
                
                // Update marker position
                this.marker.setPosition(currentPos);
                
                // Calculate rotation (bearing) and update icon
                if (frame === 0 || frame === 1) {
                    const bearing = this.calculateBearing(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng);
                    const icon = this.marker.getIcon();
                    // Update rotation property in the icon object
                    this.marker.setIcon({
                        ...icon,
                        rotation: bearing
                    });
                }
                
                frame++;
                
                if (frame >= totalFrames) {
                    frame = 0;
                    this.positionIndex++;
                    
                    // Hook to notify map or main logic that truck has reached next node
                    if (window.onTruckMove) {
                        window.onTruckMove(this.shipmentId, this.positionIndex, this.route[this.positionIndex]);
                    }
                }
            } else {
                // Route complete
                this.stop();
                return; // Prevent further ticks
            }
            
            const speed = window.playbackSpeed || 1;
            this.interval = setTimeout(tick, 100 / speed);
        };
        
        this.interval = setTimeout(tick, 100);
    }

    /**
     * Aborts the current path and begins a new route.
     * @param {Array} newRoute - Array of LatLng literals
     */
    changeRoute(newRoute) {
        this.route = newRoute;
        this.rerouted = true;
        this.positionIndex = 0; 
    }

    /**
     * Halts movement cleanly by cancelling the interval ticker.
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.active = false;
    }

    /**
     * Evaluates route progression mathematically.
     * @returns {number} Percentage complete [0.0 - 100.0]
     */
    getProgress() {
        if (!this.route || this.route.length === 0) return 0;
        return (this.positionIndex / this.route.length) * 100;
    }
}

// Export class to window
window.Truck = Truck;
