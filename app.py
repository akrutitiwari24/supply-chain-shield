import json
import os
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

import time
from logic.risk_engine import RiskEngine
from logic.route_selector import RouteSelector
from logic.predictor import RiskPredictor
from logic.realtime_data import RealTimeDataFetcher
from logic.time_shift_predictor import TimeShiftPredictor
from logic.cascade_predictor import CascadePredictor
from logic.autonomous_agent import AutonomousAgent
from logic.vision_analyzer import VisionAnalyzer
from logic.bottleneck_detector import BottleneckDetector
from logic.insight_generator import InsightGenerator
from logic.environmental_monitor import EnvironmentalMonitor

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Enable CORS for all routes
CORS(app)
# Set secret key from environment or use a default
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default-secret-key')

# Initialize logic components
risk_engine = RiskEngine()
route_selector = RouteSelector()
predictor = RiskPredictor()
time_shift_predictor = TimeShiftPredictor()
cascade_predictor = None # Initialized after data load
autonomous_agent = AutonomousAgent(risk_threshold=0.6, auto_mode=True)
vision_analyzer = VisionAnalyzer(os.getenv('GOOGLE_MAPS_API_KEY'))
bottleneck_detector = BottleneckDetector(os.getenv('GOOGLE_MAPS_API_KEY'))
insight_generator = InsightGenerator()
environmental_monitor = EnvironmentalMonitor()

realtime_fetcher = RealTimeDataFetcher(
    google_api_key=os.getenv('GOOGLE_MAPS_API_KEY'),
    weather_api_key=os.getenv('OPENWEATHER_API_KEY')
)
realtime_cache = {}

# Load data files
DISRUPTIONS = []
ROUTES = {}
SHIPMENTS = []
WEATHER = []

try:
    disruptions_path = os.path.join(os.path.dirname(__file__), 'data', 'disruptions.json')
    if os.path.exists(disruptions_path):
        with open(disruptions_path, 'r') as f:
            DISRUPTIONS = json.load(f)
except Exception as e:
    print(f"Error loading disruptions: {e}")

try:
    routes_path = os.path.join(os.path.dirname(__file__), 'data', 'routes.json')
    if os.path.exists(routes_path):
        with open(routes_path, 'r') as f:
            ROUTES = json.load(f)
except Exception as e:
    print(f"Error loading routes: {e}")

try:
    shipments_path = os.path.join(os.path.dirname(__file__), 'data', 'shipments.json')
    if os.path.exists(shipments_path):
        with open(shipments_path, 'r') as f:
            SHIPMENTS = json.load(f)
except Exception as e:
    print(f"Error loading shipments: {e}")

try:
    weather_path = os.path.join(os.path.dirname(__file__), 'data', 'weather.json')
    if os.path.exists(weather_path):
        with open(weather_path, 'r') as f:
            WEATHER = json.load(f)
except Exception as e:
    print(f"Error loading weather: {e}")

@app.route('/')
def index():
    """Render the main index.html page, passing the Google Maps API key from environment."""
    return render_template('index.html', google_maps_key=os.getenv('GOOGLE_MAPS_API_KEY'))


@app.route('/api/disruptions')
def get_disruptions():
    """Get all disruptions, dynamically calculating risk based on the time parameter."""
    time = int(request.args.get('time', 0))
    
    updated_disruptions = []
    
    for disruption in DISRUPTIONS:
        d = dict(disruption)
        
        current_base_risk = d.get('delayRisk', 0.0)
        growth_factor = d.get('growthFactor', 0.0)
        
        current_risk = predictor.predict_future_risk(current_base_risk, growth_factor, time)
        
        d['currentRisk'] = current_risk
        d['riskLevel'] = risk_engine.get_risk_level(current_risk)
        d['confidence'] = risk_engine.get_confidence(d)
        
        updated_disruptions.append(d)
        
    return jsonify(updated_disruptions)

@app.route('/api/routes')
def get_routes():
    """Return all routes as a list."""
    return jsonify(list(ROUTES.values()))

@app.route('/api/shipments')
def get_shipments():
    """Return all shipments."""
    return jsonify(SHIPMENTS)

@app.route('/api/weather')
def get_weather():
    """Return weather events."""
    return jsonify(WEATHER)


@app.route('/api/realtime-risks')
def get_realtime_risks():
    """Get real-time risks for the given route."""
    route_id = request.args.get('route_id', 'primary')
    route = ROUTES.get(route_id)
    
    if not route or 'waypoints' not in route:
        return jsonify([])
        
    cache_key = f"realtime-risks-{route_id}"
    now = time.time()
    if cache_key in realtime_cache and now - realtime_cache[cache_key]['time'] < 60:
        return jsonify(realtime_cache[cache_key]['data'])
        
    waypoints = route['waypoints'][:3]
    disruptions = []
    
    try:
        for idx, wp in enumerate(waypoints):
            risk_data = realtime_fetcher.calculate_realtime_risk(wp['lat'], wp['lng'])
            if risk_data:
                disruptions.append({
                    'id': f"realtime_{idx}",
                    'name': f"Area near {wp['lat']:.4f},{wp['lng']:.4f}",
                    'lat': wp['lat'],
                    'lng': wp['lng'],
                    'type': "realtime",
                    'delayRisk': risk_data.get('overall_risk', 0),
                    'cause': risk_data.get('cause', 'Unknown'),
                    'currentRisk': risk_data.get('overall_risk', 0),
                    'riskLevel': risk_engine.get_risk_level(risk_data.get('overall_risk', 0)),
                    'confidence': risk_data.get('confidence', 0),
                    'traffic_component': risk_data.get('traffic_component', 0),
                    'weather_component': risk_data.get('weather_component', 0)
                })
        
        realtime_cache[cache_key] = {'time': now, 'data': disruptions}
        return jsonify(disruptions)
    except Exception as e:
        print(f"Error fetching realtime risks: {e}")
        return jsonify([])

@app.route('/api/realtime-routes')
def get_realtime_routes():
    """Return routes with real-time traffic data."""
    origin_lat = request.args.get('origin_lat')
    origin_lng = request.args.get('origin_lng')
    dest_lat = request.args.get('dest_lat')
    dest_lng = request.args.get('dest_lng')
    
    if not all([origin_lat, origin_lng, dest_lat, dest_lng]):
        return jsonify([])
        
    cache_key = f"realtime-routes-{origin_lat}-{origin_lng}-{dest_lat}-{dest_lng}"
    now = time.time()
    if cache_key in realtime_cache and now - realtime_cache[cache_key]['time'] < 60:
        return jsonify(realtime_cache[cache_key]['data'])
        
    try:
        routes = realtime_fetcher.get_route_with_traffic(
            float(origin_lat), float(origin_lng), float(dest_lat), float(dest_lng)
        )
        
        # Convert to our format
        formatted_routes = []
        for idx, r in enumerate(routes):
            r['id'] = f"realtime_route_{idx}"
            r['name'] = r.get('summary', f"Route {idx+1}")
            formatted_routes.append(r)
            
        realtime_cache[cache_key] = {'time': now, 'data': formatted_routes}
        return jsonify(formatted_routes)
    except Exception as e:
        print(f"Error fetching realtime routes: {e}")
        return jsonify([])

@app.route('/api/weather/<lat>/<lng>')
def get_weather_location(lat, lng):
    """Return real-time weather for a location."""
    cache_key = f"weather-{lat}-{lng}"
    now = time.time()
    if cache_key in realtime_cache and now - realtime_cache[cache_key]['time'] < 60:
        return jsonify(realtime_cache[cache_key]['data'])
        
    try:
        weather_data = realtime_fetcher.get_weather_data(float(lat), float(lng))
        realtime_cache[cache_key] = {'time': now, 'data': weather_data}
        return jsonify(weather_data)
    except Exception as e:
        print(f"Error fetching realtime weather: {e}")
        return jsonify({})

@app.route('/api/best-route', methods=['POST'])
def get_best_route():
    """Calculate and return the best route based on provided array of risks and future traffic prediction."""
    data = request.get_json() or {}
    risks = data.get('risks', [])
    departure_offset = int(data.get('departure_offset', 0))
    
    # 1. Traditional risk-based selector
    best_risk_route = route_selector.select_best_route(list(ROUTES.values()), risks)
    
    # 2. Advanced predictive selector
    predictive_routes = time_shift_predictor.compare_routes_time_shifted(list(ROUTES.values()), departure_offset)
    best_predictive = predictive_routes[0] if predictive_routes else None
    
    if not best_predictive:
        return jsonify({'error': 'No routes available'}), 404
        
    return jsonify({
        'route': best_predictive, 
        'reason': best_predictive.get('explanation', 'Optimal predicted performance'), 
        'riskScore': best_risk_route.get('riskScore', 0),
        'predicted_delay': best_predictive.get('predicted_delay', 0),
        'predicted_total_time': best_predictive.get('predicted_total_time', 0),
        'comparison': predictive_routes
    })

@app.route('/api/time-shift-routing', methods=['POST'])
def get_time_shift_routing():
    """Detailed predictive routing analysis comparing current vs future traffic states."""
    data = request.get_json() or {}
    input_routes = data.get('routes', list(ROUTES.values()))
    departure_offset = int(data.get('departure_time_offset', 0))
    
    # Analyze routes with future prediction
    ranked_results = time_shift_predictor.compare_routes_time_shifted(input_routes, departure_offset)
    
    # Augment with current traffic baseline for comparison
    for res in ranked_results:
        # Calculate current travel time (offset=0)
        current_delay = time_shift_predictor.get_future_route_score(res['waypoints'], 0)
        
        # Calculate base time (dist/30)
        total_dist = 0
        for i in range(len(res['waypoints']) - 1):
            total_dist += time_shift_predictor._haversine_distance(res['waypoints'][i], res['waypoints'][i+1])
        base_time = (total_dist / 30.0) * 60
        
        res['current_travel_time'] = round(base_time + current_delay, 1)
        res['predicted_travel_time'] = res['predicted_total_time']
        res['time_advantage'] = round(res['current_travel_time'] - res['predicted_travel_time'], 1)
        
        # Dynamic recommendation
        if res['time_advantage'] > 10:
            res['recommendation'] = "Best choice (Future-Optimized)"
        elif res['time_advantage'] < -10:
            res['recommendation'] = "Will encounter heavy delays"
        else:
            res['recommendation'] = "Stable choice"

    # Add a global summary explanation if multiple routes provided
    if len(ranked_results) >= 2:
        best = ranked_results[0]
        others = ranked_results[1:]
        
        # Find if there's a "smart" choice (one that is slower now but faster later)
        smart_choice = None
        for r in others:
            if r['current_travel_time'] < best['current_travel_time'] and r['predicted_travel_time'] > best['predicted_travel_time']:
                smart_choice = r
                break
        
        if smart_choice:
            delay_diff = round(best['current_travel_time'] - smart_choice['current_travel_time'], 1)
            saving = round(smart_choice['predicted_travel_time'] - best['predicted_travel_time'], 1)
            explanation = f"{best['name']} recommended. Although {delay_diff}min slower now, it avoids congestion that {smart_choice['name']} will face later, saving {saving}min overall."
        else:
            explanation = f"{best['name']} is the fastest route both currently and in the predicted future window."
    else:
        explanation = "Route analyzed for future traffic performance."

    return jsonify({
        'routes': ranked_results,
        'explanation': explanation
    })


@app.route('/api/cascade-analysis')
def get_cascade_analysis():
    """Analyze the potential chain reaction impacts of current disruptions."""
    # Ensure predictor is initialized with current data
    global cascade_predictor
    cascade_predictor = CascadePredictor(DISRUPTIONS, ROUTES, SHIPMENTS)
    
    # Pick the highest risk disruption to analyze
    if not DISRUPTIONS:
        return jsonify({'error': 'No active disruptions to analyze'}), 404
        
    # Find disruption with highest base risk
    target = sorted(DISRUPTIONS, key=lambda x: x.get('delayRisk', 0), reverse=True)[0]
    
    cascade_tree = cascade_predictor.predict_cascade(target)
    impact_summary = cascade_predictor.calculate_total_impact(cascade_tree)
    mitigations = cascade_predictor.suggest_mitigation(cascade_tree)
    
    return jsonify({
        'initial_event': target['name'],
        'cascade': cascade_tree,
        'summary': impact_summary,
        'mitigations': mitigations
    })

@app.route('/api/cascade-prediction', methods=['POST'])
def get_cascade_prediction():
    """Get cascade prediction triggered by a specific or highest-risk disruption."""
    global cascade_predictor
    cascade_predictor = CascadePredictor(DISRUPTIONS, ROUTES, SHIPMENTS)

    if not DISRUPTIONS:
        return jsonify({'error': 'No active disruptions to analyze'}), 404

    data = request.get_json() or {}
    disruption_name = data.get('disruption_name')

    # Find the requested disruption, or fall back to highest base risk
    target = None
    if disruption_name:
        target = next((d for d in DISRUPTIONS if d.get('name') == disruption_name), None)
    if not target:
        target = sorted(DISRUPTIONS, key=lambda x: x.get('delayRisk', 0), reverse=True)[0]

    cascade_tree    = cascade_predictor.predict_cascade(target)
    impact_summary  = cascade_predictor.calculate_total_impact(cascade_tree)
    mitigations     = cascade_predictor.suggest_mitigation(cascade_tree)

    return jsonify({
        'initial_event': target['name'],
        'cascade':       cascade_tree,
        'summary':       impact_summary,
        'mitigations':   mitigations
    })


@app.route('/api/health')
def health_check():
    """Return health status of the API system."""
    return jsonify({'status': 'ok', 'system': 'operational'})

@app.route('/api/agent-activity')
def get_agent_activity():
    """Endpoint for the live agent activity feed widget."""
    history = autonomous_agent.get_decision_history()
    
    # Format for the activity feed cards
    actions = []
    for h in history:
        actions.append({
            "timestamp": h["timestamp"],
            "icon": "🔄" if h["action"] == "REROUTE" else "📡",
            "text": autonomous_agent.explain_decision(h),
            "confidence": h.get("confidence", 80),
            "type": h["action"],
            "shipment_id": h.get("shipment_id"),
            "new_route": h.get("new_route")
        })
        
    return jsonify({
        "actions": actions[::-1], # Most recent first
        "stats": {
            "reroutes": sum(1 for h in history if h["action"] == "REROUTE"),
            "avoided": sum(1 for h in history if h["action"] == "REROUTE") # Simplified for demo
        }
    })

@app.route('/api/vision-analysis/<lat>/<lng>')
def vision_analysis(lat, lng):
    """Perform AI-based visual traffic analysis for a specific coordinate."""
    try:
        result = vision_analyzer.analyze_traffic_from_streetview(float(lat), float(lng))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "congestion_score": 0.0}), 500

@app.route('/api/bottlenecks/<lat>/<lng>')
def get_bottlenecks(lat, lng):
    """Identify nearby urban bottlenecks using Google Places API."""
    try:
        bottlenecks = bottleneck_detector.find_bottleneck_locations(float(lat), float(lng))
        return jsonify(bottlenecks)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/advanced-routing', methods=['POST'])
def get_advanced_routing():
    """Endpoint for the NEW Google Routes API v2 with traffic prediction."""
    data = request.json
    origin = data.get('origin', {})
    destination = data.get('destination', {})
    offset = data.get('departure_time_offset', 0)
    
    if not origin or not destination:
        return jsonify({"error": "Missing origin or destination"}), 400
        
    routes = realtime_fetcher.get_advanced_routes(
        origin.get('lat'), origin.get('lng'),
        destination.get('lat'), destination.get('lng'),
        departure_time_offset=offset
    )
    
    return jsonify(routes)

@app.route('/api/insight/route', methods=['POST'])
def get_route_insight():
    """Generate LLM-based natural language insight for a routing decision."""
    data = request.json
    route_data = data.get('route_data', {})
    risk_data = data.get('risk_data', {})
    time_shift_data = data.get('time_shift_data', {})
    
    insight = insight_generator.generate_route_insight(route_data, risk_data, time_shift_data)
    return jsonify({"insight": insight})

@app.route('/api/environmental-risk/<lat>/<lng>')
def get_environmental_risk(lat, lng):
    """Analyze environmental risks (flooding, AQI) using Google Earth Engine."""
    try:
        lat_val, lng_val = float(lat), float(lng)
        flood_data = environmental_monitor.check_flood_risk(lat_val, lng_val)
        aqi_data = environmental_monitor.check_air_quality_impact(lat_val, lng_val)
        
        return jsonify({
            "flood_analysis": flood_data,
            "air_quality_analysis": aqi_data,
            "combined_environmental_risk": round((flood_data['flood_risk'] + aqi_data['aqi_impact']) / 2, 2)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/autonomous-action', methods=['POST'])
def run_autonomous_agent():
    """Trigger the autonomous agent to evaluate and act on current shipments."""
    time_val = int(request.args.get('time', 0))
    
    # Refresh disruptions with current time
    updated_disruptions = []
    for disruption in DISRUPTIONS:
        d = dict(disruption)
        current_risk = predictor.predict_future_risk(d.get('delayRisk', 0.0), d.get('growthFactor', 0.0), time_val)
        d['currentRisk'] = current_risk
        updated_disruptions.append(d)
        
    actions = autonomous_agent.monitor_and_act(SHIPMENTS, updated_disruptions, ROUTES)
    
    explanations = [autonomous_agent.explain_decision(a) for a in actions]
    
    return jsonify({
        "status": "success",
        "actions_taken": len(actions),
        "details": actions,
        "explanations": explanations
    })

@app.route('/api/autonomous-history')
def get_autonomous_history():
    """Return the history of all autonomous decisions."""
    history = autonomous_agent.get_decision_history()
    explanations = [autonomous_agent.explain_decision(h) for h in history]
    
    return jsonify({
        "history": history,
        "explanations": explanations
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001, host='0.0.0.0')
