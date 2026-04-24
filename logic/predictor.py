from typing import Optional


class RiskPredictor:
    """Predictor engine for analyzing future risks and critical timelines."""

    def predict_future_risk(self, current_risk: float, growth_factor: float, minutes_ahead: int) -> float:
        """
        Predict the future risk level based on the current risk and its growth factor.
        
        Args:
            current_risk (float): The current risk score.
            growth_factor (float): The rate at which the risk grows per minute.
            minutes_ahead (int): The number of minutes into the future to predict.
            
        Returns:
            float: The predicted future risk, capped at a maximum of 1.0.
        """
        # Formula: Predicted Risk = Current Risk + (Minutes Ahead * Growth Factor)
        predicted_risk = current_risk + (minutes_ahead * growth_factor)
        
        # Cap the predicted risk at 1.0
        return min(predicted_risk, 1.0)

    def get_time_to_critical(self, current_risk: float, growth_factor: float, threshold: float = 0.7) -> Optional[int]:
        """
        Calculate the estimated time in minutes until the risk reaches a critical threshold.
        
        Args:
            current_risk (float): The current risk score.
            growth_factor (float): The rate at which the risk grows per minute.
            threshold (float): The critical risk threshold (default is 0.7).
            
        Returns:
            Optional[int]: The number of minutes to critical threshold. Returns 0 if 
                           already reached, or None if the growth factor is <= 0.
        """
        # Return 0 if the risk has already reached or exceeded the threshold
        if current_risk >= threshold:
            return 0
            
        # Return None if risk is not growing, meaning it will never reach the threshold
        if growth_factor <= 0.0:
            return None
            
        # Formula: Minutes to Critical = (Threshold - Current Risk) / Growth Factor
        minutes = (threshold - current_risk) / growth_factor
        
        return int(minutes)
