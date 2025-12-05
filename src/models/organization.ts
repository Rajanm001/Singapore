import { z } from 'zod';

/**
 * Organization Model
 * Represents a top-level tenant in the multi-tenant system.
 * Organizations own all resources including sub-organizations, knowledge collections, and workflows.
 */

export const OrganizationSchema = z.object({
  id: z.string().describe('Unique identifier for the organization'),
  name: z.string().min(1).describe('Organization name'),
  displayName: z.string().optional().describe('Human-readable display name'),
  metadata: z.record(z.unknown()).optional().describe('Flexible metadata storage'),
  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
  status: z.enum(['active', 'suspended', 'archived']).default('active'),
  settings: z
    .object({
      maxCollections: z.number().optional(),
      maxWorkflows: z.number().optional(),
      allowSubOrganizations: z.boolean().default(true),
    })
    .optional(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

/**
 * SubOrganization Model
 * Represents a child organizational unit within a parent organization.
 * Used for hierarchical multi-tenancy and resource isolation.
 */

export const SubOrganizationSchema = z.object({
  id: z.string().describe('Unique identifier for the sub-organization'),
  organizationId: z.string().describe('Parent organization ID'),
  name: z.string().min(1).describe('Sub-organization name'),
  displayName: z.string().optional().describe('Human-readable display name'),
  metadata: z.record(z.unknown()).optional().describe('Flexible metadata storage'),
  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
  status: z.enum(['active', 'suspended', 'archived']).default('active'),
  inheritSettings: z.boolean().default(true).describe('Inherit parent org settings'),
});

export type SubOrganization = z.infer<typeof SubOrganizationSchema>;

/**
 * Factory functions for creating new instances with defaults
 */

export function createOrganization(
  data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Organization {
  return OrganizationSchema.parse({
    ...data,
    id: generateId('org'),
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
  });
}

export function createSubOrganization(
  data: Omit<SubOrganization, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): SubOrganization {
  return SubOrganizationSchema.parse({
    ...data,
    id: generateId('suborg'),
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
  });
}

/**
 * Simple ID generator (in production, use nanoid or UUID)
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
