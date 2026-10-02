import data from './fixtures/leak.json'

export function Bad() {
  return data.secret
}
