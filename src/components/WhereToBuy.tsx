"use client";

import { useEffect, useState } from "react";
import type { Offer, ShopLink } from "@/lib/shops";

const euros = (n: number, currency: string) => n.toLocaleString("fr-FR", { style: "currency", currency });

/** « Où l'acheter » : prix du moment chez les boutiques PC, et liens vers d'autres boutiques. */
export function WhereToBuy({ name, links, withPrices }: { name: string; links: ShopLink[]; withPrices: boolean }) {
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

  return (
    <div className="buy">
      <h2>Où l&apos;acheter</h2>
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
        <p className="muted tiny">Voir le prix sur :</p>
        <div className="shop-links">
          {links.map((l) => (
            <a key={l.shop} href={l.url} target="_blank" rel="noopener noreferrer sponsored" className="button ghost">
              {l.shop} ↗
            </a>
          ))}
        </div>
        {affiliate && (
          <p className="muted tiny">Liens affiliés : si tu achètes par ces liens, le site touche une petite commission, sans surcoût pour toi.</p>
        )}
      </div>
    </div>
  );
}
