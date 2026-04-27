// Global Risk Variables
let riskZones = [];
let weatherEvents = [];
let weatherCircles = [];
let riskCircles = []; // Holds risk circle objects for debugging

let hasRerouted = false;
const locationCache = {};

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

/**
 * TEST circle that ALWAYS renders on map load for debugging.
 */
function testRiskVisualization() {
  console.log('🧪 Testing risk visualization...');
  
  if (!window.map) {
      console.error('❌ Cannot test visualization: map not initialized');
      return;
  }

  // Test circle at Connaught Place (always renders)
  const testCircle = new google.maps.Circle({
    center: {lat: 28.6315, lng: 77.2167},
    radius: 800,
    fillColor: '#FF3B30',
    fillOpacity: 0.4,
    strokeColor: '#FF3B30',
    strokeOpacity: 0.9,
    strokeWeight: 4,
    map: window.map,
    zIndex: 999
  });
  
  console.log('✅ Test circle created:', testCircle);
  
  // Add click handler to verify
  testCircle.addListener('click', () => {
    alert('Risk zone clicked! Visualization working.');
  });
}

/**
 * Updates the map visualization with circular risk zones.
 * Enhanced with fallback zones and forced rendering.
 */
function updateRiskVisualization() {
  console.log('📍 Drawing risk zones:', riskZones.length);
  
  // Clear old circles
  if (window.clearRiskCircles) window.clearRiskCircles();
  
  // FORCE visible zones if none from API
  if (!riskZones || riskZones.length === 0) {
    console.warn('⚠️ No risk zones from API, using fallback');
    riskZones = [
      {
        id: 'fallback-1',
        name: 'Nehru Place Area',
        lat: 28.5494,
        lng: 77.2500,
        riskLevel: 'high',
        cause: 'Heavy traffic detected',
        confidence: 78,
        currentRisk: 0.85
      },
      {
        id: 'fallback-2',
        name: 'Ring Road Junction',
        lat: 28.5800,
        lng: 77.2600,
        riskLevel: 'moderate',
        cause: 'Moderate congestion',
        confidence: 65,
        currentRisk: 0.55
      }
    ];
  }
  
  riskZones.forEach((zone, index) => {
    console.log(`  \u2192 Drawing zone ${index + 1}:`, zone.name, zone.riskLevel);
    
    const color = getRiskColor(zone.riskLevel);
    
    const circle = new google.maps.Circle({
      center: {lat: zone.lat, lng: zone.lng},
      radius: 700, // LARGER radius - more visible
      fillColor: color,
      fillOpacity: 0.35, // MORE opaque
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 4, // THICKER stroke
      map: window.map,
      zIndex: 100, // Above traffic layer
      clickable: true
    });
    
    if (window.circles) window.circles.push(circle);
    
    // PULSING effect for high risk (radius change)
    if (zone.riskLevel === 'high') {
      let growing = true;
      const pulseInterval = setInterval(() => {
        if (!circle.getMap()) {
            clearInterval(pulseInterval);
            return;
        }
        const currentRadius = circle.getRadius();
        circle.setRadius(growing ? currentRadius + 20 : currentRadius - 20);
        if (currentRadius >= 750) growing = false;
        if (currentRadius <= 650) growing = true;
      }, 500);
    }
    
    // Info window
    const infoContent = `
      <div style="padding: 8px; min-width: 200px; color: #1a1f3a;">
        <h4 style="margin: 0 0 8px 0; color: ${color};">${zone.name}</h4>
        <p style="margin: 4px 0;"><strong>${zone.cause}</strong></p>
        <p style="margin: 4px 0;">Risk: ${zone.riskLevel.toUpperCase()}</p>
        <p style="margin: 4px 0;">Confidence: ${zone.confidence}%</p>
        <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
        <button onclick="handleVisionAnalysis(${zone.lat}, ${zone.lng}, '${zone.id}')" 
                style="width: 100%; padding: 6px; background: #1a1f3a; color: white; border: 0; border-radius: 4px; cursor: pointer; font-size: 11px; margin-bottom: 4px;">
          👁️ Run AI Vision Analysis
        </button>
        <button onclick="handleEnvironmentalAudit(${zone.lat}, ${zone.lng}, '${zone.id}')" 
                style="width: 100%; padding: 6px; background: #28a745; color: white; border: 0; border-radius: 4px; cursor: pointer; font-size: 11px;">
          🌍 Run Environmental Audit
        </button>
        <div id="vision-result-${zone.id}" style="margin-top: 8px; font-size: 11px; display: none;">
          Analyzing imagery...
        </div>
        <div id="env-result-${zone.id}" style="margin-top: 8px; font-size: 11px; display: none;">
          Analyzing environmental data...
        </div>
      </div>
    `;
    
    const infoWindow = new google.maps.InfoWindow({
      content: infoContent
    });
    
    circle.addListener('click', () => {
      infoWindow.setPosition({lat: zone.lat, lng: zone.lng});
      infoWindow.open(window.map);
    });
  });
  
  console.log('\u2705 Drew', window.circles ? window.circles.length : 0, 'risk circles');
  
  // Render weather layer after risk zones
  if (typeof showWeatherLayer === 'function') {
      showWeatherLayer(weatherEvents, window.timeElapsed || 0);
  }
}

/**
 * Fetches current risk zones from the backend API.
 * @param {string} mode - 'realtime' or 'simulated'
 */
async function fetchRisks(mode = 'realtime') {
    try {
        console.log(`Fetching ${mode} risks...`);
        const response = await fetch(`/api/risks?mode=${mode}`);
        if (!response.ok) throw new Error('Risk fetch failed');
        
        const data = await response.json();
        riskZones = data.risks || [];
        window.riskZones = riskZones;
        
        // Also update weather if provided in data (optional fallback)
        if (data.weather) {
            weatherEvents = data.weather;
        }

        updateRiskVisualization();
        updateRiskSidebar();
    } catch (err) {
        console.error('Error fetching risks:', err);
    }
}

/**
 * Calls the backend Vision Analysis API and updates the popup with results.
 */
async function handleVisionAnalysis(lat, lng, zoneId) {
    const resultDiv = document.getElementById(`vision-result-${zoneId}`);
    if (!resultDiv) return;
    
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<i>Processing satellite/street imagery...</i>';
    
    try {
        const response = await fetch(`/api/vision-analysis/${lat}/${lng}`);
        if (!response.ok) throw new Error('API Error');
        
        const data = await response.json();
        
        if (data.fallback) {
            resultDiv.innerHTML = `
                <p style="color: #666;">No Street View available for this coordinate. Using historical traffic patterns.</p>
            `;
        } else {
            resultDiv.innerHTML = `
                <div style="background: #f8f9fa; padding: 6px; border-radius: 4px; border-left: 3px solid #1a1f3a;">
                    <b>Detected:</b> ${data.vehicle_count} vehicles<br>
                    <b>AI Confidence:</b> ${data.confidence}%<br>
                    <b>Indicators:</b> ${data.indicators.join(', ')}
                </div>
            `;
        }
    } catch (err) {
        resultDiv.innerHTML = '<span style="color: red;">Error analyzing imagery.</span>';
    }
}

/**
 * Calls the backend Environmental Analysis API and updates the popup.
 */
async function handleEnvironmentalAudit(lat, lng, zoneId) {
    const resultDiv = document.getElementById(`env-result-${zoneId}`);
    if (!resultDiv) return;
    
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<i>Accessing Earth Engine datasets...</i>';
    
    try {
        const response = await fetch(`/api/environmental-risk/${lat}/${lng}`);
        if (!response.ok) throw new Error('API Error');
        
        const data = await response.json();
        const flood = data.flood_analysis;
        const aqi = data.air_quality_analysis;
        
        resultDiv.innerHTML = `
            <div style="background: #e9f7ef; padding: 6px; border-radius: 4px; border-left: 3px solid #28a745; margin-top: 5px;">
                <b>Flood Risk:</b> ${Math.round(flood.flood_risk * 100)}%<br>
                <b>AQI Impact:</b> ${Math.round(aqi.aqi_impact * 100)}%<br>
                <b>Status:</b> ${aqi.zone_type}<br>
                ${flood.warning ? `<span style="color: #d9534f; font-weight: bold;">⚠️ ${flood.warning}</span>` : ''}
            </div>
        `;
    } catch (err) {
        resultDiv.innerHTML = '<span style="color: red;">Error accessing environmental data.</span>';
    }
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

let cascadeShown = false;

/**
 * Monitors risks and triggers rerouting + cascade visualization for high risk.
 */
function checkForHighRisk() {
    const highRisk = riskZones.filter(z => z.riskLevel === 'high');

    if (highRisk.length > 0 && !hasRerouted) {
        hasRerouted = true;
        showAlert(highRisk[0]);
        setTimeout(() => triggerReroute(), 2000);
    }

    // Cascade panel: show once per session on first high-risk detection
    if (highRisk.length > 0 && !cascadeShown) {
        cascadeShown = true;
        setTimeout(() => fetchAndShowCascade(highRisk[0]), 1800);
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
            body: JSON.stringify({
                risks: riskZones,
                departure_offset: window.timeElapsed || 0
            })
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

// -------------------------------------------------------
// CASCADE VISUALIZATION
// -------------------------------------------------------

/**
 * Calls /api/cascade-prediction and triggers the animated panel.
 */
async function fetchAndShowCascade(disruption) {
    try {
        const response = await fetch('/api/cascade-prediction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disruption_name: disruption.name })
        });
        if (!response.ok) throw new Error('cascade-prediction error');
        const data = await response.json();
        showCascadePanel(data);
    } catch (err) {
        console.error('Cascade fetch error:', err);
    }
}

/**
 * Renders and animates the cascade overlay panel sequentially.
 */
function showCascadePanel(data) {
    const panel   = document.getElementById('cascade-panel');
    const backdrop = document.getElementById('cascade-backdrop');
    if (!panel) return;

    // Reset content
    ['cascade-direct', 'cascade-secondary', 'cascade-tertiary', 'mitigation-list-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    document.getElementById('total-affected').textContent  = '0';
    document.getElementById('total-delay').textContent     = '0 min';
    document.getElementById('financial-impact').textContent = '\u20b90';

    // Reset animation states
    panel.querySelectorAll('.cascade-level').forEach(el => el.classList.remove('visible'));
    panel.querySelectorAll('.cascade-arrow').forEach(el => el.classList.remove('visible'));

    // Slide panel in
    panel.classList.remove('hidden');
    if (backdrop) backdrop.classList.add('visible');

    const cascade     = data.cascade    || {};
    const summary     = data.summary    || {};
    const mitigations = data.mitigations || [];

    // -- Level 1: Direct Impact (300 ms)
    setTimeout(() => {
        const lv1 = panel.querySelector('.cascade-level.level-1');
        if (lv1) lv1.classList.add('visible');

        const items = cascade.direct || [];
        const el = document.getElementById('cascade-direct');
        if (el) {
            el.innerHTML = items.length
                ? items.map(i => `<div class="impact-item">\uD83D\uDE9B <strong>${i.id}</strong> \u2014 ${i.cargo} (+${i.delay} min)</div>`).join('')
                : '<div class="impact-item">No direct impacts detected</div>';
        }
        if (items.length) highlightAffectedShipments(items);
    }, 300);

    // Arrow 1 (900 ms)
    setTimeout(() => {
        const arrows = panel.querySelectorAll('.cascade-arrow');
        if (arrows[0]) arrows[0].classList.add('visible');
    }, 900);

    // -- Level 2: Secondary Effects (1 300 ms)
    setTimeout(() => {
        const lv2 = panel.querySelector('.cascade-level.level-2');
        if (lv2) lv2.classList.add('visible');

        const items = cascade.secondary || [];
        const el = document.getElementById('cascade-secondary');
        if (el) {
            el.innerHTML = items.length
                ? items.map(i => `<div class="impact-item">\u26A0\uFE0F +${i.additional_affected} trucks \u2014 ${i.reason}</div>`).join('')
                : '<div class="impact-item">No secondary impacts</div>';
        }
    }, 1300);

    // Arrow 2 (1 900 ms)
    setTimeout(() => {
        const arrows = panel.querySelectorAll('.cascade-arrow');
        if (arrows[1]) arrows[1].classList.add('visible');
    }, 1900);

    // -- Level 3: System-Wide (2 400 ms)
    setTimeout(() => {
        const lv3 = panel.querySelector('.cascade-level.level-3');
        if (lv3) lv3.classList.add('visible');

        const items = cascade.tertiary || [];
        const el = document.getElementById('cascade-tertiary');
        if (el) {
            el.innerHTML = items.length
                ? items.map(i => `<div class="impact-item">\uD83C\uDFED ${i.reason} (+${i.delay} min)</div>`).join('')
                : '<div class="impact-item">No warehouse impacts</div>';
        }
    }, 2400);

    // -- Stats count-up (3 000 ms)
    setTimeout(() => {
        animateCountUp('total-affected',  summary.total_affected   || 0, '',    1100, '');
        animateCountUp('total-delay',     summary.total_delay_mins || 0, ' min', 1200, '');

        const rawCost = summary.financial_impact || '\u20b90';
        const costNum = parseInt(rawCost.replace(/[^0-9]/g, '')) || 0;
        animateCountUp('financial-impact', costNum, '', 1500, '\u20b9', true);
    }, 3000);

    // -- Mitigation items (3 600 ms, staggered)
    setTimeout(() => {
        const mitEl = document.getElementById('mitigation-list-overlay');
        if (!mitEl) return;
        mitEl.innerHTML = mitigations.map(m => `<div class="mitigation-item">${m}</div>`).join('');
        mitEl.querySelectorAll('.mitigation-item').forEach((item, i) => {
            setTimeout(() => item.classList.add('visible'), i * 220);
        });
    }, 3600);
}

/**
 * Smoothly counts a number element from 0 to target.
 */
function animateCountUp(elementId, target, suffix, duration, prefix, commaSeparate) {
    const el = document.getElementById(elementId);
    if (!el || target === 0) {
        if (el) el.textContent = `${prefix || ''}0${suffix}`;
        return;
    }
    const startTime = performance.now();
    function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3);
        const current  = Math.floor(target * eased);
        const display  = commaSeparate ? current.toLocaleString('en-IN') : current;
        el.textContent = `${prefix || ''}${display}${suffix}`;
        if (progress < 1) requestAnimationFrame(update);
        else {
            const final = commaSeparate ? target.toLocaleString('en-IN') : target;
            el.textContent = `${prefix || ''}${final}${suffix}`;
        }
    }
    requestAnimationFrame(update);
}

/**
 * Adds red pulsing highlight circles on the map for directly affected shipments.
 */
function highlightAffectedShipments(directImpacted) {
    if (!window.map || !window.circles) return;
    const affectedIds = new Set(directImpacted.map(d => d.id));

    (window.trucks || []).forEach(truck => {
        if (!affectedIds.has(truck.id)) return;
        const marker = truck.marker;
        if (!marker) return;
        const pos = marker.getPosition();
        if (!pos) return;

        const ring = new google.maps.Circle({
            strokeColor:   '#FF3B30',
            strokeOpacity: 1.0,
            strokeWeight:  3,
            fillColor:     '#FF3B30',
            fillOpacity:   0.18,
            map:           window.map,
            center:        { lat: pos.lat(), lng: pos.lng() },
            radius:        350,
            zIndex:        25
        });
        window.circles.push(ring);

        let op = 0.18, up = true;
        const iv = setInterval(() => {
            if (!ring.getMap()) { clearInterval(iv); return; }
            op = up ? op + 0.06 : op - 0.06;
            if (op >= 0.5)  up = false;
            if (op <= 0.1)  up = true;
            ring.setOptions({ fillOpacity: op });
        }, 80);
    });
}

// Close button handler
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-cascade');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('cascade-panel').classList.add('hidden');
            const bd = document.getElementById('cascade-backdrop');
            if (bd) bd.classList.remove('visible');
        });
    }
    // Clicking backdrop also closes the panel
    const backdrop = document.getElementById('cascade-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            document.getElementById('cascade-panel').classList.add('hidden');
            backdrop.classList.remove('visible');
        });
    }
});

window.fetchAndShowCascade   = fetchAndShowCascade;
window.showCascadePanel      = showCascadePanel;
window.highlightAffectedShipments = highlightAffectedShipments;
