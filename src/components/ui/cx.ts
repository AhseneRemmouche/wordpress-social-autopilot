/** Join truthy class-name parts with spaces (a tiny classnames helper). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
