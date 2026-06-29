"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Archive, GripVertical, Plus, Save, Target, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MEDIA_LABELS, MEDIA_TYPES, today, uid } from '@/lib/readex';
import type { GoalItem, GoalSettings, GoalType, MediaType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface GoalsPageProps {
  goal: GoalSettings;
  goalProgress: Partial<Record<MediaType, number>>;
  onSaveGoal: (goal: GoalSettings) => Promise<void>;
}

function defaultTypesFromLegacy(goal: GoalSettings): GoalType[] {
  if (goal.goalTypes?.length) return goal.goalTypes;
  const legacyTypes: MediaType[] = goal.types?.length ? goal.types : ['book', 'audiobook', 'podcast'];
  return legacyTypes.map((type, index) => ({
    id: `${type}-type`,
    name: MEDIA_LABELS[type],
    mediaTypes: [type],
    sortOrder: index,
    createdAt: today(),
    updatedAt: today(),
  }));
}

function defaultGoalsFromLegacy(goal: GoalSettings, types: GoalType[], progress: Partial<Record<MediaType, number>>): GoalItem[] {
  if (goal.goals?.length) {
    return goal.goals.map((item, index) => ({ ...item, sortOrder: item.sortOrder ?? index }));
  }
  return types.map((type, index) => {
    const mediaTypes = type.mediaTypes?.length ? type.mediaTypes : [];
    const currentProgress = mediaTypes.reduce((sum, mediaType) => sum + (progress[mediaType] || 0), 0);
    const targetProgress = mediaTypes.reduce((sum, mediaType) => sum + (goal.targets?.[mediaType] || 12), 0) || 12;
    return {
      id: `${type.id}-goal`,
      title: type.name,
      typeId: type.id,
      currentProgress,
      targetProgress,
      sortOrder: index,
      status: 'active' as const,
      createdAt: today(),
      updatedAt: today(),
    };
  });
}

export function GoalsPage({ goal, goalProgress, onSaveGoal }: GoalsPageProps) {
  const [draft, setDraft] = useState<GoalSettings>(goal);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const goalTypes = defaultTypesFromLegacy(goal);
    setDraft({
      ...goal,
      goalTypes,
      goals: defaultGoalsFromLegacy(goal, goalTypes, goalProgress),
    });
  }, [goal, goalProgress]);

  const goalTypes = useMemo(() => [...(draft.goalTypes || [])].sort((a, b) => a.sortOrder - b.sortOrder), [draft.goalTypes]);
  const activeGoalTypes = goalTypes.filter((type) => !type.archivedAt);
  const goals = useMemo(() => [...(draft.goals || [])].sort((a, b) => a.sortOrder - b.sortOrder), [draft.goals]);
  const activeGoals = goals.filter((item) => item.status === 'active');

  const enrichedGoals = useMemo(() => activeGoals.map((item) => {
    const type = goalTypes.find((goalType) => goalType.id === item.typeId);
    const mediaProgress = (type?.mediaTypes || []).reduce((sum, mediaType) => sum + (goalProgress[mediaType] || 0), 0);
    const currentProgress = Math.max(item.currentProgress || 0, mediaProgress);
    const targetProgress = Math.max(1, item.targetProgress || 1);
    return {
      ...item,
      type,
      currentProgress,
      targetProgress,
      percent: Math.min(100, (currentProgress / targetProgress) * 100),
    };
  }), [activeGoals, goalProgress, goalTypes]);

  const featured = [...enrichedGoals].sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  }).slice(0, 3);

  const updateGoal = (id: string, patch: Partial<GoalItem>) => {
    setDraft((prev) => ({
      ...prev,
      goals: (prev.goals || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: today() } : item),
    }));
  };

  const updateType = (id: string, patch: Partial<GoalType>) => {
    setDraft((prev) => ({
      ...prev,
      goalTypes: (prev.goalTypes || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: today() } : item),
    }));
  };

  const addGoalType = () => {
    const name = `New Goal Category ${goalTypes.length + 1}`;
    const typeId = uid();
    const now = today();
    setDraft((prev) => ({
      ...prev,
      goalTypes: [
        ...(prev.goalTypes || []),
        { id: typeId, name, mediaTypes: [], sortOrder: goalTypes.length, createdAt: now, updatedAt: now },
      ],
      goals: [
        ...(prev.goals || []),
        { id: uid(), title: name, typeId, currentProgress: 0, targetProgress: 1, sortOrder: goals.length, status: 'active', createdAt: now, updatedAt: now },
      ],
    }));
  };

  const archiveType = (type: GoalType) => {
    const used = goals.some((item) => item.typeId === type.id && item.status !== 'archived');
    if (used) {
      updateType(type.id, { archivedAt: today() });
      toast({ title: 'Goal type archived', description: 'Existing goals keep their history and no longer become orphaned.' });
      return;
    }
    setDraft((prev) => ({ ...prev, goalTypes: (prev.goalTypes || []).filter((item) => item.id !== type.id) }));
  };

  const addGoal = () => {
    const typeId = activeGoalTypes[0]?.id || goalTypes[0]?.id;
    if (!typeId) return;
    if ((draft.goals || []).some((item) => item.typeId === typeId && item.status === 'active')) {
      toast({ title: 'Goal category already added', description: 'Each goal category can appear only once in this goal set.' });
      return;
    }
    const now = today();
    setDraft((prev) => ({
      ...prev,
      goals: [
        ...(prev.goals || []),
        { id: uid(), title: activeGoalTypes.find((type) => type.id === typeId)?.name || 'New Goal Category', typeId, currentProgress: 0, targetProgress: 1, sortOrder: goals.length, status: 'active', createdAt: now, updatedAt: now },
      ],
    }));
  };

  const reorderGoal = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ordered = [...goals];
    const from = ordered.findIndex((item) => item.id === fromId);
    const to = ordered.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    setDraft((prev) => ({
      ...prev,
      goals: ordered.map((item, index) => ({ ...item, sortOrder: index, updatedAt: today() })),
    }));
  };

  const saveGoals = async () => {
    const trimmedLabel = draft.label.trim();
    if (!trimmedLabel) {
      toast({ variant: 'destructive', title: 'Goal set name required', description: 'Give this goal set a name before saving.' });
      return;
    }
    const cleanedTypes = (draft.goalTypes || []).map((type) => ({ ...type, name: type.name.trim() }));
    const duplicateNames = new Set<string>();
    for (const type of cleanedTypes) {
      if (!type.name) {
        toast({ variant: 'destructive', title: 'Goal category name required', description: 'Every goal category needs a name.' });
        return;
      }
      const key = type.name.toLowerCase();
      if (duplicateNames.has(key)) {
        toast({ variant: 'destructive', title: 'Duplicate goal category', description: 'Goal category names need to stay distinct.' });
        return;
      }
      duplicateNames.add(key);
      if (new Set(type.mediaTypes || []).size !== (type.mediaTypes || []).length) {
        toast({ variant: 'destructive', title: 'Duplicate media type', description: `Remove repeated media types from ${type.name}.` });
        return;
      }
    }
    setSaving(true);
    try {
      await onSaveGoal({ ...draft, label: trimmedLabel, goalTypes: cleanedTypes });
      toast({ title: 'Goal set updated', description: 'Your categories, targets, and ordering are now synced.' });
    } catch {
      toast({ variant: 'destructive', title: 'Goals not saved', description: 'Noesis could not update your goals.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8 pt-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-headline font-semibold italic text-foreground/80">Goals</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Define the progress measures that matter to your philosophy, then let the closest goals surface automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={addGoalType} className="rounded-full bg-card">
              <Plus className="mr-2 size-4" /> New Goal Category
            </Button>
            <Button variant="outline" onClick={addGoal} className="rounded-full bg-card">
              <Plus className="mr-2 size-4" /> Add Goal Category
            </Button>
            <Button onClick={saveGoals} disabled={saving} className="rounded-full px-7 font-bold shadow-md shadow-accent/20">
              <Save className="mr-2 size-4" /> {saving ? 'Saving' : 'Save Goals'}
            </Button>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {featured.map((row) => (
            <Card key={row.id} className="rounded-xl border-accent/20 bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-code text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Closest To Complete</div>
                  <h2 className="mt-1 font-headline text-2xl font-bold italic">{row.title}</h2>
                </div>
                <Target className="size-5 text-accent" />
              </div>
              <div className="mb-3 flex items-end justify-between">
                <span className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{Math.round(row.percent)}%</span>
                <span className="font-headline text-3xl font-bold italic">{row.currentProgress}/{row.targetProgress}</span>
              </div>
              <Progress value={row.percent} className="h-2" />
            </Card>
          ))}
          {!featured.length && (
            <Card className="rounded-xl border-dashed bg-card p-6 text-sm italic text-muted-foreground md:col-span-3">
              Add an active goal to see your top progress cards.
            </Card>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <Label className="readex-kicker text-[9px] font-bold uppercase">Goal Set Name</Label>
              <Input value={draft.label} onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))} className="mt-2 h-11 max-w-xl rounded-full" />
            </div>

            <div className="grid gap-3">
              {enrichedGoals.map((row) => (
                <div
                  key={row.id}
                  draggable
                  onDragStart={() => setDraggedId(row.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => draggedId && reorderGoal(draggedId, row.id)}
                  className="grid grid-cols-[auto_1.3fr_180px_110px_auto] items-center gap-3 rounded-xl border border-border bg-background/50 p-3 transition-colors hover:border-accent/30"
                >
                  <GripVertical className="size-4 cursor-grab text-muted-foreground/50" />
                  <div>
                    <Input value={row.title} onChange={(event) => updateGoal(row.id, { title: event.target.value })} className="h-9 rounded-full font-headline text-base italic" />
                    <div className="mt-2 font-code text-[8px] uppercase tracking-widest text-muted-foreground">
                      {(row.type?.mediaTypes || []).length ? `Counts: ${(row.type?.mediaTypes || []).map((mediaType) => MEDIA_LABELS[mediaType]).join(', ')}` : 'No media types selected yet'}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                  <Select value={row.typeId} onValueChange={(value) => updateGoal(row.id, { typeId: value })}>
                    <SelectTrigger className="h-9 rounded-full font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {activeGoalTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="h-9 rounded-full border border-border bg-card px-4 font-code text-xs flex items-center justify-end">
                    {row.currentProgress}
                  </div>
                  <Input type="number" min={1} value={row.targetProgress} onChange={(event) => updateGoal(row.id, { targetProgress: Math.max(1, Number(event.target.value) || 1) })} className="h-9 rounded-full text-right font-code text-xs" />
                  <Button variant="ghost" size="icon" onClick={() => updateGoal(row.id, { status: 'archived' })} className="rounded-full text-muted-foreground hover:text-destructive">
                    <Archive className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
            <h2 className="font-code text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Goal Categories</h2>
            <p className="mt-2 text-xs italic text-muted-foreground">A goal category is a custom bucket like Books or Articles. Included media types determine what gets counted.</p>
            <div className="mt-5 space-y-3">
              {goalTypes.map((type) => (
                <div key={type.id} className={cn('rounded-xl border p-3', type.archivedAt ? 'bg-muted/20 opacity-55' : 'bg-background/50')}>
                  <div className="flex items-center gap-2">
                    <Input value={type.name} onChange={(event) => updateType(type.id, { name: event.target.value })} className="h-9 rounded-full text-sm font-bold" />
                    <Button variant="ghost" size="icon" onClick={() => archiveType(type)} className="rounded-full text-muted-foreground hover:text-destructive">
                      {type.archivedAt ? <Trash2 className="size-4" /> : <Archive className="size-4" />}
                    </Button>
                  </div>
                  <div className="mt-3 font-code text-[8px] uppercase tracking-widest text-muted-foreground">Included Media Types</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {MEDIA_TYPES.map((mediaType) => {
                      const active = (type.mediaTypes || []).includes(mediaType);
                      return (
                        <button
                          key={mediaType}
                          onClick={() => updateType(type.id, {
                            mediaTypes: active
                              ? (type.mediaTypes || []).filter((item) => item !== mediaType)
                              : [...(type.mediaTypes || []), mediaType],
                          })}
                          className={cn(
                            'rounded-full border px-2.5 py-1 font-code text-[8px] uppercase tracking-widest',
                            active ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-muted-foreground'
                          )}
                        >
                          {MEDIA_LABELS[mediaType]}
                        </button>
                      );
                    })}
                  </div>
                  {type.archivedAt && <Badge variant="outline" className="mt-3 rounded-full font-code text-[8px] uppercase">Archived</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
