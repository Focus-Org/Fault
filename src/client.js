const axios = require('axios')

class FaultApiClient {
  constructor(options) {
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
        if (axios.isAxiosError(error)) {
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

  setPersonalToken(token) {
    this.personalToken = token
  }

  async revealByPath(path) {
    const headers = {}
    if (this.personalToken) headers['X-Personal-Token'] = this.personalToken

    const { data } = await this.http.post('/secrets/reveal', { path }, { headers })
    return data
  }

  async getSecrets(path) {
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

        return [secret.key_name, secretResult.value]
      })
    )

    return Object.fromEntries(entries)
  }
}

module.exports = { FaultApiClient }