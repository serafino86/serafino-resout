# Onboarding restaurant — Ligne de Réservation

Procédure pour activer un nouveau client, du « oui » jusqu'à la ligne live. Cible : < 1 heure.

---

## Ce que veut dire « installation offerte »

Le restaurateur ne paie **aucun frais de mise en place**. Serafino :
- fournit le numéro technique (ligne Twilio locale GE),
- configure l'assistant (voix FR, questions, notifications),
- teste de bout en bout,
- forme le patron en 10 min.

Le client paie seulement l'abonnement **99 CHF/mois** (149 Pro), et **uniquement après les 30 jours d'essai**. Sans engagement : il peut arrêter quand il veut.

Le restaurant **garde son numéro actuel**. Les appels non décrochés basculent sur l'assistant (renvoi conditionnel).

---

## Pré-requis (à vérifier AVANT le 1er client)

- [ ] **Twilio rechargé** (~100-150 $). Sans solde, impossible de provisionner un numéro. ⚠️ bloquant.
- [ ] Bundle CH Local + Mobile Individual approuvé (déjà fait).
- [ ] Service `centralina-reservations.service` (port 8101) up sur le VPS.
- [ ] Bot manager partagé `@serafinoreservations_bot` actif.

---

## Étapes opérationnelles

### 1. Provisionner le numéro Twilio (ou démarrer sur la démo)
Pour une démo/essai rapide on peut router le client sur le numéro démo existant (+41 22 539 49 59). Pour la prod, provisionner un numéro local GE dédié (~1.15 $/mois) et pointer son `voice_url` vers `/webhook/reservations/twilio/`.

### 2. Enregistrer le restaurant dans le registre
```bash
python scripts/add_resto.py \
  --number +41XXXXXXXXX \
  --name "Nom du Restaurant" \
  --client-id resto-NOM \
  --manager-chat-id <CHAT_ID_TELEGRAM>
```
Cela ajoute la ligne au registre (`/var/lib/centralina/reservations/restaurants.json`) et configure le `voice_url` Twilio.

### 3. Le patron se connecte au bot
- Le patron ouvre Telegram, cherche **@serafinoreservations_bot**, fait **/start**.
- Récupérer son `chat_id` (loggé côté service au /start) → c'est le `--manager-chat-id` de l'étape 2. (Si fait après, mettre à jour via `upsert_restaurant`.)

### 4. Activer le service pour ce restaurant
Mettre `service_active=true` dans `reservation_settings/<client_id>.json` (ou via la commande **/menu** du bot, qui résout le restaurant depuis le chat_id et écrit SES réglages).

### 5. Renvoi d'appel sur le numéro du restaurant
Le restaurant configure le **renvoi conditionnel** (sur non-réponse + occupé) de son numéro vers le numéro technique. Codes GSM courants (à confirmer selon opérateur Swisscom / Salt / Sunrise) :
- Renvoi sur non-réponse : `**61*<NUMERO_TECHNIQUE>#` puis appel.
- Renvoi sur occupé : `**67*<NUMERO_TECHNIQUE>#` puis appel.
- Annuler : `##61#` / `##67#`.
Pour une ligne fixe (centrale/PBX du resto), passer par l'interface opérateur. → Le client garde son numéro public.

### 6. Test de bout en bout
- Appeler le numéro du restaurant **sans décrocher** → ça bascule sur l'assistant.
- Faire une réservation complète (prénom, nb personnes, jour, heure).
- Vérifier la notif Telegram chez le patron → bouton **✅ Confirmer** → le client reçoit le **SMS**.

### 7. Formation patron (10 min)
- Chaque demande arrive sur Telegram : **✅ Confirmer** / **❌ Refuser**. Rien n'est réservé sans lui.
- **/menu** : activer/désactiver la ligne, basculer auto/manuel.
- Le client reçoit toujours un SMS de confirmation après un ✅.

---

## Démarrage essai → facturation
- J0 : ligne live, début essai 30 jours (gratuit).
- J+25 : point de contact, mesurer les réservations captées.
- J+30 : si OK → abonnement 99 CHF/mois (149 Pro). Sinon → on coupe, le client reprend son numéro (annuler les renvois).

## Économie (interne)
Numéro Twilio ~1.15 $/mois + ~0.01 $/min entrant ≈ 5-15 $/mois par resto. Marge ≈ 85-95 CHF/mois par client. Voir `reservation_mvp` (mémoire).

## Liens
- Page produit : https://serafino-resout.ch/reservations.html
- Démo live : +41 22 539 49 59
- Template emails : `COLD_EMAIL_RESTAURANT_RESERVATIONS.md`
- Liste prospects : `OUTREACH_BATCH_01.md`
