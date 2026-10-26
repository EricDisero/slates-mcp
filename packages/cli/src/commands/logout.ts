import { clearCloudToken, clearServedBrain } from '@slatesvideo/shared'

export function runLogout(): void {
  // The brain this login received goes with it, read before the token goes (the cache names its login by it); a
  // cache the desktop app received stays.
  clearServedBrain('cli')
  clearCloudToken()
  console.log('Cloud token and the Slates brain this login received cleared.')
}
