import type {
  MuseumCommand,
  MuseumState,
  PublicExhibit,
} from "../domain/model";

export interface MuseumRepository {
  readonly mode: "local" | "sanity";
  readPublic(): Promise<PublicExhibit[]>;
  readWorkspace(): Promise<MuseumState>;
  execute(command: MuseumCommand): Promise<MuseumState>;
}
