from dataclasses import dataclass
import gymnasium as gym
import numpy as np

N_STATES = 500
N_ACTIONS = 6
ACTION_NAMES = {0: "south", 1: "north", 2: "east", 3: "west", 4: "pickup", 5: "dropoff"}


@dataclass
class TaxiState:
    taxi_row: int
    taxi_col: int
    pass_loc: int
    dest_idx: int


def make_env() -> gym.Env:
    return gym.make("Taxi-v4")


def make_render_env() -> gym.Env:
    return gym.make("Taxi-v4", render_mode="rgb_array")


def decode_state(env: gym.Env, s: int) -> TaxiState:
    taxi_row, taxi_col, pass_loc, dest_idx = env.unwrapped.decode(s)
    return TaxiState(
        taxi_row=int(taxi_row),
        taxi_col=int(taxi_col),
        pass_loc=int(pass_loc),
        dest_idx=int(dest_idx),
    )


def render_grid(state: TaxiState) -> list[list[str]]:
    """Return a 5x5 matrix of cell type strings for the given state."""
    location_map = {0: "R", 1: "G", 2: "Y", 3: "B"}
    dest_positions = {0: (0, 0), 1: (0, 4), 2: (4, 0), 3: (4, 3)}

    grid = [["." for _ in range(5)] for _ in range(5)]

    for dest_idx, (r, c) in dest_positions.items():
        grid[r][c] = location_map[dest_idx]

    if state.pass_loc < 4:
        pr, pc = dest_positions[state.pass_loc]
        grid[pr][pc] = f"P({location_map[state.pass_loc]})"

    dest_r, dest_c = dest_positions[state.dest_idx]
    grid[dest_r][dest_c] = f"D({location_map[state.dest_idx]})"

    if state.pass_loc == 4:
        grid[state.taxi_row][state.taxi_col] = "T(P)"
    else:
        grid[state.taxi_row][state.taxi_col] = "T"

    return grid


def greedy_action(policy_snapshot: dict, state: int) -> int:
    if policy_snapshot["type"] == "q_table":
        q_table = np.array(policy_snapshot["q_table"])
        return int(np.argmax(q_table[state]))
    else:
        greedy_policy = policy_snapshot["greedy_policy"]
        return int(greedy_policy[state])
