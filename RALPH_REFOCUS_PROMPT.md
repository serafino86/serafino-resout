# RALPH — Rifocalizzazione sito Serafino Résout sui 2 prodotti

Sei un agente che lavora sul sito statico di Serafino Résout (`site/*.html`). Ogni volta rileggi questo file: è la tua UNICA memoria. Lo stato reale vive in git + nel ledger `REFOCUS_PROGRESS.md`.

## OBIETTIVO
Il sito oggi vende ~12 cose (nav con 9 voci) → confonde. Il business è **2 prodotti soli** (deciso nel BP). Allinea TUTTO il sito a 2 prodotti + prezzi nuovi, senza cancellare nulla.

## LE DECISIONI (già prese, non ridiscuterle)
1. **Due prodotti, una scala:**
   - **Ligne de Réservation** — SERVIZIO gestito per ristoranti (il telefono che risponde 24/7). Prezzi NUOVI: **Standard 199 CHF/mois**, **Pro 299 CHF/mois**, essai 30 jours offert, installation offerte. (Prima era 99/149 → AGGIORNA ovunque a 199/299.)
   - **Centralina** — SISTEMA posseduto dal cliente (one-time, code au client, zéro abonnement) per PME/artigiani.
2. **Nav principale = SOLO 3 voci** su OGNI pagina: `Réservations` · `La Centralina` · `Diagnostic`. (+ eventuale contatto/CTA.)
3. **Declassa** dentro la pagina Centralina (NON nella nav principale): HORECA, Artisans, PME (sono segmenti di Centralina).
4. **Togli dalla NAV** (ma NON cancellare i file .html): Calculateur, Plan de Veille, Ateliers IA, Coaching, Coaching-vibe-coder, Automatisation, Bot-personalisé, App-sur-mesure, Formation-IA.
5. **Positioning da preservare:** Enrico ex-chef 20 ans ("je l'ai vécu de l'intérieur"), histoire La Tana Volsca, USP anti-dépendance ("je ne vous loue jamais un logiciel à vie"). La Ligne de Réservation è la PUNTA (cuneo) davanti, Centralina dietro.

## COME LAVORARE (incrementale, un pezzo per giro)
- OGNI pagina `.html` ha la SUA nav (nessun header condiviso) → vanno aggiornate TUTTE in modo identico.
- Ogni giro: apri `REFOCUS_PROGRESS.md`, prendi la prossima pagina NON ancora fatta, aggiorna la sua nav ai 3 voci + (se contiene prezzi Réservations) porta 99→199 e 149→299, poi segna la pagina come ✅ nel ledger con una riga di cosa hai cambiato.
- Se `REFOCUS_PROGRESS.md` non esiste, crealo elencando tutte le pagine `site/*.html` da sistemare come `[ ]`.
- Lavora a piccoli passi verificabili. Non riscrivere intere pagine: modifica nav + prezzi + eventuale riferimento disperso.

## GUARDRAIL (assoluti — non violare mai)
- Lavora SOLO sul branch corrente `refocus-2-produits`. **MAI** `git push`, **MAI** deploy, **MAI** `rsync` verso il VPS. Nulla va online. Enrico rivede prima.
- **NON cancellare** file `.html` (le pagine archiviate restano su disco, solo tolte dalla nav).
- **NON** scrivere "en production", "déployé", "clienti attivi" (sono demo). Rispetta il posizionamento reale.
- **NON** toccare `bot/`, il Radar, `opt_radar_*`, `deploy.sh`.
- Se un cambiamento è ambiguo, scrivilo in `REFOCUS_PROGRESS.md` sotto "DA CHIEDERE A ENRICO" e vai avanti con le pagine chiare.

## FINE
Quando: (a) tutte le pagine in `REFOCUS_PROGRESS.md` sono ✅, (b) nav a 3 voci ovunque, (c) prezzi Réservations = 199/299 ovunque compaiono → scrivi un riepilogo finale in `REFOCUS_PROGRESS.md` e crea il file `.ralph-done`. Altrimenti continua al prossimo giro.
