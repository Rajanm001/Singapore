/**
 * Metrics Collection
 * Track workflow execution metrics and performance
 */

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  unit?: string;
}

export interface AggregatedMetrics {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

export class MetricsCollector {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private readonly maxPointsPerMetric = 10000;

  /**
   * Record a metric point
   */
  record(name: string, value: number, tags?: Record<string, string>, unit?: string): void {
    const point: MetricPoint = {
      name,
      value,
      timestamp: new Date(),
      tags,
      unit,
    };

    const points = this.metrics.get(name) || [];
    points.push(point);

    // Limit stored points
    if (points.length > this.maxPointsPerMetric) {
      points.shift();
    }

    this.metrics.set(name, points);
  }

  /**
   * Record execution duration
   */
  recordDuration(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record(name, durationMs, tags, 'ms');
  }

  /**
   * Record count metric
   */
  recordCount(name: string, count: number, tags?: Record<string, string>): void {
    this.record(name, count, tags, 'count');
  }

  /**
   * Get aggregated metrics for a given name
   */
  getAggregated(name: string, since?: Date): AggregatedMetrics | null {
    const points = this.metrics.get(name);
    if (!points || points.length === 0) {
      return null;
    }

    const filtered = since
      ? points.filter(p => p.timestamp >= since)
      : points;

    if (filtered.length === 0) {
      return null;
    }

    const values = filtered.map(p => p.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);

    return {
      count: values.length,
      sum,
      min: values[0] || 0,
      max: values[values.length - 1] || 0,
      avg: sum / values.length,
      p50: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
    };
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear metrics
   */
  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedValues[lower] || 0;
    }

    return (sortedValues[lower] || 0) * (1 - weight) + (sortedValues[upper] || 0) * weight;
  }

  /**
   * Export metrics as time series
   */
  export(name: string): MetricPoint[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get summary of all metrics
   */
  getSummary(): Record<string, AggregatedMetrics> {
    const summary: Record<string, AggregatedMetrics> = {};
    
    for (const name of this.metrics.keys()) {
      const agg = this.getAggregated(name);
      if (agg) {
        summary[name] = agg;
      }
    }

    return summary;
  }
}

/**
 * Global metrics collector instance
 */
export const globalMetrics = new MetricsCollector();
