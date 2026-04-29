import numpy as np


def serialize_q_table(Q: np.ndarray) -> list[list[float]]:
    return Q.tolist()


def serialize_policy_net(policy_net, value_net) -> dict:
    import torch
    with torch.no_grad():
        states = torch.eye(500)
        from models.policy_net import N_STATES
        action_probs = policy_net(states).numpy()
        state_values = value_net(states).squeeze().numpy()
    return {
        "type": "policy_network",
        "action_probs": action_probs.tolist(),
        "greedy_policy": action_probs.argmax(axis=1).tolist(),
        "state_values": state_values.tolist(),
    }
