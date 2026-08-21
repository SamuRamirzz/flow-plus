import { describe, it, expect } from 'vitest'
import { avatarDeClaims, avatarEfectivo } from '../avatar'

const CLAIMS_GOOGLE = {
  user_metadata: { avatar_url: 'https://lh3.googleusercontent.com/a/foo=s96-c', picture: 'https://lh3.googleusercontent.com/a/foo=s96-c' },
}

describe('avatarDeClaims', () => {
  it('lee avatar_url de los claims de Google', () => {
    expect(avatarDeClaims(CLAIMS_GOOGLE)).toBe('https://lh3.googleusercontent.com/a/foo=s96-c')
  })

  it('cae a picture si avatar_url no está', () => {
    expect(avatarDeClaims({ user_metadata: { picture: 'https://x.com/p.jpg' } })).toBe('https://x.com/p.jpg')
  })

  it('devuelve null sin metadata, sin claims, o con basura', () => {
    expect(avatarDeClaims(null)).toBeNull()
    expect(avatarDeClaims(undefined)).toBeNull()
    expect(avatarDeClaims({})).toBeNull()
    expect(avatarDeClaims({ user_metadata: {} })).toBeNull()
    expect(avatarDeClaims({ user_metadata: { avatar_url: 123 } })).toBeNull()
    expect(avatarDeClaims('no soy un objeto')).toBeNull()
  })
})

describe('avatarEfectivo — la foto subida siempre gana sobre la de Google', () => {
  it('usa la foto subida si existe, ignorando Google', () => {
    expect(avatarEfectivo('https://miapp.com/avatares/x.png', CLAIMS_GOOGLE)).toBe('https://miapp.com/avatares/x.png')
  })

  it('cae a Google si no hay foto subida', () => {
    expect(avatarEfectivo(null, CLAIMS_GOOGLE)).toBe('https://lh3.googleusercontent.com/a/foo=s96-c')
    expect(avatarEfectivo(undefined, CLAIMS_GOOGLE)).toBe('https://lh3.googleusercontent.com/a/foo=s96-c')
  })

  it('null si no hay ninguna de las dos', () => {
    expect(avatarEfectivo(null, null)).toBeNull()
    expect(avatarEfectivo('', {})).toBeNull()
  })
})
