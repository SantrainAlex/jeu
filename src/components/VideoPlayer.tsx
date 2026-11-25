"use client";

import { useState } from "react";
import type { Video } from "@/lib/details";

const thumb = (v: Video) => (v.kind === "youtube" ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : v.poster);

/** Lecteur des vidéos d'un jeu : la vidéo choisie en grand, les autres en vignettes dessous. */
export function VideoPlayer({ videos, title }: { videos: Video[]; title: string }) {
  const [index, setIndex] = useState(0);
  // la vidéo YouTube ne se charge qu'au clic : la page reste rapide et YouTube n'est contacté que si on veut regarder
  const [playing, setPlaying] = useState(false);
  const video = videos[index];
  const choose = (i: number) => {
    setIndex(i);
    setPlaying(true);
  };

  return (
    <div className="video-player">
      <div className="video-frame">
        {video.kind === "youtube" ? (
          playing ? (
            <iframe
              key={video.id}
              src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
              title={`${title} — ${video.name}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <button type="button" className="video-cover" onClick={() => setPlaying(true)} aria-label={`Lire la vidéo : ${video.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(video) ?? ""} alt="" />
              <span className="play-button" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
              </span>
              <span className="video-name">{video.name}</span>
            </button>
          )
        ) : (
          <video key={video.src} src={video.src} poster={video.poster ?? undefined} controls autoPlay={playing} preload="none" playsInline />
        )}
      </div>
      {videos.length > 1 && (
        <ul className="video-list">
          {videos.map((v, i) => (
            <li key={i}>
              <button type="button" className={i === index ? "video-thumb active" : "video-thumb"} onClick={() => choose(i)}>
                <span className="video-thumb-img">
                  {thumb(v) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb(v)!} alt="" loading="lazy" />
                  )}
                  <span className="mini-play" aria-hidden="true">▶</span>
                </span>
                <span className="video-thumb-name">{v.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
