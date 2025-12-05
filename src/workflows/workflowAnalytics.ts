/**
 * Workflow Analytics
 * Track and analyze workflow execution patterns
 */

import type { WorkflowExecution } from '../models/workflowExecution.ts';
import type { Workflow } from '../models/workflow.ts';
import { createLogger } from '../utils/logger.ts';

export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgDurationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  totalStepsExecuted: number;
  avgStepsPerExecution: number;
  mostCommonErrors: Array<{ error: string; count: number }>;
}

export interface StepStats {
  stepId: string;
  stepType: string;
  label: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  totalRetries: number;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  count: number;
  avgDuration: number;
}

export class WorkflowAnalytics {
  private logger = createLogger('WorkflowAnalytics');
  private executions: WorkflowExecution[] = [];

  /**
   * Add execution for analysis
   */
  addExecution(execution: WorkflowExecution): void {
    this.executions.push(execution);
    this.logger.debug('Execution added for analytics', {
      executionId: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
    });
  }

  /**
   * Get overall execution statistics
   */
  getExecutionStats(workflowId?: string): ExecutionStats {
    const filtered = workflowId
      ? this.executions.filter(e => e.workflowId === workflowId)
      : this.executions;

    if (filtered.length === 0) {
      return this.emptyStats();
    }

    const successful = filtered.filter(e => e.status === 'completed');
    const failed = filtered.filter(e => e.status === 'failed');
    const durations = filtered
      .filter(e => e.durationMs !== undefined)
      .map(e => e.durationMs!)
      .sort((a, b) => a - b);

    const totalSteps = filtered.reduce(
      (sum, e) => sum + (e.metrics?.stepsExecuted || 0),
      0
    );

    // Count errors
    const errorCounts = new Map<string, number>();
    for (const exec of failed) {
      const errorMsg = typeof exec.error === 'string'
        ? exec.error
        : exec.error?.message ?? 'Unknown error';
      errorCounts.set(errorMsg, (errorCounts.get(errorMsg) || 0) + 1);
    }

    const mostCommonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalExecutions: filtered.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      successRate: successful.length / filtered.length,
      avgDurationMs: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      medianDurationMs: this.percentile(durations, 50),
      p95DurationMs: this.percentile(durations, 95),
      p99DurationMs: this.percentile(durations, 99),
      totalStepsExecuted: totalSteps,
      avgStepsPerExecution: totalSteps / filtered.length,
      mostCommonErrors,
    };
  }

  /**
   * Get per-step statistics
   */
  getStepStats(workflowId: string, workflow: Workflow): StepStats[] {
    const executions = this.executions.filter(e => e.workflowId === workflowId);
    const stepStats = new Map<string, StepStats>();

    // Initialize stats for each step in workflow
    for (const step of workflow.steps) {
      stepStats.set(step.id, {
        stepId: step.id,
        stepType: step.type,
        label: step.label,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        avgDurationMs: 0,
        totalRetries: 0,
      });
    }

    // Aggregate execution data
    for (const execution of executions) {
      for (const stepExec of execution.stepExecutions) {
        const stats = stepStats.get(stepExec.stepId);
        if (!stats) continue;

        stats.executionCount++;
        if (stepExec.status === 'completed') {
          stats.successCount++;
        } else if (stepExec.status === 'failed' || stepExec.status === 'skipped') {
          stats.failureCount++;
        }

        if (stepExec.durationMs) {
          stats.avgDurationMs += stepExec.durationMs;
        }

        stats.totalRetries += stepExec.retryCount || 0;
      }
    }

    // Calculate averages
    for (const stats of stepStats.values()) {
      if (stats.executionCount > 0) {
        stats.avgDurationMs /= stats.executionCount;
      }
    }

    return Array.from(stepStats.values());
  }

  /**
   * Get execution time series
   */
  getTimeSeries(
    workflowId: string,
    intervalMs: number = 3600000 // 1 hour
  ): TimeSeriesPoint[] {
    const executions = this.executions
      .filter((e): e is WorkflowExecution & { startedAt: Date } => (
        e.workflowId === workflowId && !!e.startedAt
      ))
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

    if (executions.length === 0) return [];

    const firstTime = executions[0]!.startedAt.getTime();
    const lastTime = executions[executions.length - 1]!.startedAt.getTime();
    const buckets = new Map<number, { count: number; totalDuration: number }>();

    // Group executions into time buckets
    for (const exec of executions) {
      const bucketTime = Math.floor((exec.startedAt.getTime() - firstTime) / intervalMs);
      const bucket = buckets.get(bucketTime) || { count: 0, totalDuration: 0 };
      
      bucket.count++;
      if (exec.durationMs) {
        bucket.totalDuration += exec.durationMs;
      }

      buckets.set(bucketTime, bucket);
    }

    // Convert to time series
    const series: TimeSeriesPoint[] = [];
    const totalBuckets = Math.ceil((lastTime - firstTime) / intervalMs) + 1;

    for (let i = 0; i < totalBuckets; i++) {
      const bucket = buckets.get(i) || { count: 0, totalDuration: 0 };
      const avgDuration = bucket.count > 0 ? bucket.totalDuration / bucket.count : 0;

      series.push({
        timestamp: new Date(firstTime + i * intervalMs),
        count: bucket.count,
        avgDuration,
      });
    }

    return series;
  }

  /**
   * Detect anomalies in execution patterns
   */
  detectAnomalies(workflowId: string): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    value: number;
    threshold: number;
  }> {
    const stats = this.getExecutionStats(workflowId);
    const anomalies: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      value: number;
      threshold: number;
    }> = [];

    // Check success rate
    if (stats.successRate < 0.5) {
      anomalies.push({
        type: 'low_success_rate',
        severity: 'high',
        description: 'Success rate below 50%',
        value: stats.successRate,
        threshold: 0.5,
      });
    } else if (stats.successRate < 0.8) {
      anomalies.push({
        type: 'low_success_rate',
        severity: 'medium',
        description: 'Success rate below 80%',
        value: stats.successRate,
        threshold: 0.8,
      });
    }

    // Check p99 duration
    const p99Threshold = stats.avgDurationMs * 3;
    if (stats.p99DurationMs > p99Threshold) {
      anomalies.push({
        type: 'high_p99_duration',
        severity: 'medium',
        description: 'P99 duration more than 3x average',
        value: stats.p99DurationMs,
        threshold: p99Threshold,
      });
    }

    // Check for frequent errors
    if (stats.mostCommonErrors.length > 0) {
      const topError = stats.mostCommonErrors[0];
      if (topError && topError.count > stats.totalExecutions * 0.2) {
        anomalies.push({
          type: 'frequent_error',
          severity: 'high',
          description: `Error "${topError.error}" occurs in >20% of executions`,
          value: topError.count,
          threshold: stats.totalExecutions * 0.2,
        });
      }
    }

    return anomalies;
  }

  /**
   * Get execution trends
   */
  getTrends(workflowId: string): {
    successRateTrend: 'improving' | 'declining' | 'stable';
    durationTrend: 'improving' | 'degrading' | 'stable';
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
  } {
    const series = this.getTimeSeries(workflowId);
    
    if (series.length < 2) {
      return {
        successRateTrend: 'stable',
        durationTrend: 'stable',
        volumeTrend: 'stable',
      };
    }

    // Split into two halves
    const midpoint = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, midpoint);
    const secondHalf = series.slice(midpoint);

    const firstAvgDuration = this.average(firstHalf.map(p => p.avgDuration));
    const secondAvgDuration = this.average(secondHalf.map(p => p.avgDuration));

    const firstAvgVolume = this.average(firstHalf.map(p => p.count));
    const secondAvgVolume = this.average(secondHalf.map(p => p.count));

    return {
      successRateTrend: 'stable', // Would need success/failure data per point
      durationTrend:
        secondAvgDuration < firstAvgDuration * 0.9
          ? 'improving'
          : secondAvgDuration > firstAvgDuration * 1.1
          ? 'degrading'
          : 'stable',
      volumeTrend:
        secondAvgVolume > firstAvgVolume * 1.2
          ? 'increasing'
          : secondAvgVolume < firstAvgVolume * 0.8
          ? 'decreasing'
          : 'stable',
    };
  }

  /**
   * Generate execution report
   */
  generateReport(workflowId: string, workflow: Workflow): string {
    const stats = this.getExecutionStats(workflowId);
    const stepStats = this.getStepStats(workflowId, workflow);
    const anomalies = this.detectAnomalies(workflowId);
    const trends = this.getTrends(workflowId);

    const lines: string[] = [
      `Workflow Execution Report`,
      `=========================`,
      `Workflow: ${workflow.name} (${workflowId})`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `Overall Statistics`,
      `-----------------`,
      `Total Executions: ${stats.totalExecutions}`,
      `Successful: ${stats.successfulExecutions} (${(stats.successRate * 100).toFixed(1)}%)`,
      `Failed: ${stats.failedExecutions}`,
      `Average Duration: ${stats.avgDurationMs.toFixed(0)}ms`,
      `P95 Duration: ${stats.p95DurationMs.toFixed(0)}ms`,
      `P99 Duration: ${stats.p99DurationMs.toFixed(0)}ms`,
      `Average Steps per Execution: ${stats.avgStepsPerExecution.toFixed(1)}`,
      ``,
      `Trends`,
      `------`,
      `Success Rate: ${trends.successRateTrend}`,
      `Duration: ${trends.durationTrend}`,
      `Volume: ${trends.volumeTrend}`,
      ``,
    ];

    if (anomalies.length > 0) {
      lines.push(`Anomalies Detected`, `------------------`);
      for (const anomaly of anomalies) {
        lines.push(
          `[${anomaly.severity.toUpperCase()}] ${anomaly.description}`,
          `  Value: ${anomaly.value.toFixed(2)}, Threshold: ${anomaly.threshold.toFixed(2)}`
        );
      }
      lines.push(``);
    }

    lines.push(`Step Statistics`, `---------------`);
    for (const step of stepStats) {
      if (step.executionCount > 0) {
        const successRate = (step.successCount / step.executionCount) * 100;
        lines.push(
          `${step.label} (${step.stepId})`,
          `  Type: ${step.stepType}`,
          `  Executions: ${step.executionCount}`,
          `  Success Rate: ${successRate.toFixed(1)}%`,
          `  Avg Duration: ${step.avgDurationMs.toFixed(0)}ms`,
          `  Total Retries: ${step.totalRetries}`,
          ``
        );
      }
    }

    if (stats.mostCommonErrors.length > 0) {
      lines.push(`Most Common Errors`, `------------------`);
      for (const error of stats.mostCommonErrors) {
        lines.push(`${error.error}: ${error.count} occurrences`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.executions = [];
  }

  /**
   * Helper: calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) return sortedValues[lower] || 0;

    return (
      (sortedValues[lower] || 0) * (1 - weight) +
      (sortedValues[upper] || 0) * weight
    );
  }

  /**
   * Helper: calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Helper: empty stats
   */
  private emptyStats(): ExecutionStats {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      successRate: 0,
      avgDurationMs: 0,
      medianDurationMs: 0,
      p95DurationMs: 0,
      p99DurationMs: 0,
      totalStepsExecuted: 0,
      avgStepsPerExecution: 0,
      mostCommonErrors: [],
    };
  }
}
