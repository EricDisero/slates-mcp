import { readConnection, SlatesCloudClient, SlatesDesktopClient } from '@slatesvideo/shared'
import type { SlatesUserInfo } from '@slatesvideo/shared'

export async function runStatus(): Promise<void> {
  const c = readConnection()
  console.log('=== Slates connection status ===')
  console.log(`Cloud token:       ${c.cloud.token ? 'present' : 'missing — run `slates login`'}`)
  console.log(
    `Desktop server:    ${
      c.desktop.enabled
        ? `enabled on 127.0.0.1:${c.desktop.port}`
        : 'disabled — open Slates → Settings → Agent Control'
    }`
  )

  if (c.cloud.token) {
    try {
      const cloud = new SlatesCloudClient()
      const me = await cloud.get<SlatesUserInfo>('/api/agent/me')
      // Credits since the 2026-07-07 re-denomination (credit_balance_cents is
      // a legacy alias carrying the same credit value).
      const balance = me.user.credit_balance ?? me.user.credit_balance_cents ?? 0
      console.log(`\nLogged in as:      ${me.user.email}`)
      console.log(`License:           ${me.user.license_status}`)
      console.log(`Tier:              ${me.user.tier}`)
      console.log(`Credit balance:    ${balance.toLocaleString('en-US')} credits`)
      console.log(`Scopes:            ${me.scopes.join(', ')}`)
    } catch (err) {
      console.warn(`\nCloud check failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (c.desktop.enabled && c.desktop.port && c.desktop.token) {
    try {
      const desktop = new SlatesDesktopClient()
      const h = await desktop.healthz()
      console.log(`\nDesktop reachable: ${h.ok ? 'yes' : 'no'}`)
    } catch (err) {
      console.warn(`Desktop reachable: no (${err instanceof Error ? err.message : err})`)
    }
  }
}
