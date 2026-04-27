import os
import requests
import datetime
from datetime import timedelta
from geopy.distance import geodesic

class RealTimeDataFetcher:
    """
    Fetches real-time traffic and weather data using Google Maps and OpenWeatherMap APIs.
    """

    def __init__(self, google_api_key, weather_api_key):
        """
        Initialize the fetcher with API keys and base URLs.
        
        Args:
            google_api_key (str): Google Maps API Key
            weather_api_key (str): OpenWeatherMap API Key
        """
        self.google_api_key = google_api_key
        self.weather_api_key = weather_api_key
        
        self.GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
        self.GOOGLE_DISTANCE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"
        self.WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"

    def get_traffic_conditions(self, origin_lat, origin_lng, dest_lat, dest_lng):
        """
        Makes a request to the Google Distance Matrix API to get traffic conditions.
        
        Args:
            origin_lat (float): Latitude of origin
            origin_lng (float): Longitude of origin
            dest_lat (float): Latitude of destination
            dest_lng (float): Longitude of destination
            
        Returns:
            dict: Traffic delay and severity details. Returns default values on failure.
        """
        default_result = {
            "duration_normal": 1800,
            "duration_in_traffic": 1800,
            "traffic_delay": 0,
            "traffic_severity": 0.1
        }

        try:
            params = {
                "origins": f"{origin_lat},{origin_lng}",
                "destinations": f"{dest_lat},{dest_lng}",
                "departure_time": "now",
                "traffic_model": "best_guess",
                "key": self.google_api_key
            }
            
            response = requests.get(self.GOOGLE_DISTANCE_URL, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "OK":
                elements = data["rows"][0]["elements"][0]
                if elements.get("status") == "OK":
                    duration_normal = elements["duration"]["value"]
                    duration_in_traffic = elements.get("duration_in_traffic", {}).get("value", duration_normal)
                    
                    traffic_delay = max(0, duration_in_traffic - duration_normal)
                    traffic_severity = min(1.0, traffic_delay / duration_normal) if duration_normal > 0 else 0.0
                    
                    return {
                        "duration_normal": duration_normal,
                        "duration_in_traffic": duration_in_traffic,
                        "traffic_delay": traffic_delay,
                        "traffic_severity": traffic_severity
                    }
            return default_result
        except Exception as e:
            print(f"API Error: {str(e)}")
            return default_result

    def get_weather_data(self, lat, lng):
        """
        Makes a request to OpenWeatherMap API to get current weather data.
        
        Args:
            lat (float): Latitude
            lng (float): Longitude
            
        Returns:
            dict: Weather conditions and calculated weather risk. Returns default values on failure.
        """
        default_result = {
            "temperature": 25,
            "weather_condition": "Clear",
            "visibility": 10000,
            "wind_speed": 2,
            "weather_risk": 0.1
        }

        try:
            params = {
                "lat": lat,
                "lon": lng,
                "appid": self.weather_api_key,
                "units": "metric"
            }
            
            response = requests.get(self.WEATHER_URL, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()
            
            temperature = data.get("main", {}).get("temp", 25.0)
            visibility = data.get("visibility", 10000)
            wind_speed = data.get("wind", {}).get("speed", 2.0)
            weather_condition = data.get("weather", [{}])[0].get("main", "Clear")
            
            # Calculate weather risk based on conditions
            condition_lower = weather_condition.lower()
            weather_risk = 0.1
            if condition_lower in ["rain", "thunderstorm", "drizzle"]:
                weather_risk = 0.8
            elif condition_lower in ["snow"]:
                weather_risk = 0.9
            elif condition_lower in ["fog", "mist", "haze"]:
                weather_risk = 0.6
            elif condition_lower in ["clear", "clouds"]:
                weather_risk = 0.15
            
            # Adjust risk based on severe conditions (e.g., extremely low visibility or high winds)
            if visibility < 1000:
                weather_risk = max(weather_risk, 0.7)
            if wind_speed > 15:
                weather_risk = max(weather_risk, 0.8)
                
            return {
                "temperature": temperature,
                "weather_condition": weather_condition,
                "visibility": visibility,
                "wind_speed": wind_speed,
                "weather_risk": min(1.0, weather_risk)
            }
        except Exception as e:
            print(f"API Error: {str(e)}")
            return default_result

    def get_route_with_traffic(self, origin_lat, origin_lng, dest_lat, dest_lng, alternatives=True):
        """
        Makes a request to the Google Directions API to get route options including traffic.
        
        Args:
            origin_lat (float): Latitude of origin
            origin_lng (float): Longitude of origin
            dest_lat (float): Latitude of destination
            dest_lng (float): Longitude of destination
            alternatives (bool): Whether to request alternative routes
            
        Returns:
            list: List of route objects. Returns empty list on failure.
        """
        try:
            params = {
                "origin": f"{origin_lat},{origin_lng}",
                "destination": f"{dest_lat},{dest_lng}",
                "alternatives": str(alternatives).lower(),
                "departure_time": "now",
                "key": self.google_api_key
            }
            
            response = requests.get(self.GOOGLE_DIRECTIONS_URL, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()
            
            routes = []
            if data.get("status") == "OK":
                for route in data.get("routes", []):
                    leg = route["legs"][0]
                    
                    # Extract route waypoints (polyline decoding skipped for simplicity,
                    # just providing start/end step locations)
                    waypoints = []
                    for step in leg.get("steps", []):
                        waypoints.append({
                            "lat": step["start_location"]["lat"],
                            "lng": step["start_location"]["lng"]
                        })
                    waypoints.append({
                        "lat": leg["end_location"]["lat"],
                        "lng": leg["end_location"]["lng"]
                    })
                    
                    duration_normal = leg["duration"]["value"]
                    duration_in_traffic = leg.get("duration_in_traffic", {}).get("value", duration_normal)
                    
                    routes.append({
                        "waypoints": waypoints,
                        "duration_normal": duration_normal,
                        "duration_in_traffic": duration_in_traffic,
                        "distance": leg["distance"]["value"],
                        "summary": route.get("summary", "Unknown Route")
                    })
            return routes
        except Exception as e:
            print(f"API Error: {str(e)}")
            return []

    def calculate_realtime_risk(self, lat, lng):
        """
        Combines traffic and weather data to calculate an overall real-time risk score.
        
        Args:
            lat (float): Current latitude
            lng (float): Current longitude
            
        Returns:
            dict: Detailed risk analysis.
        """
        try:
            # Get weather risk
            weather_data = self.get_weather_data(lat, lng)
            weather_risk = weather_data.get("weather_risk", 0.0)
            
            # To simulate traffic to a nearby major junction, we offset lat/lng slightly (e.g. ~5km)
            junction_lat = lat + 0.05
            junction_lng = lng + 0.05
            
            traffic_data = self.get_traffic_conditions(lat, lng, junction_lat, junction_lng)
            traffic_risk = traffic_data.get("traffic_severity", 0.0)
            
            # Combine risks (60% traffic, 40% weather)
            overall_risk = (0.6 * traffic_risk) + (0.4 * weather_risk)
            overall_risk = min(1.0, overall_risk)
            
            # Determine cause
            cause = "Normal conditions"
            if overall_risk > 0.5:
                if traffic_risk > weather_risk:
                    cause = "Heavy traffic delays ahead"
                else:
                    cause = f"Adverse weather conditions: {weather_data['weather_condition']}"
                    
            return {
                "overall_risk": round(overall_risk, 2),
                "traffic_component": round(traffic_risk, 2),
                "weather_component": round(weather_risk, 2),
                "cause": cause,
                "confidence": 85 # Assuming fairly high confidence with fresh API data
            }
        except Exception as e:
            print(f"API Error: {str(e)}")
            return {
                "overall_risk": 0.3,
                "traffic_component": 0.2,
                "weather_component": 0.1,
                "cause": "Moderate conditions",
                "confidence": 50
            }

    def get_advanced_routes(self, origin_lat, origin_lng, dest_lat, dest_lng, departure_time_offset=0):
        """
        Use NEW Google Routes API (v2) with future traffic prediction.
        """
        url = "https://routes.googleapis.com/directions/v2:computeRoutes"
        
        # Calculate departure time (UTC ISO format)
        departure = datetime.datetime.now(datetime.timezone.utc) + timedelta(minutes=departure_time_offset)
        
        headers = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': self.google_api_key,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs,routes.travelAdvisory'
        }
        
        body = {
            'origin': {
                'location': {
                    'latLng': {
                        'latitude': origin_lat,
                        'longitude': origin_lng
                    }
                }
            },
            'destination': {
                'location': {
                    'latLng': {
                        'latitude': dest_lat,
                        'longitude': dest_lng
                    }
                }
            },
            'travelMode': 'DRIVE',
            'routingPreference': 'TRAFFIC_AWARE_OPTIMAL',
            'departureTime': departure.isoformat().replace('+00:00', 'Z'),
            'computeAlternativeRoutes': True,
            'routeModifiers': {
                'avoidTolls': False,
                'avoidHighways': False,
                'avoidFerries': True
            }
        }
        
        try:
            response = requests.post(url, json=body, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                routes = []
                
                for route in data.get('routes', []):
                    # Parse polyline
                    encoded_polyline = route.get('polyline', {}).get('encodedPolyline', '')
                    waypoints = self.decode_polyline(encoded_polyline)
                    
                    # Get traffic advisory
                    advisory = route.get('travelAdvisory', {})
                    
                    # Parse duration (format is "1234s")
                    duration_str = route.get('duration', '0s')
                    duration_val = int(duration_str[:-1]) if duration_str.endswith('s') else 0
                    
                    routes.append({
                        'waypoints': waypoints,
                        'duration': duration_val,
                        'distance': route.get('distanceMeters', 0),
                        'traffic_speed': advisory.get('speedReadingIntervals', []),
                        'toll_info': advisory.get('tollInfo', {}),
                        'summary': f"Advanced Route ({round(duration_val/60)} min)"
                    })
                
                return routes
            else:
                print(f"Routes API Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Routes API exception: {e}")
            
        return []

    def decode_polyline(self, encoded):
        """Decode Google polyline to lat/lng points using standard algorithm."""
        points = []
        index = 0
        lat = 0
        lng = 0
        
        while index < len(encoded):
            result = 1
            shift = 0
            while True:
                b = ord(encoded[index]) - 63 - 1
                index += 1
                result += b << shift
                shift += 5
                if b < 0x1f:
                    break
            lat += (~result >> 1) if (result & 1) != 0 else (result >> 1)
            
            result = 1
            shift = 0
            while True:
                b = ord(encoded[index]) - 63 - 1
                index += 1
                result += b << shift
                shift += 5
                if b < 0x1f:
                    break
            lng += (~result >> 1) if (result & 1) != 0 else (result >> 1)
            
            points.append({
                'lat': lat / 1e5,
                'lng': lng / 1e5
            })
        
        return points

