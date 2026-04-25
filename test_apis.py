import os
import requests
from dotenv import load_dotenv

load_dotenv()

GOOGLE_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
WEATHER_KEY = os.getenv('OPENWEATHER_API_KEY')

print("Testing Google Maps API...")
response = requests.get(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
    params={
        "origins": "28.6315,77.2167",
        "destinations": "28.5350,77.2650",
        "key": GOOGLE_KEY
    }
)
print(f"Google API Status: {response.status_code}")
print(f"Response: {response.json().get('status')}")

print("\nTesting OpenWeatherMap API...")
response = requests.get(
    "https://api.openweathermap.org/data/2.5/weather",
    params={
        "lat": 28.6315,
        "lon": 77.2167,
        "appid": WEATHER_KEY,
        "units": "metric"
    }
)
print(f"Weather API Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"Weather: {data.get('weather', [{}])[0].get('main')}")
    print(f"Temp: {data.get('main', {}).get('temp')}°C")

print("\n✅ All APIs working!" if response.status_code == 200 else "❌ Check API keys")
