/**
 * Le gardien de la règle d'architecture n°1.
 *
 * Le cœur (src/core/) est PUR. Cette contrainte ne doit pas reposer sur la
 * discipline : elle est vérifiée mécaniquement, à chaque exécution des tests.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CORE_DIR = fileURLToPath(new URL("../src/core", import.meta.url));

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * Retire les commentaires : le cœur cite abondamment le carnet, et une règle
 * expliquée dans une phrase ne doit pas être confondue avec sa violation.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const files = collectFiles(CORE_DIR).map((path) => ({
  dir: dirname(path),
  name: relative(CORE_DIR, path).replaceAll("\\", "/"),
  code: stripComments(readFileSync(path, "utf8")),
}));

/** Ce que le cœur n'a pas le droit de toucher. */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\bMath\.random\b/, why: "l'aléatoire passe par le PRNG seedé de rng.ts" },
  { pattern: /\bDate\.now\b/, why: "le cœur n'a pas d'horloge" },
  { pattern: /\bperformance\.now\b/, why: "le cœur n'a pas d'horloge" },
  { pattern: /\bdocument\./, why: "le cœur ne connaît pas le DOM" },
  { pattern: /\bwindow\./, why: "le cœur ne connaît pas le navigateur" },
  { pattern: /\brequestAnimationFrame\b/, why: "le cœur ne sait pas qu'une animation existe" },
  { pattern: /\bconsole\./, why: "le cœur ne rend rien, il émet des événements" },
  { pattern: /\bAudioContext\b/, why: "le cœur ne sonorise pas" },
];

const IMPORT_RE = /^\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/gm;

describe("Pureté du cœur", () => {
  it("trouve bien les fichiers du cœur", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("n'importe rien hors de src/core/", () => {
    const offenders: string[] = [];

    for (const file of files) {
      for (const match of file.code.matchAll(IMPORT_RE)) {
        const specifier = match[1]!;

        // Tout paquet externe est interdit : le cœur ne dépend de rien.
        if (!specifier.startsWith(".")) {
          offenders.push(`${file.name} importe le paquet « ${specifier} »`);
          continue;
        }

        // Les chemins relatifs sont permis tant qu'ils restent dans le cœur.
        const target = resolve(file.dir, specifier);
        if (relative(CORE_DIR, target).startsWith("..")) {
          offenders.push(`${file.name} importe « ${specifier} », hors du cœur`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("ne touche ni au rendu, ni au son, ni à l'horloge, ni au hasard global", () => {
    const offenders: string[] = [];

    for (const file of files) {
      for (const { pattern, why } of FORBIDDEN) {
        if (pattern.test(file.code)) {
          offenders.push(`${file.name} : ${pattern.source} — ${why}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /**
   * Règle n°2 du projet : « si tu écris 12, 2, 3 ou 6 dans le cœur, c'est un
   * bug ». On garde les Nœuds du plateau hors du moteur : les valeurs de jeu
   * vivent dans src/presets/.
   */
  it("ne code en dur aucune valeur de plateau", () => {
    const offenders: string[] = [];
    const suspicious = /\b(?:nodeCount|captureThresholds|turnLimit|quota)\s*[:=]\s*\d/;

    for (const file of files) {
      if (suspicious.test(file.code)) {
        offenders.push(file.name);
      }
    }

    expect(offenders).toEqual([]);
  });
});
