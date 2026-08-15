"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ToleranceUnit } from "@/types/assignment";

/** Matches the array limit the assignment APIs accept for extra answers. */
const MAX_EXTRA_ANSWERS = 8;

interface NumericAnswerFieldsProps {
  correctAnswer: string;
  alsoAcceptedAnswers: string[];
  tolerance: number | null | undefined;
  toleranceUnit: ToleranceUnit;
  onChangeAlsoAccepted: (values: string[]) => void;
  onChangeTolerance: (tolerance: number | null) => void;
  onChangeToleranceUnit: (unit: ToleranceUnit) => void;
}

export function NumericAnswerFields({
  correctAnswer,
  alsoAcceptedAnswers,
  tolerance,
  toleranceUnit,
  onChangeAlsoAccepted,
  onChangeTolerance,
  onChangeToleranceUnit,
}: NumericAnswerFieldsProps) {
  const replaceAt = (index: number, value: string) =>
    onChangeAlsoAccepted(
      alsoAcceptedAnswers.map((existing, i) => (i === index ? value : existing))
    );

  return (
    <>
      <div className="space-y-2">
        <Label>Other accepted values (optional)</Label>
        {alsoAcceptedAnswers.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(e) => replaceAt(index, e.target.value)}
              placeholder="e.g., 9.81"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChangeAlsoAccepted(alsoAcceptedAnswers.filter((_, i) => i !== index))
              }
              title="Remove this value"
              className="shrink-0 text-gray-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {alsoAcceptedAnswers.length < MAX_EXTRA_ANSWERS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChangeAlsoAccepted([...alsoAcceptedAnswers, ""])}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add accepted value
          </Button>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Each value scores full marks and gets the same tolerance. Blank rows are dropped
          when the assignment is saved.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Accepted tolerance (optional)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step="any"
            value={tolerance ?? ""}
            onChange={(e) =>
              onChangeTolerance(e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder="Blank = exact match"
          />
          <Select value={toleranceUnit} onValueChange={onChangeToleranceUnit}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ABSOLUTE">± absolute</SelectItem>
              <SelectItem value="PERCENT">± percent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tolerance
            ? toleranceUnit === "PERCENT"
              ? `Answers within ${tolerance}% of ${correctAnswer || "the answer"} are marked correct.`
              : `Answers within ±${tolerance} of ${correctAnswer || "the answer"} are marked correct.`
            : "Trailing zeros and spaces are always ignored (9.8 = 9.80), but significant figures are not enforced."}
        </p>
      </div>
    </>
  );
}
