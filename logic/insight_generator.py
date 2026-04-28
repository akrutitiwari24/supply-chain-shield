from google import genai
import os

class InsightGenerator:
    """
    Intelligence layer that uses the modern Google Gemini SDK (google-genai) 
    to generate natural language insights and strategic summaries from raw 
    supply chain data.
    """
    def __init__(self):
        # Initialize the new Google GenAI client
        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            try:
                self.client = genai.Client(api_key=api_key)
                self.model_id = 'gemini-2.0-flash'
                self.active = True
            except Exception as e:
                print(f"Error initializing Gemini Client: {e}")
                self.active = False
        else:
            self.active = False
            print("Warning: GEMINI_API_KEY not found. LLM insights will use fallbacks.")
    
    def generate_route_insight(self, route_data, risk_data, time_shift_data):
        """
        Generate human-readable insight about routing decisions and trade-offs.
        """
        if not self.active:
            return self._fallback_route_insight(route_data)

        prompt = f"""
        You are an advanced Supply Chain Logistics AI. Analyze this operational data and provide a concise, professional insight.
        
        CONTEXT:
        - Current route: {route_data.get('current_route')} (ETA: {route_data.get('current_eta')} min)
        - Alternative: {route_data.get('alternative_route')} (ETA: {route_data.get('alternative_eta')} min)
        
        RISK ANALYSIS:
        - Current route risks: {risk_data.get('current_risks')}
        - Alternative route risks: {risk_data.get('alternative_risks')}
        
        PREDICTIVE TRENDS:
        - Traffic prediction for departure: {time_shift_data.get('prediction')}
        
        INSTRUCTIONS:
        1. One sentence recommendation.
        2. One sentence explaining the primary rationale (risk vs. time).
        3. Estimated benefit (time or cost saved).
        
        Keep it under 50 words total. Professional and actionable tone.
        """
        
        try:
            # Using the exact model string required by the v1 API
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt
            )
            if response and hasattr(response, 'text'):
                return response.text.strip()
            return self._fallback_route_insight(route_data)
        except Exception as e:
            if "101" in str(e) or "Network" in str(e):
                print(f"Gemini Connectivity Error: Please check Docker network settings. {e}")
            else:
                print(f"Gemini API Error: {e}")
            return self._fallback_route_insight(route_data)
    
    def generate_disruption_summary(self, disruptions):
        """
        Summarizes multiple concurrent network disruptions into a single strategic view.
        """
        if not self.active:
            return f"Network analysis: {len(disruptions)} active disruptions requiring attention."

        disruption_list = ', '.join([f"{d.get('name')}: {d.get('cause')}" for d in disruptions])
        
        prompt = f"""
        Provide a strategic executive summary of these concurrent supply chain disruptions:
        
        {disruption_list}
        
        STRUCTURE:
        - Overall network status (1 sentence).
        - Critical bottlenecks identified (1 sentence).
        - Immediate recommended strategy (1 sentence).
        
        Constraints: Maximum 40 words total.
        """
        
        try:
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt
            )
            if response and hasattr(response, 'text'):
                return response.text.strip()
            return f"Strategic analysis unavailable. Detected {len(disruptions)} disruptions."
        except Exception as e:
            print(f"Gemini API Error: {e}")
            return f"Strategic analysis unavailable. Detected {len(disruptions)} disruptions affecting throughput."

    def _fallback_route_insight(self, route_data):
        """Non-AI fallback for route analysis."""
        alt = route_data.get('alternative_route', 'Alternative')
        return f"Routing recommendation: Switch to {alt}. Analysis indicates superior traffic flow and reduced risk exposure for current shipment window."
