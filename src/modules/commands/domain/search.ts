export interface SearchableAction {
  id: string;
  label: string;
  detail: string;
  keywords?: string;
}
export function searchActions<T extends SearchableAction>(actions: T[], query: string): T[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return actions.filter((action) =>
    words.every((word) =>
      `${action.label} ${action.detail} ${action.keywords || ''}`.toLocaleLowerCase().includes(word),
    ),
  );
}
