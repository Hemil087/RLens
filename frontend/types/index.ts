export type AlgorithmType = "q_learning" | "sarsa" | "reinforce" | "actor_critic";

export type TrainingStatus = "idle" | "training" | "complete" | "error";

export interface EpisodeUpdate {
  type: "episode_update";
  episode: number;
  reward: number;
  steps: number;
  rolling_avg_reward: number;
  epsilon?: number;
  extra_metrics: {
    td_error?: number;
    policy_loss?: number;
    value_loss?: number;
  };
}

// Elements inside an `episode_batch` message. Identical shape to EpisodeUpdate
// but without the per-message `type` tag (the batch wrapper carries the type).
export type EpisodeEntry = Omit<EpisodeUpdate, "type">;

// New P1 protocol: episodes are streamed in batches to reduce WS overhead.
export interface EpisodeBatch {
  type: "episode_batch";
  episodes: EpisodeEntry[];
}

export interface Checkpoint {
  type: "checkpoint";
  episode: number;
  policy_snapshot: PolicySnapshot;
}

export interface TrainingComplete {
  type: "training_complete";
  total_episodes: number;
  final_avg_reward: number;
  convergence_episode: number | null;
  all_checkpoints: number[];
}

export interface PolicySnapshot {
  type: "q_table" | "policy_network" | "tabular_policy";
  q_table?: number[][];
  greedy_policy: number[];
  action_probs?: number[][];
  state_values?: number[];
}