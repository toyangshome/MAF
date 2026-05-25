import type { Task, MAFConfig, LogEntry, WorkflowNode } from '../../types';
import type { TaskSuggestion, ConfigAdvice, ErrorDiagnosis, WorkflowOptimization } from './types';

// ── 纯函数：任务描述模糊匹配建议 ───────────────────────────────

/**
 * 模糊匹配历史任务描述
 * 使用简单的子串 + 编辑距离相似度进行排序
 */
export function matchTaskDescriptions(
  input: string,
  historyTasks: Task[],
  limit = 5
): TaskSuggestion[] {
  if (!input.trim() || historyTasks.length === 0) return [];

  const query = input.toLowerCase().trim();
  const seen = new Set<string>();
  const results: TaskSuggestion[] = [];

  for (const task of historyTasks) {
    const desc = task.description.toLowerCase().trim();
    if (seen.has(desc) || desc === query) continue;
    seen.add(desc);

    let score = 0;

    // 完全包含查询词
    if (desc.includes(query)) {
      score = 0.9;
    }
    // 查询词是描述的前缀
    else if (desc.startsWith(query)) {
      score = 0.95;
    }
    // 检查每个词的匹配
    else {
      const queryWords = query.split(/\s+/);
      const descWords = desc.split(/\s+/);
      let matchedWords = 0;
      for (const qw of queryWords) {
        if (descWords.some((dw) => dw.includes(qw) || qw.includes(dw))) {
          matchedWords++;
        }
      }
      if (matchedWords > 0) {
        score = matchedWords / queryWords.length * 0.7;
      }
      // 编辑距离相似度 (简化版)
      else {
        const similarity = 1 - levenshteinDistance(query, desc) / Math.max(query.length, desc.length);
        if (similarity > 0.3) score = similarity * 0.5;
      }
    }

    if (score > 0.2) {
      results.push({ description: task.description, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** 简化版 Levenshtein 距离 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // 只对较短的字符串计算（性能优化）
  if (m > 100 || n > 100) {
    return Math.abs(m - n) + Math.min(m, n) * 0.5;
  }

  const dp: number[] = Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// ── 纯函数：配置分析建议 ─────────────────────────────────────

/**
 * 分析当前配置，给出优化建议
 */
export function analyzeConfig(config: MAFConfig): ConfigAdvice[] {
  const advice: ConfigAdvice[] = [];

  // 全局配置检查
  if (config.timeout < 30000) {
    advice.push({
      field: 'timeout',
      currentValue: `${config.timeout}ms`,
      suggestedValue: '60000ms',
      severity: 'warning',
      message: '全局超时时间过短，复杂任务可能因超时而失败。建议至少设为 60000ms。',
    });
  }

  if (config.timeout > 300000) {
    advice.push({
      field: 'timeout',
      currentValue: `${config.timeout}ms`,
      severity: 'info',
      message: '超时时间较长（>5分钟），任务失败时需要较长时间才能检测到。',
    });
  }

  if (config.maxRetries === 0) {
    advice.push({
      field: 'maxRetries',
      currentValue: '0',
      suggestedValue: '3',
      severity: 'warning',
      message: '未配置重试，临时网络错误可能导致任务失败。建议设为 2-3 次。',
    });
  }

  if (config.maxRetries > 5) {
    advice.push({
      field: 'maxRetries',
      currentValue: String(config.maxRetries),
      suggestedValue: '3',
      severity: 'info',
      message: '重试次数过多可能延长失败任务的响应时间。',
    });
  }

  // Agent 配置检查
  for (const agent of (Array.isArray(config.agents) ? config.agents : [])) {
    if (agent.temperature > 1.0) {
      advice.push({
        field: `${agent.name}.temperature`,
        currentValue: agent.temperature.toFixed(2),
        suggestedValue: '0.7',
        severity: 'warning',
        message: `Agent "${agent.name}" 的 temperature (${agent.temperature.toFixed(2)}) 过高，输出可能不稳定。编码类任务建议 0.0-0.3，创意类建议 0.7-0.9。`,
      });
    }

    if (agent.temperature > 0.7 && agent.type === 'coder') {
      advice.push({
        field: `${agent.name}.temperature`,
        currentValue: agent.temperature.toFixed(2),
        suggestedValue: '0.2',
        severity: 'info',
        message: `编码 Agent "${agent.name}" 的 temperature 偏高，代码生成建议使用较低的 temperature (0.0-0.3)。`,
      });
    }

    if (agent.maxTokens < 1024) {
      advice.push({
        field: `${agent.name}.maxTokens`,
        currentValue: String(agent.maxTokens),
        suggestedValue: '4096',
        severity: 'warning',
        message: `Agent "${agent.name}" 的 maxTokens (${agent.maxTokens}) 不足，复杂任务的输出可能被截断。建议至少 2048。`,
      });
    }

    if (agent.maxTokens > 16384) {
      advice.push({
        field: `${agent.name}.maxTokens`,
        currentValue: String(agent.maxTokens),
        severity: 'info',
        message: `Agent "${agent.name}" 的 maxTokens (${agent.maxTokens}) 较大，可能导致 token 消耗过快和响应变慢。`,
      });
    }

    if (!agent.systemPrompt || agent.systemPrompt.trim().length < 10) {
      advice.push({
        field: `${agent.name}.systemPrompt`,
        currentValue: agent.systemPrompt ? `"${agent.systemPrompt.slice(0, 30)}..."` : '(empty)',
        severity: 'warning',
        message: `Agent "${agent.name}" 缺少有效的系统提示词，可能影响输出质量。`,
      });
    }

    if (agent.tools.length === 0) {
      advice.push({
        field: `${agent.name}.tools`,
        currentValue: '0 tools',
        severity: 'info',
        message: `Agent "${agent.name}" 未分配工具，只能进行纯文本对话。`,
      });
    }

    // 检查工具与 agent 类型的匹配
    if (agent.type === 'coder' && !agent.tools.some((t) => ['file_read', 'file_write', 'shell_exec'].includes(t))) {
      advice.push({
        field: `${agent.name}.tools`,
        currentValue: agent.tools.join(', ') || '(none)',
        suggestedValue: 'file_read, file_write, shell_exec',
        severity: 'info',
        message: `编码 Agent "${agent.name}" 建议添加文件读写和命令执行工具。`,
      });
    }
  }

  // 检查是否有重复 agent 名称
  const nameCount = new Map<string, number>();
  for (const agent of (Array.isArray(config.agents) ? config.agents : [])) {
    nameCount.set(agent.name, (nameCount.get(agent.name) || 0) + 1);
  }
  for (const [name, count] of nameCount) {
    if (count > 1) {
      advice.push({
        field: 'agents',
        currentValue: `"${name}" x${count}`,
        severity: 'warning',
        message: `存在 ${count} 个同名 Agent "${name}"，可能导致混淆。建议使用不同名称。`,
      });
    }
  }

  return advice;
}

// ── 纯函数：错误诊断 ────────────────────────────────────────

/** 常见错误模式及其诊断 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  diagnosis: string;
  suggestions: string[];
  severity: 'warning' | 'error';
}> = [
  {
    pattern: /timeout|timed?\s*out|ETIMEDOUT/i,
    diagnosis: '请求超时，服务端响应时间超过配置的超时限制。',
    suggestions: [
      '增加 timeout 配置值（当前建议 >= 60000ms）',
      '检查网络连接是否稳定',
      '如果使用 VPN，确认代理端口设置正确',
      '将任务拆分为更小的子任务',
    ],
    severity: 'error',
  },
  {
    pattern: /rate.?limit|429|too many requests/i,
    diagnosis: '触发了 API 速率限制。',
    suggestions: [
      '增加请求间隔时间',
      '减少并发 Agent 数量',
      '考虑升级 API 订阅计划',
      '使用 exponential backoff 重试策略',
    ],
    severity: 'warning',
  },
  {
    pattern: /unauthorized|401|invalid.*api.?key|authentication/i,
    diagnosis: 'API 认证失败，密钥可能无效或过期。',
    suggestions: [
      '检查 API Key 是否正确配置',
      '确认 API Key 未过期',
      '检查环境变量中的密钥是否被正确加载',
      '验证 API Key 对应的账户权限',
    ],
    severity: 'error',
  },
  {
    pattern: /context.?length|token.*limit|max.?tokens|context.?window/i,
    diagnosis: '输入或输出超过了模型的上下文窗口限制。',
    suggestions: [
      '减少 system prompt 的长度',
      '将大任务拆分为多个小任务',
      '使用上下文窗口更大的模型',
      '清理不必要的对话历史',
    ],
    severity: 'error',
  },
  {
    pattern: /connection|ECONNREFUSED|ENOTFOUND|network/i,
    diagnosis: '网络连接失败，无法访问 API 服务。',
    suggestions: [
      '检查网络连接状态',
      '确认 VPN/代理服务已启动（端口 127.0.0.1:7892）',
      '验证 API endpoint URL 是否正确',
      '检查防火墙设置是否阻止了连接',
    ],
    severity: 'error',
  },
  {
    pattern: /model.?not.?found|404.*model|invalid.?model/i,
    diagnosis: '指定的模型不存在或不可用。',
    suggestions: [
      '检查模型名称拼写是否正确',
      '确认该模型在当前 provider 下可用',
      '尝试切换到其他可用模型',
      '检查模型是否已废弃或需要特殊访问权限',
    ],
    severity: 'error',
  },
  {
    pattern: /content.?filter|safety|blocked|policy/i,
    diagnosis: '内容被安全过滤器拦截。',
    suggestions: [
      '检查任务描述是否包含敏感内容',
      '尝试重新措辞任务描述',
      '如果误触发，考虑调整 temperature 参数',
    ],
    severity: 'warning',
  },
  {
    pattern: /out.?of.?memory|OOM|memory/i,
    diagnosis: '系统内存不足。',
    suggestions: [
      '减少并发执行的任务数量',
      '关闭不需要的进程释放内存',
      '增加系统可用内存',
      '优化 Agent 处理的数据量',
    ],
    severity: 'error',
  },
];

/**
 * 分析错误消息并提供诊断建议
 */
export function diagnoseError(errorMessage: string): ErrorDiagnosis[] {
  if (!errorMessage.trim()) return [];

  const results: ErrorDiagnosis[] = [];
  for (const pat of ERROR_PATTERNS) {
    if (pat.pattern.test(errorMessage)) {
      results.push({
        errorPattern: pat.pattern.source,
        diagnosis: pat.diagnosis,
        suggestions: pat.suggestions,
        severity: pat.severity,
      });
    }
  }

  // 如果没有匹配到已知模式，返回通用建议
  if (results.length === 0) {
    results.push({
      errorPattern: 'unknown',
      diagnosis: '遇到未知错误类型。',
      suggestions: [
        '查看完整错误日志获取更多信息',
        '尝试重新执行任务',
        '检查相关配置是否正确',
        '如果问题持续，尝试简化任务描述',
      ],
      severity: 'error',
    });
  }

  return results;
}

/**
 * 从日志中提取错误信息
 */
export function extractErrorsFromLogs(logs: LogEntry[]): LogEntry[] {
  return logs.filter((log) => log.level === 'error').slice(-20);
}

// ── 纯函数：工作流优化分析 ──────────────────────────────────

/**
 * 分析工作流依赖图，识别优化机会
 */
export function analyzeWorkflow(nodes: WorkflowNode[]): WorkflowOptimization[] {
  if (nodes.length < 2) return [];

  const optimizations: WorkflowOptimization[] = [];
  const depsMap = new Map<string, string[]>();
  nodes.forEach((n) => depsMap.set(n.id, n.dependencies));

  // 1. 识别可并行执行的节点
  const parallelGroups = findParallelGroups(nodes, depsMap);
  for (const group of parallelGroups) {
    if (group.length > 1) {
      optimizations.push({
        type: 'parallel',
        title: `${group.length} 个节点可并行执行`,
        description: `节点 [${group.join(', ')}] 之间无依赖关系，可配置为并行执行以缩短总耗时。`,
        affectedNodes: group,
      });
    }
  }

  // 2. 识别冗余依赖
  const redundantDeps = findRedundantDependencies(nodes, depsMap);
  for (const [nodeId, redundant] of redundantDeps) {
    optimizations.push({
      type: 'redundant',
      title: `节点 "${nodeId}" 存在冗余依赖`,
      description: `依赖 [${redundant.join(', ')}] 可通过传递性隐含，移除可简化依赖图。`,
      affectedNodes: [nodeId, ...redundant],
    });
  }

  // 3. 识别长链
  const longChains = findLongChains(nodes, depsMap);
  for (const chain of longChains) {
    if (chain.length >= 4) {
      optimizations.push({
        type: 'chain',
        title: `检测到 ${chain.length} 级依赖链`,
        description: `链路 [${chain.join(' -> ')}] 较长，中间节点的故障会阻塞后续所有节点。考虑加入并行路径或检查点。`,
        affectedNodes: chain,
      });
    }
  }

  // 4. 识别瓶颈节点（被大量节点依赖）
  const bottlenecks = findBottlenecks(nodes, depsMap);
  for (const [nodeId, count] of bottlenecks) {
    optimizations.push({
      type: 'bottleneck',
      title: `"${nodeId}" 是瓶颈节点`,
      description: `该节点被 ${count} 个其他节点依赖，其失败或延迟将影响大量下游任务。`,
      affectedNodes: [nodeId],
    });
  }

  return optimizations;
}

/** 查找可并行执行的节点组 */
function findParallelGroups(
  nodes: WorkflowNode[],
  depsMap: Map<string, string[]>
): string[][] {
  // 按依赖深度分组
  const levels = new Map<string, number>();
  const computed = new Set<string>();

  function getLevel(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    const deps = depsMap.get(id) || [];
    if (deps.length === 0) {
      levels.set(id, 0);
      return 0;
    }
    const maxDepLevel = Math.max(...deps.map((d) => getLevel(d) + 1));
    levels.set(id, maxDepLevel);
    return maxDepLevel;
  }

  nodes.forEach((n) => getLevel(n.id));

  // 按层级分组
  const byLevel = new Map<number, string[]>();
  for (const [id, level] of levels) {
    const arr = byLevel.get(level) || [];
    arr.push(id);
    byLevel.set(level, arr);
  }

  return Array.from(byLevel.values()).filter((g) => g.length > 1);
}

/** 查找冗余依赖（传递性可推导的依赖） */
function findRedundantDependencies(
  nodes: WorkflowNode[],
  depsMap: Map<string, string[]>
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const node of nodes) {
    const directDeps = depsMap.get(node.id) || [];
    if (directDeps.length < 2) continue;

    // 收集所有间接依赖
    const transitiveDeps = new Set<string>();
    const visited = new Set<string>();

    function collectTransitive(id: string) {
      if (visited.has(id)) return;
      visited.add(id);
      const deps = depsMap.get(id) || [];
      for (const d of deps) {
        transitiveDeps.add(d);
        collectTransitive(d);
      }
    }

    for (const dep of directDeps) {
      collectTransitive(dep);
    }

    // 直接依赖中，若被其他直接依赖的传递闭包包含，则为冗余
    const redundant = directDeps.filter((d) => {
      // 检查 d 是否在其他直接依赖的传递闭包中
      for (const otherDep of directDeps) {
        if (otherDep === d) continue;
        const otherTransitive = new Set<string>();
        const vis = new Set<string>();
        function collect(id: string) {
          if (vis.has(id)) return;
          vis.add(id);
          const deps = depsMap.get(id) || [];
          for (const dd of deps) {
            otherTransitive.add(dd);
            collect(dd);
          }
        }
        collect(otherDep);
        if (otherTransitive.has(d)) return true;
      }
      return false;
    });

    if (redundant.length > 0) {
      result.set(node.id, redundant);
    }
  }

  return result;
}

/** 查找长依赖链 */
function findLongChains(
  nodes: WorkflowNode[],
  depsMap: Map<string, string[]>
): string[][] {
  const chains: string[][] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // 找到叶子节点（不被任何其他节点依赖）
  const dependedOn = new Set<string>();
  for (const deps of depsMap.values()) {
    deps.forEach((d) => dependedOn.add(d));
  }
  const leaves = nodes.filter((n) => !dependedOn.has(n.id));

  function traceChain(nodeId: string, path: string[]): string[] {
    const deps = depsMap.get(nodeId) || [];
    if (deps.length === 0) return [...path, nodeId];

    let longestChain = [...path, nodeId];
    for (const dep of deps) {
      const chain = traceChain(dep, [...path, nodeId]);
      if (chain.length > longestChain.length) {
        longestChain = chain;
      }
    }
    return longestChain;
  }

  for (const leaf of leaves) {
    const chain = traceChain(leaf.id, []);
    if (chain.length >= 4) {
      chains.push(chain);
    }
  }

  return chains;
}

/** 查找瓶颈节点 */
function findBottlenecks(
  nodes: WorkflowNode[],
  depsMap: Map<string, string[]>
): Array<[string, number]> {
  const depCount = new Map<string, number>();
  for (const deps of depsMap.values()) {
    for (const d of deps) {
      depCount.set(d, (depCount.get(d) || 0) + 1);
    }
  }

  return Array.from(depCount.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);
}
