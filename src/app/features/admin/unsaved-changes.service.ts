import { Injectable, signal } from '@angular/core';

/**
 * Estado compartido de "cambios sin guardar" del panel admin. Hoy sólo lo setea
 * `ConfigComponent` (su form es el único con guardado diferido); `AdminNavComponent`
 * lo consulta antes de navegar para no perder cambios sin confirmar.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChangesService {
  private readonly _dirty = signal(false);
  readonly dirty = this._dirty.asReadonly();

  setDirty(value: boolean): void {
    this._dirty.set(value);
  }
}
