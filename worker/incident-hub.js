import { DurableObject } from 'cloudflare:workers'

export class IncidentHub extends DurableObject {
  async fetch(request) {
    if (new URL(request.url).pathname === '/publish') {
      const event = await request.json()
      await Promise.all(
        this.ctx.getWebSockets().map(async (socket) => {
          const attachment = socket.deserializeAttachment()
          const row = await this.env.DB.prepare(
            `SELECT u.id,u.active,u.role_id,r.permissions FROM sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id WHERE s.token_hash=? AND s.expires_at>?`,
          )
            .bind(attachment.tokenHash, Date.now())
            .first()
          if (
            !row?.active ||
            row.role_id === 'agent' ||
            !JSON.parse(row.permissions).incidents?.includes('view')
          ) {
            socket.close(1008, 'Sesión o permisos vencidos')
            return
          }
          try {
            socket.send(
              JSON.stringify({ ...event, notify: row.id !== event.createdBy }),
            )
          } catch {
            socket.close(1011, 'Reconectar')
          }
        }),
      )
      return new Response('ok')
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket requerido', { status: 426 })
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({
      tokenHash: request.headers.get('X-Session-Hash'),
    })
    return new Response(null, { status: 101, webSocket: client })
  }
  webSocketClose(socket, code, reason) {
    socket.close(code === 1005 || code === 1006 ? 1000 : code, reason)
  }
  webSocketError(socket) {
    socket.close(1011, 'Reconectar')
  }
}
