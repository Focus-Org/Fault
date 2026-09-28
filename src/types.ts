export type ApiErrorPayload = { error?: string; message?: string }

// POST /secrets/reveal — seule route de l'API utilisable avec un PAT
// (X-Personal-Token requis pour obtenir la valeur en clair d'un secret).
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
