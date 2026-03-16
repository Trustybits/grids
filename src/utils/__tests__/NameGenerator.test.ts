import { describe, it, expect } from 'vitest'
import { generateRandomDisplayName, generateSeededDisplayName } from '../NameGenerator'

describe('NameGenerator', () => {
  describe('generateRandomDisplayName', () => {
    it('returns a string in "Adjective Animal" format', () => {
      const name = generateRandomDisplayName()
      const parts = name.split(' ')
      expect(parts).toHaveLength(2)
      expect(parts[0].length).toBeGreaterThan(0)
      expect(parts[1].length).toBeGreaterThan(0)
    })

    it('returns a non-empty string', () => {
      const name = generateRandomDisplayName()
      expect(name.trim().length).toBeGreaterThan(0)
    })
  })

  describe('generateSeededDisplayName', () => {
    it('is deterministic — same seed produces same name', () => {
      const name1 = generateSeededDisplayName('user-abc-123')
      const name2 = generateSeededDisplayName('user-abc-123')
      expect(name1).toBe(name2)
    })

    it('produces different names for different seeds', () => {
      const name1 = generateSeededDisplayName('user-abc-123')
      const name2 = generateSeededDisplayName('user-xyz-789')
      expect(name1).not.toBe(name2)
    })

    it('returns "Adjective Animal" format', () => {
      const name = generateSeededDisplayName('test-seed')
      const parts = name.split(' ')
      expect(parts).toHaveLength(2)
    })

    it('handles empty string seed without crashing', () => {
      const name = generateSeededDisplayName('')
      expect(typeof name).toBe('string')
      expect(name.split(' ')).toHaveLength(2)
    })
  })
})
