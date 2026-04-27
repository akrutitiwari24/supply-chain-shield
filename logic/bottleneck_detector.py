import requests

class BottleneckDetector:
    """
    Detector engine that uses Google Places API to identify static 
    urban bottlenecks such as hospitals, schools, and transit hubs.
    """
    def __init__(self, api_key):
        self.api_key = api_key
        self.places_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    
    def find_bottleneck_locations(self, center_lat, center_lng, radius=5000):
        """
        Scans for locations within a radius that typically generate 
        high traffic volume or frequent emergency vehicle movement.
        """
        bottleneck_types = [
            'gas_station',      # Often causes lane-entry slowdowns
            'shopping_mall',    # High-volume parking congestion
            'hospital',         # Frequent emergency vehicle priority
            'school',           # Peak-hour drop-off/pick-up gridlock
            'transit_station'   # High pedestrian and taxi volume
        ]
        
        all_bottlenecks = []
        
        for place_type in bottleneck_types:
            params = {
                'location': f'{center_lat},{center_lng}',
                'radius': radius,
                'type': place_type,
                'key': self.api_key
            }
            
            try:
                response = requests.get(self.places_url, params=params)
                
                if response.status_code == 200:
                    results = response.json().get('results', [])
                    
                    for place in results[:5]:  # Limit to top 5 per category for performance
                        all_bottlenecks.append({
                            'name': place.get('name'),
                            'type': place_type,
                            'lat': place['geometry']['location']['lat'],
                            'lng': place['geometry']['location']['lng'],
                            'rating': place.get('rating', 3.0),
                            'user_ratings_total': place.get('user_ratings_total', 0),
                            'risk_factor': self.calculate_risk_factor(place, place_type)
                        })
            except Exception as e:
                print(f"Error fetching bottlenecks for {place_type}: {e}")
        
        # Sort by risk factor to prioritize the most critical bottlenecks
        return sorted(all_bottlenecks, key=lambda x: x['risk_factor'], reverse=True)
    
    def calculate_risk_factor(self, place, place_type):
        """
        Calculates a risk score (0.0 to 1.0) based on location type 
        and historical popularity data.
        """
        base_risk = {
            'hospital': 0.7,      # High priority (emergency sirens)
            'school': 0.8,        # Time-bound extreme congestion
            'shopping_mall': 0.6, # Erratic traffic flow
            'transit_station': 0.75, # Concentrated vehicle density
            'gas_station': 0.4    # Minor lane disruptions
        }
        
        risk = base_risk.get(place_type, 0.3)
        
        # Adjust risk based on location popularity (user ratings as proxy for volume)
        popularity = place.get('user_ratings_total', 0)
        if popularity > 2000:
            risk += 0.2
        elif popularity > 1000:
            risk += 0.1
            
        return min(round(risk, 2), 1.0)
