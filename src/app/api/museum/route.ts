import { repository } from "@/repositories";
import { apiError } from "@/server/access";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const source = repository();
    return Response.json(
      { exhibits: await source.readPublic(), mode: source.mode },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
