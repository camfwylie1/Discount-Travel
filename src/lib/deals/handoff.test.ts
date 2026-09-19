import { describe, expect, it } from 'vitest'
import { decideOpenMode, framedAttribution } from './handoff'

const base = { providerName: 'Northbound Adventures', complianceStatus: 'PERMITTED' }

describe('deciding how to open a provider page', () => {
  it('frames only where the provider has agreed', () => {
    expect(decideOpenMode({ ...base, framingPermitted: true }).mode).toBe('IN_APP')
  })

  it('opens a new tab when nobody has recorded permission', () => {
    // The whole point: silence is not consent, even though framing would keep
    // the member in the app longer and is therefore what we would prefer.
    const decision = decideOpenMode({ ...base, framingPermitted: false })
    expect(decision.mode).toBe('NEW_TAB')
    expect(decision.reason).toMatch(/has not agreed/i)
    expect(decision.reason).toMatch(/compliance/i)
  })

  it('never frames a blocked provider, whatever the framing flag says', () => {
    const decision = decideOpenMode({
      ...base,
      complianceStatus: 'BLOCKED',
      framingPermitted: true,
    })
    expect(decision.mode).toBe('NEW_TAB')
  })

  it('names the provider and disclaims the sale in the framed attribution', () => {
    const text = framedAttribution('Northbound Adventures')
    expect(text).toContain('Northbound Adventures')
    expect(text).toMatch(/not with Voyaj/i)
  })
})
