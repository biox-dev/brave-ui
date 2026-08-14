export class ActionDispatcher {
  static actions: Record<string, Function> = {};

  static register(name: string, handler: Function) {
    if (ActionDispatcher.actions[name]) {
      console.warn(`[LLM] Action already registered: ${name}`);
      return;
    }
    ActionDispatcher.actions[name] = handler;
  }

  static dispatch(action: string, payload: any) {
    const fn = ActionDispatcher.actions[action];

    if (!fn) {
      console.warn("[LLM] Unknown action:", action);
      return;
    }
    return fn(payload);
  }
  static async dispatchList(actions: { action: string; payload: any }[]) {
    const results = [];

    for (const a of actions) {
      try {
        const r = await ActionDispatcher.dispatch(a.action as any, a.payload);
        results.push({ success: true, result: r });
      } catch (err: any) {
        results.push({ success: false, error: err?.message });
      }
    }

    return results;
  }
}

// {
//   "action": "form.set_value",
//   "payload": { "form": "F1", "field": "age", "value": 18 }
// }
// ActionDispatcher.dispatch(data.action, data.payload);

// {
//   "actions": [
//     { "action": "ui.show_message", "payload": { "type": "info", "text": "Start" } },
//     { "action": "router.go", "payload": { "path": "/analysis" } },
//     { "action": "form.set_value", "payload": { "form": "analysisForm", "field": "sample", "value": "A01" } }
//   ]
// }
// ActionDispatcher.dispatchList(data.actions);