export interface FaultApiClientOptions {
  /** Ex: "http://localhost:3000/api" */
  baseURL: string
  /** Personal Access Token "smtk_..." (Authorization: Bearer) */
  token: string
  /** X-Personal-Token, requis pour révéler la valeur d'un secret */
  personalToken?: string
}

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

export declare class FaultApiClient {
  constructor(options: FaultApiClientOptions)
  /** Change/définit le X-Personal-Token utilisé pour révéler des secrets. */
  setPersonalToken(token: string | undefined): void
  /** POST /secrets/reveal */
  revealByPath(path: string): Promise<RevealPathResult>
  /** Dossier → objet { key_name: valeur } ; secret → sa valeur en `string`. */
  getSecrets(path: string): Promise<string | Record<string, string>>
}