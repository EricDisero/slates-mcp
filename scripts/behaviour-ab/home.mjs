// The throwaway HOME a run's server sees: a connection file pointing at the
// fixture, so the server under test never reads the user's real connection or
// reaches the real desktop app.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { FIXTURE_CLOUD_TOKEN, FIXTURE_DESKTOP_TOKEN, FIXTURE_IDS } from './fixture.mjs'

/** The user's real cloud token, read for the fixture's one price-list GET. Never written anywhere. */
export function realCloudToken() {
  try {
    const conn = JSON.parse(readFileSync(join(homedir(), '.slates', 'agent-connection.json'), 'utf8'))
    return typeof conn?.cloud?.token === 'string' ? conn.cloud.token : null
  } catch {
    return null
  }
}

/** Write `<dir>/.slates/agent-connection.json` for a fixture on `port`; returns the env the server needs. */
export function armHome(dir, port) {
  mkdirSync(join(dir, '.slates'), { recursive: true })
  writeFileSync(
    join(dir, '.slates', 'agent-connection.json'),
    JSON.stringify({
      cloud: { token: FIXTURE_CLOUD_TOKEN },
      desktop: { enabled: true, port, token: FIXTURE_DESKTOP_TOKEN },
      defaultProjectId: FIXTURE_IDS.P1,
    }, null, 2)
  )
  return {
    HOME: dir,
    USERPROFILE: dir,
    SLATES_CLOUD_BASE_URL: `http://127.0.0.1:${port}`,
  }
}
