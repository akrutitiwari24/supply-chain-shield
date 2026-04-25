// Global Risk Variables
let riskZones = [];
let weatherEvents = [];
let weatherCircles = [];
let timeElapsed = 0;
let hasRerouted = false;
const locationCache = {};

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Fetches the latest risk data from the backend API.
 */
async function fetchRisks(mode = 'simulated') {
    let sourceMode = mode;
    try {
        if (mode === 'realtime') {
            try {
                const routeId = window.currentRoute ? window.currentRoute.id : 'primary';
                const response = await fetch(`/api/realtime-risks?route_id=${routeId}`);
                if (!response.ok) throw new Error('Realtime API response not OK');
                riskZones = await response.json();
                if (!riskZones || riskZones.length === 0) throw new Error('No real-time risks returned');
                riskZones.forEach(z => z.source = 'realtime');
            } catch (rtErr) {
                console.warn('Real-time data unavailable, using simulation');
                sourceMode = 'simulated';
            }
        }
        
        if (sourceMode === 'simulated') {
            const response = await fetch(`/api/disruptions?time=${timeElapsed}`);
            riskZones = await response.json();
            riskZones.forEach(z => z.source = 'simulated');
        }
        
        const weatherResponse = await fetch('/api/weather');
        weatherEvents = await weatherResponse.json();
        
        updateRiskVisualization();
        await updateRiskSidebar();
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
        const radius = 400 + (zone.currentRisk * 500);
        // We set zIndex so risk zones stay ON TOP of weather
        const circle = new google.maps.Circle({
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.35,
            map: window.map,
            center: {lat: zone.lat, lng: zone.lng},
            radius: radius,
            zIndex: 10
        });
        window.riskCircles.push(circle);
        
        if (zone.riskLevel === 'high') {
            let opacity = 0.25;
            let growing = true;
            const pulseInterval = setInterval(() => {
                if (!circle.getMap()) {
                    clearInterval(pulseInterval);
                    return;
                }
                opacity = growing ? opacity + 0.05 : opacity - 0.05;
                if (opacity >= 0.45) growing = false;
                if (opacity <= 0.25) growing = true;
                circle.setOptions({ fillOpacity: opacity });
            }, 100);
        }
        
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
    
    showWeatherLayer(weatherEvents, timeElapsed);
}

/**
 * Renders the active weather events onto the map.
 * @param {Array} weatherEvents Array of weather objects
 * @param {number} currentTime Simulation time
 */
function showWeatherLayer(weatherEvents, currentTime) {
    // Clear old weather circles
    weatherCircles.forEach(circle => {
        if (circle.effectInterval) clearInterval(circle.effectInterval);
        circle.setMap(null);
    });
    weatherCircles = [];
    
    const activeEvents = weatherEvents.filter(e => 
        currentTime >= e.startTime && currentTime < (e.startTime + e.duration)
    );
    
    activeEvents.forEach(event => {
        let color = '#CCCCCC';
        let opacity = 0.3;
        
        if (event.type === 'rain') {
            color = '#4A90E2';
            opacity = 0.2;
        } else if (event.type === 'storm') {
            color = '#6B5B95';
            opacity = 0.25;
        }
        
        const circle = new google.maps.Circle({
            strokeColor: color,
            strokeOpacity: 0.5,
            strokeWeight: 1,
            fillColor: color,
            fillOpacity: opacity,
            map: window.map,
            center: event.location,
            radius: event.radius,
            zIndex: 5 // Ensure this is under risk zones (zIndex: 10)
        });
        
        // Add animated effects
        if (event.type === 'rain' || event.type === 'storm') {
            // Shimmer effect
            let shimmerUp = true;
            let currentOp = opacity;
            circle.effectInterval = setInterval(() => {
                if (!circle.getMap()) return clearInterval(circle.effectInterval);
                currentOp = shimmerUp ? currentOp + 0.05 : currentOp - 0.05;
                if (currentOp > opacity + 0.1) shimmerUp = false;
                if (currentOp < opacity - 0.1) shimmerUp = true;
                circle.setOptions({ fillOpacity: currentOp });
            }, 150);
        } else if (event.type === 'fog') {
            // Slow fade
            let fadeUp = true;
            let currentOp = opacity;
            circle.effectInterval = setInterval(() => {
                if (!circle.getMap()) return clearInterval(circle.effectInterval);
                currentOp = fadeUp ? currentOp + 0.02 : currentOp - 0.02;
                if (currentOp > opacity + 0.15) fadeUp = false;
                if (currentOp < opacity - 0.1) fadeUp = true;
                circle.setOptions({ fillOpacity: currentOp });
            }, 500);
        }
        
        weatherCircles.push(circle);
    });
}

/**
 * Fetches the formatted address or neighborhood name for given coordinates using Google Geocoder.
 */
async function getLocationName(lat, lng) {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (locationCache[cacheKey]) return locationCache[cacheKey];

    try {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response.results && response.results.length > 0) {
            // Try to find a neighborhood or sublocality for a more descriptive "Area" name
            const neighborhood = response.results[0].address_components.find(c => 
                c.types.includes('neighborhood') || c.types.includes('sublocality_level_1')
            );
            const name = neighborhood ? neighborhood.long_name : response.results[0].formatted_address.split(',')[0];
            locationCache[cacheKey] = name;
            return name;
        }
    } catch (error) {
        console.warn('Geocoding warning:', error);
    }
    return `Area near ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

/**
 * Updates the sidebar DOM with current risk data.
 */
async function updateRiskSidebar() {
    const riskList = document.getElementById('risk-list');
    
    if (riskList) {
        // Resolve names for zones that don't have specific names (realtime zones)
        for (let zone of riskZones) {
            if (!zone.name || zone.name.startsWith('Area near')) {
                zone.name = await getLocationName(zone.lat, zone.lng);
            }
        }

        riskList.innerHTML = riskZones.map(zone => {
            const badge = zone.source === 'realtime' ? '<span class="badge live" style="margin-left:auto; font-size:0.7em;">🔴 LIVE</span>' : '<span class="badge sim" style="margin-left:auto; font-size:0.7em;">📊 SIM</span>';
            return `
            <div class="risk-item risk-${zone.riskLevel}">
                <div class="risk-header" style="display:flex; align-items:center;">
                    <span class="risk-dot"></span>
                    <strong>${zone.name}</strong>
                    ${badge}
                </div>
                <div class="risk-details">
                    <small>${zone.cause}</small>
                    <span class="risk-confidence">${zone.confidence}%</span>
                </div>
            </div>
        `}).join('');
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
        hasRerouted = true; // Set immediately to prevent loop
        showAlert(highRisk[0]);
        setTimeout(() => triggerReroute(), 2000);
    }
}

/**
 * Displays the alert popup modal with given disruption info.
 * @param {Object} disruption - The disruption data object
 */
function showAlert(disruption) {
    playAlertSound();
    const alertPanel = document.getElementById('alert-panel');
    document.getElementById('alert-title').textContent = 'Disruption Detected';
    document.getElementById('alert-cause').textContent = disruption.cause;
    document.getElementById('alert-confidence').textContent = `Confidence: ${disruption.confidence}%`;
    
    // Calculate predictive timeline based on simulation data
    const currentRisk = disruption.currentRisk || 0.5;
    const growth = disruption.growthFactor || 1.1;
    
    // Time until critical congestion (estimated)
    const timeToCritical = Math.max(2, Math.floor(((1.0 - currentRisk) * 10) / growth));
    
    // Check for overlapping weather events near this time
    const overlappingWeather = window.weatherEvents && window.weatherEvents.filter(w => 
        window.timeElapsed >= w.startTime - 5 && 
        window.timeElapsed <= w.startTime + w.duration
    );
    const hasWeatherImpact = overlappingWeather && overlappingWeather.length > 0;
    
    const t1 = timeToCritical;
    const t2 = t1 + (hasWeatherImpact ? 6 : 9);
    const t3 = t2 + (hasWeatherImpact ? 7 : 11);
    const t4 = t3 + 5;
    
    const weatherText = hasWeatherImpact ? 
        `${overlappingWeather[0].type.charAt(0).toUpperCase() + overlappingWeather[0].type.slice(1)} compounds impact, visibility drops` :
        `Congestion spills over to adjacent arteries`;
    
    const timelineHtml = `
        <div class="predictive-timeline">
            <h4>Predicted Timeline:</h4>
            <div class="timeline-step step-yellow">
                <span class="step-text">T+${t1}min: ${disruption.cause} reaches critical congestion</span>
            </div>
            <div class="timeline-step step-orange">
                <span class="step-text">T+${t2}min: ${weatherText}</span>
            </div>
            <div class="timeline-step step-red">
                <span class="step-text">T+${t3}min: Combined impact causes 40min delay</span>
            </div>
            <div class="timeline-step step-darkred">
                <span class="step-text">T+${t4}min: Window for reroute closes</span>
            </div>
        </div>
    `;
    
    document.getElementById('alert-eta').innerHTML = timelineHtml;
    
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
                playSuccessSound();
            }
            document.getElementById('alert-panel').classList.add('hidden');
            
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

/**
 * Generates a subtle alert beep.
 */
function playAlertSound() {
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioContext.currentTime);
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.2);
}

/**
 * Generates a subtle success chime.
 */
function playSuccessSound() {
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioContext.currentTime);
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.15);
}

window.playAlertSound = playAlertSound;
window.playSuccessSound = playSuccessSound;
