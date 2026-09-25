import { UserRole, UserPermissions } from '../types/chat';

/**
 * Centralized Role-Based Access Control (RBAC) & Permission Engine.
 * Single source of truth for authorization rules across the client and API layers.
 */

export const ADMIN_PERMISSIONS: UserPermissions = {
  canManageAIConfiguration: true,
  canSelectModel: true,
  canManageApiKeys: true,
  canAccessSettings: true,
  canModifySystemPrompt: true,
  canAccessAdminDashboard: true,
};

export const REGULAR_USER_PERMISSIONS: UserPermissions = {
  canManageAIConfiguration: false,
  canSelectModel: false,
  canManageApiKeys: false,
  canAccessSettings: false,
  canModifySystemPrompt: false,
  canAccessAdminDashboard: false,
};

/**
 * Returns complete permissions map for a given user role.
 */
export function getPermissionsForRole(role: UserRole): UserPermissions {
  if (role === 'admin') {
    return ADMIN_PERMISSIONS;
  }
  return REGULAR_USER_PERMISSIONS;
}

/**
 * Check if the role is allowed to configure or manage system AI models, providers, and parameters.
 */
export function canManageAIConfiguration(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Check if the role is allowed to open the Model Selector dialog or switch models.
 */
export function canSelectModel(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Check if the role is allowed to view, add, modify, or delete API keys.
 */
export function canManageApiKeys(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Check if the role is allowed to open the Settings & Configuration dialog.
 */
export function canAccessSettings(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Check if the role is allowed to customize the AI system prompt.
 */
export function canModifySystemPrompt(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Check if the role is allowed to access the secure Admin Dashboard (Usage & Logs).
 */
export function canAccessAdminDashboard(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Guard utility for functions/actions that enforces Administrator permissions.
 * Throws a structured 403 Forbidden Error if unauthorized.
 */
export function assertAdmin(role: UserRole, operationName = 'This action'): void {
  if (role !== 'admin') {
    throw new Error(`403 Forbidden: ${operationName} requires Administrator privileges.`);
  }
}
