import io
import os
import base64
import imageio

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

from core.env_wrapper import make_render_env, greedy_action


def generate_episode_gif(policy_snapshot: dict, fps: int = 4) -> dict:
    env = make_render_env()
    frames = []

    state, _ = env.reset()
    frames.append(env.render())
    done = False
    step = 0
    total_reward = 0.0

    while not done and step < 200:
        action = greedy_action(policy_snapshot, state)
        state, reward, terminated, truncated, _ = env.step(action)
        frames.append(env.render())
        done = terminated or truncated
        total_reward += float(reward)
        step += 1

    env.close()

    buf = io.BytesIO()
    imageio.mimsave(buf, frames, format="GIF", fps=fps, loop=0)
    gif_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {
        "gif_b64": gif_b64,
        "total_steps": step,
        "total_reward": total_reward,
    }