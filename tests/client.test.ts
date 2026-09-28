import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { FaultApiClient } from '../src'

vi.mock('axios')

const mockedAxios = vi.mocked(axios, { deep: true })

type HttpMock = {
  post: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  interceptors: { response: { use: ReturnType<typeof vi.fn> } }
}

function createHttpMock(): HttpMock {
  return {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: { response: { use: vi.fn() } }
  }
}

describe('FaultApiClient', () => {
  let httpMock: HttpMock

  beforeEach(() => {
    httpMock = createHttpMock()
    mockedAxios.create.mockReturnValue(httpMock as unknown as ReturnType<typeof axios.create>)
    mockedAxios.isAxiosError.mockReturnValue(false)
  })

  function makeClient(personalToken?: string) {
    return new FaultApiClient({
      baseURL: 'http://localhost:3000/api',
      token: 'smtk_test-token',
      personalToken
    })
  }

  it("construit l'instance axios avec le Bearer token et baseURL fournis", () => {
    makeClient()

    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:3000/api',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer smtk_test-token'
      }
    })
  })

  describe('revealByPath', () => {
    it("appelle POST /secrets/reveal avec le body { path } et X-Personal-Token si fourni", async () => {
      httpMock.post.mockResolvedValueOnce({
        data: { type: 'secret', uuid: 'u1', key_name: 't1', value: 'truc' }
      })

      const client = makeClient('smtk_personal')
      const result = await client.revealByPath('test/t1')

      expect(httpMock.post).toHaveBeenCalledWith(
        '/secrets/reveal',
        { path: 'test/t1' },
        { headers: { 'X-Personal-Token': 'smtk_personal' } }
      )
      expect(result).toEqual({ type: 'secret', uuid: 'u1', key_name: 't1', value: 'truc' })
    })

    it("n'envoie pas d'en-tête X-Personal-Token si aucun personalToken n'est configuré", async () => {
      httpMock.post.mockResolvedValueOnce({
        data: { type: 'folder', uuid: 'f1', name: 'Test', secrets: [] }
      })

      const client = makeClient()
      await client.revealByPath('test')

      expect(httpMock.post).toHaveBeenCalledWith('/secrets/reveal', { path: 'test' }, { headers: {} })
    })

    it('reflète les changements faits via setPersonalToken', async () => {
      httpMock.post.mockResolvedValue({
        data: { type: 'secret', uuid: 'u1', key_name: 't1', value: 'truc' }
      })

      const client = makeClient()
      client.setPersonalToken('smtk_new')
      await client.revealByPath('test/t1')

      expect(httpMock.post).toHaveBeenLastCalledWith(
        '/secrets/reveal',
        { path: 'test/t1' },
        { headers: { 'X-Personal-Token': 'smtk_new' } }
      )
    })
  })

  describe('getSecrets', () => {
    it('renvoie directement une string quand le chemin désigne un secret', async () => {
      httpMock.post.mockResolvedValueOnce({
        data: { type: 'secret', uuid: 'u1', key_name: 't1', value: 'truc' }
      })

      const client = makeClient('smtk_personal')
      const result = await client.getSecrets('test/t1')

      expect(result).toBe('truc')
      expect(httpMock.post).toHaveBeenCalledTimes(1)
    })

    it('renvoie un objet { key_name: value } quand le chemin désigne un dossier', async () => {
      httpMock.post
        .mockResolvedValueOnce({
          data: {
            type: 'folder',
            uuid: 'f1',
            name: 'Test',
            secrets: [
              { uuid: 'u2', key_name: 't2' },
              { uuid: 'u3', key_name: 't3' },
              { uuid: 'u1', key_name: 't1' }
            ]
          }
        })
        .mockResolvedValueOnce({ data: { type: 'secret', uuid: 'u2', key_name: 't2', value: 'machin' } })
        .mockResolvedValueOnce({ data: { type: 'secret', uuid: 'u3', key_name: 't3', value: 'ici' } })
        .mockResolvedValueOnce({ data: { type: 'secret', uuid: 'u1', key_name: 't1', value: 'truc' } })

      const client = makeClient('smtk_personal')
      const result = await client.getSecrets('test')

      expect(result).toEqual({ t2: 'machin', t3: 'ici', t1: 'truc' })
      // 1 appel pour lister le dossier + 1 par secret
      expect(httpMock.post).toHaveBeenCalledTimes(4)
      expect(httpMock.post).toHaveBeenNthCalledWith(
        2,
        '/secrets/reveal',
        { path: 'test/t2' },
        { headers: { 'X-Personal-Token': 'smtk_personal' } }
      )
    })

    it("lève une erreur si un sous-chemin attendu comme secret revient comme dossier", async () => {
      httpMock.post
        .mockResolvedValueOnce({
          data: {
            type: 'folder',
            uuid: 'f1',
            name: 'Test',
            secrets: [{ uuid: 'u1', key_name: 't1' }]
          }
        })
        .mockResolvedValueOnce({
          data: { type: 'folder', uuid: 'u1', name: 't1', secrets: [] }
        })

      const client = makeClient('smtk_personal')

      await expect(client.getSecrets('test')).rejects.toThrow(
        'Le chemin "test/t1" ne correspond pas à un secret.'
      )
    })
  })

  describe('gestion des erreurs HTTP', () => {
    it("transforme une erreur Axios en Error avec le message renvoyé par l'API", () => {
      makeClient()

      // Récupère le handler d'erreur passé à interceptors.response.use(...)
      const [, errorHandler] = httpMock.interceptors.response.use.mock.calls[0]

      mockedAxios.isAxiosError.mockReturnValue(true)
      const axiosError = {
        response: { data: { error: 'Token personnel invalide.' } },
        message: 'Request failed with status code 401'
      }

      // errorHandler lance de façon SYNCHRONE (throw), il ne renvoie pas
      // une promesse rejetée : on ne peut donc pas utiliser `rejects` ici.
      expect(() => errorHandler(axiosError)).toThrow('Token personnel invalide.')
    })

    it('relance telle quelle (même référence) une erreur non-Axios', () => {
      makeClient()

      const [, errorHandler] = httpMock.interceptors.response.use.mock.calls[0]
      mockedAxios.isAxiosError.mockReturnValue(false)

      const genericError = new Error('boom')

      let caught: unknown
      try {
        errorHandler(genericError)
        expect.fail('errorHandler aurait dû lancer une exception.')
      } catch (err) {
        caught = err
      }

      expect(caught).toBe(genericError)
    })
  })
})