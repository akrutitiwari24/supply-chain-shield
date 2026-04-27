import math
from datetime import datetime, timedelta
from typing import List, Dict, Any

class TimeShiftPredictor:
    """
    Predicts future traffic states and analyzes routes based on predicted 
    arrival times at various segments.
    """
    
    def __init__(self):
        # Historical patterns by hour (0-23)
        # Value represents traffic multiplier (1.0 = average)
        self.hourly_patterns = {
            0: 0.3, 1: 0.3, 2: 0.3, 3: 0.3, 4: 0.4, 5: 0.5,
            6: 0.7, 7: 1.2, 8: 2.0, 9: 2.0, 10: 1.5, 11: 1.2,
            12: 1.1, 13: 1.1, 14: 1.2, 15: 1.4, 16: 1.8, 17: 2.0,
            18: 2.0, 19: 1.8, 20: 1.4, 21: 0.8, 22: 0.5, 23: 0.4
        }
        
    def predict_traffic_at_time(self, location_lat: float, location_lng: float, minutes_ahead: int) -> float:
        """
        Predicts traffic severity at a location at a future time offset.
        
        Args:
            location_lat (float): Latitude
            location_lng (float): Longitude
            minutes_ahead (int): Future time offset in minutes
            
        Returns:
            float: Predicted severity (0.0 to 1.0)
        """
        # Base current severity for demo purposes
        base_severity = 0.3
        
        now = datetime.now()
        future_time = now + timedelta(minutes=minutes_ahead)
        hour = future_time.hour
        is_weekend = future_time.weekday() >= 5
        
        # Apply hourly pattern
        multiplier = self.hourly_patterns.get(hour, 1.0)
        
        # Apply weekend adjustment (30% less traffic on weekends)
        if is_weekend:
            multiplier *= 0.7
            
        predicted_severity = base_severity * multiplier
        
        # Apply growth factor logic
        # Rush hours: 8-10am and 5-8pm (17-20)
        is_rush_hour = (8 <= hour <= 10) or (17 <= hour <= 20)
        
        if is_rush_hour:
            # Severity increases 5% per 10 minutes during buildup
            growth = 1 + (0.05 * (minutes_ahead / 10))
            predicted_severity *= growth
        else:
            # Severity decreases 3% per 10 minutes as traffic clears
            decay = 1 - (0.03 * (minutes_ahead / 10))
            predicted_severity *= max(0.2, decay) # Cap decay
            
        return min(predicted_severity, 1.0)

    def _haversine_distance(self, pt1: Dict[str, float], pt2: Dict[str, float]) -> float:
        """Helper to calculate distance in km."""
        R = 6371.0 # Earth radius in km
        lat1, lon1 = math.radians(pt1['lat']), math.radians(pt1['lng'])
        lat2, lon2 = math.radians(pt2['lat']), math.radians(pt2['lng'])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c

    def get_future_route_score(self, route_waypoints: List[Dict[str, float]], departure_time_offset: int = 0) -> float:
        """
        Scores a route by predicting traffic at each waypoint based on arrival time.
        
        Args:
            route_waypoints (List): List of {lat, lng} dicts
            departure_time_offset (int): Starting time offset from now in minutes
            
        Returns:
            float: Total predicted delay in minutes
        """
        total_delay = 0.0
        cumulative_travel_time = 0.0 # in minutes
        avg_speed_kmh = 30.0 # Base speed without traffic
        
        for i in range(len(route_waypoints) - 1):
            pt1 = route_waypoints[i]
            pt2 = route_waypoints[i+1]
            
            dist = self._haversine_distance(pt1, pt2)
            
            # Calculate when truck will arrive at this segment
            arrival_time_offset = departure_time_offset + cumulative_travel_time
            
            # Predict traffic at arrival time
            predicted_severity = self.predict_traffic_at_time(pt1['lat'], pt1['lng'], int(arrival_time_offset))
            
            # Calculate effective speed: 0.0 severity = 30km/h, 1.0 severity = 3km/h (90% reduction)
            effective_speed = avg_speed_kmh * (1.0 - (predicted_severity * 0.9))
            effective_speed = max(5.0, effective_speed) # Minimum crawl speed 5km/h
            
            segment_time = (dist / effective_speed) * 60 # in minutes
            
            # Delay is the additional time compared to base speed
            base_segment_time = (dist / avg_speed_kmh) * 60
            total_delay += (segment_time - base_segment_time)
            
            cumulative_travel_time += segment_time
            
        return total_delay

    def compare_routes_time_shifted(self, routes: List[Dict[str, Any]], departure_offset: int = 0) -> List[Dict[str, Any]]:
        """
        Sorts routes by predicted total travel time considering future traffic.
        
        Args:
            routes (List): List of route dicts with 'waypoints'
            departure_offset (int): Starting time offset in minutes
            
        Returns:
            List: Sorted routes with predicted delay and explanations
        """
        scored_routes = []
        for route in routes:
            delay = self.get_future_route_score(route['waypoints'], departure_offset)
            
            # Calculate base travel time (total distance / avg speed)
            total_dist = 0
            for i in range(len(route['waypoints']) - 1):
                total_dist += self._haversine_distance(route['waypoints'][i], route['waypoints'][i+1])
            
            base_time = (total_dist / 30.0) * 60
            predicted_total_time = base_time + delay
            
            scored_routes.append({
                **route,
                'predicted_delay': round(delay, 1),
                'predicted_total_time': round(predicted_total_time, 1),
                'score': predicted_total_time
            })
            
        # Sort by predicted total time (ascending)
        scored_routes.sort(key=lambda x: x['score'])
        
        # Add comparative explanations
        for i, route in enumerate(scored_routes):
            if i == 0:
                route['explanation'] = "Optimal route: Best predicted performance over travel window."
            elif route['predicted_delay'] > 15:
                route['explanation'] = f"Not recommended: Predicted traffic peaks during arrival ({route['predicted_delay']}m delay)."
            else:
                route['explanation'] = "Alternative route: Stable but slower overall."
                
        return scored_routes
