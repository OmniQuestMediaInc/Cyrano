from typing import Dict
from datetime import datetime, timedelta, timezone


class StateProvider:
    def __init__(self):
        self.cooling_periods: Dict[str, datetime] = {}
        self.welfare_history: Dict[str, list] = {}

    def is_in_cooling_period(self, user_id: str) -> bool:
        return (
            user_id in self.cooling_periods
            and datetime.now(timezone.utc) < self.cooling_periods[user_id]
        )

    def set_cooling_period(self, user_id: str, hours: int = 24):
        self.cooling_periods[user_id] = datetime.now(timezone.utc) + timedelta(hours=hours)

    def record_welfare_score(self, user_id: str, score: float):
        if user_id not in self.welfare_history:
            self.welfare_history[user_id] = []
        self.welfare_history[user_id].append({"score": score})

    def get_welfare_trend(self, user_id: str) -> float:
        history = self.welfare_history.get(user_id, [])
        if len(history) < 3:
            return 50.0
        recent = [h["score"] for h in history[-3:]]
        return sum(recent) / len(recent)
