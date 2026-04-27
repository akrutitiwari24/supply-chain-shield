import datetime
import math
from typing import List, Dict, Any

class AutonomousAgent:
    """
    Self-healing supply chain agent that monitors system state and 
    executes autonomous reroutes to mitigate risks.
    """

    def __init__(self, risk_threshold: float = 0.7, auto_mode: bool = True):
        self.risk_threshold = risk_threshold
        self.auto_mode = auto_mode
        self.decision_log = []
        
        # Safety limits
        self.max_reroutes_per_shipment = 3
        self.cost_threshold = 5000  # Max acceptable cost increase in ₹
        self.reroute_counts = {}  # Tracks reroutes per shipment ID

    def monitor_and_act(self, shipments: List[Dict], risk_zones: List[Dict], routes: Dict[str, Dict]) -> List[Dict]:
        """
        Continuously evaluate system state and take action if risks exceed thresholds.
        """
        actions_taken = []
        
        for shipment in shipments:
            shipment_id = shipment.get('id')
            current_route_id = shipment.get('routeId')
            current_route = routes.get(current_route_id)
            
            if not current_route:
                continue
                
            # Calculate risk exposure score
            risk_exposure = self._calculate_exposure(current_route, risk_zones)
            
            # If score > threshold AND auto_mode enabled
            if risk_exposure > self.risk_threshold and self.auto_mode:
                # Check safety limits
                if self.reroute_counts.get(shipment_id, 0) < self.max_reroutes_per_shipment:
                    action = self.execute_reroute(shipment, current_route, risk_zones, routes)
                    if action:
                        actions_taken.append(action)
                        self.decision_log.append(action)
                        # Increment reroute count
                        self.reroute_counts[shipment_id] = self.reroute_counts.get(shipment_id, 0) + 1
                else:
                    self.decision_log.append({
                        "timestamp": datetime.datetime.now().strftime("%H:%M"),
                        "shipment_id": shipment_id,
                        "action": "NONE",
                        "reasoning": f"Risk {risk_exposure:.2f} high, but max reroutes reached.",
                        "outcome": "Maintained current route"
                    })
                    
        return actions_taken

    def execute_reroute(self, shipment: Dict, current_route: Dict, risk_zones: List[Dict], all_routes: Dict[str, Dict]) -> Dict:
        """
        Find best alternative route and execute if benefit > cost.
        """
        shipment_id = shipment.get('id')
        best_alt = None
        min_risk = float('inf')
        
        # Find best alternative route
        for rid, route in all_routes.items():
            if rid == shipment.get('routeId'):
                continue
                
            risk = self._calculate_exposure(route, risk_zones)
            if risk < min_risk:
                min_risk = risk
                best_alt = route
        
        if not best_alt:
            return None

        # Calculate metrics
        # Mock calculations for demo purposes
        time_diff = best_alt.get('duration', 40) - current_route.get('duration', 30) # in minutes
        fuel_cost = abs(time_diff) * 50 # ₹50 per minute of travel
        risk_reduction = self._calculate_exposure(current_route, risk_zones) - min_risk
        financial_benefit = risk_reduction * 5000 # Assume ₹5000 saving per 1.0 risk reduction
        
        net_benefit = financial_benefit - fuel_cost
        
        action_summary = {
            "timestamp": datetime.datetime.now().strftime("%H:%M"),
            "shipment_id": shipment_id,
            "previous_route": current_route.get('name'),
            "new_route": best_alt.get('name'),
            "risk_score": round(self._calculate_exposure(current_route, risk_zones), 2),
            "new_risk_score": round(min_risk, 2),
            "time_impact": time_diff,
            "cost_impact": fuel_cost,
            "financial_benefit": round(financial_benefit, 2),
            "net_benefit": round(net_benefit, 2),
            "confidence": round(80 + (risk_reduction * 10), 1)
        }

        if net_benefit > 0:
            # Execute route change (simulated update)
            shipment['routeId'] = best_alt.get('id')
            shipment['status'] = "Rerouted by AI"
            action_summary["action"] = "REROUTE"
            action_summary["reasoning"] = f"Detected high risk. Rerouted to {best_alt.get('name')} for {round(risk_reduction*100)}% risk reduction."
            action_summary["outcome"] = "Success"
        else:
            action_summary["action"] = "NONE"
            action_summary["reasoning"] = "Risk acceptable, no action needed (cost of reroute exceeds benefit)"
            action_summary["outcome"] = "Maintained current route"
            
        return action_summary

    def explain_decision(self, action: Dict) -> str:
        """
        Generate human-readable explanation for an autonomous decision.
        """
        if action["action"] == "NONE":
            return f"At {action['timestamp']}, analyzed {action['shipment_id']}. {action['reasoning']}."

        return (
            f"At {action['timestamp']}, detected {int(action['risk_score']*100)}% risk on {action['shipment_id']}'s route "
            f"({action['previous_route']}). Autonomous system executed reroute to {action['new_route']}. "
            f"Trade-off: {'+' if action['time_impact'] >= 0 else ''}{action['time_impact']}min distance, "
            f"-{int((action['risk_score'] - action['new_risk_score'])*100)}% delay risk. "
            f"Net benefit: \u20b9{int(action['net_benefit'])} penalty avoided. "
            f"Confidence: {action['confidence']}%"
        )

    def get_decision_history(self) -> List[Dict]:
        """
        Return log of all autonomous actions taken.
        """
        return self.decision_log

    def _calculate_exposure(self, route: Dict, risk_zones: List[Dict]) -> float:
        """
        Internal helper to calculate route risk exposure.
        Matches logic in RouteSelector for consistency.
        """
        total_risk = 0.0
        waypoints = route.get('waypoints', [])
        
        for wp in waypoints:
            lat1 = wp.get('lat', 0.0)
            lng1 = wp.get('lng', 0.0)
            
            for zone in risk_zones:
                lat2 = zone.get('lat', 0.0)
                lng2 = zone.get('lng', 0.0)
                
                # Haversine distance
                R = 6371000.0
                dlat = math.radians(lat2 - lat1)
                dlng = math.radians(lng2 - lng1)
                a = (math.sin(dlat / 2.0) ** 2) + (math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * (math.sin(dlng / 2.0) ** 2))
                c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
                distance = R * c
                
                if distance < 1500.0: # 1.5km threshold for agent
                    proximity = 1.0 - (distance / 1500.0)
                    zone_risk = zone.get('currentRisk', 0.0)
                    total_risk += zone_risk * proximity
                    
        return min(total_risk, 1.0) # Cap at 1.0 for percentage conversion
