/**
 * MAF UI — Mock Data Module
 *
 * Central export for all mock data and factory utilities.
 */
export * from './factory';

// Re-export the static mock data for backward compatibility
export { mockAgents, mockLogs, mockTasks, mockMetrics, mockConfig } from './data';
