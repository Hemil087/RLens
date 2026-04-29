import numpy as np
from algorithms.base import BaseAgent


class QLearningAgent(BaseAgent):
    def __init__(
        self,
        alpha: float = 0.1,
        gamma: float = 0.99,
        epsilon_start: float = 1.0,
        epsilon_end: float = 0.01,
        n_episodes: int = 3000,
    ):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon_start = epsilon_start
        self.epsilon_end = epsilon_end
        self.n_episodes = n_episodes

        self.Q = np.zeros((500, 6))
        self.epsilon = epsilon_start
        self._episode = 0

    def _decay_epsilon(self):
        progress = self._episode / max(self.n_episodes - 1, 1)
        self.epsilon = self.epsilon_start - progress * (self.epsilon_start - self.epsilon_end)

    def select_action(self, state: int) -> int:
        if np.random.random() < self.epsilon:
            return np.random.randint(6)
        return int(np.argmax(self.Q[state]))

    def update(self, state: int, action: int, reward: float, next_state: int, done: bool) -> dict:
        td_target = reward + self.gamma * np.max(self.Q[next_state]) * (1 - done)
        td_error = td_target - self.Q[state, action]
        self.Q[state, action] += self.alpha * td_error
        return {"td_error": float(abs(td_error))}

    def end_episode(self):
        self._episode += 1
        self._decay_epsilon()

    def get_policy_snapshot(self) -> dict:
        greedy_policy = np.argmax(self.Q, axis=1).tolist()
        return {
            "type": "q_table",
            "q_table": self.Q.tolist(),
            "greedy_policy": greedy_policy,
        }

    def get_config(self) -> dict:
        return {
            "alpha": self.alpha,
            "gamma": self.gamma,
            "epsilon_start": self.epsilon_start,
            "epsilon_end": self.epsilon_end,
            "n_episodes": self.n_episodes,
        }
