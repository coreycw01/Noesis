"use client";

import React, { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AtlasHealthRow } from './atlas-diagnostics';

interface AtlasHealthTableProps {
  rows: AtlasHealthRow[];
  onOpenPosition: (id: string) => void;
}

type HealthSort = 'weakest' | 'strongest' | 'stale' | 'tension' | 'recent';

export function AtlasHealthTable({ rows, onOpenPosition }: AtlasHealthTableProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<HealthSort>('weakest');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = rows.filter((row) => {
      if (!query) return true;
      return `${row.position.title} ${row.position.statement} ${row.position.description} ${row.healthLabel} ${row.nextAction}`.toLowerCase().includes(query);
    });

    return [...base].sort((a, b) => {
      switch (sort) {
        case 'strongest':
          return (b.supportCount - b.challengeCount + b.linkedPractices.length) - (a.supportCount - a.challengeCount + a.linkedPractices.length);
        case 'stale':
          return Date.parse(a.lastRevised || a.position.dateUpdated) - Date.parse(b.lastRevised || b.position.dateUpdated);
        case 'tension':
          return b.tensionLevel - a.tensionLevel;
        case 'recent':
          return Date.parse(b.lastRevised || b.position.dateUpdated) - Date.parse(a.lastRevised || a.position.dateUpdated);
        case 'weakest':
        default:
          return a.tensionLevel - b.tensionLevel === 0
            ? a.supportCount - b.supportCount
            : b.tensionLevel - a.tensionLevel;
      }
    });
  }, [rows, search, sort]);

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Idea Health</Badge>
            <h2 className="mt-3 font-headline text-3xl font-semibold italic text-foreground">Which ideas are strong, weak, untested, stale, or conflicted?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              Use this table for weekly review. It turns positions into a diagnostic surface so the app can point to what needs work next.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search positions..." className="h-10 w-72 rounded-full" />
            <Select value={sort} onValueChange={(value) => setSort(value as HealthSort)}>
              <SelectTrigger className="h-10 w-48 rounded-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weakest">Weakest First</SelectItem>
                <SelectItem value="strongest">Strongest First</SelectItem>
                <SelectItem value="stale">Stalest First</SelectItem>
                <SelectItem value="tension">Highest Tension</SelectItem>
                <SelectItem value="recent">Recently Revised</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card/85 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Support</TableHead>
              <TableHead>Challenge</TableHead>
              <TableHead>Practice</TableHead>
              <TableHead>Last Revised</TableHead>
              <TableHead>Tension</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Next Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.position.id} className="cursor-pointer" onClick={() => onOpenPosition(row.position.id)}>
                <TableCell className="max-w-[240px]">
                  <div className="font-headline text-lg font-semibold italic text-foreground">{row.position.title}</div>
                  <div className="line-clamp-2 text-sm text-muted-foreground">{row.position.statement || row.position.description}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">{row.position.status}</Badge>
                </TableCell>
                <TableCell>{row.position.confidenceScore ?? row.position.confidence ?? 0}%</TableCell>
                <TableCell>{row.supportCount}</TableCell>
                <TableCell>{row.challengeCount}</TableCell>
                <TableCell>{row.practiceLinked ? 'Yes' : 'No'}</TableCell>
                <TableCell>{new Date(row.lastRevised || row.position.dateUpdated).toLocaleDateString()}</TableCell>
                <TableCell>{row.tensionLevel}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">{row.evidenceQuality}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className="rounded-full bg-muted/30 text-foreground">{row.healthLabel}</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-8 rounded-full px-3" onClick={(event) => { event.stopPropagation(); onOpenPosition(row.position.id); }}>
                    <ArrowUpDown className="mr-1.5 size-3.5" />
                    {row.nextAction}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm italic text-muted-foreground">
                  No positions match this review filter yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
