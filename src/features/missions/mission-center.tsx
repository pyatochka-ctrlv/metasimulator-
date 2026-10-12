"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock, Target } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { MISSIONS, MISSION_TYPE_LABEL, PASS_SCORE } from "@/content/missions";
import type { LearningLevel } from "@/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/common";
import { bestScores, LEVEL_LABELS } from "@/features/learning/progress";
import { ScoreBadge } from "./assessment-report";

export function MissionCenter() {
  const attempts = useAppStore((s) => s.missionAttempts);
  const scores = useMemo(() => bestScores(attempts), [attempts]);
  const inProgress = new Set(Object.values(attempts).filter((a) => a.status === "in_progress").map((a) => a.missionId));
  const [level, setLevel] = useState<LearningLevel | "all">("all");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "todo" | "passed" | "progress">("all");

  const list = MISSIONS.filter((m) => {
    if (level !== "all" && m.level !== level) return false;
    if (type !== "all" && m.type !== type) return false;
    const passed = (scores[m.id] ?? 0) >= PASS_SCORE;
    if (status === "passed" && !passed) return false;
    if (status === "todo" && (passed || inProgress.has(m.id))) return false;
    if (status === "progress" && !inProgress.has(m.id)) return false;
    return true;
  });

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Mission Center"
        description="Практичні брифи від запуску першої кампанії до аудиту й звіту клієнту. Кожна місія — окремий навчальний акаунт зі сценарієм."
        actions={
          <span className="text-xs text-muted-foreground">
            Зараховано: <b>{Object.values(scores).filter((s) => s >= PASS_SCORE).length}</b> / {MISSIONS.length}
          </span>
        }
      />
      <div className="flex flex-wrap gap-2 border-b bg-surface px-4 py-2 sm:px-6">
        <Select value={level} onValueChange={(v) => setLevel(v as LearningLevel | "all")}>
          <SelectTrigger className="h-8 w-56" aria-label="Рівень">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Усі рівні</SelectItem>
            {(Object.keys(LEVEL_LABELS) as LearningLevel[]).map((l) => (
              <SelectItem key={l} value={l}>
                {LEVEL_LABELS[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-44" aria-label="Тип">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Усі типи</SelectItem>
            {Object.entries(MISSION_TYPE_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-8 w-44" aria-label="Статус">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Усі статуси</SelectItem>
            <SelectItem value="todo">Не розпочаті</SelectItem>
            <SelectItem value="progress">В процесі</SelectItem>
            <SelectItem value="passed">Зараховані</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="p-4 sm:p-6">
        {list.length === 0 ? (
          <EmptyState title="Немає місій за фільтрами" />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="data-table w-full min-w-[760px] text-[13px]">
              <thead>
                <tr>
                  <th scope="col" className="w-10">№</th>
                  <th scope="col">Місія</th>
                  <th scope="col">Рівень</th>
                  <th scope="col">Тип</th>
                  <th scope="col">Час</th>
                  <th scope="col">Найкращий бал</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const score = scores[m.id];
                  return (
                    <tr key={m.id}>
                      <td className="num text-muted-foreground">{m.number}</td>
                      <td className="max-w-[420px] whitespace-normal">
                        <Link href={`/missions/${m.id}`} className="font-medium text-primary hover:underline">
                          {m.title}
                        </Link>
                        <p className="text-2xs text-muted-foreground">{m.summary}</p>
                      </td>
                      <td>
                        <Badge variant="secondary">{LEVEL_LABELS[m.level]}</Badge>
                      </td>
                      <td>{MISSION_TYPE_LABEL[m.type]}</td>
                      <td className="text-xs text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />~{m.estimatedMinutes} хв
                      </td>
                      <td>{score !== undefined ? <ScoreBadge score={score} /> : inProgress.has(m.id) ? <Badge variant="info">в процесі</Badge> : <span className="text-2xs text-muted-foreground">—</span>}</td>
                      <td className="text-right">
                        <Button size="xs" variant={inProgress.has(m.id) ? "default" : "outline"} asChild>
                          <Link href={`/missions/${m.id}`}>
                            <Target /> {inProgress.has(m.id) ? "Продовжити" : score !== undefined ? "Переглянути" : "Відкрити бриф"}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
