import { ActionRegistry } from "./ActionRegistry.bak";

type InferActionMap = {
  [K in ReturnType<typeof ActionRegistry.all> extends Map<infer N, infer H>
    ? N
    : never]: ActionRegistry extends { actions: Map<any, (p: infer P) => any> }
    ? P
    : never;
};

export class ActionDispatcher {
  static dispatch<K extends keyof InferActionMap>(name: K, payload: InferActionMap[K]) {
    const handler = ActionRegistry.get(name as string);
    if (!handler) throw new Error("Unknown action: " + name);
    return handler(payload);
  }
}