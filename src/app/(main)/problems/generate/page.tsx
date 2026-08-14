"use client";

import { StaffOnly } from "@/components/auth/StaffOnly";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrackTime } from "@/lib/use-track-time";
import {
  Sparkles,
  Loader2,
  FilePlus,
  GripVertical,
  Layers,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { GeneratedProblemCard } from "@/components/problems/GeneratedProblemCard";
import { ProblemBank } from "@/components/problems/ProblemBank";
import { ProblemGeneratorConfig } from "@/components/problems/ProblemGeneratorConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GeneratedProblem {
  id?: string;
  questionText: string;
  questionType: string;
  options?: string[];
  correctAnswer: string;
  solution: string;
  points: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diagram?: { type: "svg" | "mermaid"; content: string } | any;
}


interface ProblemSet {
  id: string;
  topic: string;
  difficulty: number;
  questionType: string;
  createdBy: string;
  createdById: string;
  createdAt: string;
  problems: GeneratedProblem[];
}


function formatQuestionType(type: string): string {
  const typeMap: Record<string, string> = {
    "FREE_RESPONSE": "Free Response",
    "MC": "Multiple Choice",
    "TF": "True/False",
  };
  return typeMap[type] || type;
}

function SortableProblemItem({
  id,
  index,
  problem,
  onRemove,
}: {
  id: string;
  index: number;
  problem: GeneratedProblem & { sourceTopic: string; _uid: string };
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
        isDragging ? "bg-indigo-50 dark:bg-indigo-950 shadow-lg rounded-lg" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing touch-none shrink-0"
        title="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 shrink-0">
            {problem.sourceTopic}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {problem.points} pts &middot; {problem.questionType}
          </span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1">
          {problem.questionText.replace(/\$\$?[^$]+\$\$?/g, "[math]").slice(0, 120)}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0"
        title="Remove"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProblemGeneratorPageContent() {
  useTrackTime("PROBLEM_GEN");
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [difficulty, setDifficulty] = useState("3");
  const [count, setCount] = useState(3);
  const [questionType, setQuestionType] = useState("MC");
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<GeneratedProblem[]>([]);
  const [hasStreamText, setHasStreamText] = useState(false);
  const streamRef = useRef<HTMLPreElement>(null);
  const streamBufferRef = useRef("");
  const [copied, setCopied] = useState<number | null>(null);
  const [pastSets, setPastSets] = useState<ProblemSet[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [loadingPast, setLoadingPast] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);
  const [pendingDeleteSetId, setPendingDeleteSetId] = useState<string | null>(null);

  // Merge problem sets state
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [mergedProblems, setMergedProblems] = useState<(GeneratedProblem & { sourceTopic: string; _uid: string })[]>([]);
  const [showStagingArea, setShowStagingArea] = useState(false);
  const [creatingFromMerged, setCreatingFromMerged] = useState(false);
  const uidCounterRef = useRef(0);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) {
          setCurrentUser({ id: data.user.id, role: data.user.role || "STUDENT" });
        }
      })
      .catch((err) => console.error("[auth] Failed to fetch session:", err));
  }, []);

  const loadPastSets = async () => {
    if (pastSets.length > 0) {
      setShowPast(!showPast);
      return;
    }
    setLoadingPast(true);
    try {
      const res = await fetch("/api/problems/generate");
      if (res.ok) {
        const data = await res.json();
        setPastSets(data.problemSets || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPast(false);
      setShowPast(true);
    }
  };

  const requestDeleteProblemSet = (e: React.MouseEvent, psId: string) => {
    e.stopPropagation();
    setPendingDeleteSetId(psId);
  };

  const confirmDeleteProblemSet = async () => {
    if (!pendingDeleteSetId) return;
    const psId = pendingDeleteSetId;
    setPendingDeleteSetId(null);
    setDeletingSetId(psId);
    try {
      const res = await fetch("/api/problems/generate", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: psId }),
      });
      if (res.ok) {
        setPastSets((prev) => prev.filter((s) => s.id !== psId));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingSetId(null);
    }
  };

  const canDeleteSet = (ps: ProblemSet) => {
    if (!currentUser) return false;
    return currentUser.role === "ADMIN" || ps.createdById === currentUser.id;
  };

  const toggleSetSelection = (psId: string) => {
    setSelectedSetIds((prev) => {
      const next = new Set(prev);
      if (next.has(psId)) next.delete(psId);
      else next.add(psId);
      return next;
    });
  };

  const handleMergeSelected = () => {
    const selected = pastSets.filter((ps) => selectedSetIds.has(ps.id));
    const merged = selected.flatMap((ps) =>
      ps.problems.map((p) => {
        uidCounterRef.current += 1;
        return { ...p, sourceTopic: ps.topic, _uid: `mp-${uidCounterRef.current}` };
      })
    );
    setMergedProblems(merged);
    setShowStagingArea(true);
    setSelectedSetIds(new Set());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMergedProblems((prev) => {
        const oldIndex = prev.findIndex((p) => p._uid === active.id);
        const newIndex = prev.findIndex((p) => p._uid === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const removeMergedProblem = (index: number) => {
    setMergedProblems((prev) => prev.filter((_, i) => i !== index));
  };

  const createAssignmentFromMerged = async () => {
    if (mergedProblems.length === 0) return;
    setCreatingFromMerged(true);
    try {
      const totalPoints = mergedProblems.reduce((sum, p) => sum + p.points, 0);
      const topics = Array.from(new Set(mergedProblems.map((p) => p.sourceTopic)));
      const title = topics.length <= 3
        ? `${topics.join(", ")} - Merged Problems`
        : `${topics.slice(0, 2).join(", ")} + ${topics.length - 2} more - Merged Problems`;
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: `Merged ${mergedProblems.length} problems from ${topics.length} topic(s): ${topics.join(", ")}.`,
          type: "QUIZ",
          totalPoints,
          questions: mergedProblems.map((p) => ({
            questionText: p.questionText,
            questionType: p.questionType,
            options: p.options || null,
            correctAnswer: p.correctAnswer,
            points: p.points,
            diagram: p.diagram || null,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/assignments/${data.assignment.id}/edit`);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to create assignment");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create assignment");
    } finally {
      setCreatingFromMerged(false);
    }
  };

  const loadProblemSet = (ps: ProblemSet) => {
    setProblems(ps.problems);
    setTopic(ps.topic);
    setDifficulty(String(ps.difficulty));
    setQuestionType(ps.questionType);
    setShowPast(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const appendStreamText = useCallback((text: string) => {
    streamBufferRef.current += text;
    if (streamRef.current) {
      streamRef.current.textContent = streamBufferRef.current + "|";
    }
  }, []);

  const effectiveTopic = topic === "__custom__" ? customTopic.trim() : topic;

  const handleGenerate = async () => {
    if (!effectiveTopic) return;
    setLoading(true);
    setProblems([]);
    streamBufferRef.current = "";
    setHasStreamText(false);

    try {
      const res = await fetch("/api/problems/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: effectiveTopic,
          difficulty: Number(difficulty),
          count,
          questionType,
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Generation failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "delta") {
              if (!streamBufferRef.current) {
                setHasStreamText(true);
              }
              appendStreamText(event.content);
            } else if (event.type === "done") {
              setProblems(event.problems || []);
              streamBufferRef.current = "";
              setHasStreamText(false);
              if (pastSets.length > 0) {
                setPastSets([]);
              }
            } else if (event.type === "error") {
              console.error("Generation error:", event.message);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [creatingAssignment, setCreatingAssignment] = useState(false);

  const createAssignmentFromProblems = async () => {
    if (problems.length === 0) return;
    setCreatingAssignment(true);
    try {
      const totalPoints = problems.reduce((sum, p) => sum + p.points, 0);
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${effectiveTopic} - Generated Problems`,
          description: `Auto-generated ${problems.length} ${formatQuestionType(questionType)} problems on ${effectiveTopic} (difficulty ${difficulty}/5).`,
          type: "QUIZ",
          totalPoints,
          questions: problems.map((p) => ({
            questionText: p.questionText,
            questionType: p.questionType || questionType,
            options: p.options || null,
            correctAnswer: p.correctAnswer,
            points: p.points,
            diagram: p.diagram || null,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/assignments/${data.assignment.id}/edit`);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to create assignment");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create assignment");
    } finally {
      setCreatingAssignment(false);
    }
  };

  const copyProblem = (index: number) => {
    const p = problems[index];
    const text = `${p.questionText}\n\n${
      p.options ? p.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n") + "\n\n" : ""
    }Answer: ${p.correctAnswer}\n\nSolution: ${p.solution}`;
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const topics = [
    "Kinematics",
    "Newton's Laws",
    "Work & Energy",
    "Momentum & Collisions",
    "Rotational Motion",
    "Oscillations & Waves",
    "Electrostatics",
    "Electric Circuits",
    "Magnetism",
    "Electromagnetic Induction",
    "Thermodynamics",
    "Optics",
    "Modern Physics",
    "Fluid Mechanics",
    "Gravitation",
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 rounded-xl bg-gray-900 shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Problem Generator
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-[52px]">
          Generate physics problems using AI for assignments and practice
        </p>
      </div>

      <ProblemGeneratorConfig
        topic={topic}
        onTopicChange={setTopic}
        customTopic={customTopic}
        onCustomTopicChange={setCustomTopic}
        customInstructions={customInstructions}
        onCustomInstructionsChange={setCustomInstructions}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        questionType={questionType}
        onQuestionTypeChange={setQuestionType}
        count={count}
        onCountChange={setCount}
        loading={loading}
        effectiveTopic={effectiveTopic}
        onGenerate={handleGenerate}
      />

      {/* Loading State with streaming preview */}
      {loading && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Generating {count} {effectiveTopic} problems...
            </p>
          </div>
          {hasStreamText ? (
            <pre ref={streamRef} className="p-6 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed" />
          ) : (
            <div className="p-10 text-center">
              <Sparkles className="h-7 w-7 text-gray-300 animate-pulse mx-auto mb-2" />
              <p className="text-xs text-gray-400 dark:text-gray-500">Waiting for AI response...</p>
            </div>
          )}
        </div>
      )}

      {/* Generated Problems */}
      {problems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Generated Problems
              <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
                ({problems.length})
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                Auto-saved
              </span>
              <Button
                onClick={createAssignmentFromProblems}
                disabled={creatingAssignment}
                size="sm"
                className="gap-1.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-lg"
              >
                {creatingAssignment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FilePlus className="h-3.5 w-3.5" />
                )}
                Create Assignment
              </Button>
            </div>
          </div>

          {problems.map((problem, index) => (
            <GeneratedProblemCard
              key={problem.id || index}
              problem={problem}
              index={index}
              isCopied={copied === index}
              onCopy={copyProblem}
            />
          ))}
        </div>
      )}

      {/* Staging Area (Merged Problems) */}
      {showStagingArea && mergedProblems.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                Staging Area
              </h2>
              <span className="text-xs text-indigo-500 dark:text-indigo-400">
                ({mergedProblems.length} problems)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={createAssignmentFromMerged}
                disabled={creatingFromMerged || mergedProblems.length === 0}
                size="sm"
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                {creatingFromMerged ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FilePlus className="h-3.5 w-3.5" />
                )}
                Create Assignment
              </Button>
              <Button
                onClick={() => { setShowStagingArea(false); setMergedProblems([]); }}
                size="sm"
                variant="outline"
                className="gap-1.5 text-gray-600 dark:text-gray-400 rounded-lg"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={mergedProblems.map((p) => p._uid)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {mergedProblems.map((p, index) => (
                  <SortableProblemItem
                    key={p._uid}
                    id={p._uid}
                    index={index}
                    problem={p}
                    onRemove={() => removeMergedProblem(index)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <ProblemBank
        pastSets={pastSets}
        showPast={showPast}
        loadingPast={loadingPast}
        selectedSetIds={selectedSetIds}
        deletingSetId={deletingSetId}
        onToggleShow={loadPastSets}
        onToggleSetSelection={toggleSetSelection}
        onLoadProblemSet={loadProblemSet}
        onRequestDelete={requestDeleteProblemSet}
        onMergeSelected={handleMergeSelected}
        onClearSelection={() => setSelectedSetIds(new Set())}
        canDeleteSet={canDeleteSet}
      />
      <AlertDialog open={!!pendingDeleteSetId} onOpenChange={(open) => { if (!open) setPendingDeleteSetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Problem Set</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this problem set? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProblemSet} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ProblemGeneratorPage() {
  return (
    <StaffOnly>
      <ProblemGeneratorPageContent />
    </StaffOnly>
  );
}
