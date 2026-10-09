import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
export default function LocationPicker({ lat, lng, onChange }) {
  const el = useRef(null),
    callback = useRef(onChange)
  callback.current = onChange
  useEffect(() => {
    const position = [Number(lat) || 8.4273, Number(lng) || -82.4308]
    const map = L.map(el.current, { scrollWheelZoom: false }).setView(
      position,
      14,
    )
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)
    const marker = L.marker(position, {
      draggable: true,
      icon: L.divIcon({
        className: '',
        html: '<div class="pin-site">📍</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      }),
    }).addTo(map)
    const move = (p) => {
      marker.setLatLng(p)
      callback.current({
        lat: Number(p.lat.toFixed(6)),
        lng: Number(p.lng.toFixed(6)),
      })
    }
    map.on('click', (e) => move(e.latlng))
    marker.on('dragend', () => move(marker.getLatLng()))
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(el.current)
    return () => {
      observer.disconnect()
      map.remove()
    }
  }, [])
  return (
    <div>
      <p className="mb-2 text-xs text-muted">
        Haz clic en el mapa o arrastra el marcador. Ubicación inicial: David,
        Chiriquí.
      </p>
      <div ref={el} className="isolate h-64 rounded-xl border border-line" />
    </div>
  )
}
