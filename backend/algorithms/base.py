from abc import ABC, abstractmethod


class BaseAgent(ABC):
    @abstractmethod
    def select_action(self, state: int) -> int: ...

    @abstractmethod
    def update(self, state: int, action: int, reward: float, next_state: int, done: bool) -> dict: ...

    @abstractmethod
    def get_policy_snapshot(self) -> dict: ...

    @abstractmethod
    def get_config(self) -> dict: ...
