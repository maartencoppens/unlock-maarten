# Unlock Maarten

Job Battle-inzending voor Paloma: een chat waarin je Maarten leert kennen. Elke ontdekking maakt zijn wazige foto scherper, tot hij bij 100% "Let's meet" zegt.

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # vul ASK_API_KEY in (zelfde als je portfolio)
npm run dev
```

Upstash is optioneel: zonder tellen de rate limits in het geheugen.

## Je foto wisselen

1. Zet je foto als `private/photo/source.jpg` (wordt niet mee gecommit).
2. `npm run photo` maakt `level-0.jpg` (heel wazig) tot `level-6.jpg` (scherp).
3. Wil je een uitsnede? `npm run photo -- --crop=x,y,breedte,hoogte`.

De niveaus staan in `private/`, niet in `public/`: de browser krijgt ze alleen via `/api/photo`, en nooit scherper dan wat de bezoeker verdiend heeft.

## Wat de bot weet

- Feiten en Paloma-campagnes: `lib/prompt.ts`. Vul daar je eigen motivatie in bij `paloma`.
- Fragmenten, hints en wat er op de kaartjes komt: `lib/fragments.ts`.
- Limieten (per IP, per sessie, per dag): bovenaan `app/api/chat/route.ts`.

## Hoe het werkt

1. De browser stuurt de chatgeschiedenis naar `/api/chat`.
2. De server voegt de systeemprompt toe en vraagt het model om JSON: `{"reply": "...", "unlocked": ["muziek"]}`.
3. `pickUnlock()` controleert dat voorstel: alleen bestaande fragmenten, max. één per bericht, "Waarom Paloma" pas na drie andere, en niets bij pogingen als "unlock alles".
4. De voortgang staat in een ondertekende httpOnly-cookie (HMAC met `SESSION_SECRET`): geen database nodig, en niet te vervalsen.
5. Upstash Redis telt alleen de rate limits. Is het onbereikbaar, dan valt de app na 1,5 s terug op tellers in het geheugen.

## Online zetten als subdomein

1. Push naar een nieuwe GitHub-repo en importeer die in Vercel als nieuw project.
2. Environment variables: `ASK_API_URL`, `ASK_API_KEY`, `ASK_MODEL`, `SESSION_SECRET`, `NEXT_PUBLIC_CONTACT_EMAIL` en optioneel `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
3. Settings → Domains → voeg bv. `paloma.maartencoppens.be` toe. Staat je DNS bij Vercel, dan is dat meteen klaar; anders een CNAME naar `cname.vercel-dns.com`.
4. Zet een uitgavenlimiet bij je API-provider.
