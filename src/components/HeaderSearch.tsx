"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const loupe = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

type Suggestion = { id: number; name: string; year: string | null; image: string | null; href: string };

/** Temps d'attente après la dernière lettre tapée avant de demander les suggestions (ms). */
const WAIT = 250;

/**
 * Barre de recherche de l'en-tête : cherche un jeu sur toutes les plateformes (page /recherche).
 * Pendant qu'on tape (2 lettres ou plus), quelques jeux sont proposés juste en dessous :
 * un clic (ou flèches + Entrée) ouvre directement la fiche du jeu.
 */
export function HeaderSearch() {
  const path = usePathname();
  const q = useSearchParams()?.get("q") ?? "";
  const current = path === "/recherche" ? q : "";
  // key : le champ se remet à jour quand on change de recherche ou de page
  return <SearchBox key={`${path}|${current}`} initial={current} />;
}

/** Version affichée le temps que l'adresse de la page soit connue. */
export function HeaderSearchFallback() {
  return <SearchBox initial="" />;
}

function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState(initial);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1); // suggestion choisie au clavier (-1 = aucune)
  const typed = useRef(false); // on ne propose rien tant que la personne n'a pas tapé

  const wanted = text.trim();
  useEffect(() => {
    if (!typed.current || wanted.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    const stop = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/recherche?q=${encodeURIComponent(wanted)}`, { signal: stop.signal });
        const data = (await res.json()) as { games?: Suggestion[] };
        setItems(data.games ?? []);
        setActive(-1);
      } catch {
        if (!stop.signal.aborted) setItems([]);
      } finally {
        if (!stop.signal.aborted) setLoading(false);
      }
    }, WAIT);
    return () => {
      clearTimeout(timer);
      stop.abort();
    };
  }, [wanted]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const allResults = `/recherche?q=${encodeURIComponent(wanted)}`;
  const show = open && wanted.length >= 2 && (loading || items.length > 0 || typed.current);

  return (
    <form
      className="header-search"
      action="/recherche"
      role="search"
      onSubmit={(e) => {
        // une suggestion choisie au clavier : on ouvre sa fiche
        if (active >= 0 && items[active]) {
          e.preventDefault();
          go(items[active].href);
        } else {
          setOpen(false);
        }
      }}
    >
      {loupe}
      <input
        type="search"
        name="q"
        value={text}
        onChange={(e) => {
          typed.current = true;
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (!items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
          }
        }}
        placeholder="Rechercher un jeu…"
        aria-label="Rechercher un jeu"
        enterKeyHint="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />
      {show && (
        // onMouseDown : on choisit avant que le champ perde le focus (sinon la liste se ferme d'abord)
        <div className="suggestions" onMouseDown={(e) => e.preventDefault()}>
          <ul id={listId} role="listbox" aria-label="Suggestions">
            {items.map((g, i) => (
              <li key={g.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <a href={g.href} className={i === active ? "active" : undefined} onClick={(e) => { e.preventDefault(); go(g.href); }}>
                  {g.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.image} alt="" loading="lazy" />
                  ) : (
                    <span className="suggestion-placeholder">{g.name.slice(0, 1)}</span>
                  )}
                  <span className="suggestion-name">{g.name}</span>
                  {g.year && <span className="suggestion-year">{g.year}</span>}
                </a>
              </li>
            ))}
          </ul>
          {loading && items.length === 0 && <p className="suggestion-note">Recherche…</p>}
          {!loading && items.length === 0 && <p className="suggestion-note">Aucun jeu trouvé.</p>}
          {items.length > 0 && (
            <a href={allResults} className="suggestion-all" onClick={(e) => { e.preventDefault(); go(allResults); }}>
              Voir tous les résultats pour « {wanted} »
            </a>
          )}
        </div>
      )}
    </form>
  );
}
