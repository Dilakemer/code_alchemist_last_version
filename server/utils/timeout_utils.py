def to_gemini_timeout(seconds: float | int | None, default_seconds: int = 60) -> int:
    """
    Converts a timeout in seconds to milliseconds for the Google GenAI SDK.
    Enforces a minimum of 10 seconds (10,000 ms) as required by Gemini.
    
    Args:
        seconds: Timeout in seconds.
        default_seconds: Default timeout if seconds is None.
        
    Returns:
        Timeout in milliseconds (int).
    """
    if seconds is None:
        seconds = default_seconds
    
    # Enforce minimum 10s floor
    safe_seconds = max(10.0, float(seconds))
    
    # Convert to milliseconds
    return int(safe_seconds * 1000)
