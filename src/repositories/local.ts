import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createSeed } from "../data/seed";
import {
  MuseumError,
  publicExhibits,
  type MuseumCommand,
  type MuseumState,
} from "../domain/model";
import { transition } from "../domain/workflow";
import type { MuseumRepository } from "./contracts";

/** One local file, one atomic commit, a cross-process exclusive lock. */
export class LocalMuseumRepository implements MuseumRepository {
  readonly mode = "local" as const;
  private readonly statePath: string;
  private readonly lockPath: string;

  constructor(private readonly directory = path.join(process.cwd(), ".data")) {
    this.statePath = path.join(directory, "museum.json");
    this.lockPath = path.join(directory, "write.lock");
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true });
    try {
      await mkdir(this.lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new MuseumError(
          "WORKSPACE_BUSY",
          "Another save is in progress. Wait a moment, then reload. A persistent lock requires local recovery; see README.",
          409,
        );
      }
      throw error;
    }
    try {
      return await operation();
    } finally {
      await rm(this.lockPath, { recursive: true, force: true });
    }
  }

  private async load(): Promise<MuseumState | null> {
    try {
      const state = JSON.parse(
        await readFile(this.statePath, "utf8"),
      ) as MuseumState;
      if (
        state.schemaVersion !== 1 ||
        !Number.isSafeInteger(state.version) ||
        !Array.isArray(state.exhibits) ||
        !Array.isArray(state.audit)
      ) {
        throw new Error("Unsupported local state.");
      }
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new MuseumError(
        "LOCAL_STATE_INVALID",
        "The local data file could not be read. It has been preserved; see README for recovery.",
        503,
      );
    }
  }

  private async save(state: MuseumState): Promise<void> {
    const temporary = `${this.statePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(state, null, 2), {
        flag: "wx",
        mode: 0o600,
      });
      // Windows may briefly deny replacing a file held by a concurrent reader.
      // Keep the old snapshot intact and retry the atomic rename under our lock.
      for (let attempt = 0; ; attempt += 1) {
        try {
          await rename(temporary, this.statePath);
          break;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (
            !["EPERM", "EACCES", "EBUSY"].includes(code ?? "") ||
            attempt >= 5
          )
            throw error;
          await delay(10 * 2 ** attempt);
        }
      }
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async readWorkspace(): Promise<MuseumState> {
    const state = await this.load();
    if (state) return state;
    return this.withLock(async () => {
      const existing = await this.load();
      if (existing) return existing;
      const seed = createSeed();
      await this.save(seed);
      return seed;
    });
  }

  async readPublic() {
    return publicExhibits(await this.readWorkspace());
  }

  async execute(command: MuseumCommand): Promise<MuseumState> {
    return this.withLock(async () => {
      const previous = (await this.load()) ?? createSeed();
      const next = transition(previous, command);
      await this.save(next);
      return next;
    });
  }
}
