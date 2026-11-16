/** RuneScape's recorded fight chat lines. Keep chronological messages
 * in a small immutable ring buffer so React can subscribe without polling.
 */
export type OcellusGameMessage = Readonly<{
  id: number;
  tick: number;
  text: string;
}>;

/** Six messages fit the game canvas without taking over the combat view. */
export function appendOcellusGameMessage(
  current: readonly OcellusGameMessage[],
  tick: number,
  message: string,
): readonly OcellusGameMessage[] {
  const text = message.trim();
  if (!text) return current;
  const id = current.length ? current[current.length - 1].id + 1 : 1;
  return [...current.slice(-5), Object.freeze({ id, tick, text })];
}
