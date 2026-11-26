"use client";

import { useEffect, useState } from "react";
import type { Offer, ShopLink } from "@/lib/shops";
import { ExternalLabel } from "./ExternalLabel";

const euros = (n: number, currency: string) => n.toLocaleString("fr-FR", { style: "currency", currency });

type Props = {
  name: string;
  /** boutiques officielles qui vendent vraiment le jeu (liens directs) */
  stores: { name: string; url: string }[];
  /** liens de recherche vers d'autres boutiques (seulement quand elles vendent sûrement le jeu) */
  links: ShopLink[];
  withPrices: boolean;
  free: boolean;
};

/** « Où l'acheter » : prix du moment, boutiques officielles du jeu, et autres boutiques probables. */
export function WhereToBuy({ name, stores, links, withPrices, free }: Props) {
  const [offers, setOffers] = useState<Offer[] | null>(withPrices ? null : []);

  useEffect(() => {
    if (!withPrices) return;
    let cancelled = false;
    fetch(`/api/prix?${new URLSearchParams({ name })}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setOffers(d.offers ?? []))
      .catch(() => !cancelled && setOffers([]));
    return () => {
      cancelled = true;
    };
  }, [name, withPrices]);

  const affiliate = links.some((l) => l.affiliate);
  // rien de sûr à proposer : mieux vaut ne rien afficher qu'un lien vers une boutique qui ne vend pas le jeu
  if (offers !== null && offers.length === 0 && stores.length === 0 && links.length === 0) return null;

  return (
    <div className="buy">
      <h2>{free ? "Où y jouer" : "Où l'acheter"}</h2>
      <div className="buy-box">
        {offers === null && (
          <div aria-busy="true">
            <div className="line" style={{ width: "80%" }} />
            <div className="line" style={{ width: "60%" }} />
          </div>
        )}
        {offers && offers.length > 0 && (
          <ul className="offers">
            {offers.map((o, i) => (
              <li key={o.shop}>
                <a href={o.url} target="_blank" rel="noopener noreferrer sponsored" className="offer">
                  <span className="offer-shop">
                    {o.shop}
                    {i === 0 && <span className="best">Meilleur prix</span>}
                  </span>
                  <span className="offer-price">
                    {o.cut > 0 && (
                      <span className="cut mono" title={`Prix habituel : ${euros(o.regular, o.currency)}`}>
                        -{o.cut} %
                      </span>
                    )}
                    <strong className="mono">{euros(o.price, o.currency)}</strong>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {offers && offers.length > 0 && <p className="muted tiny">Prix PC du moment, via IsThereAnyDeal.</p>}
        {free && <p className="free">Ce jeu est gratuit.</p>}
        {stores.length > 0 && (
          <>
            <p className="muted tiny">{free ? "À télécharger sur :" : "Vendu sur :"}</p>
            <div className="store-links">
              {stores.map((st) => (
                <a key={st.url} href={st.url} target="_blank" rel="noopener noreferrer" className="chip">
                  <ExternalLabel>{st.name}</ExternalLabel>
                </a>
              ))}
            </div>
          </>
        )}
        {links.length > 0 && (
          <>
            <p className="muted tiny">Comparer le prix sur :</p>
            <div className="shop-links">
              {links.map((l) => (
                <a key={l.shop} href={l.url} target="_blank" rel="noopener noreferrer sponsored" className="button ghost ext-button">
                  <ExternalLabel>{l.shop}</ExternalLabel>
                </a>
              ))}
            </div>
          </>
        )}
        {affiliate && (
          <p className="muted tiny">Liens affiliés : si tu achètes par ces liens, le site touche une petite commission, sans surcoût pour toi.</p>
        )}
      </div>
    </div>
  );
}
