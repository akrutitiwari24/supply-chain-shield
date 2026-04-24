from typing import Any, Dict


class RiskEngine:
    """Engine for assessing routing risks and confidence levels."""

    def calculate_risk(self, traffic: float, weather: float, historical: float) -> float:
        """
        Calculate the combined risk score based on different factors.

        Args:
            traffic (float): Traffic factor (0 to 1).
            weather (float): Weather factor (0 to 1).
            historical (float): Historical factor (0 to 1).

        Returns:
            float: The calculated risk score.
        """
        return 0.5 * traffic + 0.3 * weather + 0.2 * historical

    def get_risk_level(self, score: float) -> str:
        """
        Determine the risk level category based on the numerical score.

        Args:
            score (float): The calculated risk score.

        Returns:
            str: "high", "moderate", or "low" risk level.
        """
        if score >= 0.7:
            return "high"
        if score >= 0.4:
            return "moderate"
        return "low"

    def get_confidence(self, disruption: Dict[str, Any]) -> int:
        """
        Calculate the confidence percentage for a disruption.

        Args:
            disruption (Dict[str, Any]): The disruption data dictionary.

        Returns:
            int: The calculated confidence percentage (capped at 99).
        """
        base = 72
        disruption_type = disruption.get("type", "").lower()

        if disruption_type == "traffic":
            base += 12
        elif disruption_type == "weather":
            base += 8
        elif disruption_type == "congestion":
            base += 5

        return min(base, 99)

    def get_risk_color(self, level: str) -> str:
        """
        Get the UI color code for a specific risk level.

        Args:
            level (str): The risk level category.

        Returns:
            str: A hex color code.
        """
        level_lower = level.lower()
        if level_lower == "high":
            return "#FF3B30"
        if level_lower == "moderate":
            return "#FF9500"
        if level_lower == "low":
            return "#34C759"
        
        # Default fallback
        return "#34C759"
