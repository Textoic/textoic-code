import {
  withInstance,
  withoutInstance,
  type IgnoredInstance,
  type IgnoredInstances,
} from "@textoic/enlint-lsp/issues";
import { EventEmitter, type Memento } from "vscode";

const storageKey = "textoic.ignoredInstances";

export class IgnoredInstanceStore {
  private readonly changes = new EventEmitter<void>();
  readonly onDidChange = this.changes.event;

  constructor(private readonly state: Memento) {}

  all(): IgnoredInstances {
    return this.state.get<IgnoredInstances>(storageKey, {});
  }

  of(uri: string) {
    return this.all()[uri] ?? [];
  }

  add(uri: string, instance: IgnoredInstance) {
    return this.write(uri, withInstance(this.of(uri), instance));
  }

  remove(uri: string, instance: IgnoredInstance) {
    return this.write(uri, withoutInstance(this.of(uri), instance));
  }

  clear(uri: string) {
    return this.write(uri, []);
  }

  private async write(uri: string, instances: IgnoredInstance[]) {
    const others = Object.entries(this.all()).filter(([key]) => key !== uri);
    const kept =
      instances.length === 0 ? others : [...others, [uri, instances]];
    await this.state.update(storageKey, Object.fromEntries(kept));
    this.changes.fire();
  }
}
