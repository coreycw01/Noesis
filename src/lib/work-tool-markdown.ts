import type { WorkToolData } from './types';

export function serializeWorkToolMarkdown(label: string, data: WorkToolData) {
  const sections = Object.entries(data.fields || {})
    .filter(([, value]) => value.trim())
    .map(([field, value]) => `### ${field.replace(/_/g, ' ')}\n\n${value}`);

  if (data.mindMapNodes?.length) {
    const nodes = new Map(data.mindMapNodes.map((node) => [node.id, node]));
    const branches = data.mindMapNodes.map((node) => {
      const name = node.label.trim() || 'Untitled branch';
      if (!node.parentId) return `- ${name}`;
      const parent = nodes.get(node.parentId);
      return parent ? `- ${parent.label.trim() || 'Untitled branch'} -> ${name}` : `- ${name}`;
    });
    sections.push(`### Branches\n\n${branches.join('\n')}`);
  } else {
    const branches = (data.branches || []).filter((branch) => branch.trim());
    if (branches.length) sections.push(`### Branches\n\n${branches.map((branch) => `- ${branch}`).join('\n')}`);
  }

  if (data.timeline?.length) {
    const entries = data.timeline.map((entry) =>
      `#### ${entry.date || 'Untitled stage'}${entry.branch ? ` · ${entry.branch}` : ''}: ${entry.title || 'Untitled event'}\n${entry.detail}`,
    );
    sections.push(`### Timeline\n\n${entries.join('\n\n')}`);
  }

  return sections.length ? [`## ${label}`, ...sections].join('\n\n') : '';
}
