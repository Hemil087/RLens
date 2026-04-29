"use client";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/shared/Card";
import { AlgorithmSelector } from "@/components/training/AlgorithmSelector";
import { ParamPanel } from "@/components/training/ParamPanel";
import { TrainingControls } from "@/components/training/TrainingControls";
import { RewardCurve } from "@/components/charts/RewardCurve";
import { MetricsChart } from "@/components/charts/MetricsChart";
import { EpsilonDecayChart } from "@/components/charts/EpsilonDecayChart";
import { CheckpointSlider } from "@/components/policy/CheckpointSlider";
import { PolicyArrows } from "@/components/policy/PolicyArrows";
import { StateValueMap } from "@/components/policy/StateValueMap";
import { QTableHeatmap } from "@/components/policy/QTableHeatmap";
import { StatusBadge } from "@/components/training/StatusBadge";
import { useTrainingSocket } from "@/hooks/useTrainingSocket";
import { useTrainingStore } from "@/store/trainingStore";

export default function TrainPage() {
  useTrainingSocket();
  const { status, finalStats, isConnected, algorithm, checkpoints, selectedCheckpointIdx } =
    useTrainingStore();

  const isTabular = algorithm === "q_learning" || algorithm === "sarsa";
  const snapshot = checkpoints[selectedCheckpointIdx]?.policy_snapshot;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Train" isConnected={isConnected} />
      <div className="flex flex-1 gap-4 p-4 overflow-auto">
        <div className="w-64 shrink-0 flex flex-col gap-4">
          <Card title="Algorithm">
            <AlgorithmSelector />
          </Card>
          <Card title="Hyperparameters">
            <ParamPanel />
          </Card>
          <Card title="Controls">
            <div className="flex justify-end mb-2">
              <StatusBadge />
            </div>
            <TrainingControls />
            {status === "complete" && finalStats && (
              <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Final avg reward</span>
                  <span className="text-green-400 font-mono">{finalStats.final_avg_reward}</span>
                </div>
                {finalStats.convergence_episode && (
                  <div className="flex justify-between">
                    <span>Converged at</span>
                    <span className="text-indigo-400 font-mono">ep {finalStats.convergence_episode}</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <Card title="Reward Curve">
            <RewardCurve />
          </Card>
          <Card title="Metrics">
            <MetricsChart />
            <EpsilonDecayChart />
          </Card>

          {checkpoints.length > 0 && (
            <Card title="Policy Visualization">
              <CheckpointSlider />
              <div className="mt-4 flex gap-4 flex-wrap">
                {isTabular ? (
                  <PolicyArrows snapshot={snapshot} />
                ) : (
                  <StateValueMap snapshot={snapshot} />
                )}
              </div>
              {isTabular && snapshot?.type === "q_table" && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                    Q-Table Heatmap
                  </summary>
                  <div className="mt-2">
                    <QTableHeatmap />
                  </div>
                </details>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
