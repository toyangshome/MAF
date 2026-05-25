import type { Agent, Task, LogEntry, AgentMetric } from '../types';

export interface ReportOptions {
  format: 'html' | 'markdown' | 'json';
  includeAgents: boolean;
  includeTasks: boolean;
  includeLogs: boolean;
  includeMetrics: boolean;
  timeRange?: { start: string; end: string };
}

export interface ReportData {
  agents: Agent[];
  tasks: Task[];
  logs: LogEntry[];
  metrics: AgentMetric[];
}

function filterByTimeRange<T extends { timestamp?: string; createdAt?: string }>(
  items: T[],
  timeRange?: { start: string; end: string },
): T[] {
  if (!timeRange) return items;
  const start = new Date(timeRange.start).getTime();
  const end = new Date(timeRange.end).getTime();
  return items.filter((item) => {
    const ts = item.timestamp ?? item.createdAt;
    if (!ts) return true;
    const t = new Date(ts).getTime();
    return t >= start && t <= end;
  });
}

function computeSummary(data: ReportData) {
  const { tasks, metrics } = data;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const total = tasks.length;
  const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

  let totalDuration = 0;
  let durationCount = 0;
  for (const t of tasks) {
    if (t.completedAt && t.createdAt) {
      totalDuration += new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
      durationCount++;
    }
  }
  const avgDuration = durationCount > 0 ? (totalDuration / durationCount / 1000).toFixed(1) : 'N/A';

  const avgSuccessRate =
    metrics.length > 0
      ? ((metrics.reduce((s, m) => s + m.successRate, 0) / metrics.length) * 100).toFixed(1)
      : 'N/A';

  return { total, completed, failed, successRate, avgDuration, avgSuccessRate };
}

// ── JSON ──────────────────────────────────────────────────────────────

function generateJSON(data: ReportData, options: ReportOptions): string {
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    summary: computeSummary(data),
  };

  if (options.includeAgents) report.agents = data.agents;
  if (options.includeTasks) report.tasks = filterByTimeRange(data.tasks, options.timeRange);
  if (options.includeLogs) report.logs = filterByTimeRange(data.logs, options.timeRange);
  if (options.includeMetrics) report.metrics = data.metrics;

  return JSON.stringify(report, null, 2);
}

// ── Markdown ──────────────────────────────────────────────────────────

function statusBadge(status: string): string {
  return `\`${status}\``;
}

function generateMarkdown(data: ReportData, options: ReportOptions): string {
  const lines: string[] = [];
  const summary = computeSummary(data);
  const now = new Date().toLocaleString();

  lines.push('# MAF Execution Report');
  lines.push('');
  lines.push(`> Generated: ${now}`);
  lines.push('');

  // Summary
  lines.push('## Execution Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Total Tasks | ${summary.total} |`);
  lines.push(`| Completed | ${summary.completed} |`);
  lines.push(`| Failed | ${summary.failed} |`);
  lines.push(`| Task Success Rate | ${summary.successRate}% |`);
  lines.push(`| Agent Avg Success Rate | ${summary.avgSuccessRate}% |`);
  lines.push(`| Avg Duration | ${summary.avgDuration}s |`);
  lines.push('');

  // Agents
  if (options.includeAgents && data.agents.length > 0) {
    lines.push('## Agent Statistics');
    lines.push('');
    lines.push('| Agent | Type | Status | Runs | Success Rate | Avg Duration |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const a of data.agents) {
      const metric = data.metrics.find((m) => m.agentId === a.id);
      lines.push(
        `| ${a.name} | ${a.type} | ${statusBadge(a.status)} | ${metric?.totalRuns ?? 'N/A'} | ${metric ? (metric.successRate * 100).toFixed(1) + '%' : 'N/A'} | ${metric ? metric.avgDuration.toFixed(1) + 's' : 'N/A'} |`,
      );
    }
    lines.push('');
  }

  // Tasks
  if (options.includeTasks) {
    const tasks = filterByTimeRange(data.tasks, options.timeRange);
    if (tasks.length > 0) {
      lines.push('## Task List');
      lines.push('');
      lines.push('| Task | Status | Duration | Result |');
      lines.push('| --- | --- | --- | --- |');
      for (const t of tasks) {
        const duration =
          t.completedAt && t.createdAt
            ? ((new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / 1000).toFixed(1) + 's'
            : '-';
        lines.push(`| ${t.description.slice(0, 60)} | ${statusBadge(t.status)} | ${duration} | ${t.result ?? '-'} |`);
      }
      lines.push('');
    }
  }

  // Metrics
  if (options.includeMetrics && data.metrics.length > 0) {
    lines.push('## Metrics Overview');
    lines.push('');
    for (const m of data.metrics) {
      lines.push(`### ${m.agentName}`);
      lines.push('');
      lines.push(`- Total Runs: ${m.totalRuns}`);
      lines.push(`- Success Rate: ${(m.successRate * 100).toFixed(1)}%`);
      lines.push(`- Avg Duration: ${m.avgDuration.toFixed(1)}s`);
      const lastExec = m.executionTime[m.executionTime.length - 1];
      const lastTokens = m.tokenUsage[m.tokenUsage.length - 1];
      if (lastExec) lines.push(`- Last Execution Time: ${lastExec.value}ms`);
      if (lastTokens) lines.push(`- Last Token Usage: ${lastTokens.value}`);
      lines.push('');
    }
  }

  // Logs
  if (options.includeLogs) {
    const logs = filterByTimeRange(data.logs, options.timeRange);
    if (logs.length > 0) {
      lines.push('## Log Entries');
      lines.push('');
      lines.push('```');
      for (const log of logs.slice(0, 100)) {
        lines.push(`[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`);
      }
      if (logs.length > 100) lines.push(`... and ${logs.length - 100} more entries`);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── HTML ──────────────────────────────────────────────────────────────

function htmlStatusColor(status: string): string {
  const map: Record<string, string> = {
    completed: '#30a46c', done: '#30a46c',
    running: '#3b82f6',
    pending: '#a1a1aa', idle: '#a1a1aa',
    waiting: '#f5a623',
    failed: '#e5484d', error: '#e5484d',
    blocked: '#f5a623',
  };
  return map[status] ?? '#a1a1aa';
}

function htmlStatusBadge(status: string): string {
  const color = htmlStatusColor(status);
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;color:#fff;background:${color}">${status}</span>`;
}

function generateHTML(data: ReportData, options: ReportOptions): string {
  const summary = computeSummary(data);
  const now = new Date().toLocaleString();

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>MAF Execution Report</title>
</head>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#111;color:#e0e0e0;line-height:1.6;">
<div style="max-width:960px;margin:0 auto;">

<h1 style="font-size:24px;font-weight:700;color:#fff;margin-bottom:4px;">MAF Execution Report</h1>
<p style="font-size:13px;color:#888;margin-top:0;">Generated: ${now}</p>

<!-- Summary -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:24px 0;">
  <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:28px;font-weight:700;color:#fff;">${summary.total}</div>
    <div style="font-size:12px;color:#888;margin-top:4px;">Total Tasks</div>
  </div>
  <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:28px;font-weight:700;color:#30a46c;">${summary.completed}</div>
    <div style="font-size:12px;color:#888;margin-top:4px;">Completed</div>
  </div>
  <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:28px;font-weight:700;color:#e5484d;">${summary.failed}</div>
    <div style="font-size:12px;color:#888;margin-top:4px;">Failed</div>
  </div>
  <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:28px;font-weight:700;color:#3b82f6;">${summary.successRate}%</div>
    <div style="font-size:12px;color:#888;margin-top:4px;">Success Rate</div>
  </div>
  <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:28px;font-weight:700;color:#f5a623;">${summary.avgDuration}s</div>
    <div style="font-size:12px;color:#888;margin-top:4px;">Avg Duration</div>
  </div>
</div>
`;

  // Agents
  if (options.includeAgents && data.agents.length > 0) {
    html += `
<h2 style="font-size:18px;font-weight:600;color:#fff;margin-top:32px;border-bottom:1px solid #333;padding-bottom:8px;">Agent Statistics</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<thead>
<tr style="border-bottom:2px solid #333;">
  <th style="text-align:left;padding:8px;color:#888;">Agent</th>
  <th style="text-align:left;padding:8px;color:#888;">Type</th>
  <th style="text-align:left;padding:8px;color:#888;">Status</th>
  <th style="text-align:right;padding:8px;color:#888;">Runs</th>
  <th style="text-align:right;padding:8px;color:#888;">Success Rate</th>
  <th style="text-align:right;padding:8px;color:#888;">Avg Duration</th>
</tr>
</thead>
<tbody>`;
    for (const a of data.agents) {
      const metric = data.metrics.find((m) => m.agentId === a.id);
      html += `
<tr style="border-bottom:1px solid #222;">
  <td style="padding:8px;font-weight:500;color:#fff;">${a.name}</td>
  <td style="padding:8px;">${a.type}</td>
  <td style="padding:8px;">${htmlStatusBadge(a.status)}</td>
  <td style="padding:8px;text-align:right;">${metric?.totalRuns ?? 'N/A'}</td>
  <td style="padding:8px;text-align:right;">${metric ? (metric.successRate * 100).toFixed(1) + '%' : 'N/A'}</td>
  <td style="padding:8px;text-align:right;">${metric ? metric.avgDuration.toFixed(1) + 's' : 'N/A'}</td>
</tr>`;
    }
    html += `
</tbody>
</table>`;
  }

  // Tasks
  if (options.includeTasks) {
    const tasks = filterByTimeRange(data.tasks, options.timeRange);
    if (tasks.length > 0) {
      html += `
<h2 style="font-size:18px;font-weight:600;color:#fff;margin-top:32px;border-bottom:1px solid #333;padding-bottom:8px;">Task List</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<thead>
<tr style="border-bottom:2px solid #333;">
  <th style="text-align:left;padding:8px;color:#888;">Description</th>
  <th style="text-align:left;padding:8px;color:#888;">Status</th>
  <th style="text-align:right;padding:8px;color:#888;">Duration</th>
  <th style="text-align:left;padding:8px;color:#888;">Result</th>
</tr>
</thead>
<tbody>`;
      for (const t of tasks) {
        const duration =
          t.completedAt && t.createdAt
            ? ((new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / 1000).toFixed(1) + 's'
            : '-';
        html += `
<tr style="border-bottom:1px solid #222;">
  <td style="padding:8px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.description}</td>
  <td style="padding:8px;">${htmlStatusBadge(t.status)}</td>
  <td style="padding:8px;text-align:right;">${duration}</td>
  <td style="padding:8px;color:#888;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.result ?? '-'}</td>
</tr>`;
      }
      html += `
</tbody>
</table>`;
    }
  }

  // Metrics
  if (options.includeMetrics && data.metrics.length > 0) {
    html += `
<h2 style="font-size:18px;font-weight:600;color:#fff;margin-top:32px;border-bottom:1px solid #333;padding-bottom:8px;">Metrics Overview</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<thead>
<tr style="border-bottom:2px solid #333;">
  <th style="text-align:left;padding:8px;color:#888;">Agent</th>
  <th style="text-align:right;padding:8px;color:#888;">Total Runs</th>
  <th style="text-align:right;padding:8px;color:#888;">Success Rate</th>
  <th style="text-align:right;padding:8px;color:#888;">Avg Duration</th>
  <th style="text-align:right;padding:8px;color:#888;">Token Usage (last)</th>
</tr>
</thead>
<tbody>`;
    for (const m of data.metrics) {
      const lastTokens = m.tokenUsage[m.tokenUsage.length - 1];
      html += `
<tr style="border-bottom:1px solid #222;">
  <td style="padding:8px;font-weight:500;color:#fff;">${m.agentName}</td>
  <td style="padding:8px;text-align:right;">${m.totalRuns}</td>
  <td style="padding:8px;text-align:right;">${(m.successRate * 100).toFixed(1)}%</td>
  <td style="padding:8px;text-align:right;">${m.avgDuration.toFixed(1)}s</td>
  <td style="padding:8px;text-align:right;">${lastTokens ? lastTokens.value : 'N/A'}</td>
</tr>`;
    }
    html += `
</tbody>
</table>`;
  }

  // Logs
  if (options.includeLogs) {
    const logs = filterByTimeRange(data.logs, options.timeRange);
    if (logs.length > 0) {
      const levelColor: Record<string, string> = { info: '#3b82f6', warn: '#f5a623', error: '#e5484d', debug: '#888' };
      html += `
<h2 style="font-size:18px;font-weight:600;color:#fff;margin-top:32px;border-bottom:1px solid #333;padding-bottom:8px;">Log Entries <span style="font-size:13px;color:#888;font-weight:400;">(${Math.min(logs.length, 100)} of ${logs.length})</span></h2>
<div style="background:#0d0d0d;border:1px solid #222;border-radius:8px;padding:16px;font-family:'SF Mono',Consolas,monospace;font-size:12px;max-height:400px;overflow-y:auto;">`;
      for (const log of logs.slice(0, 100)) {
        const ts = new Date(log.timestamp).toLocaleTimeString();
        const lc = levelColor[log.level] ?? '#888';
        html += `<div style="margin-bottom:4px;"><span style="color:#555;">${ts}</span> <span style="color:${lc};font-weight:600;">[${log.level.toUpperCase()}]</span> <span style="color:#888;">[${log.source}]</span> ${log.message}</div>`;
      }
      if (logs.length > 100) {
        html += `<div style="color:#555;margin-top:8px;">... and ${logs.length - 100} more entries</div>`;
      }
      html += `</div>`;
    }
  }

  html += `
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #222;font-size:12px;color:#555;text-align:center;">
  MAF Report &mdash; Generated ${now}
</div>
</div>
</body>
</html>`;

  return html;
}

// ── Public API ────────────────────────────────────────────────────────

export function generateReport(data: ReportData, options: ReportOptions): string {
  switch (options.format) {
    case 'json':
      return generateJSON(data, options);
    case 'markdown':
      return generateMarkdown(data, options);
    case 'html':
      return generateHTML(data, options);
  }
}

export function getReportFilename(format: ReportOptions['format']): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'html';
  return `maf-report-${ts}.${ext}`;
}

export function getMimeType(format: ReportOptions['format']): string {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'markdown':
      return 'text/markdown';
    case 'html':
      return 'text/html';
  }
}

export function downloadReport(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
