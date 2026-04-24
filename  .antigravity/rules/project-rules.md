# Supply Chain Shield - Project Rules

## Tech Stack
- Backend: Python Flask (port 5000)
- Frontend: HTML + vanilla JavaScript + Google Maps API
- NO React, NO TypeScript, NO other frameworks
- Dark themed UI using CSS custom properties

## Code Standards
- All API keys MUST be in .env file, never hardcoded
- Use environment variables: os.getenv('KEY_NAME')
- Python: Follow PEP 8 style guide
- JavaScript: Use ES6+ syntax, no jQuery
- File naming: lowercase with underscores (e.g., risk_engine.py)

## Important Constraints
- All code must run in a simple Flask development server
- Frontend must work without build tools (no webpack, no npm build)
- Google Maps API key must be passed to template via Flask
- Dark map theme required (use Snazzy Maps style)

## Project Goal
Predictive supply chain disruption detection system that:
1. Shows truck moving on Google Maps
2. Displays risk zones with color coding
3. Predicts future disruptions
4. Automatically reroutes before problems occur