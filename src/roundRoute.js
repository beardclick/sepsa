// Convierte las rondas anteriores de un solo lugar sin perder su recorrido.
export const roundStops = (round) =>
  Array.isArray(round.paradas)
    ? round.paradas
    : [
        {
          lugar: round.lugar || '',
          inicio: round.inicio || '08:00',
          fin: round.fin || '09:00',
        },
      ]

export function routeTimeline(stops) {
  const minutes = (value) => {
    const [h, m] = value.split(':').map(Number)
    return h * 60 + m
  }
  let previousEnd = 0
  return stops.map((stop, index) => {
    let start = minutes(stop.inicio) + Math.floor(previousEnd / 1440) * 1440
    if (index && start < previousEnd) start += 1440
    let end = minutes(stop.fin) + Math.floor(start / 1440) * 1440
    if (end < start) end += 1440
    previousEnd = end
    return {
      ...stop,
      startDay: Math.floor(start / 1440),
      endDay: Math.floor(end / 1440),
    }
  })
}
