"use client";

import React from "react";
import type { Model } from "@/types/models";
import { useThinking } from "../ui";
import { useEffort } from "../useEffort";
import { Choice } from "./Choice";

const NAMES: Record<string, string> = {
  "": "Auto",
  none: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

/** How hard the model thinks, where a node lists the levels it takes; `at`
 *  is the model as the provider the send goes to lists it. */
export function ThinkingOption({ model, at }: { model: Model; at?: Model }) {
  const [, setThinking] = useThinking();
  const { levels, effort } = useEffort(model, at);
  if (!levels.length) return null;
  return (
    <span className="pic-opts">
      <Choice
        label="Thinking"
        prefix="Thinking: "
        value={effort ?? ""}
        options={["", ...levels].map((level) => ({ value: level, name: NAMES[level] ?? level }))}
        onPick={setThinking}
      />
    </span>
  );
}
