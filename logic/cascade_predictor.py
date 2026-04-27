import math
from typing import List, Dict, Any

class CascadePredictor:
    """
    Simulates and predicts chain-reaction disruptions in the supply chain network.
    Analyzes how a single blockage ripples through routes, warehouses, and customer SLAs.
    """
    
    def __init__(self, risk_zones: List[Dict], routes: Dict[str, Dict], shipments: List[Dict]):
        self.risk_zones = risk_zones
        self.routes = routes
        self.shipments = shipments
        # Pre-calculate dependency mapping for faster lookup
        self.route_usage = self._build_route_usage_map()

    def _build_route_usage_map(self) -> Dict[str, List[str]]:
        """Maps route IDs to the shipment IDs using them."""
        usage = {}
        for s in self.shipments:
            rid = s.get('routeId')
            if rid not in usage:
                usage[rid] = []
            usage[rid].append(s['id'])
        return usage

    def predict_cascade(self, initial_disruption: Dict[str, Any]) -> Dict[str, Any]:
        """
        Simulates a 3-level cascade from an initial disruption event.
        """
        # Step 1: Direct Impact (Shipments on the affected route segment)
        direct_impacted = []
        d_lat = initial_disruption.get('lat', 0)
        d_lng = initial_disruption.get('lng', 0)
        
        for shipment in self.shipments:
            route = self.routes.get(shipment.get('routeId'))
            if not route: continue
            
            # Simple geometric proximity check for waypoints
            is_affected = False
            for wp in route.get('waypoints', []):
                dist = math.sqrt((wp['lat'] - d_lat)**2 + (wp['lng'] - d_lng)**2)
                if dist < 0.015: # Roughly 1.5km radius
                    is_affected = True
                    break
            
            if is_affected:
                direct_impacted.append({
                    'id': shipment['id'],
                    'cargo': shipment.get('cargo', 'General Goods'),
                    'delay': 30, # Base minutes
                    'priority': shipment.get('priority', 'medium')
                })

        # Step 2: Secondary Impact (Route Diversion & Overload)
        # When direct trucks divert, they cause congestion on alternate routes for others
        secondary_impacted = []
        if direct_impacted:
            # In a demo, we simulate that every direct delay causes 2 more indirect delays 
            # due to "herd-mentality" routing on the best alternate.
            for i, imp in enumerate(direct_impacted):
                secondary_impacted.append({
                    'id': f"OVERLOAD_{i}",
                    'source_truck': imp['id'],
                    'additional_affected': 2,
                    'delay': 15,
                    'reason': "Diverted traffic overload on Mathura Road"
                })

        # Step 3: Tertiary Impact (Downstream Warehouse & Penalties)
        tertiary_impacted = []
        for imp in direct_impacted:
            if imp['priority'] == 'high':
                tertiary_impacted.append({
                    'id': f"WH_DELAY_{imp['id']}",
                    'reason': f"Receiving delay for {imp['cargo']} at Hub",
                    'delay': 60,
                    'penalty_risk': True
                })

        return {
            'disruption_name': initial_disruption.get('name', 'Network Point Blockage'),
            'direct': direct_impacted,
            'secondary': secondary_impacted,
            'tertiary': tertiary_impacted
        }

    def calculate_total_impact(self, cascade_tree: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates the cumulative damage across the network.
        """
        direct_c = len(cascade_tree['direct'])
        secondary_c = sum(s['additional_affected'] for s in cascade_tree['secondary'])
        tertiary_c = len(cascade_tree['tertiary'])
        
        total_affected = direct_c + secondary_c + tertiary_c
        
        # Calculate delay minutes
        delay_mins = sum(s['delay'] for s in cascade_tree['direct'])
        delay_mins += sum(s['delay'] * s['additional_affected'] for s in cascade_tree['secondary'])
        delay_mins += sum(s['delay'] for s in cascade_tree['tertiary'])
        
        # Mock financial impact: High priority = 500/min, others = 100/min
        cost = 0
        for s in cascade_tree['direct']:
            cost += s['delay'] * (500 if s['priority'] == 'high' else 150)
        cost += (secondary_c * 15 * 100) # Secondary is usually lower impact
        cost += (tertiary_c * 60 * 800) # Tertiary (Warehouse) is expensive
        
        return {
            'total_affected': total_affected,
            'total_delay_mins': delay_mins,
            'financial_impact': f"₹{cost:,}",
            'breakdown': {
                'direct': direct_c,
                'secondary': secondary_c,
                'tertiary': tertiary_c
            },
            'critical_at_risk': sum(1 for s in cascade_tree['direct'] if s['priority'] == 'high')
        }

    def suggest_mitigation(self, cascade_tree: Dict[str, Any]) -> List[str]:
        """
        Generates actionable interventions to break the cascade.
        """
        mitigations = []
        
        if cascade_tree['direct']:
            ids = [s['id'] for s in cascade_tree['direct']]
            mitigations.append(f"Reroute {', '.join(ids)} via alternate Hub (Patparganj) to bypass primary blockage.")
            
        if cascade_tree['secondary']:
            mitigations.append("Apply 10-minute staggered departure for Mayapuri outbound fleet to prevent downstream overload.")
            
        if cascade_tree['tertiary']:
            mitigations.append("Activate 'Emergency Dock' at Connaught Place to prioritize high-priority medical unloading.")
            
        # Generic catch-all for system health
        mitigations.append("Advise drivers within 5km radius to maintain 30km/h speed to prevent gridlock tail-back.")
        
        return mitigations
