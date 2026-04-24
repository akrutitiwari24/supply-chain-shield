import math
from typing import Any, Dict, List


class RouteSelector:
    """Selector engine to evaluate routes against risk zones and pick the optimal choice."""

    def haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the great-circle distance between two points in meters using Haversine formula.
        
        Args:
            lat1 (float): Latitude of the first point in decimal degrees.
            lon1 (float): Longitude of the first point in decimal degrees.
            lat2 (float): Latitude of the second point in decimal degrees.
            lon2 (float): Longitude of the second point in decimal degrees.
            
        Returns:
            float: The distance between the points in meters.
        """
        # Earth radius in meters
        R = 6371000.0 
        
        # Convert decimal degrees to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Determine differences between coordinates
        dlat = lat2_rad - lat1_rad
        dlng = lon2_rad - lon1_rad
        
        # Haversine formula
        a = (math.sin(dlat / 2.0) ** 2) + (math.cos(lat1_rad) * math.cos(lat2_rad) * (math.sin(dlng / 2.0) ** 2))
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        
        # Compute total distance
        distance = R * c
        return distance

    def score_route(self, route: Dict[str, Any], risk_zones: List[Dict[str, Any]]) -> float:
        """
        Score a route based on proximity of its waypoints to known risk zones.
        
        Args:
            route (Dict[str, Any]): Route dict, expected to contain a 'waypoints' list of dicts.
            risk_zones (List[Dict[str, Any]]): List of risk zones (disruptions).
            
        Returns:
            float: The total calculated risk score.
        """
        total_risk = 0.0
        waypoints = route.get('waypoints', [])
        
        for wp in waypoints:
            # Extract waypoint coordinates safely
            lat1 = wp.get('lat', 0.0)
            lng1 = wp.get('lng', wp.get('lon', 0.0))
            
            for zone in risk_zones:
                # Extract zone coordinates (handling standard key differences flexibly)
                lat2 = zone.get('lat', 0.0)
                lng2 = zone.get('lng', zone.get('lon', 0.0))
                
                distance = self.haversine_distance(lat1, lng1, lat2, lng2)
                
                # Check if waypoint is within 1000 meters (1km) of the disruptive zone
                if distance < 1000.0:
                    # Calculate proximity factor. 
                    # If distance is near 0, proximity approaches 1.0 (maximum impact).
                    # As distance approaches 1000m, proximity approaches 0.0 (minimal impact).
                    proximity = 1.0 - (distance / 1000.0)
                    
                    # Fetching the risk, using the expected 'currentRisk' key or
                    # gracefully falling back to 'delayRisk' if used directly from raw data
                    zone_risk = zone.get('currentRisk', zone.get('delayRisk', 0.0))
                    
                    # Augment total risk by combining the base zone risk with proximity weight
                    total_risk += zone_risk * proximity
                    
        return total_risk

    def select_best_route(self, routes: List[Dict[str, Any]], risk_zones: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Evaluate all provided routes and select the one with the lowest overall risk.
        
        Args:
            routes (List[Dict[str, Any]]): List of available routes to assess.
            risk_zones (List[Dict[str, Any]]): List of active risk zones.
            
        Returns:
            Dict[str, Any]: The ideal route possessing the lowest total risk, 
                            augmented with a 'riskScore' field.
        """
        for route in routes:
            # Inject corresponding risk score into every route
            route['riskScore'] = self.score_route(route, risk_zones)
            
        # Sort routes ascending based on evaluated riskScore to ensure lowest risk routes go first
        sorted_routes = sorted(routes, key=lambda r: r.get('riskScore', float('inf')))
        
        # Return best evaluated route or an empty dict if none provided
        return sorted_routes[0] if sorted_routes else {}
