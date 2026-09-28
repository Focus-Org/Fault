# fault-api-client

Client TypeScript minimaliste pour l'API **FAULT** (gestionnaire de secrets).

Ce client n'implémente qu'une seule route de l'API : `POST /secrets/reveal`, la
seule utilisable avec un **Personal Access Token (PAT)**. Toutes les autres
routes de l'API exigent une session JWT classique (login utilisateur) et ne
sont pas couvertes par ce package.

## Installation

```bash
npm install @focus-labs/fault-client
```

## Pré-requis côté API

- Un **PAT** (`smtk_...`) créé via `POST /api/user/tokens` (session JWT
  classique, voir `token.routes.ts`).
- Pour lire la valeur en clair d'un secret, le même PAT doit aussi être
  envoyé en en-tête `X-Personal-Token` (second facteur exigé par
  `secret.routes.ts` sur la route `/secrets/reveal`).

## Initialisation

```ts
import { FaultApiClient } from './client.js'

const client = new FaultApiClient({
  baseURL: 'http://localhost:3000/api',
  token: 'smtk_xxxxxxxx...',       // Authorization: Bearer <token>
  personalToken: 'smtk_xxxxxxxx...' // X-Personal-Token (optionnel à l'init)
})

// Peut aussi être défini/modifié après coup :
client.setPersonalToken('smtk_xxxxxxxx...')
```

> En pratique, `token` et `personalToken` sont souvent le **même** PAT.

## API

### `client.revealByPath(path: string): Promise<RevealPathResult>`

Résout un chemin de type `dossier/sous-dossier/nom` dans l'arborescence des
secrets.

- Si `path` désigne un **dossier** → renvoie la liste de ses secrets, **sans
  déchiffrement** (aucune valeur, pas besoin de `X-Personal-Token`).
- Si `path` désigne un **secret** → renvoie sa valeur en clair. Nécessite un
  `X-Personal-Token` valide, sinon l'API répond en erreur.

```ts
// Dossier
const folder = await client.revealByPath('Test')
// {
//   type: 'folder',
//   uuid: '...',
//   name: 'Test',
//   secrets: [{ uuid: '...', key_name: 't1' }, { uuid: '...', key_name: 't2' }, ...]
// }

// Secret
const secret = await client.revealByPath('Test/t1')
// {
//   type: 'secret',
//   uuid: '...',
//   key_name: 't1',
//   value: 'la-valeur-en-clair'
// }
```

### `client.getSecrets(path: string): Promise<Record<string, string>>`

Sucre syntaxique au-dessus de `revealByPath` : résout un dossier **puis** va
chercher la valeur de **chacun** de ses secrets, et renvoie le tout sous
forme d'objet plat `{ nom_du_secret: valeur }`.

```ts
const secrets = await client.getSecrets('Test')

secrets.t1 // 'la-valeur-en-clair'
secrets.t2
secrets.t3
```

⚠️ Points importants :

- Nécessite un `personalToken` configuré (`setPersonalToken` ou option du
  constructeur) — sinon chaque secret renvoie une erreur côté API.
- Effectue **1 requête pour lister le dossier + 1 requête par secret**
  (l'API ne permet pas de révéler plusieurs secrets en un seul appel).
  À éviter sur un dossier contenant un très grand nombre de secrets.
- Lève une `Error` si `path` ne désigne pas un dossier, ou si l'un des
  chemins enfants résolus ne désigne pas un secret (cas normalement
  impossible sauf modification concurrente de l'arborescence).

### `client.setPersonalToken(token: string | undefined)`

Définit ou efface le `X-Personal-Token` utilisé pour déchiffrer les secrets.
Passer `undefined` désactive le déchiffrement : `revealByPath` sur un secret
renverra alors une erreur d'authentification.

## Types

```ts
export type RevealFolderResult = {
  type: 'folder'
  uuid: string
  name: string
  secrets: { uuid: string; key_name: string }[]
}

export type RevealSecretResult = {
  type: 'secret'
  uuid: string
  key_name: string
  value: string
}

export type RevealPathResult = RevealFolderResult | RevealSecretResult
```

## Gestion des erreurs

Toute erreur HTTP renvoyée par l'API est convertie en `Error` JavaScript
standard (message tiré de `error` ou `message` dans le corps de la réponse),
avec l'erreur Axios d'origine accessible via `error.cause` :

```ts
try {
  await client.revealByPath('Test/inexistant')
} catch (err) {
  console.error((err as Error).message) // "Chemin introuvable."
}
```

## Exemple complet

```ts
import { FaultApiClient } from './client.js'

const client = new FaultApiClient({
  baseURL: 'https://fault.focus-labs.fr/api',
  token: process.env.FAULT_PAT!,
  personalToken: process.env.FAULT_PAT!
})

async function main() {
  const dbSecrets = await client.getSecrets('production/database')

  console.log(dbSecrets.DB_HOST)
  console.log(dbSecrets.DB_PASSWORD)
}

main()
```
