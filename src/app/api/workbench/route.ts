import { repository } from "@/repositories";
import { parseCommand } from "@/domain/validation";
import { MuseumError } from "@/domain/model";
import { apiError, authorizeWorkbench } from "@/server/access";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    authorizeWorkbench(request);
    const source = repository();
    return Response.json(
      { state: await source.readWorkspace(), mode: source.mode },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    authorizeWorkbench(request);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new MuseumError("INVALID_INPUT", "JSON is required.", 415);
    if (Number(request.headers.get("content-length") ?? 0) > 20000)
      throw new MuseumError("TOO_LARGE", "This draft is too large.", 413);
    const body = await request.text();
    if (body.length > 20000)
      throw new MuseumError("TOO_LARGE", "This draft is too large.", 413);
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      throw new MuseumError("INVALID_INPUT", "The request is not valid JSON.");
    }
    const command = parseCommand(input);
    return Response.json(
      { state: await repository().execute(command) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
