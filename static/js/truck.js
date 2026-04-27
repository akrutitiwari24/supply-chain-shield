/**
 * Truck class representing an animated marker moving along a route.
 */
class Truck {
    /**
     * @param {google.maps.Map} map - The Google Map instance
     * @param {Array} route - Array of LatLng literals to follow
     * @param {string} shipmentId - Identifier for the shipment
     * @param {string} priority - 'high', 'medium', or 'low'
     */
    constructor(map, route, shipmentId = 'Unknown', priority = 'medium') {
        this.map = map;
        this.route = route;
        this.shipmentId = shipmentId;
        this.priority = priority.toLowerCase();
        this.positionIndex = 0;
        this.active = true;
        this.rerouted = false;
        this.interval = null;
        this.trail = [];
        this.trailLine = null;
        this.currentSpeed = 0;

        const iconUrl = this.generateIcon(this.priority);
        this.createMarker(iconUrl);
        this.createTrail();
        this.startMoving();
        this.addClickHandler();
    }

    /**
     * Generates a visible emoji icon with drop shadow.
     */
    generateIcon() {
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="28" fill="#FFD60A" stroke="#000" stroke-width="3"/>
          <text x="30" y="40" font-size="30" text-anchor="middle" fill="#000">🚛</text>
        </svg>`;
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    /**
     * Initializes the marker and speed label.
     */
    createMarker(iconUrl) {
        this.marker = new google.maps.Marker({
            position: this.route[0],
            map: this.map,
            icon: {
                url: iconUrl,
                scaledSize: new google.maps.Size(60, 60),
                anchor: new google.maps.Point(30, 30)
            },
            label: {
                text: this.shipmentId,
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 'bold'
            },
            title: `Shipment: ${this.shipmentId}`,
            zIndex: 100
        });

        // Add PULSING animation
        this.marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => this.marker.setAnimation(null), 2000);
    }

    /**
     * Creates the initial trail polylines.
     */
    createTrail() {
        const colorMap = { high: '#FF3B30', medium: '#007AFF', low: '#34C759' };
        this.trailColor = colorMap[this.priority] || '#007AFF';
    }

    /**
     * Adds interactivity to the truck.
     */
    addClickHandler() {
        this.infoWindow = new google.maps.InfoWindow();
        this.marker.addListener('click', () => {
            const status = this.rerouted ? 'Rerouted' : (this.currentSpeed > 0 ? 'On Time' : 'Delayed');
            const content = `
                <div class="truck-popup" style="padding: 10px; color: #1a1f3a;">
                    <h3 style="margin: 0 0 5px 0;">Shipment: ${this.shipmentId}</h3>
                    <p style="margin: 5px 0;"><strong>Status:</strong> ${status}</p>
                    <p style="margin: 5px 0;"><strong>Priority:</strong> ${this.priority.toUpperCase()}</p>
                    <p style="margin: 5px 0;"><strong>Speed:</strong> ${this.currentSpeed} km/h</p>
                    <p style="margin: 5px 0;"><strong>ETA:</strong> ${Math.ceil((this.route.length - this.positionIndex) * 0.5)} mins</p>
                </div>
            `;
            this.infoWindow.setContent(content);
            this.infoWindow.open(this.map, this.marker);
        });
    }

    /**
     * Helper to calculate distance in km between two points.
     */
    haversineDistance(pt1, pt2) {
        const R = 6371; // Earth radius in km
        const dLat = (pt2.lat - pt1.lat) * Math.PI / 180;
        const dLon = (pt2.lng - pt1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(pt1.lat * Math.PI / 180) * Math.cos(pt2.lat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Updates the fading trail behind the truck.
     */
    updateTrail(newPos) {
        this.trail.push(newPos);
        if (this.trail.length > 10) this.trail.shift(); // Keep last 10 positions

        if (this.trailLine) this.trailLine.setMap(null);

        this.trailLine = new google.maps.Polyline({
            path: this.trail,
            strokeColor: '#FFD60A',
            strokeOpacity: 0.6,
            strokeWeight: 4,
            map: this.map
        });
    }

    /**
     * Starts the movement timeline with smooth interpolation.
     */
    startMoving() {
        let frame = 0;
        const totalFrames = 20; // 20 intermediate points as requested

        const tick = () => {
            if (!this.active) return;
            if (window.isPaused) {
                this.interval = setTimeout(tick, 100);
                return;
            }

            if (this.positionIndex < this.route.length - 1) {
                const startPoint = this.route[this.positionIndex];
                const endPoint = this.route[this.positionIndex + 1];
                
                const progress = frame / totalFrames;
                const currentLat = startPoint.lat + (endPoint.lat - startPoint.lat) * progress;
                const currentLng = startPoint.lng + (endPoint.lng - startPoint.lng) * progress;
                const currentPos = { lat: currentLat, lng: currentLng };
                
                // Update marker
                this.marker.setPosition(currentPos);
                this.updateTrail(currentPos);

                // Speed calculation: distance in 100ms interval
                const dist = this.haversineDistance(startPoint, endPoint) / totalFrames;
                this.currentSpeed = Math.floor(dist * 10 * 3600 * (window.playbackSpeed || 1));
                
                frame++;
                
                if (frame >= totalFrames) {
                    frame = 0;
                    this.positionIndex++;
                    
                    if (window.onTruckMove) {
                        window.onTruckMove(this.shipmentId, this.positionIndex, this.route[this.positionIndex]);
                    }
                }
            } else {
                this.stop();
                return;
            }
            
            const speed = window.playbackSpeed || 1;
            this.interval = setTimeout(tick, 100 / speed);
        };
        
        this.interval = setTimeout(tick, 100);
    }

    changeRoute(newRoute) {
        this.route = newRoute;
        this.rerouted = true;
        this.positionIndex = 0;
    }

    stop() {
        if (this.interval) clearTimeout(this.interval);
        this.active = false;
        // Keep trail but stop label
        this.marker.setLabel(null);
    }

    getProgress() {
        if (!this.route || this.route.length === 0) return 0;
        return (this.positionIndex / this.route.length) * 100;
    }
}

window.Truck = Truck;

