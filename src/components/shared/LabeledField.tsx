'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SelectTrigger } from '@/components/ui/select';

export function LabeledField({ label, children }: { label: string; children?: React.ReactNode }) {
  const generatedId = React.useId();
  const control = React.isValidElement<{ id?: string }>(children)
    && (children.type === Input || children.type === Textarea || children.type === 'input' || children.type === 'textarea' || children.type === 'select')
    ? children : null;
  const controlId = control?.props.id || generatedId;
  const labelSelects = (nodes: React.ReactNode): React.ReactNode => React.Children.map(nodes, (node) => {
    if (!React.isValidElement<{ children?: React.ReactNode; 'aria-label'?: string; 'aria-labelledby'?: string }>(node)) return node;
    if (node.type === SelectTrigger) return React.cloneElement(node, {
      'aria-labelledby': node.props['aria-label'] || node.props['aria-labelledby'] ? node.props['aria-labelledby'] : `${generatedId}-label`,
    });
    return node.props.children ? React.cloneElement(node, { children: labelSelects(node.props.children) }) : node;
  });
  return (
    <div className="space-y-2" role="group" aria-labelledby={`${generatedId}-label`}>
      <Label id={`${generatedId}-label`} htmlFor={control ? controlId : undefined} className="text-sm font-medium leading-6 text-foreground">{label}</Label>
      {control ? React.cloneElement(control, { id: controlId }) : labelSelects(children)}
    </div>
  );
}
