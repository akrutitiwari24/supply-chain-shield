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
let REALTIME_MODE = (CONFIG.mode === 'realtime' || CONFIG.mode === 'hybrid' || CONFIG.mode === 'prediction'); 
let lastSuccessfulUpdate = Date.now();
let trucks = [];
let allRoutes = [];
let shipments = [];
let isPaused = false;
let playbackSpeed = 1;
let timelineInterval;
window.timeElapsed = 0; // Initialize global time counter
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
        
        // Remove old toggle injection
        // ... (skipped)
        
        setupEventListeners();
        startRiskMonitoring();
        startTimeCounter();
        
        // DEBUG: Force test visualization after map loads
        setTimeout(() => {
            if (window.testRiskVisualization) window.testRiskVisualization();
        }, 2000);
        
        // Manual Debug Button
        const debugBtn = document.getElementById('debug-zones');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => {
                if (window.updateRiskVisualization) {
                    window.updateRiskVisualization();
                    alert(`Drew ${window.circles ? window.circles.length : 0} risk zones. Check map!`);
                }
            });
        }

        // Bottleneck Detection
        const bottleneckBtn = document.getElementById('detect-bottlenecks');
        if (bottleneckBtn) {
            bottleneckBtn.addEventListener('click', () => {
                detectBottlenecks();
            });
        }

        // AI Insights polling
        updateAIInsight();
        setInterval(updateAIInsight, 30000);

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
        // CRITICAL FALLBACK: Ensure controls work even if data fetch fails
        setupEventListeners();
        startTimeCounter();
        startRiskMonitoring();
    }
}

/**
 * Attaches all event listeners for UI controls.
 * Safely checks for element existence to prevent script crashes.
 */
function setupEventListeners() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.onclick = () => {
            isPaused = !isPaused;
            window.isPaused = isPaused;
            playPauseBtn.textContent = isPaused ? '▶ Play' : '⏸ Pause';
            console.log('Simulation', isPaused ? 'Paused' : 'Resumed');
        };
    }

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.onclick = () => {
            window.timeElapsed = 0;
            trucks.forEach(t => t.positionIndex = 0);
            const slider = document.getElementById('timeline-slider');
            if (slider) slider.value = 0;
            document.getElementById('time-elapsed').textContent = 'Time: 0 min';
            console.log('Simulation Restarted');
        };
    }

    const slider = document.getElementById('timeline-slider');
    if (slider) {
        slider.oninput = (e) => {
            window.timeElapsed = parseInt(e.target.value);
            document.getElementById('timeline-label').textContent = window.timeElapsed + ' min';
            if (window.fetchRisks) window.fetchRisks(CONFIG.mode === 'simulated' ? 'simulated' : 'realtime');
        };
    }

    const speedSelect = document.getElementById('speed-control');
    if (speedSelect) {
        speedSelect.onchange = (e) => {
            playbackSpeed = parseFloat(e.target.value);
            window.playbackSpeed = playbackSpeed;
            clearInterval(timelineInterval);
            startTimeCounter();
        };
    }

    const reportBtn = document.getElementById('generate-report-btn');
    if (reportBtn) reportBtn.onclick = () => { if (window.generatePDFReport) window.generatePDFReport(); };

    // Mode Switchers
    ['mode-demo', 'mode-realtime', 'mode-prediction'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.onclick = () => {
                const mode = id === 'mode-demo' ? 'simulated' : (id === 'mode-realtime' ? 'hybrid' : 'prediction');
                localStorage.setItem('appMode', mode);
                location.reload();
            };
        }
    });

    // Debug button
    const debugBtn = document.getElementById('debug-zones');
    if (debugBtn) {
        debugBtn.onclick = () => {
            if (window.updateRiskVisualization) window.updateRiskVisualization();
        };
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
 * Fetches predictive routing data and updates the comparison widget.
 */
async function updateTimeShiftAnalysis() {
    try {
        const response = await fetch('/api/time-shift-routing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                departure_time_offset: window.timeElapsed || 0
            })
        });
        
        if (!response.ok) return;
        const data = await response.json();
        
        const routes = data.routes;
        if (!routes || routes.length < 1) return;
        
        // Future Best is the first in the ranked list
        const futureBest = routes[0];
        
        // Find current best (lowest current_travel_time)
        const currentBest = [...routes].sort((a, b) => a.current_travel_time - b.current_travel_time)[0];
        
        // Update DOM
        document.getElementById('current-best-route').textContent = currentBest.name;
        document.getElementById('current-time').textContent = `${Math.round(currentBest.current_travel_time)} min`;
        
        document.getElementById('future-best-route').textContent = futureBest.name;
        document.getElementById('future-time').textContent = `${Math.round(futureBest.predicted_travel_time)} min`;
        
        document.getElementById('routing-insight').textContent = data.explanation;
        
    } catch (err) {
        console.warn('Error updating time-shift analysis:', err);
    }
}

/**
 * Fetches and displays AI-generated strategic insights using Google Gemini.
 */
async function updateAIInsight() {
    console.log('🤖 Requesting AI insight...');
    const insightText = document.getElementById('insight-text');
    
    try {
        // Collect current state for context
        const response = await fetch('/api/insight/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                route_data: {
                    current_route: document.getElementById('current-best-route').textContent || "Primary Route",
                    alternative_route: document.getElementById('future-best-route').textContent || "Predictive Route",
                    current_eta: document.getElementById('current-time').textContent || "--",
                    alternative_eta: document.getElementById('future-time').textContent || "--"
                },
                risk_data: {
                    current_risks: "Moderate urban congestion patterns",
                    alternative_risks: "Clear path via predictive model"
                },
                time_shift_data: {
                    prediction: "Traffic expected to increase by 15% in next hour"
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            insightText.textContent = data.insight;
            insightText.style.fontStyle = 'normal';
            insightText.style.color = '#111827';
        }
    } catch (err) {
        console.warn('AI Insight fetch failed:', err);
        insightText.textContent = "Unable to reach AI strategist. Monitoring network status...";
    }
}

/**
 * Analyzes potential chain reactions and updates the cascade widget.
 */
async function updateCascadeAnalysis() {
    try {
        const response = await fetch('/api/cascade-analysis');
        if (!response.ok) return;
        
        const data = await response.json();
        const summary = data.summary;
        
        // Update Summary
        document.getElementById('cascade-total').textContent = summary.total_affected;
        document.getElementById('cascade-cost').textContent = summary.financial_impact;
        
        // Update Step Texts
        document.getElementById('cascade-direct-text').textContent = `${summary.breakdown.direct} shipments on route`;
        document.getElementById('cascade-secondary-text').textContent = `${summary.breakdown.secondary} diverted trucks`;
        document.getElementById('cascade-tertiary-text').textContent = `${summary.breakdown.tertiary} warehouse delays`;
        
        // Update Mitigations
        const list = document.getElementById('mitigation-list');
        list.innerHTML = data.mitigations.map(m => `<li>${m}</li>`).join('');
        
    } catch (err) {
        console.warn('Error updating cascade analysis:', err);
    }
}

/**
 * Periodically triggers the autonomous agent and updates the activity feed.
 */
async function updateAutonomousAgent() {
    try {
        // 1. Trigger agent to act
        await fetch(`/api/autonomous-action?time=${window.timeElapsed || 0}`, { method: 'POST' });
        
        // 2. Fetch activity for feed
        const response = await fetch('/api/agent-activity');
        if (!response.ok) return;
        
        const data = await response.json();
        const feed = document.getElementById('agent-activity');
        if (!feed) return;
        
        // Update stats
        const rerouteEl = document.getElementById('auto-reroutes-count');
        const avoidedEl = document.getElementById('disruptions-avoided');
        if (rerouteEl) rerouteEl.textContent = data.stats.reroutes;
        if (avoidedEl) avoidedEl.textContent = data.stats.avoided;

        // Check for new actions
        const currentActionCount = feed.querySelectorAll('.agent-action').length;
        if (data.actions.length > currentActionCount) {
            // New actions found!
            const newActions = data.actions.slice(0, data.actions.length - currentActionCount);
            
            newActions.reverse().forEach(action => {
                const card = document.createElement('div');
                card.className = `agent-action ${action.type.toLowerCase()}`;
                card.innerHTML = `
                    <div class="action-time">${action.timestamp}</div>
                    <div class="action-icon">${action.icon}</div>
                    <div class="action-text">${action.text}</div>
                    <div class="action-confidence">Confidence: ${action.confidence}%</div>
                `;
                feed.prepend(card);
                
                // If it was a reroute, sync the UI (map + shipment list)
                if (action.type === "REROUTE") {
                    if (action.new_route && action.shipment_id) {
                        const newRoute = allRoutes.find(r => r.name === action.new_route);
                        if (newRoute && window.switchRoute) {
                            window.switchRoute(action.shipment_id, newRoute);
                        }
                    }
                    if (window.playSuccessSound) window.playSuccessSound();
                }
            });

            // Limit feed size
            while (feed.children.length > 10) {
                feed.removeChild(feed.lastChild);
            }
        }
    } catch (err) {
        console.warn('Error updating autonomous agent:', err);
    }
}

/**
 * Initiates the recurrent polling loop for live disruption data.
 */
function startRiskMonitoringLoop() {
    const poll = () => {
    const fetchMode = (CONFIG.mode === 'simulated') ? 'simulated' : 'realtime';
    window.fetchRisks(fetchMode);
    lastSuccessfulUpdate = Date.now();
    if (window.checkForHighRisk) window.checkForHighRisk();
    
    // Update analysis widgets
    updateTimeShiftAnalysis();
    updateCascadeAnalysis();
    updateAutonomousAgent();
        
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
    const fetchMode = (CONFIG.mode === 'simulated') ? 'simulated' : 'realtime';
    window.fetchRisks(fetchMode); 
    
    // Initial analysis
    updateTimeShiftAnalysis();
    updateCascadeAnalysis();
    
    startRiskMonitoringLoop();
    
    // Live Analytics polling
    setInterval(updateAnalytics, 5000);

    // AI Strategic Insights polling
    updateAIInsight();
    setInterval(updateAIInsight, 30000);
    
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
    const intervalTime = 1000 / playbackSpeed;
    
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

let bottleneckMarkers = [];
/**
 * Detects nearby static urban bottlenecks and displays them on the map.
 */
async function detectBottlenecks() {
    const center = window.map.getCenter();
    const lat = center.lat();
    const lng = center.lng();
    
    console.log(`Scanning for bottlenecks around ${lat}, ${lng}...`);
    
    try {
        const response = await fetch(`/api/bottlenecks/${lat}/${lng}`);
        if (!response.ok) throw new Error('Bottleneck API failed');
        
        const bottlenecks = await response.json();
        
        // Clear existing markers
        bottleneckMarkers.forEach(m => m.setMap(null));
        bottleneckMarkers = [];
        
        bottlenecks.forEach(b => {
            const marker = new google.maps.Marker({
                position: { lat: b.lat, lng: b.lng },
                map: window.map,
                icon: {
                    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                    scale: 5,
                    fillColor: '#FF9500',
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: '#FFFFFF'
                },
                title: b.name
            });
            
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 10px; color: #1a1f3a;">
                        <h4 style="margin: 0;">${b.name}</h4>
                        <p style="margin: 5px 0;"><b>Type:</b> ${b.type.replace('_', ' ')}</p>
                        <p style="margin: 5px 0;"><b>Risk Factor:</b> ${Math.round(b.risk_factor * 100)}%</p>
                        <p style="margin: 5px 0; font-size: 11px; color: #666;">Static bottleneck identified via Places API</p>
                    </div>
                `
            });
            
            marker.addListener('click', () => {
                infoWindow.open(window.map, marker);
            });
            
            bottleneckMarkers.push(marker);
        });
        
        alert(`Detected ${bottlenecks.length} potential bottlenecks in the current area.`);
        
    } catch (err) {
        console.error('Error detecting bottlenecks:', err);
    }
}

// Export for debugging
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
