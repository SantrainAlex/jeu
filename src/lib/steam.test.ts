import { describe, expect, it } from "vitest";
import { parseRequirements, steamAppId, toSteamInfo } from "./steam";

const MIN =
  '<strong>Minimale :</strong><br><ul class="bb_ul"><li>Processeur 64 bits et système d\'exploitation obligatoires<br></li>' +
  "<li><strong>Système d'exploitation *:</strong> Windows 10<br></li><li><strong>Processeur :</strong> Intel Core i5-8400 | AMD Ryzen 3 3300X<br></li>" +
  "<li><strong>Mémoire vive :</strong> 12 GB de mémoire<br></li><li><strong>Graphiques :</strong> NVIDIA GeForce GTX 1060 3 GB<br></li>" +
  "<li><strong>Espace disque :</strong> 60 GB d'espace disque disponible</li></ul>";

describe("Steam", () => {
  it("trouve le numéro Steam dans les liens des boutiques", () => {
    expect(steamAppId([{ url: "https://store.playstation.com/x" }, { url: "https://store.steampowered.com/app/1245620/ELDEN_RING/" }])).toBe(1245620);
    expect(steamAppId([{ url: "https://www.gog.com/game/x" }])).toBeNull();
  });

  it("lit la configuration PC et met des noms en français", () => {
    expect(parseRequirements(MIN)).toEqual([
      { label: "Système", value: "Windows 10" },
      { label: "Processeur", value: "Intel Core i5-8400 | AMD Ryzen 3 3300X" },
      { label: "Mémoire vive", value: "12 GB de mémoire" },
      { label: "Carte graphique", value: "NVIDIA GeForce GTX 1060 3 GB" },
      { label: "Stockage", value: "60 GB d'espace disque disponible" },
    ]);
    expect(parseRequirements(undefined)).toEqual([]);
  });

  it("manette : entièrement, en partie, ou inconnu", () => {
    expect(toSteamInfo({ controller_support: "full" }).controller).toBe("full");
    expect(toSteamInfo({ categories: [{ id: 18 }] }).controller).toBe("partial");
    expect(toSteamInfo({ categories: [{ id: 2 }] }).controller).toBeNull();
  });

  it("garde la description française seulement si elle est assez longue, et accepte une config vide", () => {
    const info = toSteamInfo({
      short_description: "Un RPG d&#39;action en monde ouvert dans l&#39;Entre-terre, créé par FromSoftware.",
      pc_requirements: [],
    });
    expect(info.shortFr).toBe("Un RPG d'action en monde ouvert dans l'Entre-terre, créé par FromSoftware.");
    expect(info.pc).toBeNull();
    expect(toSteamInfo({ short_description: "Court." }).shortFr).toBeNull();
  });
});
