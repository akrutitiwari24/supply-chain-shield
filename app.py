import json
import os
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from logic.risk_engine import RiskEngine
from logic.route_selector import RouteSelector
from logic.predictor import RiskPredictor

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

# Load data files
DISRUPTIONS = []
ROUTES = {}

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
