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
    """Calculate and return the best route based on provided array of risks."""
    data = request.get_json() or {}
    risks = data.get('risks', [])
    
    best = route_selector.select_best_route(list(ROUTES.values()), risks)
    
    if not best:
        return jsonify({'error': 'No routes available'}), 404
        
    return jsonify({
        'route': best, 
        'reason': 'Lowest risk exposure', 
        'riskScore': best.get('riskScore', 0)
    })

@app.route('/api/health')
def health_check():
    """Return health status of the API system."""
    return jsonify({'status': 'ok', 'system': 'operational'})

if __name__ == '__main__':
    app.run(debug=True, port=5001, host='0.0.0.0')
