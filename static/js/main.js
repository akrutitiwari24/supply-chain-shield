// Application Orchestrator

// Global Variables
let currentTruck = null;
let allRoutes = [];
let currentRoute = null;

/**
 * Initializes the entire application state.
 */
async function initializeApp() {
    try {
        console.log("Initializing map...");
        window.initializeMap();
        
        console.log("Fetching routes data from backend API...");
        const response = await fetch('/api/routes');
        if (!response.ok) throw new Error("Failed to fetch routes");
        
        allRoutes = await response.json();
        
        if (allRoutes.length > 0) {
            currentRoute = allRoutes[0];
            
            console.log(`Drawing initial route: ${currentRoute.name}`);
            window.drawRoute(currentRoute.waypoints, currentRoute.color);
            
            console.log("Deploying active truck shipment...");
            currentTruck = new window.Truck(window.map, currentRoute.waypoints);
        } else {
            console.warn("No routes returned from API.");
        }
        
        startRiskMonitoring();
        startTimeCounter();
        
    } catch (err) {
        console.error("Critical error during application initialization:", err);
    }
}

/**
 * Initiates the recurrent polling loop for live disruption data.
 */
function startRiskMonitoring() {
    console.log("Starting predictive risk monitoring service...");
    window.fetchRisks(); 
    
    setInterval(() => {
        window.fetchRisks();
        if (window.checkForHighRisk) window.checkForHighRisk();
        
        // Update predictions metric
        const count = document.getElementById('predictions-count');
        if (count) {
            count.textContent = parseInt(count.textContent) + 1;
        }
    }, 2000);
}

/**
 * Starts the central simulated time scale ticker.
 */
function startTimeCounter() {
    setInterval(() => {
        window.timeElapsed++;
        const elapsedLabel = document.getElementById('time-elapsed');
        if (elapsedLabel) {
            elapsedLabel.textContent = `Time: ${window.timeElapsed} min`;
        }
    }, 2000);
}

/**
 * Changes the active route pathing for the truck seamlessly.
 * Exposed globally as requested.
 * @param {Object} newRoute 
 */
window.switchRoute = function(newRoute) {
    console.log(`Executing reroute to: ${newRoute.name}`);
    window.clearPolylines();
    
    setTimeout(() => {
        window.drawRoute(newRoute.waypoints, newRoute.color, 6); 
        if (currentTruck) {
            currentTruck.changeRoute(newRoute.waypoints);
        }
        currentRoute = newRoute;
    }, 500);
};

/**
 * Callback hook invoked by the active Truck instance internally smoothly.
 * @param {number} posIndex Iterator mapping the array
 * @param {Object} position Google maps LatLng dictionary mapping
 */
window.onTruckMove = function(posIndex, position) {
    console.log(`Truck at position index: ${posIndex}`);
};

// Starts application lifecycle on window load
window.addEventListener('load', initializeApp);

// Export for debugging potential scope issues
window.currentTruck = currentTruck;
window.allRoutes = allRoutes;
window.currentRoute = currentRoute;
