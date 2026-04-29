import numpy as np
from algorithms.base import BaseAgent


def softmax(x: np.ndarray) -> np.ndarray:
    """Numerically stable softmax over a 1D array."""
    e = np.exp(x - np.max(x))
    return e / e.sum()


class ActorCriticAgent(BaseAgent):
    def __init__(
        self,
        alpha_theta: float = 0.001,   # actor learning rate
        alpha_v: float = 0.01,        # critic learning rate
        gamma: float = 0.99,
        n_episodes: int = 3000,
    ):
        self.alpha_theta = alpha_theta
        self.alpha_v = alpha_v
        self.gamma = gamma
        self.n_episodes = n_episodes

        # Actor: preference table — same role as the NN's output logits
        self.theta = np.zeros((500, 6), dtype=np.float64)

        # Critic: state value table
        self.V = np.zeros(500, dtype=np.float64)

        # Discount accumulator — resets to 1.0 each episode (S&B Ch.13.5)
        self.I = 1.0

        # Per-episode metric accumulators
        self._td_errors: list[float] = []
        self._actor_losses: list[float] = []
        self._critic_losses: list[float] = []

    # ------------------------------------------------------------------
    # Policy
    # ------------------------------------------------------------------

    def _policy(self, state: int) -> np.ndarray:
        """Return action probability distribution for a state."""
        return softmax(self.theta[state])

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    def select_action(self, state: int) -> int:
        return int(np.random.choice(6, p=self._policy(state)))

    def update(
        self,
        state: int,
        action: int,
        reward: float,
        next_state: int,
        done: bool,
    ) -> dict:
        # TD error (delta)
        v_next = 0.0 if done else self.V[next_state]
        delta = reward + self.gamma * v_next - self.V[state]

        # Critic update — semi-gradient TD(0)
        self.V[state] += self.alpha_v * delta

        # Actor update — policy gradient with TD error as advantage
        # ∇log π(a|s) = 1(a == action) - π(·|s)   [softmax gradient]
        probs = self._policy(state)
        grad = np.zeros(6, dtype=np.float64)
        grad[action] = 1.0
        grad -= probs
        self.theta[state] += self.alpha_theta * self.I * delta * grad

        # Discount accumulator decay
        self.I *= self.gamma

        # Metrics
        td_abs = abs(delta)
        actor_loss = -np.log(probs[action] + 1e-8) * delta
        critic_loss = delta ** 2

        self._td_errors.append(td_abs)
        self._actor_losses.append(float(actor_loss))
        self._critic_losses.append(float(critic_loss))

        return {"td_error": td_abs}

    def end_episode(self) -> dict:
        """Reset discount accumulator and return averaged episode metrics."""
        self.I = 1.0

        result = {}
        if self._actor_losses:
            result["policy_loss"] = float(np.mean(self._actor_losses))
            result["value_loss"] = float(np.mean(self._critic_losses))
            result["td_error"] = float(np.mean(self._td_errors))

        self._td_errors.clear()
        self._actor_losses.clear()
        self._critic_losses.clear()

        return result

    def get_policy_snapshot(self) -> dict:
        action_probs = np.array([softmax(self.theta[s]) for s in range(500)])
        return {
            "type": "tabular_policy",
            "theta": self.theta.tolist(),
            "action_probs": action_probs.tolist(),
            "greedy_policy": action_probs.argmax(axis=1).tolist(),
            "state_values": self.V.tolist(),
        }

    def get_config(self) -> dict:
        return {
            "alpha_theta": self.alpha_theta,
            "alpha_v": self.alpha_v,
            "gamma": self.gamma,
            "n_episodes": self.n_episodes,
        }