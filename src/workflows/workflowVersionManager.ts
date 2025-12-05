/**
 * Workflow Version Manager
 * Handles workflow versioning, history, and migrations
 */

import type { Workflow } from '../models/workflow.ts';
import { createLogger } from '../utils/logger.ts';
import { WorkflowValidationError } from '../utils/errors.ts';

export interface VersionInfo {
  version: number;
  versionLabel?: string;
  createdAt: Date;
  createdBy?: string;
  changes?: string;
}

export interface VersionDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

export class WorkflowVersionManager {
  private logger = createLogger('WorkflowVersionManager');

  /**
   * Create a new version of a workflow
   */
  async createVersion(
    currentWorkflow: Workflow,
    updates: Partial<Workflow>,
    createdBy?: string,
    changes?: string
  ): Promise<Workflow> {
    this.logger.info('Creating new workflow version', {
      workflowId: currentWorkflow.id,
      currentVersion: currentWorkflow.version,
    });

    // Validate that workflow exists and is latest
    if (!currentWorkflow.isLatest) {
      throw new WorkflowValidationError(
        'Cannot create version from non-latest workflow'
      );
    }

    // Create new version
    const newVersion: Workflow = {
      ...currentWorkflow,
      ...updates,
      version: currentWorkflow.version + 1,
      parentVersionId: currentWorkflow.id,
      isLatest: true,
      updatedAt: new Date(),
      createdBy,
    };

    if (changes) {
      newVersion.metadata = {
        ...(newVersion.metadata ?? {}),
        changeSummary: changes,
      };
    }

    // Mark previous version as not latest
    currentWorkflow.isLatest = false;

    this.logger.info('Workflow version created', {
      workflowId: newVersion.id,
      version: newVersion.version,
      parentVersion: currentWorkflow.version,
    });

    return newVersion;
  }

  /**
   * Get version history for a workflow
   */
  async getVersionHistory(workflowId: string): Promise<VersionInfo[]> {
    this.logger.debug('Returning mock version history', { workflowId });
    // In production, this would query the database
    // For now, return mock data
    return [
      {
        version: 1,
        versionLabel: 'v1.0.0',
        createdAt: new Date('2025-01-01'),
        createdBy: 'user_123',
        changes: 'Initial version',
      },
      {
        version: 2,
        versionLabel: 'v1.1.0',
        createdAt: new Date('2025-02-01'),
        createdBy: 'user_123',
        changes: 'Added error handling step',
      },
    ];
  }

  /**
   * Compare two workflow versions
   */
  compareVersions(v1: Workflow, v2: Workflow): VersionDiff {
    const v1Steps = new Set(v1.steps.map(s => s.id));
    const v2Steps = new Set(v2.steps.map(s => s.id));

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    // Find added steps
    for (const stepId of v2Steps) {
      if (!v1Steps.has(stepId)) {
        added.push(stepId);
      }
    }

    // Find removed steps
    for (const stepId of v1Steps) {
      if (!v2Steps.has(stepId)) {
        removed.push(stepId);
      }
    }

    // Find modified steps
    for (const stepId of v1Steps) {
      if (v2Steps.has(stepId)) {
        const v1Step = v1.steps.find(s => s.id === stepId);
        const v2Step = v2.steps.find(s => s.id === stepId);

        if (v1Step && v2Step) {
          const v1Json = JSON.stringify(v1Step);
          const v2Json = JSON.stringify(v2Step);

          if (v1Json !== v2Json) {
            modified.push(stepId);
          }
        }
      }
    }

    return { added, removed, modified };
  }

  /**
   * Rollback to a previous version
   */
  async rollback(
    workflowId: string,
    targetVersion: number,
    rolledBackBy?: string
  ): Promise<Workflow> {
    this.logger.info('Rolling back workflow', {
      workflowId,
      targetVersion,
      rolledBackBy,
    });

    // In production, fetch the target version from database
    // For now, throw error
    throw new Error('Rollback not yet implemented - database integration required');
  }

  /**
   * Tag a workflow version
   */
  async tagVersion(
    workflowId: string,
    version: number,
    tag: string
  ): Promise<void> {
    this.logger.info('Tagging workflow version', {
      workflowId,
      version,
      tag,
    });

    // In production, update database
    // For now, just log
  }

  /**
   * Get latest version number
   */
  async getLatestVersion(workflowId: string): Promise<number> {
    this.logger.debug('Returning mock latest version', { workflowId });
    // In production, query database
    return 1;
  }

  /**
   * Check if a workflow can be safely updated
   */
  async canUpdate(workflow: Workflow): Promise<boolean> {
    // Check if workflow is being used in active executions
    // In production, query execution table
    const activeExecutions = 0; // Mock

    if (activeExecutions > 0) {
      this.logger.warn('Workflow has active executions', {
        workflowId: workflow.id,
        activeExecutions,
      });
      return false;
    }

    return true;
  }

  /**
   * Archive old versions
   */
  async archiveOldVersions(
    workflowId: string,
    keepLastN: number = 5
  ): Promise<number> {
    this.logger.info('Archiving old workflow versions', {
      workflowId,
      keepLastN,
    });

    // In production, update database to set status = 'archived'
    // for versions older than keepLastN
    return 0; // Return number of archived versions
  }

  /**
   * Migrate workflow to new schema
   */
  async migrateSchema(
    workflow: Workflow,
    migrationFn: (wf: Workflow) => Workflow
  ): Promise<Workflow> {
    this.logger.info('Migrating workflow schema', {
      workflowId: workflow.id,
      version: workflow.version,
    });

    try {
      const migrated = migrationFn(workflow);
      
      // Validate migrated workflow
      if (!migrated.id || !migrated.steps || migrated.steps.length === 0) {
        throw new WorkflowValidationError('Migration produced invalid workflow');
      }

      this.logger.info('Workflow schema migrated successfully', {
        workflowId: migrated.id,
      });

      return migrated;
    } catch (error) {
      this.logger.error('Workflow migration failed', error as Error, {
        workflowId: workflow.id,
      });
      throw error;
    }
  }

  /**
   * Generate version summary
   */
  generateVersionSummary(workflow: Workflow): string {
    const stepCount = workflow.steps.length;
    const stepTypes = new Set(workflow.steps.map(s => s.type));
    const hasConditionals = workflow.steps.some(s => s.type === 'CONDITION');
    const hasRetries = workflow.steps.some(s => s.retry !== undefined);

    const parts: string[] = [
      `Version ${workflow.version}`,
      workflow.versionLabel ? `(${workflow.versionLabel})` : '',
      `- ${stepCount} steps`,
      `- Types: ${Array.from(stepTypes).join(', ')}`,
    ];

    if (hasConditionals) {
      parts.push('- Has conditional branching');
    }

    if (hasRetries) {
      parts.push('- Has retry logic');
    }

    parts.push(`- Status: ${workflow.status}`);
    parts.push(`- Created: ${workflow.createdAt.toISOString()}`);

    if (workflow.createdBy) {
      parts.push(`- Created by: ${workflow.createdBy}`);
    }

    return parts.filter(Boolean).join('\n');
  }
}
