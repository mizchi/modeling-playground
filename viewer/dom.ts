/** Each page supplies its ID -> element contract; missing markup fails at startup. */
export function elementLookup<Elements>() {
  return <Key extends keyof Elements & string>(id: Key): Elements[Key] => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing element #${id}`);
    return element as Elements[Key];
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
