import { loadEnvFile } from "node:process";

export function loadLocalEnvironment() {
  try {
    loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function safeScriptFailure(error: unknown): never {
  // SDK errors can contain headers or request bodies. Only our controlled errors are printable.
  const safe =
    error instanceof Error && error.name === "MuseumError"
      ? error.message
      : "The operation failed. Provider details were suppressed. No success was assumed.";
  process.stderr.write(`${safe}\n`);
  process.exit(1);
}
