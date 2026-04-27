import ee
import os

class EnvironmentalMonitor:
    """
    Advanced monitor that leverages Google Earth Engine (GEE) to analyze 
    environmental risk factors such as flood patterns, precipitation anomalies, 
    and air quality impacts on logistics.
    """
    def __init__(self):
        # Initialize Earth Engine
        # Note: In a production environment, this would use a service account key
        try:
            # Attempt to initialize. If it fails, we use simulation/fallback logic
            ee.Initialize()
            self.active = True
        except Exception as e:
            print(f"Earth Engine not initialized: {e}. Using environmental simulation fallback.")
            self.active = False
    
    def check_flood_risk(self, lat, lng, radius_meters=5000):
        """
        Analyzes historical precipitation and terrain data to estimate 
        the current flood risk for a specific area.
        """
        if not self.active:
            # Fallback simulation logic based on monsoon patterns/location
            return self._simulate_flood_risk(lat, lng)

        try:
            point = ee.Geometry.Point([lng, lat])
            region = point.buffer(radius_meters)
            
            # Use CHIRPS (Climate Hazards Group InfraRed Precipitation with Station data)
            # to analyze recent rainfall patterns
            precipitation = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
            recent = precipitation.filterDate('2024-01-01', '2024-12-31')
            
            mean_precip = recent.mean().reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=5000
            )
            
            # Fetch the precipitation value (mm/day)
            precip_value = mean_precip.get('precipitation').getInfo()
            
            # Threshold analysis: > 10mm/day average suggests significant flood risk 
            # in urban environments like Delhi.
            risk_score = 0.2
            warning = None
            
            if precip_value > 15:
                risk_score = 0.9
                warning = "CRITICAL: Extreme precipitation detected. High flood risk."
            elif precip_value > 10:
                risk_score = 0.7
                warning = "WARNING: Heavy rainfall history. Potential road flooding."
            elif precip_value > 5:
                risk_score = 0.4
                warning = "CAUTION: Moderate precipitation. Expect localized slowdowns."
            
            return {
                'flood_risk': risk_score,
                'precipitation_mm': round(precip_value, 2),
                'warning': warning,
                'source': 'Google Earth Engine'
            }
        
        except Exception as e:
            print(f"Earth Engine Query Error: {e}")
            return self._simulate_flood_risk(lat, lng)
    
    def check_air_quality_impact(self, lat, lng):
        """
        Estimates the impact of air quality on logistics operations 
        (e.g., visibility issues, regulatory speed limits, driver health).
        """
        # Industrial zones in Delhi typically have significantly higher AQI impact
        industrial_zones = [
            (28.5494, 77.2500),  # Okhla Industrial Estate
            (28.7500, 77.1000),  # Bawana Industrial Area
            (28.6500, 77.3000),  # Ghazipur
        ]
        
        # Calculate distance to nearest industrial hotspot
        min_distance = 1.0 # Default large value
        for iz in industrial_zones:
            dist = ((lat - iz[0])**2 + (lng - iz[1])**2)**0.5
            if dist < min_distance:
                min_distance = dist
        
        # Proximity logic: < 0.05 units (~5km) indicates high impact area
        if min_distance < 0.05:
            impact = 0.6 + (0.05 - min_distance) * 4
            return {
                'aqi_impact': round(min(impact, 0.95), 2),
                'visibility_risk': round(min(impact * 0.7, 0.8), 2),
                'recommendation': 'Optimize routing to avoid high-pollution industrial corridors.',
                'zone_type': 'Industrial/High Emission'
            }
        
        return {
            'aqi_impact': 0.3,
            'visibility_risk': 0.15,
            'recommendation': 'Standard environmental conditions.',
            'zone_type': 'Standard Urban'
        }

    def _simulate_flood_risk(self, lat, lng):
        """Simulation fallback for environmental analysis."""
        # Check if near Yamuna river area (lat 28.6-28.7, lng 77.25-77.3)
        is_river_adjacent = (28.6 <= lat <= 28.7) and (77.25 <= lng <= 77.3)
        
        return {
            'flood_risk': 0.65 if is_river_adjacent else 0.15,
            'precipitation_mm': 8.5 if is_river_adjacent else 1.2,
            'warning': 'River proximity detected - increased seasonal flood risk' if is_river_adjacent else None,
            'source': 'Environmental Simulation Engine'
        }
