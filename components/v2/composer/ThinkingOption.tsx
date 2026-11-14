"use client";

import React, { useMemo } from "react";
import { useCatalogModels, useCatalogService } from "@/features/catalog/view";
import type { Model } from "@/types/models";
import { useThinking } from "../ui";
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
  const catalog = useCatalogService();
  const { models } = useCatalogModels();
  const [thinking, setThinking] = useThinking();
  const levels = useMemo(() => catalog?.efforts(model.id, at) ?? [], [catalog, models, model.id, at]);
  if (!levels.length) return null;
  return (
    <span className="pic-opts">
      <Choice
        label="Thinking"
        prefix="Thinking: "
        value={levels.includes(thinking) ? thinking : ""}
        options={["", ...levels].map((level) => ({ value: level, name: NAMES[level] ?? level }))}
        onPick={setThinking}
      />
    </span>
  );
}
