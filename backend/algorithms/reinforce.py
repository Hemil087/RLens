import numpy as np
from algorithms.base import BaseAgent


def softmax(x: np.ndarray) -> np.ndarray:
    """Numerically stable softmax over a 1D array."""
    e = np.exp(x - np.max(x))
    return e / e.sum()


def softmax_rows(mat: np.ndarray) -> np.ndarray:
    """Numerically stable softmax over rows of a 2D array (vectorized)."""
    shifted = mat - mat.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


class REINFORCEAgent(BaseAgent):
    def __init__(
        self,
        alpha_theta: float = 0.001,   # policy learning rate
        alpha_w: float = 0.1,         # baseline learning rate — MUST be high (0.05–0.2)
        gamma: float = 0.99,
        n_episodes: int = 3000,
    ):
        self.alpha_theta = alpha_theta
        self.alpha_w = alpha_w
        self.gamma = gamma
        self.n_episodes = n_episodes

        # Actor: preference table — π(a|s) = softmax(theta[s])
        self.theta = np.zeros((500, 6), dtype=np.float64)

        # Baseline: W[s] tracks actual discounted returns V(s)
        # Must learn quickly (high alpha_w) to keep delta small and stable
        self.W = np.zeros(500, dtype=np.float64)

        # Episode trajectory buffer
        self._trajectory: list[tuple] = []   # (state, action, reward)

    # ------------------------------------------------------------------
    # Policy
    # ------------------------------------------------------------------

    def _policy(self, state: int) -> np.ndarray:
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
        """Buffer the transition — REINFORCE updates only at episode end."""
        self._trajectory.append((state, action, reward))
        return {}

    def end_episode(self) -> dict:
        """
        Compute Monte Carlo returns and update theta + W.

        Design decisions:
        - NO return normalization: normalization makes W[s] converge to 0
          for all states (since normalized mean is always ~0), defeating the
          entire purpose of having a baseline. Use raw returns instead.
        - HIGH alpha_w (0.1): baseline must track actual returns quickly.
          With alpha_w=0.001 the baseline is frozen near 0, making
          delta = G_t - W[s] ≈ G_t ≈ -80, causing policy updates to explode.
        - NO γ^t: dropped for practical stability. The γ^t term is theoretically
          correct but downweights later timesteps, making early noisy gradients
          dominate before the baseline has warmed up.
        """
        if not self._trajectory:
            return {}

        T = len(self._trajectory)
        states  = [t[0] for t in self._trajectory]
        actions = [t[1] for t in self._trajectory]

        # --- Step 1: Compute raw discounted returns G_t (no normalization) ---
        returns = np.zeros(T, dtype=np.float64)
        G = 0.0
        for t in reversed(range(T)):
            G = self._trajectory[t][2] + self.gamma * G
            returns[t] = G

        # --- Step 2: Update baseline W and policy theta ---
        policy_losses = []
        value_losses  = []

        for t in range(T):
            s   = states[t]
            a   = actions[t]
            G_t = returns[t]

            # Advantage: how much better was this return vs our baseline estimate?
            delta = G_t - self.W[s]

            # Baseline update — high alpha_w so W[s] tracks returns quickly
            # W[s] converges to ~E[G_t | s_t = s] ≈ V(s)
            self.W[s] += self.alpha_w * delta

            # Policy gradient: ∇log π(a|s) = one_hot(a) − π(·|s)
            probs    = self._policy(s)
            grad     = np.zeros(6, dtype=np.float64)
            grad[a]  = 1.0
            grad    -= probs
            self.theta[s] += self.alpha_theta * delta * grad

            policy_losses.append(-np.log(probs[a] + 1e-8) * delta)
            value_losses.append(delta ** 2)

        self._trajectory = []
        return {
            "policy_loss": float(np.mean(policy_losses)),
            "value_loss":  float(np.mean(value_losses)),
        }

    def get_policy_snapshot(self) -> dict:
        # Vectorized softmax over all 500 states in one pass (was a Python loop).
        action_probs = softmax_rows(self.theta)
        # Drop `theta` from the payload — it's just pre-softmax logits, and the
        # frontend only ever reads action_probs / greedy_policy / state_values.
        # If you later need theta for offline analysis, expose it via a REST
        # endpoint rather than paying for it on every checkpoint.
        return {
            "type": "tabular_policy",
            "action_probs":  np.round(action_probs, 4).tolist(),
            "greedy_policy": action_probs.argmax(axis=1).tolist(),
            "state_values":  np.round(self.W, 4).tolist(),
        }

    def get_config(self) -> dict:
        return {
            "alpha_theta": self.alpha_theta,
            "alpha_w":     self.alpha_w,
            "gamma":       self.gamma,
            "n_episodes":  self.n_episodes,
        }