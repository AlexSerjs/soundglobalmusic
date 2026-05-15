"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { COUNTRY_MAP } from "@/lib/playlists";
import { GROQ_COUNTRY_NAMES } from "@/lib/countries";

// ── All countries merged ──────────────────────────────────────────────────────
const ALL_COUNTRIES = [
  ...Object.entries(COUNTRY_MAP).map(([code, info]) => ({ code, name: info.name })),
  ...Object.entries(GROQ_COUNTRY_NAMES).map(([code, name]) => ({ code, name })),
].sort((a, b) => a.name.localeCompare(b.name));

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExtractedTrack  { rank: number; title: string; artist: string; }
interface ExtractedArtist { name: string; genre: string; }
interface ExtractedScene  { name: string; topSong: string; }

type SectionKey = "tracks" | "artists" | "scene";

interface PendingExtract {
  section: SectionKey;
  preview: string;   // object URL for image preview
  fileName: string;
}

interface OverrideInfo {
  exists: boolean;
  source?: string;
  cachedAt?: number;
  trackCount?: number;
  artistCount?: number;
}

const SECTION_LABELS: Record<SectionKey, string> = {
  tracks:  "Lo más popular",
  artists: "Top Artistas",
  scene:   "Escena Local",
};

const SECTION_ICONS: Record<SectionKey, string> = {
  tracks:  "🎵",
  artists: "🎤",
  scene:   "🎸",
};

// ── Auth gate ──────────────────────────────────────────────────────────────────
function AuthGate({ onAuth }: { onAuth: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.trim()) return;
    onAuth(pw.trim());
    setErr(true); // will be reset if auth succeeds (parent replaces component)
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d1b2a" }}>
      <form onSubmit={submit} className="bg-[#0a1628] border border-white/10 rounded-2xl p-8 w-80 flex flex-col gap-4 shadow-2xl">
        <div className="text-center">
          <span className="text-3xl">🔧</span>
          <h1 className="text-white font-bold text-lg mt-2">SoundGlobal Admin</h1>
          <p className="text-gray-500 text-xs mt-1">Panel de administración</p>
        </div>
        <input
          type="password"
          placeholder="Contraseña"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(false); }}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#38bdf8]/50 transition-colors"
          autoFocus
        />
        {err && <p className="text-red-400 text-xs text-center">Contraseña incorrecta</p>}
        <button
          type="submit"
          className="bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#0d1b2a] font-bold py-2.5 rounded-lg text-sm transition-colors"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}

// ── Summary modal (before extraction) ────────────────────────────────────────
function SummaryModal({
  pending,
  countryName,
  onConfirm,
  onCancel,
}: {
  pending: PendingExtract;
  countryName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const steps =
    pending.section === "tracks"
      ? [
          "📸 Leer la captura con Llama 4 Vision (Groq)",
          "🎵 Extraer: posición, título y artista de cada canción visible",
          "🔍 Buscar cada canción en Deezer para obtener preview de 30s y portada",
          `💾 Guardar como override permanente para ${countryName}`,
          "✅ El tab 'Lo más popular' mostrará estos datos hasta que lo cambies",
        ]
      : pending.section === "artists"
      ? [
          "📸 Leer la captura con Llama 4 Vision (Groq)",
          "🎤 Extraer: nombre del artista y género musical",
          "🔍 Buscar cada artista en Deezer para obtener foto y enlace",
          `💾 Guardar como override permanente para ${countryName}`,
          "✅ El tab 'Top Artistas' mostrará estos datos hasta que lo cambies",
        ]
      : [
          "📸 Leer la captura con Llama 4 Vision (Groq)",
          "🎸 Extraer: artistas locales y su canción más representativa",
          "🔍 Buscar cada artista y canción en Deezer para foto y preview",
          `💾 Guardar como override permanente de Escena Local para ${countryName}`,
          "✅ El tab 'Escena Local' mostrará estos datos hasta que los cambies",
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0e1f35] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-white font-bold text-base mb-1">
          {SECTION_ICONS[pending.section]} Extraer {SECTION_LABELS[pending.section]}
        </h2>
        <p className="text-gray-500 text-xs mb-4">{pending.fileName}</p>

        {/* Image thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pending.preview}
          alt="preview"
          className="w-full h-36 object-cover rounded-lg mb-4 opacity-80"
        />

        {/* Steps */}
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">La IA hará esto en orden:</p>
        <ol className="space-y-1.5 mb-5">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-[#38bdf8] font-bold text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#0d1b2a] font-bold text-sm transition-colors"
          >
            Proceder →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini toggle switch ────────────────────────────────────────────────────────
function MiniToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={active ? "Pausar auto-actualización" : "Reanudar auto-actualización"}
      className="flex flex-col items-center gap-0.5 disabled:opacity-40"
    >
      <div className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${active ? "bg-green-500" : "bg-gray-600"}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${active ? "left-[18px]" : "left-0.5"}`} />
      </div>
      <span className={`text-[9px] font-medium transition-colors ${active ? "text-green-400" : "text-gray-500"}`}>
        {disabled ? "…" : active ? "Auto" : "Pausado"}
      </span>
    </button>
  );
}

// ── Main admin panel ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const [token, setToken]               = useState<string | null>(null);
  const [authed, setAuthed]             = useState(false);

  // The global CSS sets overflow:hidden on body (for the map page).
  // Override it here so the admin page can scroll normally.
  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  const [countryCode, setCountryCode]   = useState("");
  const [countryName, setCountryName]   = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [overrideInfo, setOverrideInfo] = useState<OverrideInfo | null>(null);

  // Per-section auto-update toggles (true = auto/no override, false = paused/overridden)
  const [autoTracks, setAutoTracks]   = useState(true);
  const [autoArtists, setAutoArtists] = useState(true);
  const [autoScene, setAutoScene]     = useState(true);

  const [tracks, setTracks]     = useState<ExtractedTrack[]>([]);
  const [artists, setArtists]   = useState<ExtractedArtist[]>([]);
  const [scene, setScene]       = useState<ExtractedScene[]>([]);

  const [pending, setPending]         = useState<PendingExtract | null>(null);
  const [extractingSection, setExtractingSection] = useState<SectionKey | null>(null);
  const [saving, setSaving]           = useState(false);
  const [savingScene, setSavingScene] = useState(false);
  const [msg, setMsg]           = useState<{ text: string; type: "ok" | "err" | "info" } | null>(null);

  const tracksFileRef  = useRef<HTMLInputElement>(null);
  const artistsFileRef = useRef<HTMLInputElement>(null);
  const sceneFileRef   = useRef<HTMLInputElement>(null);

  const showMsg = (text: string, type: "ok" | "err" | "info" = "info") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), type === "ok" ? 10000 : 5000);
  };

  // ── Auth ───────────────────────────────────────────────────────────────────
  const handleAuth = useCallback(async (pw: string) => {
    // Test auth by calling the override endpoint
    const res = await fetch("/api/admin/override/US", {
      headers: { "x-admin-token": pw },
    });
    if (res.ok) {
      setToken(pw);
      setAuthed(true);
    }
  }, []);

  // ── Load override info when country changes ────────────────────────────────
  const loadOverride = useCallback(async (code: string) => {
    if (!token || !code) return;

    const res = await fetch(`/api/admin/override/${code}`, {
      headers: { "x-admin-token": token },
    });
    const { tracks: savedTracks, artists: savedArtists } = await res.json();

    setAutoTracks(!savedTracks || savedTracks.length === 0);
    setAutoArtists(!savedArtists || savedArtists.length === 0);

    if (savedTracks?.length) {
      setTracks(
        savedTracks.map((t: { name: string; artistName: string }, i: number) => ({
          rank: i + 1, title: t.name, artist: t.artistName,
        }))
      );
    } else {
      setTracks([]);
    }

    if (savedArtists?.length) {
      setArtists(
        savedArtists.map((a: { name: string; genres: string[] }) => ({
          name: a.name, genre: a.genres?.[0] ?? "",
        }))
      );
    } else {
      setArtists([]);
    }

    setOverrideInfo({
      exists: !!(savedTracks?.length || savedArtists?.length),
      trackCount: savedTracks?.length ?? 0,
      artistCount: savedArtists?.length ?? 0,
      cachedAt: Date.now(),
    });

    // Load scene override separately (stored in its own key)
    const sceneRes = await fetch(`/api/admin/scene/${code}`, {
      headers: { "x-admin-token": token },
    });
    if (sceneRes.ok) {
      const { override: sceneOverride } = await sceneRes.json();
      if (sceneOverride?.artists) {
        setScene(
          sceneOverride.artists.map((a: { name: string; topSong: string }) => ({
            name: a.name, topSong: a.topSong ?? "",
          }))
        );
        setAutoScene(false);
      } else {
        setScene([]);
        setAutoScene(true);
      }
    }
  }, [token]);

  useEffect(() => {
    if (countryCode) loadOverride(countryCode);
  }, [countryCode, loadOverride]);

  // ── Image selected → show summary ─────────────────────────────────────────
  const handleFileChange = (section: SectionKey, file: File) => {
    const preview = URL.createObjectURL(file);
    setPending({ section, preview, fileName: file.name });
  };

  // ── Confirm → run extraction ───────────────────────────────────────────────
  const runExtraction = async () => {
    if (!pending || !token) return;
    const section = pending.section;
    setPending(null);
    setExtractingSection(section);
    showMsg("Leyendo imagen con IA…", "info");

    // Get the file from the correct input
    const fileInput = section === "tracks" ? tracksFileRef.current
                    : section === "artists" ? artistsFileRef.current
                    : sceneFileRef.current;
    const file = fileInput?.files?.[0];
    if (!file) { setExtractingSection(null); return; }

    const form = new FormData();
    form.append("image", file);
    form.append("section", section);

    try {
      const res  = await fetch("/api/admin/extract", {
        method: "POST",
        headers: { "x-admin-token": token },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      if (section === "tracks") {
        const extracted: ExtractedTrack[] = (json.data?.tracks ?? []).map(
          (t: { rank?: number; title: string; artist: string }, i: number) => ({
            rank: t.rank ?? i + 1,
            title: t.title,
            artist: t.artist,
          })
        );
        setTracks(extracted);
        showMsg(`✅ ${extracted.length} canciones extraídas. Revisa y guarda.`, "ok");
      } else if (section === "artists") {
        const extracted: ExtractedArtist[] = (json.data?.artists ?? []).map(
          (a: { name: string; genre?: string }) => ({
            name: a.name, genre: a.genre ?? "",
          })
        );
        setArtists(extracted);
        showMsg(`✅ ${extracted.length} artistas extraídos. Revisa y guarda.`, "ok");
      } else {
        // scene
        const extracted: ExtractedScene[] = (json.data?.artists ?? []).map(
          (a: { name: string; topSong?: string }) => ({
            name: a.name, topSong: a.topSong ?? "",
          })
        );
        setScene(extracted);
        showMsg(`✅ ${extracted.length} artistas de escena local extraídos. Revisa y guarda.`, "ok");
      }
    } catch (e) {
      showMsg(`Error: ${e}`, "err");
    } finally {
      setExtractingSection(null);
    }
  };

  // ── Save override ──────────────────────────────────────────────────────────
  const saveOverride = async () => {
    if (!token || !countryCode) return;
    setSaving(true);
    showMsg("Buscando previews en Deezer y guardando…", "info");

    const section = tracks.length > 0 && artists.length > 0 ? "both"
                  : tracks.length > 0 ? "tracks"
                  : "artists";

    try {
      const res = await fetch(`/api/admin/override/${countryCode}`, {
        method: "POST",
        headers: {
          "x-admin-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryName,
          section,
          tracks: tracks.map((t) => ({ title: t.title, artist: t.artist })),
          artists: artists.map((a) => ({ name: a.name, genre: a.genre })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showMsg(`✅ ¡Guardado! ${countryName} ya muestra los nuevos datos. Abre el mapa y haz clic en el país para verlo.`, "ok");
      await loadOverride(countryCode);
    } catch (e) {
      showMsg(`Error al guardar: ${e}`, "err");
    } finally {
      setSaving(false);
    }
  };

  // ── Save scene override ────────────────────────────────────────────────────
  const saveScene = async () => {
    if (!token || !countryCode || scene.length === 0) return;
    setSavingScene(true);
    showMsg("Buscando artistas en Deezer y guardando escena local…", "info");
    try {
      const res = await fetch(`/api/admin/scene/${countryCode}`, {
        method: "POST",
        headers: { "x-admin-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({
          countryName,
          artists: scene.map((a) => ({ name: a.name, topSong: a.topSong })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showMsg(`✅ ¡Escena local guardada! Abre el mapa, clic en ${countryName} → tab Escena Local para verlo.`, "ok");
      setAutoScene(false);
    } catch (e) {
      showMsg(`Error al guardar escena: ${e}`, "err");
    } finally {
      setSavingScene(false);
    }
  };

  // ── Toggle per-section auto-update ────────────────────────────────────────
  const toggleSection = async (section: SectionKey) => {
    if (!token || !countryCode) return;
    const isAuto = section === "tracks" ? autoTracks
                 : section === "artists" ? autoArtists
                 : autoScene;

    if (isAuto) {
      // Pause: fetch current data and freeze just this section
      setSaving(true);
      showMsg("Congelando datos actuales…", "info");
      try {
        if (section === "scene") {
          const res = await fetch(`/api/country/${countryCode}/scene`);
          const data = await res.json();
          await fetch(`/api/admin/scene/${countryCode}`, {
            method: "POST",
            headers: { "x-admin-token": token!, "Content-Type": "application/json" },
            body: JSON.stringify({
              countryName,
              artists: (data.artists ?? []).map((a: { name: string; topTrack?: { name: string } }) => ({
                name: a.name, topSong: a.topTrack?.name ?? "",
              })),
            }),
          });
          setAutoScene(false);
        } else {
          const res = await fetch(`/api/country/${countryCode}`);
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          await fetch(`/api/admin/override/${countryCode}`, {
            method: "POST",
            headers: { "x-admin-token": token!, "Content-Type": "application/json" },
            body: JSON.stringify({
              countryName,
              section,
              tracks: section === "tracks"
                ? (data.topTracks ?? []).map((t: { name: string; artistName: string }) => ({
                    title: t.name, artist: t.artistName,
                  }))
                : [],
              artists: section === "artists"
                ? (data.topArtists ?? []).map((a: { name: string; genres: string[] }) => ({
                    name: a.name, genre: a.genres?.[0] ?? "",
                  }))
                : [],
            }),
          });
          if (section === "tracks") setAutoTracks(false);
          else setAutoArtists(false);
        }
        const label = section === "tracks" ? "Lo más popular"
                    : section === "artists" ? "Top Artistas"
                    : "Escena Local";
        showMsg(`⏸ ${label} pausado.`, "ok");
        await loadOverride(countryCode);
      } catch (e) {
        showMsg(`Error: ${e}`, "err");
      } finally {
        setSaving(false);
      }
    } else {
      // Resume: delete only this section's override
      if (section === "scene") {
        await fetch(`/api/admin/scene/${countryCode}`, {
          method: "DELETE",
          headers: { "x-admin-token": token! },
        });
        setAutoScene(true);
        setScene([]);
      } else {
        await fetch(`/api/admin/override/${countryCode}?section=${section}`, {
          method: "DELETE",
          headers: { "x-admin-token": token! },
        });
        if (section === "tracks") { setAutoTracks(true); setTracks([]); }
        else { setAutoArtists(true); setArtists([]); }
      }
      const label = section === "tracks" ? "Lo más popular"
                  : section === "artists" ? "Top Artistas"
                  : "Escena Local";
      showMsg(`🔄 ${label} reactivado.`, "ok");
    }
  };

  // ── Clear ALL overrides ────────────────────────────────────────────────────
  const clearOverride = async () => {
    if (!token || !countryCode || !confirm(`¿Eliminar override de ${countryName}?`)) return;
    await Promise.all([
      fetch(`/api/admin/override/${countryCode}`, {
        method: "DELETE", headers: { "x-admin-token": token },
      }),
      fetch(`/api/admin/scene/${countryCode}`, {
        method: "DELETE", headers: { "x-admin-token": token },
      }),
    ]);
    setAutoTracks(true);
    setAutoArtists(true);
    setAutoScene(true);
    setOverrideInfo({ exists: false });
    setTracks([]);
    setArtists([]);
    setScene([]);
    showMsg("Override eliminado. Vuelve a Last.fm/Groq.", "ok");
  };

  const filteredCountries = ALL_COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!authed) return <AuthGate onAuth={handleAuth} />;

  const anyOverrideActive = !autoTracks || !autoArtists || !autoScene;

  return (
    <div className="min-h-screen" style={{ background: "#0d1b2a" }}>
      {/* Confirmation modal */}
      {pending && (
        <SummaryModal
          pending={pending}
          countryName={countryName || "este país"}
          onConfirm={runExtraction}
          onCancel={() => setPending(null)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0a1628]/90 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔧</span>
          <span className="text-white font-bold">SoundGlobal Admin</span>
          <a href="/" className="text-xs text-gray-500 hover:text-gray-300 ml-2 transition-colors">← Volver al mapa</a>
        </div>
        <button
          onClick={() => { setToken(null); setAuthed(false); }}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Cerrar sesión
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Toast — fixed at top so it's always visible */}
        {msg && (
          <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg mx-auto px-4`}>
            <div className={`px-4 py-3 rounded-xl text-sm font-medium shadow-2xl ${
              msg.type === "ok"  ? "bg-green-500 text-white" :
              msg.type === "err" ? "bg-red-500/90 border border-red-400/30 text-white" :
              "bg-[#0e1f35] border border-[#38bdf8]/40 text-[#38bdf8]"
            }`}>
              {msg.text}
            </div>
          </div>
        )}

        {/* Country selector */}
        <div className="bg-[#0a1628] border border-white/10 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Seleccionar país</p>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar país…"
              value={countrySearch || countryName}
              onChange={(e) => { setCountrySearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#38bdf8]/50 transition-colors"
            />
            {showDropdown && filteredCountries.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-[#0e1f35] border border-white/10 rounded-xl shadow-2xl z-20 max-h-56 overflow-y-auto">
                {filteredCountries.slice(0, 40).map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCountryCode(c.code);
                      setCountryName(c.name);
                      setCountrySearch("");
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span>{c.code}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Country status card */}
        {countryCode && (
          <div className="bg-[#0a1628] border border-white/10 rounded-2xl p-5 space-y-3">
            <div>
              <h2 className="text-white font-bold text-base">{countryName}</h2>
              {/* Per-section status summary */}
              <p className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                <span className={autoTracks ? "text-green-400" : "text-amber-400"}>
                  {autoTracks ? "🔄" : "⏸"} Popular
                </span>
                <span className={autoArtists ? "text-green-400" : "text-amber-400"}>
                  {autoArtists ? "🔄" : "⏸"} Artistas
                </span>
                <span className={autoScene ? "text-green-400" : "text-amber-400"}>
                  {autoScene ? "🔄" : "⏸"} Escena
                </span>
              </p>
              {overrideInfo?.cachedAt && anyOverrideActive && (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Override activo · {overrideInfo.trackCount ?? 0} tracks · {overrideInfo.artistCount ?? 0} artistas
                </p>
              )}
            </div>

            {anyOverrideActive && (
              <button
                onClick={clearOverride}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                🗑 Eliminar todos los overrides
              </button>
            )}
          </div>
        )}

        {/* Upload sections */}
        {countryCode && (
          <>
            {/* Lo más popular */}
            <Section
              title="Lo más popular"
              icon="🎵"
              description="Sube una captura de Spotify Charts, Apple Music Top 100, etc."
              fileRef={tracksFileRef}
              onFileChange={(f) => handleFileChange("tracks", f)}
              extracting={extractingSection === "tracks"}
              autoState={autoTracks}
              onToggle={() => toggleSection("tracks")}
              toggleDisabled={saving}
            >
              {tracks.length > 0 && (
                <EditableTrackTable tracks={tracks} onChange={setTracks} />
              )}
            </Section>

            {/* Top Artistas */}
            <Section
              title="Top Artistas"
              icon="🎤"
              description="Sube una captura de top artistas. O añade manualmente."
              fileRef={artistsFileRef}
              onFileChange={(f) => handleFileChange("artists", f)}
              extracting={extractingSection === "artists"}
              autoState={autoArtists}
              onToggle={() => toggleSection("artists")}
              toggleDisabled={saving}
            >
              {artists.length > 0 && (
                <EditableArtistTable artists={artists} onChange={setArtists} />
              )}
            </Section>

            {/* Save tracks + artists — label reflects exactly what has data */}
            {(tracks.length > 0 || artists.length > 0) && (
              <button
                onClick={saveOverride}
                disabled={saving}
                className="w-full py-3 bg-[#38bdf8] hover:bg-[#0ea5e9] disabled:opacity-50 text-[#0d1b2a] font-bold rounded-xl text-sm transition-colors"
              >
                {saving
                  ? "Guardando y buscando en Deezer…"
                  : `💾 Guardar ${[
                      tracks.length > 0 && "Lo más popular",
                      artists.length > 0 && "Top Artistas",
                    ].filter(Boolean).join(" + ")} para ${countryName}`}
              </button>
            )}

            {/* ── Escena Local ────────────────────────────────────────────── */}
            <div className="border-t border-white/5 pt-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3 px-1">
                Sección independiente · se guarda por separado
              </p>
            </div>

            <Section
              title="Escena Local"
              icon="🎸"
              description="Sube una captura con artistas locales del país. Extrae nombre + canción representativa."
              fileRef={sceneFileRef}
              onFileChange={(f) => handleFileChange("scene", f)}
              extracting={extractingSection === "scene"}
              autoState={autoScene}
              onToggle={() => toggleSection("scene")}
              toggleDisabled={saving}
            >
              {scene.length > 0 && (
                <EditableSceneTable scene={scene} onChange={setScene} />
              )}
            </Section>

            {scene.length > 0 && (
              <button
                onClick={saveScene}
                disabled={savingScene}
                className="w-full py-3 bg-purple-500/80 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors"
              >
                {savingScene ? "Guardando escena local en Deezer…" : `🎸 Guardar Escena Local para ${countryName}`}
              </button>
            )}
          </>
        )}

        {/* ── Música de introducción ──────────────────────────────────────── */}
        <div className="border-t border-white/5 pt-4">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1 px-1">Global · independiente del país</p>
        </div>
        <IntroPlaylistManager token={token!} showMsg={showMsg} />

      </div>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({
  title, icon, description, fileRef, onFileChange, extracting,
  autoState, onToggle, toggleDisabled, children,
}: {
  title: string; icon: string; description: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (f: File) => void;
  extracting: boolean;
  autoState: boolean;
  onToggle: () => void;
  toggleDisabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-[#0a1628] border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">{icon} {title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <MiniToggle active={autoState} onToggle={onToggle} disabled={toggleDisabled} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={extracting}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-300 hover:text-white transition-colors disabled:opacity-40"
          >
            📸 Subir captura
          </button>
        </div>
      </div>
      <input
        type="file"
        accept="image/*"
        ref={fileRef}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChange(f); }}
      />
      {extracting && (
        <div className="flex items-center gap-2 text-[#38bdf8] text-xs">
          <div className="w-3 h-3 border border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
          Extrayendo con IA…
        </div>
      )}
      {children}
    </div>
  );
}

// ── Editable track table ──────────────────────────────────────────────────────
function EditableTrackTable({
  tracks, onChange,
}: {
  tracks: { rank: number; title: string; artist: string }[];
  onChange: (t: { rank: number; title: string; artist: string }[]) => void;
}) {
  const update = (i: number, field: "title" | "artist", val: string) => {
    const next = [...tracks];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const remove = (i: number) => onChange(tracks.filter((_, j) => j !== i));
  const add    = () => onChange([...tracks, { rank: tracks.length + 1, title: "", artist: "" }]);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-gray-600 uppercase tracking-widest">{tracks.length} canciones extraídas — edita si algo está mal</p>
      {tracks.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-gray-600 text-xs w-5 text-right flex-shrink-0">{t.rank}</span>
          <input
            value={t.title}
            onChange={(e) => update(i, "title", e.target.value)}
            placeholder="Título"
            className="flex-1 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#38bdf8]/30 min-w-0"
          />
          <input
            value={t.artist}
            onChange={(e) => update(i, "artist", e.target.value)}
            placeholder="Artista"
            className="flex-1 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#38bdf8]/30 min-w-0"
          />
          <button onClick={() => remove(i)} className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0 transition-colors">✕</button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">+ Añadir fila</button>
    </div>
  );
}

// ── Editable scene table ──────────────────────────────────────────────────────
function EditableSceneTable({
  scene, onChange,
}: {
  scene: { name: string; topSong: string }[];
  onChange: (s: { name: string; topSong: string }[]) => void;
}) {
  const update = (i: number, field: "name" | "topSong", val: string) => {
    const next = [...scene];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const remove = (i: number) => onChange(scene.filter((_, j) => j !== i));
  const add    = () => onChange([...scene, { name: "", topSong: "" }]);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-gray-600 uppercase tracking-widest">{scene.length} artistas de escena local — edita si algo está mal</p>
      {scene.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={a.name}
            onChange={(e) => update(i, "name", e.target.value)}
            placeholder="Artista"
            className="flex-1 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400/30 min-w-0"
          />
          <input
            value={a.topSong}
            onChange={(e) => update(i, "topSong", e.target.value)}
            placeholder="Canción representativa"
            className="flex-1 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-purple-400/30 min-w-0"
          />
          <button onClick={() => remove(i)} className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0 transition-colors">✕</button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">+ Añadir artista</button>
    </div>
  );
}

// ── Editable artist table ─────────────────────────────────────────────────────
function EditableArtistTable({
  artists, onChange,
}: {
  artists: { name: string; genre: string }[];
  onChange: (a: { name: string; genre: string }[]) => void;
}) {
  const update = (i: number, field: "name" | "genre", val: string) => {
    const next = [...artists];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const remove = (i: number) => onChange(artists.filter((_, j) => j !== i));
  const add    = () => onChange([...artists, { name: "", genre: "" }]);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-gray-600 uppercase tracking-widest">{artists.length} artistas extraídos</p>
      {artists.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={a.name}
            onChange={(e) => update(i, "name", e.target.value)}
            placeholder="Artista"
            className="flex-1 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#38bdf8]/30 min-w-0"
          />
          <input
            value={a.genre}
            onChange={(e) => update(i, "genre", e.target.value)}
            placeholder="Género"
            className="w-28 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#38bdf8]/30 flex-shrink-0"
          />
          <button onClick={() => remove(i)} className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0 transition-colors">✕</button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">+ Añadir artista</button>
    </div>
  );
}

// ── Intro Playlist Manager ────────────────────────────────────────────────────
interface IntroTrack {
  title: string; artist: string; preview: string;
  albumImageUrl: string; deezerUrl: string;
}

function IntroPlaylistManager({ token, showMsg }: {
  token: string;
  showMsg: (text: string, type: "ok" | "err" | "info") => void;
}) {
  const [playlist, setPlaylist]   = useState<IntroTrack[]>([]);
  const [newTitle, setNewTitle]   = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified]   = useState<IntroTrack | null>(null);
  const [saving, setSaving]       = useState(false);
  const [loaded, setLoaded]       = useState(false);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/admin/intro-playlist", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((d) => { setPlaylist(d.playlist ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [token]);

  const verify = async () => {
    if (!newTitle.trim()) return;
    setVerifying(true);
    setVerified(null);
    try {
      const params = new URLSearchParams({ title: newTitle, artist: newArtist });
      const res  = await fetch(`/api/admin/verify-track?${params}`, { headers: { "x-admin-token": token } });
      const data = await res.json();
      if (!res.ok || !data.found) {
        showMsg("❌ No encontrado en Deezer o sin preview disponible.", "err");
      } else {
        setVerified(data);
        if (previewRef.current) { previewRef.current.pause(); previewRef.current = null; }
        if (data.preview) {
          const a = new Audio(data.preview);
          a.volume = 0.5;
          a.play().catch(() => {});
          previewRef.current = a;
          setTimeout(() => { a.pause(); }, 5000);
        }
      }
    } catch { showMsg("Error verificando", "err"); }
    finally { setVerifying(false); }
  };

  const addTrack = () => {
    if (!verified) return;
    setPlaylist((p) => [...p, verified]);
    setVerified(null); setNewTitle(""); setNewArtist("");
  };

  const remove   = (i: number) => setPlaylist((p) => p.filter((_, j) => j !== i));
  const moveUp   = (i: number) => { if (i === 0) return; setPlaylist((p) => { const n=[...p]; [n[i-1],n[i]]=[n[i],n[i-1]]; return n; }); };
  const moveDown = (i: number) => { if (i===playlist.length-1) return; setPlaylist((p) => { const n=[...p]; [n[i],n[i+1]]=[n[i+1],n[i]]; return n; }); };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/intro-playlist", {
        method: "POST",
        headers: { "x-admin-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ playlist }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(`✅ Playlist guardada — ${d.count} canciones. Rota cada hora automáticamente.`, "ok");
    } catch (e) { showMsg(`Error: ${e}`, "err"); }
    finally { setSaving(false); }
  };

  const hourIndex = playlist.length > 0 ? Math.floor(Date.now() / 3_600_000) % playlist.length : -1;

  return (
    <div className="bg-[#0a1628] border border-white/10 rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-white font-semibold text-sm">🎧 Música de introducción</h3>
        <p className="text-xs text-gray-500 mt-0.5">Las canciones rotan cada hora. Verifica en Deezer antes de añadir — reproduce 5s para que confirmes.</p>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input value={newTitle} onChange={(e) => { setNewTitle(e.target.value); setVerified(null); }}
            onKeyDown={(e) => e.key === "Enter" && verify()} placeholder="Título"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8]/50 min-w-0" />
          <input value={newArtist} onChange={(e) => { setNewArtist(e.target.value); setVerified(null); }}
            onKeyDown={(e) => e.key === "Enter" && verify()} placeholder="Artista"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8]/50 min-w-0" />
          <button onClick={verify} disabled={verifying || !newTitle.trim()}
            className="flex-shrink-0 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-300 hover:text-white transition-colors disabled:opacity-40">
            {verifying ? "…" : "🔍 Verificar"}
          </button>
        </div>
        {verified && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {verified.albumImageUrl && <img src={verified.albumImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{verified.title}</p>
              <p className="text-green-400 text-[11px]">{verified.artist} · ✅ Preview disponible · 🎵 reproduciendo 5s</p>
            </div>
            <button onClick={addTrack} className="flex-shrink-0 px-3 py-1.5 bg-green-500 hover:bg-green-400 text-white text-xs font-bold rounded-lg transition-colors">+ Añadir</button>
          </div>
        )}
      </div>

      {!loaded ? <p className="text-xs text-gray-600">Cargando…</p>
       : playlist.length === 0 ? <p className="text-xs text-gray-600">Sin canciones — se usa Avicii por defecto.</p>
       : (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest">{playlist.length} canciones · sonando ahora: #{hourIndex + 1}</p>
          {playlist.map((t, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${i===hourIndex ? "bg-[#38bdf8]/10 border border-[#38bdf8]/20" : "bg-white/[0.03]"}`}>
              <span className="text-gray-500 text-[10px] w-4 text-right flex-shrink-0">{i===hourIndex ? "▶" : i+1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.albumImageUrl && <img src={t.albumImageUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs truncate">{t.title}</p>
                <p className="text-gray-500 text-[10px] truncate">{t.artist}</p>
              </div>
              <button onClick={() => moveUp(i)}   className="text-gray-600 hover:text-gray-300 text-xs px-0.5">↑</button>
              <button onClick={() => moveDown(i)} className="text-gray-600 hover:text-gray-300 text-xs px-0.5">↓</button>
              <button onClick={() => remove(i)}   className="text-gray-600 hover:text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      {playlist.length > 0 && (
        <button onClick={save} disabled={saving}
          className="w-full py-2.5 bg-[#38bdf8] hover:bg-[#0ea5e9] disabled:opacity-50 text-[#0d1b2a] font-bold rounded-xl text-sm transition-colors">
          {saving ? "Guardando…" : `💾 Guardar playlist (${playlist.length} canciones)`}
        </button>
      )}
    </div>
  );
}
