import { useMemo } from "react";
import { useCatalogModels, useCatalogService } from "@/features/catalog/view";
import type { Model } from "@/types/models";
import { useThinking } from "./ui";

/** The thinking levels the menu offers for a model (`at`: the model as the
 *  provider the send goes to lists it), and the one a send asks for: your
 *  choice where it is offered, else none, which leaves it to the node. */
export function useEffort(model: Model | null, at?: Model | null) {
  const catalog = useCatalogService();
  const { models } = useCatalogModels();
  const [thinking] = useThinking();
  const levels = useMemo(() => (model && catalog?.efforts(model.id, at ?? undefined)) || [], [catalog, models, model, at]);
  return { levels, effort: levels.includes(thinking) ? thinking : undefined };
}
