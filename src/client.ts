import axios, { type AxiosInstance } from 'axios'
import type { ApiErrorPayload, RevealPathResult } from './types.js'

export interface FaultApiClientOptions {
  /** Ex: "http://localhost:3000/api" */
  baseURL: string
  /**
   * Personal Access Token "smtk_...". C'est le seul mode d'authentification
   * accepté ici : /secrets/reveal est la seule route de l'API utilisable
   * avec un PAT (toutes les autres routes protégées exigent une session
   * JWT classique — voir app.ts `authenticate` et token.routes.ts).
   */
  token: string
  /**
   * X-Personal-Token requis pour obtenir la valeur en clair d'un secret
   * (cf. secret.routes.ts, route /secrets/reveal). En pratique le même
   * jeton "smtk_..." que `token`.
   */
  personalToken?: string
}

export class FaultApiClient {
  private readonly http: AxiosInstance
  private personalToken?: string

  constructor(options: FaultApiClientOptions) {
    this.personalToken = options.personalToken

    this.http = axios.create({
      baseURL: options.baseURL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.token}`
      }
    })

    this.http.interceptors.response.use(
      response => response,
      error => {
        if (axios.isAxiosError<ApiErrorPayload>(error)) {
          const message =
            error.response?.data?.error ??
            error.response?.data?.message ??
            error.message ??
            'Erreur inconnue lors de l’appel à l’API FAULT.'
          throw new Error(message, { cause: error })
        }
        throw error
      }
    )
  }

  /** Change/définit le X-Personal-Token utilisé pour révéler des secrets. */
  setPersonalToken(token: string | undefined) {
    this.personalToken = token
  }

  /**
   * Équivalent direct de :
   *   curl -X POST /api/secrets/reveal -d '{"path": "..."}' \
   *        -H "Authorization: Bearer <pat>" -H "X-Personal-Token: <pat>"
   *
   * Si `path` désigne un dossier, retourne la liste de ses secrets (sans
   * déchiffrement, pas de X-Personal-Token requis). S'il désigne un secret,
   * le X-Personal-Token configuré est requis pour obtenir la valeur en clair.
   */
  async revealByPath(path: string): Promise<RevealPathResult> {
    const headers: Record<string, string> = {}
    if (this.personalToken) headers['X-Personal-Token'] = this.personalToken

    const { data } = await this.http.post<RevealPathResult>(
      '/secrets/reveal',
      { path },
      { headers }
    )
    return data
  }

  /**
   * Résout un dossier puis va chercher la valeur en clair de CHAQUE secret
   * qu'il contient, et renvoie le tout sous forme d'objet plat :
   *
   *   const secrets = await client.getSecrets('Test')
   *   secrets.t1 // -> valeur en clair du secret "t1"
   *
   * Si `path` désigne directement un secret, renvoie sa valeur telle
   * quelle (`string`) plutôt qu'un objet. Le type de retour est donc une
   * union `string | Record<string, string>` : narrowez avec `typeof`
   * côté appelant (voir examples/reveal.ts) avant d'accéder à une clé.
   *
   * Nécessite `personalToken` (setPersonalToken / option `personalToken`),
   * sinon l'API renverra une erreur "X-Personal-Token requis" pour chaque
   * secret. Fait 1 requête pour lister le dossier + 1 requête par secret
   * (l'API ne permet pas de révéler plusieurs secrets en un seul appel).
   */
  async getSecrets(path: string): Promise<string | Record<string, string>> {
    const result = await this.revealByPath(path)

    if (result.type === 'secret') {
      return result.value
    }

    const entries = await Promise.all(
      result.secrets.map(async (secret) => {
        const secretPath = `${path}/${secret.key_name}`
        const secretResult = await this.revealByPath(secretPath)

        if (secretResult.type !== 'secret') {
          throw new Error(`Le chemin "${secretPath}" ne correspond pas à un secret.`)
        }

        return [secret.key_name, secretResult.value] as const
      })
    )

    return Object.fromEntries(entries)
  }
}