import "server-only";
import { MuseumError } from "../domain/model";
import { LocalMuseumRepository } from "./local";
import { SanityMuseumRepository } from "./sanity";
import type { MuseumRepository } from "./contracts";

export function repository(): MuseumRepository {
  const mode = process.env.MUSEUM_STORAGE ?? "local";
  if (mode === "local") return new LocalMuseumRepository();
  if (mode === "sanity") return new SanityMuseumRepository();
  throw new MuseumError(
    "INVALID_STORAGE",
    "MUSEUM_STORAGE must be local or sanity.",
    503,
  );
}
