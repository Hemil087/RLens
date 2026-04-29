import torch
import torch.nn as nn
import numpy as np

N_STATES = 500
N_ACTIONS = 6


class PolicyNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(N_STATES, 128), nn.ReLU(),
            nn.Linear(128, 64), nn.ReLU(),
            nn.Linear(64, N_ACTIONS),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return torch.softmax(self.net(x), dim=-1)


class ValueNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(N_STATES, 128), nn.ReLU(),
            nn.Linear(128, 64), nn.ReLU(),
            nn.Linear(64, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def state_to_onehot(s: int) -> torch.Tensor:
    t = torch.zeros(N_STATES)
    t[s] = 1.0
    return t


def all_state_probs(policy_net: PolicyNet) -> np.ndarray:
    with torch.no_grad():
        states = torch.eye(N_STATES)
        probs = policy_net(states)
    return probs.numpy()
