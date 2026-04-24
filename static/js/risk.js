// Global Risk Variables
let riskZones = [];
let timeElapsed = 0;
let hasRerouted = false;

/**
 * Fetches the latest risk data from the backend API.
 */
async function fetchRisks() {
    try {
        const response = await fetch(`/api/disruptions?time=${timeElapsed}`);
        riskZones = await response.json();
        
        updateRiskVisualization();
        updateRiskSidebar();
        checkForHighRisk();
        
        // Optionally update prediction counter based on risks length
        const predictionsCount = document.getElementById('predictions-count');
        if (predictionsCount) {
            predictionsCount.textContent = riskZones.length * (timeElapsed + 1);
        }
    } catch (err) {
        console.error('Error fetching risks:', err);
    }
}

/**
 * Updates the map visualization with circular risk zones.
 */
function updateRiskVisualization() {
    window.clearRiskCircles(); // Clear previous circles
    
    riskZones.forEach(zone => {
        const color = getRiskColor(zone.riskLevel);
        const circle = window.drawRiskCircle(zone.lat, zone.lng, 600, color);
        
        const infoWindow = new google.maps.InfoWindow({
            content: `<div class="risk-popup">
                <h4>${zone.name}</h4>
                <p><strong>${zone.cause}</strong></p>
                <p>Risk Level: ${zone.riskLevel.toUpperCase()}</p>
                <p>Confidence: ${zone.confidence}%</p>
            </div>`
        });
        
        circle.addListener('click', () => {
            infoWindow.setPosition({lat: zone.lat, lng: zone.lng});
            infoWindow.open(window.map);
        });
    });
}

/**
 * Updates the sidebar DOM with current risk data.
 */
function updateRiskSidebar() {
    const riskList = document.getElementById('risk-list');
    
    if (riskList) {
        riskList.innerHTML = riskZones.map(zone => `
            <div class="risk-item risk-${zone.riskLevel}">
                <div class="risk-header">
                    <span class="risk-dot"></span>
                    <strong>${zone.name}</strong>
                </div>
                <div class="risk-details">
                    <small>${zone.cause}</small>
                    <span class="risk-confidence">${zone.confidence}%</span>
                </div>
            </div>
        `).join('');
    }
}

/**
 * Maps risk severity level to hex color codes.
 * @param {string} level - The risk level string ('high', 'moderate', 'low')
 * @returns {string} Hexadecimal color code
 */
function getRiskColor(level) {
    if (level === 'high') return '#FF3B30';
    if (level === 'moderate') return '#FF9500';
    return '#34C759'; // Low/Default
}

/**
 * Monitors risks and triggers rerouting workflow if a high risk is detected.
 */
function checkForHighRisk() {
    const highRisk = riskZones.filter(z => z.riskLevel === 'high');
    
    if (highRisk.length > 0 && !hasRerouted) {
        showAlert(highRisk[0]);
        setTimeout(() => triggerReroute(), 2000);
    }
}

/**
 * Displays the alert popup modal with given disruption info.
 * @param {Object} disruption - The disruption data object
 */
function showAlert(disruption) {
    const alertPanel = document.getElementById('alert-panel');
    document.getElementById('alert-title').textContent = 'Disruption Detected';
    document.getElementById('alert-cause').textContent = disruption.cause;
    document.getElementById('alert-confidence').textContent = `Confidence: ${disruption.confidence}%`;
    document.getElementById('alert-eta').textContent = 'Route will be affected in ~12 minutes';
    
    alertPanel.classList.remove('hidden');
}

/**
 * Makes POST request for optimal route, then updates DOM & system.
 */
async function triggerReroute() {
    try {
        const response = await fetch('/api/best-route', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({risks: riskZones})
        });
        
        const data = await response.json();
        const route = data.route;
        
        document.getElementById('alert-action').innerHTML = `
            Switching to: <strong>${route.name}</strong>
        `;
        
        setTimeout(() => {
            if (window.switchRoute) {
                window.switchRoute(route);
            }
            document.getElementById('alert-panel').classList.add('hidden');
            window.hasRerouted = true;
            
            const count = document.getElementById('reroutes-count');
            if (count) {
                count.textContent = parseInt(count.textContent) + 1;
            }
        }, 1500);
    } catch (err) {
        console.error('Error triggering reroute:', err);
    }
}

// Export functions and variables to global window object
window.riskZones = riskZones;
window.timeElapsed = timeElapsed;
window.hasRerouted = hasRerouted;

window.fetchRisks = fetchRisks;
window.updateRiskVisualization = updateRiskVisualization;
window.updateRiskSidebar = updateRiskSidebar;
window.getRiskColor = getRiskColor;
window.checkForHighRisk = checkForHighRisk;
window.showAlert = showAlert;
window.triggerReroute = triggerReroute;
