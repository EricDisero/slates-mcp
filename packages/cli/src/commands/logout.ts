import { clearCloudToken } from '@slatesvideo/shared'

export function runLogout(): void {
  clearCloudToken()
  console.log('Cloud token cleared.')
}
