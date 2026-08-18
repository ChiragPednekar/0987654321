"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIFFICULTIES, DOMAINS } from "@/lib/constants";
import type { Difficulty, Domain } from "@/lib/types/database";

interface Criterion {
  key: string;
  weight: number;
  descriptor: string;
}

const DEFAULT_CRITERIA: Criterion[] = [
  { key: "problem_structuring", weight: 25, descriptor: "" },
  { key: "analysis", weight: 25, descriptor: "" },
  { key: "risk_assessment", weight: 25, descriptor: "" },
  { key: "recommendation", weight: 25, descriptor: "" },
];

export interface CaseFormInitial {
  id: string;
  slug: string;
  title: string;
  domain: Domain;
  difficulty: Difficulty;
  category_id: string | null;
  company_track: string | null;
  estimated_minutes: number;
  scenario: string;
  instructions: string;
  supporting_data: Record<string, unknown> | null;
  expected_framework: string | null;
  model_answer: string | null;
  tags: string[] | null;
  is_published: boolean;
  rubric: {
    criteria: Record<string, number>;
    descriptors: Record<string, string> | null;
    pass_score: number;
  } | null;
}

/** Turns a stored rubric back into the editable row shape. */
function criteriaFrom(initial?: CaseFormInitial): Criterion[] {
  const rubric = initial?.rubric;
  if (!rubric || Object.keys(rubric.criteria ?? {}).length === 0)
    return DEFAULT_CRITERIA;

  return Object.entries(rubric.criteria).map(([key, weight]) => ({
    key,
    weight,
    descriptor: rubric.descriptors?.[key] ?? "",
  }));
}

export function CaseForm({
  categories,
  initial,
}: {
  categories: { id: string; name: string; domain: string }[];
  /** Present when editing an existing case; absent when creating one. */
  initial?: CaseFormInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [saving, setSaving] = React.useState(false);
  const [domain, setDomain] = React.useState<Domain>(
    initial?.domain ?? "consulting",
  );
  const [difficulty, setDifficulty] = React.useState<Difficulty>(
    initial?.difficulty ?? "medium",
  );
  const [categoryId, setCategoryId] = React.useState<string>(
    initial?.category_id ?? "",
  );
  const [criteria, setCriteria] = React.useState<Criterion[]>(
    criteriaFrom(initial),
  );

  const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
  const relevantCategories = categories.filter((c) => c.domain === domain);

  function updateCriterion(index: number, patch: Partial<Criterion>) {
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleaned = criteria.filter((c) => c.key.trim() && c.weight > 0);
    if (cleaned.length === 0) {
      toast.error("Add at least one rubric criterion.");
      return;
    }

    const keys = cleaned.map((c) =>
      c.key.trim().toLowerCase().replace(/\s+/g, "_"),
    );
    if (new Set(keys).size !== keys.length) {
      toast.error("Rubric criteria must have unique names.");
      return;
    }

    setSaving(true);
    const formData = new FormData(event.currentTarget);

    let supportingData: Record<string, unknown> = {};
    const rawSupporting = String(formData.get("supporting_data") ?? "").trim();
    if (rawSupporting) {
      try {
        supportingData = JSON.parse(rawSupporting);
      } catch {
        toast.error("Supporting data must be valid JSON.");
        setSaving(false);
        return;
      }
    }

    const response = await fetch(
      isEdit ? `/api/admin/cases/${initial!.id}` : "/api/admin/cases",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: String(formData.get("title")),
          domain,
          difficulty,
          category_id: categoryId || null,
          company_track: String(formData.get("company_track") || "") || null,
          estimated_minutes: Number(formData.get("estimated_minutes")),
          scenario: String(formData.get("scenario")),
          instructions: String(formData.get("instructions")),
          supporting_data: supportingData,
          expected_framework:
            String(formData.get("expected_framework") || "") || null,
          model_answer: String(formData.get("model_answer") || "") || null,
          tags: String(formData.get("tags") || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          is_published: formData.get("is_published") === "on",
          rubric: {
            criteria: Object.fromEntries(
              cleaned.map((c, i) => [keys[i], c.weight]),
            ),
            descriptors: Object.fromEntries(
              cleaned
                .map((c, i) => [keys[i], c.descriptor.trim()])
                .filter(([, value]) => value),
            ),
            pass_score: Number(formData.get("pass_score")),
          },
        }),
      },
    );

    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      toast.error(
        payload.error ??
          (isEdit ? "Could not save case." : "Could not create case."),
      );
      return;
    }

    toast.success(isEdit ? "Case saved." : "Case created.");
    router.push(`/cases/${payload.slug ?? initial!.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              minLength={5}
              maxLength={200}
              defaultValue={initial?.title}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Domain</Label>
              <Select
                value={domain}
                onValueChange={(value) => {
                  setDomain(value as Domain);
                  setCategoryId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(value as Difficulty)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {relevantCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_track">Company track</Label>
              <Input
                id="company_track"
                name="company_track"
                defaultValue={initial?.company_track ?? ""}
                placeholder="e.g. McKinsey"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_minutes">Estimated minutes</Label>
              <Input
                id="estimated_minutes"
                name="estimated_minutes"
                type="number"
                min={5}
                max={360}
                defaultValue={initial?.estimated_minutes ?? 30}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                name="tags"
                placeholder="pricing, b2b, saas"
                defaultValue={initial?.tags?.join(", ") ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scenario">Scenario (markdown)</Label>
            <Textarea
              id="scenario"
              name="scenario"
              defaultValue={initial?.scenario}
              required
              minLength={50}
              className="min-h-40 font-mono text-[13px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions (markdown)</Label>
            <Textarea
              id="instructions"
              name="instructions"
              defaultValue={initial?.instructions}
              required
              minLength={10}
              className="min-h-24 font-mono text-[13px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supporting_data">Supporting data (JSON)</Label>
            <Textarea
              id="supporting_data"
              name="supporting_data"
              defaultValue={
                initial?.supporting_data &&
                Object.keys(initial.supporting_data).length > 0
                  ? JSON.stringify(initial.supporting_data, null, 2)
                  : ""
              }
              placeholder='{"financials": {"revenue_cr": 50, "growth_pct": 30}}'
              className="min-h-24 font-mono text-[13px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_framework">Expected framework</Label>
            <Textarea
              id="expected_framework"
              name="expected_framework"
              defaultValue={initial?.expected_framework ?? ""}
              className="min-h-20 font-mono text-[13px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model_answer">Model answer</Label>
            <Textarea
              id="model_answer"
              name="model_answer"
              defaultValue={initial?.model_answer ?? ""}
              className="min-h-32 font-mono text-[13px]"
            />
            <p className="text-xs text-muted-foreground">
              Shown to the grader as a reference, never to students.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rubric</CardTitle>
          <p className="text-sm text-muted-foreground">
            Total {totalWeight} points. Each criterion is graded out of its
            weight.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {criteria.map((criterion, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  value={criterion.key}
                  onChange={(event) =>
                    updateCriterion(index, { key: event.target.value })
                  }
                  placeholder="criterion_name"
                />
                <Input
                  value={criterion.descriptor}
                  onChange={(event) =>
                    updateCriterion(index, { descriptor: event.target.value })
                  }
                  placeholder="What the grader should look for (optional)"
                  className="text-xs"
                />
              </div>
              <Input
                type="number"
                min={1}
                max={100}
                value={criterion.weight}
                onChange={(event) =>
                  updateCriterion(index, { weight: Number(event.target.value) })
                }
                className="w-20"
                aria-label="Weight"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setCriteria((prev) => prev.filter((_, i) => i !== index))
                }
                aria-label="Remove criterion"
              >
                <Trash2 />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setCriteria((prev) => [
                ...prev,
                { key: "", weight: 20, descriptor: "" },
              ])
            }
          >
            <Plus /> Add criterion
          </Button>

          <div className="space-y-2">
            <Label htmlFor="pass_score">Pass score (%)</Label>
            <Input
              id="pass_score"
              name="pass_score"
              defaultValue={initial?.rubric?.pass_score ?? 60}
              type="number"
              min={0}
              max={100}

              className="w-28"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_published"
            className="size-4"
            defaultChecked={initial ? initial.is_published : true}
          />
          Publish immediately
        </label>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {isEdit ? "Save changes" : "Create case"}
        </Button>
      </div>
    </form>
  );
}
