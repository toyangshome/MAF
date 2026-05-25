/** AI 助手建议项 */
export interface Suggestion {
  id: string;
  type: 'task' | 'config' | 'error' | 'workflow';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description: string;
  action?: {
    label: string;
    handler: () => void;
  };
}

/** 任务建议 */
export interface TaskSuggestion {
  description: string;
  score: number; // 匹配分数 0-1
}

/** 配置建议 */
export interface ConfigAdvice {
  field: string;
  currentValue: string;
  suggestedValue?: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

/** 错误诊断 */
export interface ErrorDiagnosis {
  errorPattern: string;
  diagnosis: string;
  suggestions: string[];
  severity: 'warning' | 'error';
}

/** 工作流优化建议 */
export interface WorkflowOptimization {
  type: 'parallel' | 'redundant' | 'chain' | 'bottleneck';
  title: string;
  description: string;
  affectedNodes: string[];
}
