export type ActionHandler<P> = (payload: P) => any;

export class ActionRegistry {
  static actions = new Map<string, ActionHandler<any>>();

  static register<P>(name: string, handler: ActionHandler<P>) {
    this.actions.set(name, handler);
  }

  static get(name: string) {
    return this.actions.get(name);
  }

  static all() {
    return this.actions;
  }
}