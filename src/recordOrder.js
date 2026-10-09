// Conserva el orden existente cuando no hay fecha de creación disponible.
export function newestFirst(records) {
  const created = (record) => {
    const value = record.createdAt || record.created_at || record.generado
    return value ? Date.parse(value) || 0 : 0
  }
  return [...records].sort((a, b) => created(b) - created(a))
}
