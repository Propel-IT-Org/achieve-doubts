import { useLevels } from "~/lib/queries";

/**
 * The classes a batch can be put on, as <option>s. Suspends on the level
 * list, so it goes inside a select whose form is already boundaried.
 */
export function LevelOptions() {
  const levels = useLevels();
  return (
    <>
      {levels.map((level) => (
        <option key={level.id} value={level.id}>
          {level.nameEn}
        </option>
      ))}
    </>
  );
}
