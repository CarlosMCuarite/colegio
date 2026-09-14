"use client";
import { FormEvent, useMemo, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import DashboardLayout from "../../../../components/layout/DashboardLayout";
import api, { fetcher } from "../../../../lib/api";
import styles from "./actualizaciones.module.css";

type Release = {
  id: string;
  version: string;
  build: number;
  notas: string;
  activa: boolean;
  obligatoria: boolean;
  versionMinima?: string | null;
  nombreArchivo: string;
  tamanoBytes: number;
  sha256: string;
  createdAt: string;
};
const size = (value: number) =>
  value <= 0 ? "0 MB" : `${(value / 1048576).toFixed(1)} MB`;

export default function ActualizacionesPage() {
  const { data, mutate, isLoading } = useSWR<any>("/actualizaciones", fetcher);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const releases: Release[] = data?.data ?? [];
  const summary = useMemo(
    () => ({
      total: releases.length,
      stored: releases.reduce((sum, r) => sum + Math.max(0, r.tamanoBytes), 0),
      active: releases.find((r) => r.activa),
    }),
    [releases],
  );

  async function publicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const target = e.currentTarget;
    try {
      await api.post("/actualizaciones", new FormData(target), {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180000,
      });
      toast.success("Actualización publicada para Android");
      target.reset();
      await mutate();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
          "No se pudo publicar la actualización",
      );
    } finally {
      setSaving(false);
    }
  }

  async function eliminarArchivo(release: Release) {
    if (
      !confirm(
        `¿Eliminar el APK de SIGE ${release.version}?\n\nLa versión seguirá visible en el historial, pero ya no podrá instalarse ni activarse.`,
      )
    )
      return;
    setDeleting(release.id);
    try {
      await api.delete(`/actualizaciones/${release.id}/archivo`);
      toast.success("APK eliminado. El historial se conservó.");
      await mutate();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ?? "No se pudo eliminar el APK",
      );
    } finally {
      setDeleting(null);
    }
  }

  return (
    <DashboardLayout
      title="Actualizaciones de la aplicación"
      allowedRoles={["SUPERADMIN"]}
    >
      <main className={`enterprise-page ${styles.page}`}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>
              Distribución privada · Android
            </span>
            <h2>Centro de versiones SIGE</h2>
            <p>
              Publica, controla y depura versiones instalables sin perder su
              trazabilidad.
            </p>
          </div>
          <div className={styles.heroIcon} aria-hidden="true">
            <i className="bi bi-phone" />
          </div>
        </header>
        <section
          className={styles.metrics}
          aria-label="Resumen de actualizaciones"
        >
          <article>
            <i className="bi bi-check2-circle" />
            <div>
              <small>Versión activa</small>
              <strong>
                {summary.active ? `v${summary.active.version}` : "Ninguna"}
              </strong>
            </div>
          </article>
          <article>
            <i className="bi bi-archive" />
            <div>
              <small>Historial</small>
              <strong>{summary.total} versiones</strong>
            </div>
          </article>
          <article>
            <i className="bi bi-device-ssd" />
            <div>
              <small>Storage utilizado</small>
              <strong>{size(summary.stored)}</strong>
            </div>
          </article>
        </section>
        <div className={styles.workspace}>
          <section className={`enterprise-card ${styles.publisher}`}>
            <div className={styles.sectionHeading}>
              <div className={styles.sectionIcon}>
                <i className="bi bi-cloud-arrow-up" />
              </div>
              <div>
                <span>Nueva entrega</span>
                <h3>Publicar actualización</h3>
              </div>
            </div>
            <form onSubmit={publicar} className={styles.form}>
              <label>
                Versión <span>Formato semántico</span>
                <input
                  required
                  name="version"
                  className="sige-input"
                  placeholder="1.1.0"
                />
              </label>
              <label>
                Compilación <span>Debe ser incremental</span>
                <input
                  required
                  name="build"
                  type="number"
                  min="1"
                  className="sige-input"
                  placeholder="2"
                />
              </label>
              <label>
                Versión mínima <span>Opcional</span>
                <input
                  name="versionMinima"
                  className="sige-input"
                  placeholder="1.0.0"
                />
              </label>
              <label className={styles.file}>
                Archivo APK <span>Máximo 250 MB</span>
                <input
                  required
                  name="apk"
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                />
              </label>
              <label className={styles.notes}>
                Novedades <span>Visible antes de descargar</span>
                <textarea
                  required
                  minLength={5}
                  name="notas"
                  className="sige-input"
                  rows={5}
                  placeholder="Describe las mejoras y correcciones…"
                />
              </label>
              <label className={styles.check}>
                <input type="checkbox" name="obligatoria" value="true" />
                <span>
                  <strong>Actualización obligatoria</strong>
                  <small>El usuario deberá instalarla para continuar.</small>
                </span>
              </label>
              <button className="btn-primary" disabled={saving}>
                <i className={`bi ${saving ? "bi-arrow-repeat" : "bi-send"}`} />
                {saving ? "Publicando APK…" : "Publicar versión"}
              </button>
            </form>
          </section>
          <section className={`enterprise-card ${styles.history}`}>
            <div className={styles.historyHead}>
              <div>
                <span>Registro permanente</span>
                <h3>Historial de versiones</h3>
              </div>
              <small>
                Eliminar un APK libera espacio, no elimina esta trazabilidad.
              </small>
            </div>
            {isLoading ? (
              <div className={styles.empty}>Cargando versiones…</div>
            ) : releases.length === 0 ? (
              <div className={styles.empty}>
                <i className="bi bi-inboxes" />
                <strong>Aún no hay versiones</strong>
                <span>La primera publicación aparecerá aquí.</span>
              </div>
            ) : (
              <div className={styles.timeline}>
                {releases.map((release) => {
                  const hasFile = release.tamanoBytes > 0;
                  return (
                    <article key={release.id} className={styles.release}>
                      <div className={styles.versionMark}>{release.build}</div>
                      <div className={styles.releaseBody}>
                        <div className={styles.releaseTop}>
                          <div>
                            <h4>v{release.version}</h4>
                            <span>
                              {new Intl.DateTimeFormat("es-PE", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(release.createdAt))}
                            </span>
                          </div>
                          <div className={styles.badges}>
                            {release.activa && (
                              <b className={styles.active}>Activa</b>
                            )}
                            {release.obligatoria && (
                              <b className={styles.required}>Obligatoria</b>
                            )}
                            <b
                              className={
                                hasFile ? styles.available : styles.removed
                              }
                            >
                              {hasFile ? "APK disponible" : "Archivo eliminado"}
                            </b>
                          </div>
                        </div>
                        <p>{release.notas}</p>
                        <div className={styles.fileMeta}>
                          <span>
                            <i className="bi bi-file-earmark-zip" />
                            {release.nombreArchivo}
                          </span>
                          <span>{size(release.tamanoBytes)}</span>
                          <code title={release.sha256}>
                            SHA {release.sha256.slice(0, 12)}…
                          </code>
                        </div>
                      </div>
                      <button
                        className="btn-danger"
                        disabled={!hasFile || deleting === release.id}
                        onClick={() => eliminarArchivo(release)}
                        aria-label={`Eliminar APK de la versión ${release.version}`}
                      >
                        <i className="bi bi-trash3" />
                        {deleting === release.id
                          ? "Eliminando…"
                          : hasFile
                            ? "Eliminar APK"
                            : "Eliminado"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </DashboardLayout>
  );
}
