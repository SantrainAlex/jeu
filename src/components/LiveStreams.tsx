"use client";

import { useEffect, useState } from "react";
import type { Lives, Stream } from "@/lib/twitch";

type State = { status: "loading" } | { status: "off" } | ({ status: "ok" } & Lives);

const viewers = (n: number) =>
  n >= 1000 ? `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : String(n);

const LANGS: Record<string, string> = { fr: "FR", en: "EN", es: "ES", de: "DE", it: "IT", pt: "PT", ja: "JA", ko: "KO", ru: "RU" };

/**
 * Les personnes en live sur ce jeu (Twitch). Chargé après la page pour ne pas la ralentir ;
 * un clic sur un live l'ouvre dans le lecteur Twitch intégré.
 */
export function LiveStreams({ name, igdbId }: { name: string; igdbId: number | null }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [playing, setPlaying] = useState<Stream | null>(null);
  const [host, setHost] = useState("");

  useEffect(() => {
    setHost(window.location.hostname);
    const params = new URLSearchParams({ name });
    if (igdbId) params.set("igdb", String(igdbId));
    let cancelled = false;
    fetch(`/api/lives?${params}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setState(d.available ? { status: "ok", ...d } : { status: "off" }))
      .catch(() => !cancelled && setState({ status: "off" }));
    return () => {
      cancelled = true;
    };
  }, [name, igdbId]);

  // Twitch n'est pas configuré ou ne répond pas : on n'affiche rien
  if (state.status === "off") return null;

  const directory = `https://www.twitch.tv/search?term=${encodeURIComponent(state.status === "ok" ? (state.twitchGame ?? name) : name)}`;

  return (
    <section>
      <h2>
        <span className="live-dot" aria-hidden="true" /> En live
        {state.status === "ok" && state.streams.length > 0 && <span className="count mono">{state.streams.length}</span>}
      </h2>

      {state.status === "loading" && (
        <ul className="lives" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="live-card skeleton-block" style={{ aspectRatio: "16 / 11" }} />
          ))}
        </ul>
      )}

      {state.status === "ok" && state.streams.length === 0 && (
        <p className="muted">
          Personne n&apos;est en live sur ce jeu en ce moment.{" "}
          <a href={directory} target="_blank" rel="noreferrer">Voir sur Twitch</a>
        </p>
      )}

      {state.status === "ok" && state.streams.length > 0 && (
        <>
          {playing && host && (
            <div className="live-player">
              <div className="video-frame">
                <iframe
                  key={playing.channel}
                  src={`https://player.twitch.tv/?channel=${playing.channel}&parent=${host}&autoplay=true&muted=false`}
                  title={`Live de ${playing.name}`}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
              <div className="live-player-bar">
                <span>
                  <strong>{playing.name}</strong> · {viewers(playing.viewers)} spectateurs
                </span>
                <span className="live-player-actions">
                  <a href={`https://www.twitch.tv/${playing.channel}`} target="_blank" rel="noreferrer" className="link">
                    Ouvrir sur Twitch ↗
                  </a>
                  <button type="button" className="chip" onClick={() => setPlaying(null)}>Fermer</button>
                </span>
              </div>
            </div>
          )}
          <ul className="lives">
            {state.streams.map((s) => (
              <li key={s.channel}>
                <button
                  type="button"
                  className={playing?.channel === s.channel ? "live-card active" : "live-card"}
                  onClick={() => setPlaying(s)}
                  aria-label={`Regarder le live de ${s.name}`}
                >
                  <span className="live-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumbnail} alt="" loading="lazy" />
                    <span className="live-badge">LIVE</span>
                    <span className="live-viewers mono">{viewers(s.viewers)} 👁</span>
                  </span>
                  <span className="live-info">
                    <strong>
                      {s.name}
                      {LANGS[s.language] && <span className="tag">{LANGS[s.language]}</span>}
                    </strong>
                    <span className="live-title">{s.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">
            Lives fournis par Twitch, en français d&apos;abord. <a href={directory} target="_blank" rel="noreferrer">Tous les lives sur Twitch</a>
          </p>
        </>
      )}
    </section>
  );
}
