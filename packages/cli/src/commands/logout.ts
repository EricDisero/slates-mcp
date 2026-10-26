import { clearCloudToken, clearServedBrain } from '@slatesvideo/shared'

export function runLogout(): void {
  clearCloudToken()
  // The brain this login received goes with it.
  clearServedBrain()
  console.log('Cloud token and the cached Slates brain cleared.')
}
