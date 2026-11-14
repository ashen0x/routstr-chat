"use client";

import React from "react";
import type { Model } from "@/types/models";
import { mostPictures, pictureOf } from "../picker/catalog";
import { pictureSats } from "../price";
import { usePicture } from "../ui";
import { Choice } from "./Choice";

const word = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A picture model's size, quality and count, where the model lists them,
 *  each with what the picture would cost. */
export function PictureOptions({ model }: { model: Model }) {
  const [picture, setPicture] = usePicture();
  const ip = model.image_pricing;
  const shown = pictureOf(model, picture);
  if (!ip || !shown) return null;
  const { resolution, quality, n } = shown;
  const most = mostPictures(model);
  const one = pictureSats(model, shown);
  return (
    <span className="pic-opts">
      {ip.resolutions.length > 1 && (
        <Choice
          label="Picture size"
          value={resolution ?? ""}
          options={ip.resolutions.map((r) => ({ value: r, name: r, sats: pictureSats(model, { ...shown, resolution: r }) * n }))}
          onPick={(r) => setPicture({ ...picture, resolution: r })}
        />
      )}
      {ip.qualities.length > 1 && (
        <Choice
          label="Picture quality"
          value={quality ?? ""}
          options={ip.qualities.map((q) => ({ value: q, name: word(q), sats: pictureSats(model, { ...shown, quality: q }) * n }))}
          onPick={(q) => setPicture({ ...picture, quality: q })}
        />
      )}
      {most > 1 && (
        <Choice
          label="How many pictures"
          value={n}
          options={Array.from({ length: most }, (_, i) => ({ value: i + 1, name: i ? `${i + 1} pictures` : "1 picture", sats: one * (i + 1) }))}
          onPick={(k) => setPicture({ ...picture, n: k })}
        />
      )}
    </span>
  );
}
