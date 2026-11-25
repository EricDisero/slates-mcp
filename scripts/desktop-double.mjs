// The desktop client's capability question and quote call, for a check's fake desktop: spread
// `clientCalls` into the fake beside its own requireCapability, get and post.
//   hasCapability answers as the fake's requireCapability does (refused = the desktop lacks it).
//   quote reads the request from the query, as the client calls a desktop before 'quote-post'.
// The real client's own choice between body and query is proven in quote-ops-check.mjs.
export const clientCalls = {
  async hasCapability(cap) {
    try { await this.requireCapability(cap, ''); return true } catch { return false }
  },
  quote(path, field, request) {
    return this.get(path, { [field]: JSON.stringify(request) })
  },
}
