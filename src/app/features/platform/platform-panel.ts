import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { PlatformAuthService } from '../../core/platform/platform-auth.service';
import {
  CrearTenantRequest,
  PlatformService,
  TenantResumen,
} from '../../core/platform/platform.service';

@Component({
  selector: 'app-platform-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './platform-panel.html',
  styleUrl: './platform-panel.scss',
})
export class PlatformPanelComponent {
  private readonly api = inject(PlatformService);
  private readonly auth = inject(PlatformAuthService);
  private readonly router = inject(Router);

  readonly tenants = signal<TenantResumen[]>([]);
  readonly loading = signal(false);
  readonly notice = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  /** Credenciales del club recién creado: se muestran una única vez (la contraseña no se vuelve a ver). */
  readonly createdCreds = signal<{ url: string; email: string; password: string } | null>(null);
  readonly credsCopied = signal(false);

  /** Plantillas de landing disponibles (mismo flujo de reserva, distinto layout). */
  readonly plantillas = [
    { value: 'A', label: 'A · Poster', hint: 'Afiche a un lado + reserva (default)' },
    { value: 'B', label: 'B · Hero centrado', hint: 'Marca grande centrada, más comercial' },
    { value: 'C', label: 'C · Compacta (app)', hint: 'Barra lateral + grilla, va directo a reservar' },
  ];

  // ── Alta ──
  readonly showForm = signal(false);
  readonly creating = signal(false);
  readonly fSlug = signal('');
  readonly fName = signal('');
  readonly fOwnerEmail = signal('');
  readonly fOwnerPassword = signal('');
  readonly fColorPrimario = signal('#2747ff');
  readonly fColorSecundario = signal<string | null>(null);
  readonly fPlantilla = signal('A');
  readonly fDireccion = signal('');
  readonly fWhatsapp = signal('');
  readonly fHosts = signal('');
  readonly canCreate = computed(
    () =>
      /^[a-z0-9-]{2,80}$/.test(this.fSlug().trim()) &&
      this.fName().trim().length > 0 &&
      this.fOwnerEmail().trim().length > 3 &&
      this.fOwnerPassword().length >= 6 &&
      !this.creating()
  );

  // ── Baja (confirmación inline) ──
  readonly confirmDeleteId = signal<number | null>(null);
  readonly deleting = signal(false);

  // ── Edición inline ──
  readonly editingId = signal<number | null>(null);
  readonly savingEdit = signal(false);
  readonly eName = signal('');
  readonly eColorPrimario = signal('#2747ff');
  readonly eColorSecundario = signal<string | null>(null);
  readonly ePlantilla = signal('A');
  readonly eStatus = signal('ACTIVE');

  // ── Reset de contraseña del owner ──
  readonly resettingId = signal<number | null>(null);
  readonly rPassword = signal('');
  readonly resetSaving = signal(false);
  readonly canReset = computed(() => this.rPassword().length >= 8 && !this.resetSaving());
  /** Última contraseña reseteada con éxito: banner persistente con botón copiar (no se auto-cierra). */
  readonly resetSuccess = signal<{ name: string; password: string } | null>(null);
  readonly resetCopied = signal(false);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (ts) => {
        this.tenants.set(ts);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No pudimos cargar los clubes.');
      },
    });
  }

  logoSrc(t: TenantResumen): string | null {
    const u = t.logoUrl;
    if (!u) return null;
    return /^https?:\/\//i.test(u) ? u : environment.apiBase + u;
  }

  /** URL pública del club (landing) a partir de su slug. */
  tenantUrl(t: TenantResumen): string {
    return environment.tenantBaseUrl.replace('{slug}', t.slug);
  }

  private flash(msg: string): void {
    this.notice.set(msg);
    setTimeout(() => this.notice.set(null), 3500);
  }

  // ── Alta ──
  toggleForm(): void {
    this.showForm.update((v) => !v);
  }
  setColorSec(v: string): void {
    this.fColorSecundario.set(v && v.trim() ? v.trim() : null);
  }

  crear(): void {
    if (!this.canCreate()) return;
    this.creating.set(true);
    this.errorMsg.set(null);
    const hosts = this.fHosts()
      .split(/[\s,]+/)
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    const body: CrearTenantRequest = {
      slug: this.fSlug().trim().toLowerCase(),
      name: this.fName().trim(),
      colorPrimario: this.fColorPrimario().trim() || null,
      colorSecundario: this.fColorSecundario(),
      plantilla: this.fPlantilla(),
      ownerEmail: this.fOwnerEmail().trim().toLowerCase(),
      ownerPassword: this.fOwnerPassword(),
      direccion: this.fDireccion().trim() || null,
      whatsapp: this.fWhatsapp().trim() || null,
      hosts: hosts.length ? hosts : undefined,
    };
    this.api.crear(body).subscribe({
      next: (res) => {
        this.creating.set(false);
        this.createdCreds.set({
          url: environment.tenantBaseUrl.replace('{slug}', res.slug),
          email: body.ownerEmail,
          password: body.ownerPassword,
        });
        this.resetForm();
        this.showForm.set(false);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        this.errorMsg.set(err.error?.error ?? err.error?.message ?? 'No pudimos crear el club.');
      },
    });
  }

  dismissCreds(): void {
    this.createdCreds.set(null);
  }

  /** Copia URL + email + contraseña del club recién creado, con fallback si no hay Clipboard API. */
  copyCreds(): void {
    const c = this.createdCreds();
    if (!c) return;
    const text = `URL: ${c.url}\nEmail: ${c.email}\nContraseña: ${c.password}`;
    this.copyToClipboard(
      text,
      () => {
        this.credsCopied.set(true);
        setTimeout(() => this.credsCopied.set(false), 1800);
      },
      () => this.errorMsg.set('No pudimos copiar. Copiá los datos manualmente.')
    );
  }

  private copyToClipboard(text: string, onOk: () => void, onFail: () => void): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onOk, onFail);
    } else {
      onFail();
    }
  }

  private resetForm(): void {
    this.fSlug.set('');
    this.fName.set('');
    this.fOwnerEmail.set('');
    this.fOwnerPassword.set('');
    this.fColorPrimario.set('#2747ff');
    this.fColorSecundario.set(null);
    this.fPlantilla.set('A');
    this.fDireccion.set('');
    this.fWhatsapp.set('');
    this.fHosts.set('');
  }

  // ── Edición ──
  startEdit(t: TenantResumen): void {
    this.editingId.set(t.id);
    this.eName.set(t.name);
    this.eColorPrimario.set(t.colorPrimario || '#2747ff');
    this.eColorSecundario.set(t.colorSecundario);
    this.ePlantilla.set(t.plantilla || 'A');
    this.eStatus.set(t.status);
  }
  cancelEdit(): void {
    this.editingId.set(null);
  }
  setEditColorSec(v: string): void {
    this.eColorSecundario.set(v && v.trim() ? v.trim() : null);
  }
  saveEdit(t: TenantResumen): void {
    this.savingEdit.set(true);
    this.api
      .editar(t.id, {
        name: this.eName().trim() || null,
        colorPrimario: this.eColorPrimario().trim() || null,
        colorSecundario: this.eColorSecundario(),
        plantilla: this.ePlantilla(),
        status: this.eStatus(),
      })
      .subscribe({
        next: (updated) => {
          this.savingEdit.set(false);
          this.editingId.set(null);
          this.upsert(updated);
          this.flash(`"${updated.name}" actualizado.`);
        },
        error: () => {
          this.savingEdit.set(false);
          this.errorMsg.set('No pudimos guardar los cambios.');
        },
      });
  }

  toggleEstado(t: TenantResumen): void {
    const activar = t.status !== 'ACTIVE';
    const call = activar ? this.api.activar(t.id) : this.api.desactivar(t.id);
    call.subscribe({
      next: (updated) => {
        this.upsert(updated);
        this.flash(`"${updated.name}" ${activar ? 'activado' : 'desactivado'}.`);
      },
      error: () => this.errorMsg.set('No pudimos cambiar el estado.'),
    });
  }

  private upsert(t: TenantResumen): void {
    this.tenants.update((list) => list.map((x) => (x.id === t.id ? t : x)));
  }

  // ── Baja definitiva ──
  askDelete(t: TenantResumen): void {
    this.confirmDeleteId.set(t.id);
  }
  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }
  confirmDelete(t: TenantResumen): void {
    this.deleting.set(true);
    this.api.eliminar(t.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmDeleteId.set(null);
        this.tenants.update((list) => list.filter((x) => x.id !== t.id));
        this.flash(`"${t.name}" eliminado.`);
      },
      error: () => {
        this.deleting.set(false);
        this.errorMsg.set('No pudimos eliminar el club.');
      },
    });
  }

  // ── Reset de contraseña del owner ──
  startReset(t: TenantResumen): void {
    this.resettingId.set(t.id);
    this.rPassword.set('');
  }
  cancelReset(): void {
    this.resettingId.set(null);
    this.rPassword.set('');
  }
  confirmReset(t: TenantResumen): void {
    if (!this.canReset()) return;
    if (!confirm(`¿Resetear la contraseña del owner de "${t.name}"? La actual deja de funcionar.`)) return;
    this.resetSaving.set(true);
    const password = this.rPassword();
    this.api.resetOwnerPassword(t.id, password).subscribe({
      next: () => {
        this.resetSaving.set(false);
        this.resettingId.set(null);
        this.rPassword.set('');
        this.resetSuccess.set({ name: t.name, password });
      },
      error: (err: HttpErrorResponse) => {
        this.resetSaving.set(false);
        this.errorMsg.set(err.error?.error ?? 'No pudimos resetear la contraseña.');
      },
    });
  }
  dismissResetSuccess(): void {
    this.resetSuccess.set(null);
  }
  copyResetPassword(): void {
    const p = this.resetSuccess()?.password;
    if (!p) return;
    this.copyToClipboard(
      p,
      () => {
        this.resetCopied.set(true);
        setTimeout(() => this.resetCopied.set(false), 1800);
      },
      () => this.errorMsg.set('No pudimos copiar. Copiá la contraseña manualmente.')
    );
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/plataforma']);
  }
}
