import requests
import base64
import os

class VisionAnalyzer:
    """
    Analyzer engine that uses Google Cloud Vision API to detect congestion 
    patterns by analyzing Street View imagery.
    """
    def __init__(self, api_key):
        self.api_key = api_key
        self.vision_url = "https://vision.googleapis.com/v1/images:annotate"
    
    def analyze_traffic_from_streetview(self, lat, lng):
        """
        Retrieves a Street View static image for a location and analyzes 
        it for vehicle density and congestion indicators.
        """
        # Get Street View static image
        streetview_url = f"https://maps.googleapis.com/maps/api/streetview"
        params = {
            'size': '640x640',
            'location': f'{lat},{lng}',
            'heading': '90',
            'pitch': '0',
            'key': self.api_key
        }
        
        try:
            img_response = requests.get(streetview_url, params=params)
            
            if img_response.status_code == 200:
                # Encode image to base64 for Vision API
                img_base64 = base64.b64encode(img_response.content).decode()
                
                # Construct Vision API request
                vision_request = {
                    'requests': [{
                        'image': {'content': img_base64},
                        'features': [
                            {'type': 'LABEL_DETECTION', 'maxResults': 10},
                            {'type': 'OBJECT_LOCALIZATION', 'maxResults': 10}
                        ]
                    }]
                }
                
                # Analyze with Cloud Vision
                vision_response = requests.post(
                    f"{self.vision_url}?key={self.api_key}",
                    json=vision_request
                )
                
                if vision_response.status_code == 200:
                    result = vision_response.json()
                    return self.parse_congestion(result)
                else:
                    print(f"Vision API Error: {vision_response.status_code} - {vision_response.text}")
            else:
                print(f"Street View API Error: {img_response.status_code}")
                
        except Exception as e:
            print(f"Vision Analysis Exception: {str(e)}")
        
        # Fallback if APIs fail or location has no streetview
        return {'congestion_score': 0.3, 'confidence': 50, 'fallback': True}
    
    def parse_congestion(self, vision_result):
        """
        Parses Vision API annotations to calculate a normalized congestion score.
        """
        responses = vision_result.get('responses', [{}])
        if not responses:
            return {'congestion_score': 0.0, 'confidence': 0}
            
        labels = responses[0].get('labelAnnotations', [])
        objects = responses[0].get('localizedObjectAnnotations', [])
        
        # Count vehicles and detect congestion keywords
        vehicle_count = 0
        congestion_keywords = ['car', 'truck', 'bus', 'vehicle', 'traffic', 'road', 'congestion', 'gridlock']
        
        # Check labels for general scene understanding
        for label in labels:
            desc = label.get('description', '').lower()
            if any(keyword in desc for keyword in congestion_keywords):
                # Labels don't necessarily mean individual counts, but indicate presence
                vehicle_count += 0.5 
        
        # Check objects for specific vehicle instances
        for obj in objects:
            name = obj.get('name', '').lower()
            if name in ['car', 'truck', 'bus', 'van', 'motorcycle']:
                vehicle_count += 1
        
        # Convert to congestion score (0.0 to 1.0)
        # Assuming > 10 vehicles in a single frame indicates high congestion
        congestion_score = min(vehicle_count / 15.0, 1.0) 
        confidence = min(70 + (vehicle_count * 2), 95)
        
        return {
            'congestion_score': round(congestion_score, 2),
            'vehicle_count': int(vehicle_count),
            'confidence': int(confidence),
            'indicators': [l.get('description') for l in labels[:5]],
            'detected_objects': [obj.get('name') for obj in objects[:5]]
        }
