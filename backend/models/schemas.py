from pydantic import BaseModel
from typing import Any


class ReplayGifRequest(BaseModel):
    policy_snapshot: dict[str, Any]
    fps: int = 4


class PolicyAnalyzeRequest(BaseModel):
    policy_snapshot: dict[str, Any]
