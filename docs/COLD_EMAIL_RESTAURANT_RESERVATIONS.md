# Cold email — Linea Prenotazioni (ristoranti GE)

**Gancio killer**: il numero demo è LIVE. Il prospect può **chiamarlo e sentire il prodotto** dall'email. Pochissimi cold email lo permettono.

---

## EMAIL 1 (primo contatto, FR)

**Oggetto** (testa 2 varianti):
- A: `Votre téléphone sonne pendant le service — appelez le 022 539 49 59`
- B: `[Nom du resto] : combien de réservations manquées le soir ?`

**Corpo:**
> Bonjour,
>
> Le soir, en plein service, le téléphone sonne et personne ne peut répondre. Chaque appel manqué, c'est une table perdue.
>
> J'ai construit une **ligne de réservation qui répond toute seule, 24h/24**, en français — voix naturelle, pas un robot.
>
> **Testez-la maintenant : appelez le +41 22 539 49 59.** C'est l'assistant qui répond. Faites une réservation, vous verrez.
>
> Vous recevez chaque demande sur votre téléphone, vous confirmez d'un clic, le client reçoit un SMS. Vous gardez le contrôle.
>
> Si ça vous plaît, je vous monte la même chose sur **votre** numéro en moins d'une heure. Dès 99 CHF/mois, essai 30 jours, sans engagement, installation offerte.
>
> Une démo de 60 secondes ? [lien vidéo]
>
> Enrico — Serafino Résout, Genève
> 📞 +41 78 658 37 60

---

## EMAIL 2 (relance a 3-4 giorni, se no risposta)

**Oggetto:** `Re: votre ligne réservations`

> Bonjour,
>
> Vous avez essayé le +41 22 539 49 59 ? En 60 secondes vous entendez exactement ce que vos clients entendraient.
>
> Concrètement pour [Nom du resto] : zéro réservation manquée le soir, vous validez tout depuis votre téléphone, et vous gardez votre numéro actuel (les appels non décrochés basculent sur l'assistant).
>
> 15 minutes cette semaine pour vous montrer ?
>
> Enrico

---

## EMAIL 3 (ultima, valore + chiusura soft)

**Oggetto:** `Je vous laisse tranquille — mais gardez ça sous le coude`

> Bonjour,
> Pas de souci si ce n'est pas le moment. Le numéro de démo reste actif : +41 22 539 49 59. Le jour où vous en avez marre des appels manqués, j'active votre ligne en une heure.
> Bonne continuation,
> Enrico

---

## COME LANCIARLA (operativo)

L'autopilot Serafino esiste già (`serafino_email_autopilot.py`, draft 6h; `serafino_email_sender.py`, invio 9-18 lun-sab) ed è già sector-aware.

**Passi:**
1. **Arricchire le email dei lead restaurant** — il collo di bottiglia è la copertura email (molti lead restaurant senza email valida). Far girare `scraper_serafino_enrich.py` mirato sul settore restaurant, o raccolta manuale dei 20-30 ristoranti migliori (Google/local.ch).
2. **Inserire questo template restaurant** nell'autopilot (sostituire/aggiungere il pitch per `sector == "restaurant"` con il testo Email 1 sopra, + il numero demo + link video).
3. **Partire piccolo**: 20 email/giorno (limite anti-spam Hostinger). `serafino_email_autopilot.py --limit 20`.
4. **Tracking già attivo** (pixel + link tracking + `serafino_reply_tracker.py`): vedi aperture e risposte.
5. **Quando rispondono / chiamano la demo** → chiusura: `add_resto.py` → linea loro live in minuti.

**Caveat onesti:**
- Email SMTP Hostinger: limiti di invio — non superare ~20-30/giorno per dominio, scaldare gradualmente.
- Copertura email restaurant bassa → la qualità della lista batte la quantità: meglio 30 ristoranti giusti con email verificata che 279 senza.
- Il gancio "chiama il numero" funziona MEGLIO via WhatsApp/telefono che email fredda (i ristoratori aprono poco le email B2B). Considera anche outreach WhatsApp/passaggio fisico col QR del numero demo.

## KPI da guardare (prima settimana)
- chiamate ricevute sul numero demo (log `centralina-reservations`)
- aperture email (tracker)
- risposte / "sì proviamo"
- obiettivo realistico: 1-2 ristoranti che dicono "montami la linea" = primo incasso
