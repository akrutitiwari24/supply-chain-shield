// Application Orchestrator

// Configuration Object
const savedMode = localStorage.getItem('appMode') || 'hybrid';
const CONFIG = {
  mode: savedMode, // 'realtime', 'simulated', or 'hybrid'
  
  hybrid_settings: {
    use_real_traffic: true,        // Google Traffic Layer
    use_real_weather: true,         // OpenWeatherMap
    use_real_routes: true,          // Google Directions
    simulate_trucks: true,          // Multiple trucks (real-time only tracks 1)
    simulate_timing: true,          // Speed up for demo
    show_predictions: true          // Show future risk (real-time is current only)
  },
  
  update_intervals: {
    realtime_risks: 30000,   // 30 seconds
    simulated_risks: 3000,    // 3 seconds
    weather: 600000,          // 10 minutes
    traffic: 60000            // 1 minute
  }
};

// Global Variables
let REALTIME_MODE = (CONFIG.mode === 'realtime' || CONFIG.mode === 'hybrid'); 
let lastSuccessfulUpdate = Date.now();
let trucks = [];
let allRoutes = [];
let shipments = [];
let isPaused = false;
let playbackSpeed = 1;
let timelineInterval;
window.isPaused = isPaused;
window.playbackSpeed = playbackSpeed;

/**
 * Initializes the entire application state.
 */
async function initializeApp() {
    try {
        console.log("Initializing map...");
        window.initializeMap();
        
        console.log("Fetching routes data from backend API...");
        const routeResponse = await fetch('/api/routes');
        if (!routeResponse.ok) throw new Error("Failed to fetch routes");
        allRoutes = await routeResponse.json();
        
        console.log("Fetching shipments data from backend API...");
        const shipmentResponse = await fetch('/api/shipments');
        if (!shipmentResponse.ok) throw new Error("Failed to fetch shipments");
        shipments = await shipmentResponse.json();
        
        updateShipmentList(shipments);
        
        // Map shipments to trucks
        const activeShipments = (CONFIG.mode === 'hybrid' && CONFIG.hybrid_settings.simulate_trucks) 
            ? shipments 
            : [shipments[0]];

        activeShipments.forEach(shipment => {
            // Find corresponding route
            const route = allRoutes.find(r => r.id === shipment.routeId) || allRoutes[0];
            
            if (route) {
                // Draw route on map
                window.drawRoute(route.waypoints, route.color);
                
                // Timing logic: speed up for demo if hybrid/simulated
                const useSimTiming = (CONFIG.mode === 'simulated' || (CONFIG.mode === 'hybrid' && CONFIG.hybrid_settings.simulate_timing));
                const delayMs = shipment.startTime === 0 ? 0 : (useSimTiming ? shipment.startTime * 10 : shipment.startTime * 1000);
                
                setTimeout(() => {
                    console.log(`Deploying active truck shipment: ${shipment.id}`);
                    const iconUrl = getIconForPriority(shipment.priority);
                    const truck = new window.Truck(window.map, route.waypoints, shipment.id, iconUrl);
                    trucks.push(truck);
                }, delayMs);
            }
        });
        
        // Add toggle button in UI
        const timelineControls = document.querySelector('.timeline-controls');
        if (timelineControls) {
            const btnLabel = REALTIME_MODE ? '🔴 LIVE MODE' : '📊 DEMO MODE';
            const btnColor = REALTIME_MODE ? '#dc3545' : '#6c757d';
            
            timelineControls.insertAdjacentHTML('afterbegin', `<button id="realtime-toggle" class="control-btn" style="background:${btnColor};color:white;font-weight:bold;margin-right:10px;">${btnLabel}</button>`);
            const btn = document.getElementById('realtime-toggle');
            btn.addEventListener('click', () => {
                REALTIME_MODE = !REALTIME_MODE;
                btn.textContent = REALTIME_MODE ? '🔴 LIVE MODE' : '📊 DEMO MODE';
                btn.style.background = REALTIME_MODE ? '#dc3545' : '#6c757d';
                
                if (window.riskMonitorTimer) clearTimeout(window.riskMonitorTimer);
                window.fetchRisks(REALTIME_MODE ? 'realtime' : 'simulated');
                
                const dataModeEl = document.getElementById('data-mode');
                if (dataModeEl) {
                    dataModeEl.textContent = REALTIME_MODE ? '🔴 Real-Time Data' : '📊 Simulated Data';
                    dataModeEl.classList.toggle('simulated', !REALTIME_MODE);
                }
                
                startRiskMonitoringLoop();
            });
        }
        
        // Setup Event Listeners for Timeline Controls
        document.getElementById('play-pause-btn').addEventListener('click', () => {
            isPaused = !isPaused;
            window.isPaused = isPaused;
            document.getElementById('play-pause-btn').textContent = isPaused ? '▶ Play' : '⏸ Pause';
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            window.timeElapsed = 0;
            if (window.resetRiskState) window.resetRiskState();
            
            // Reset all trucks to start
            trucks.forEach(truck => {
                truck.positionIndex = 0;
                if (truck.route && truck.route.length > 0) {
                    truck.marker.setPosition(truck.route[0]);
                }
            });
            // Clear alert
            const alertPanel = document.getElementById('alert-panel');
            if (alertPanel) alertPanel.classList.add('hidden');
            
            const slider = document.getElementById('timeline-slider');
            const sliderLabel = document.getElementById('timeline-label');
            if (slider && sliderLabel) {
                slider.value = 0;
                sliderLabel.textContent = '0 min';
            }
        });

        document.getElementById('speed-control').addEventListener('change', (e) => {
            playbackSpeed = parseFloat(e.target.value);
            window.playbackSpeed = playbackSpeed;
            // Restart intervals with new speed
            clearInterval(timelineInterval);
            startTimeCounter();
        });

        document.getElementById('timeline-slider').addEventListener('input', (e) => {
            window.timeElapsed = parseInt(e.target.value);
            // Update display
            document.getElementById('timeline-label').textContent = window.timeElapsed + ' min';
            window.fetchRisks(); // Force update risk on slider drag
        });
        
        document.getElementById('generate-report-btn').addEventListener('click', generatePDFReport);
        
        const modeToggle = document.getElementById('mode-toggle');
        if (modeToggle) {
            modeToggle.textContent = CONFIG.mode === 'simulated' ? 'Switch to Real-Time' : 'Switch to Simulated';
            modeToggle.addEventListener('click', () => {
                const nextMode = CONFIG.mode === 'simulated' ? 'hybrid' : 'simulated';
                localStorage.setItem('appMode', nextMode);
                location.reload();
            });
        }

        startRiskMonitoring();
        startTimeCounter();

        // Refresh the 'Updated: X seconds ago' timer every second
        setInterval(() => {
            const elapsed = Math.floor((Date.now() - lastSuccessfulUpdate) / 1000);
            const updateEl = document.getElementById('last-update');
            if (updateEl) {
                updateEl.textContent = elapsed === 0 ? 'Updated: just now' : `Updated: ${elapsed}s ago`;
            }
        }, 1000);
        
    } catch (err) {
        console.error("Critical error during application initialization:", err);
    }
}

/**
 * Returns icon configuration based on priority.
 * The Truck class handles 'high', 'medium', 'low' natively to generate colored SVGs.
 * @param {string} priority 
 * @returns {string} 
 */
function getIconForPriority(priority) {
    return priority; // 'high' -> yellow, 'medium' -> blue, 'low' -> green
}

/**
 * Populates the shipment list in the sidebar dynamically.
 * @param {Array} shipmentsData 
 */
function updateShipmentList(shipmentsData) {
    const listElement = document.getElementById('shipment-list');
    if (!listElement) return;
    
    listElement.innerHTML = shipmentsData.map(shipment => `
        <div class="shipment-item priority-${shipment.priority}">
            <div class="shipment-header">
                <span class="shipment-id">${shipment.id}</span>
                <span class="shipment-status">${shipment.status}</span>
            </div>
            <div class="shipment-details">
                <div>🚚 ${shipment.cargo}</div>
                <div>👤 ${shipment.driver}</div>
                <div>📍 ${shipment.origin} &rarr; ${shipment.destination}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Initiates the recurrent polling loop for live disruption data.
 */
function startRiskMonitoringLoop() {
    const poll = () => {
        window.fetchRisks(REALTIME_MODE ? 'realtime' : 'simulated');
        lastSuccessfulUpdate = Date.now();
        if (window.checkForHighRisk) window.checkForHighRisk();
        
        const count = document.getElementById('predictions-count');
        if (count) count.textContent = parseInt(count.textContent) + 1;
        
        const interval = REALTIME_MODE ? CONFIG.update_intervals.realtime_risks : CONFIG.update_intervals.simulated_risks;
        window.riskMonitorTimer = setTimeout(poll, interval);
    };
    
    const interval = REALTIME_MODE ? CONFIG.update_intervals.realtime_risks : CONFIG.update_intervals.simulated_risks;
    window.riskMonitorTimer = setTimeout(poll, interval);
}

function startRiskMonitoring() {
    console.log("Starting predictive risk monitoring service...");
    window.fetchRisks(REALTIME_MODE ? 'realtime' : 'simulated'); 
    
    startRiskMonitoringLoop();
    
    // Live Analytics polling
    setInterval(updateAnalytics, 5000);
    
    setTimeout(fetchWeatherOverlay, 3000);
    setInterval(fetchWeatherOverlay, CONFIG.update_intervals.weather);
}

let weatherOverlayMarkers = [];
async function fetchWeatherOverlay() {
    weatherOverlayMarkers.forEach(m => m.setMap(null));
    weatherOverlayMarkers = [];
    
    for (const zone of window.riskZones || []) {
        try {
            const resp = await fetch(`/api/weather/${zone.lat}/${zone.lng}`);
            if (resp.ok) {
                const weatherData = await resp.json();
                let icon = '☀️';
                if (weatherData.weather_condition === 'Rain') icon = '🌧️';
                else if (weatherData.weather_condition === 'Clouds') icon = '☁️';
                else if (weatherData.weather_condition === 'Thunderstorm') icon = '⛈️';
                else if (weatherData.weather_condition === 'Snow') icon = '🌨️';
                else if (['Mist', 'Fog', 'Haze'].includes(weatherData.weather_condition)) icon = '🌫️';
                
                const marker = new google.maps.Marker({
                    position: {lat: parseFloat(zone.lat), lng: parseFloat(zone.lng)},
                    map: window.map,
                    label: { text: icon, fontSize: '24px' },
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                    zIndex: 20
                });
                weatherOverlayMarkers.push(marker);
            }
        } catch (e) {
            console.error('Error fetching weather overlay:', e);
        }
    }
}

/**
 * Starts the central simulated time scale ticker.
 */
function startTimeCounter() {
    const intervalTime = 3000 / playbackSpeed;
    
    timelineInterval = setInterval(() => {
        if (!isPaused) {
            window.timeElapsed++;
            const elapsedLabel = document.getElementById('time-elapsed');
            if (elapsedLabel) {
                elapsedLabel.textContent = `Time: ${window.timeElapsed} min`;
            }
            
            // Update slider value
            const slider = document.getElementById('timeline-slider');
            const sliderLabel = document.getElementById('timeline-label');
            if (slider && sliderLabel) {
                slider.value = window.timeElapsed;
                sliderLabel.textContent = window.timeElapsed + ' min';
            }
        }
    }, intervalTime);
}

/**
 * Changes the active route pathing for a specific truck seamlessly.
 * @param {string|Object} shipmentId - The ID of the truck, or the route object (for fallback)
 * @param {Object} [newRoute] - The new route object
 */
window.switchRoute = function(shipmentId, newRoute) {
    // Fallback if called from risk.js without shipmentId (e.g. switchRoute(route))
    if (typeof shipmentId === 'object') {
        newRoute = shipmentId;
        shipmentId = trucks.length > 0 ? trucks[0].shipmentId : null;
    }

    console.log(`Executing reroute for shipment ${shipmentId} to: ${newRoute.name}`);
    window.clearPolylines();
    
    // Redraw all active routes
    trucks.forEach(t => {
        if (t.shipmentId !== shipmentId) {
            // We would ideally redraw their routes here if we kept references, 
            // but for demo let's just focus on the rerouted one or keep it simple.
        }
    });

    setTimeout(() => {
        window.drawRoute(newRoute.waypoints, newRoute.color, 6); 
        const targetTruck = trucks.find(t => t.shipmentId === shipmentId);
        if (targetTruck) {
            targetTruck.changeRoute(newRoute.waypoints);
        }
        
        // Update shipment status in UI
        const shipment = shipments.find(s => s.id === shipmentId);
        if (shipment) {
            shipment.status = "rerouted";
            updateShipmentList(shipments);
        }
        
        // Trigger live analytics update after DOM count changes
        setTimeout(updateAnalytics, 100);
    }, 500);
};

/**
 * Callback hook invoked by the active Truck instance internally smoothly.
 * @param {string} shipmentId The ID of the shipment
 * @param {number} posIndex Iterator mapping the array
 * @param {Object} position Google maps LatLng dictionary mapping
 */
window.onTruckMove = function(shipmentId, posIndex, position) {
    // console.log(`Truck ${shipmentId} at position index: ${posIndex}`);
};

// Starts application lifecycle on window load
window.addEventListener('load', initializeApp);

// Export for debugging potential scope issues
window.trucks = trucks;
window.allRoutes = allRoutes;

// Analytics State
let analyticsState = {
    delaySaved: 0,
    accuracy: 72,
    costSavings: 0
};

/**
 * Calculates and animates live analytics metrics.
 */
function updateAnalytics() {
    const reroutesCountElement = document.getElementById('reroutes-count');
    const predictionsCountElement = document.getElementById('predictions-count');
    
    const reroutes = parseInt(reroutesCountElement ? reroutesCountElement.textContent : '0') || 0;
    const predictions = parseInt(predictionsCountElement ? predictionsCountElement.textContent : '0') || 0;
    
    const newDelaySaved = reroutes * 18;
    const newAccuracy = Math.min(94, 72 + Math.floor(predictions / 5));
    const newCostSavings = Math.floor((newDelaySaved / 60) * 1200);
    
    const delayEl = document.getElementById('avg-delay-saved');
    const accuracyEl = document.getElementById('prediction-accuracy');
    const costEl = document.getElementById('cost-savings');
    
    if (delayEl && analyticsState.delaySaved !== newDelaySaved) {
        animateValue(delayEl, analyticsState.delaySaved, newDelaySaved, 1000, val => val + ' min');
        analyticsState.delaySaved = newDelaySaved;
    }
    
    if (accuracyEl && analyticsState.accuracy !== newAccuracy) {
        animateValue(accuracyEl, analyticsState.accuracy, newAccuracy, 1000, val => val + '%');
        analyticsState.accuracy = newAccuracy;
    }
    
    if (costEl && analyticsState.costSavings !== newCostSavings) {
        animateValue(costEl, analyticsState.costSavings, newCostSavings, 1000, val => '₹' + val.toLocaleString('en-IN'));
        analyticsState.costSavings = newCostSavings;
    }
}

/**
 * Animates a number from start to end over duration using requestAnimationFrame.
 */
function animateValue(element, start, end, duration, formatter) {
    if (start === end) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        element.textContent = formatter(current);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = formatter(end);
        }
    };
    window.requestAnimationFrame(step);
}
