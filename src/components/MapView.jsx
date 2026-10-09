import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const SHIELD = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5z"/></svg>'

// markers: [{ id, lat, lng, kind: 'agent'|'site', label, title, sub }]
export default function MapView({ markers, selectedId, onSelect, className = 'h-[360px]' }) {
  const el = useRef(null)
  const map = useRef(null)
  const group = useRef(null)
  const refs = useRef({})
  const fitted = useRef('')
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: false }).setView([8.43, -82.43], 10)
    map.current = m
    group.current = L.layerGroup().addTo(m)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    const observer = new ResizeObserver(() => {
      m.invalidateSize({ pan: false })
      const positions = Object.values(refs.current).map((marker) => marker.getLatLng())
      if (!selectedRef.current && positions.length) {
        m.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 15, animate: false })
      }
      group.current.eachLayer((layer) => {
        const popup = layer.getPopup()
        if (popup) {
          popup.options.maxWidth = Math.min(300, Math.max(100, m.getSize().x - 60))
          popup.options.minWidth = Math.min(180, popup.options.maxWidth)
          if (popup.isOpen()) popup.update()
        }
      })
    })
    observer.observe(el.current)
    return () => { observer.disconnect(); m.remove(); map.current = null }
  }, [])

  const sig = JSON.stringify(markers)
  useEffect(() => {
    const m = map.current
    if (!m) return
    group.current.clearLayers()
    refs.current = {}
    markers.forEach((k) => {
      const agent = k.kind === 'agent'
      const icon = L.divIcon({
        className: '',
        html: agent ? `<div class="pin">${esc(k.label)}</div>` : `<div class="pin-site">${SHIELD}</div>`,
        iconSize: agent ? [36, 36] : [28, 28],
        iconAnchor: agent ? [18, 18] : [14, 14],
      })
      const mk = L.marker([k.lat, k.lng], { icon, zIndexOffset: agent ? 500 : 0 })
        .bindPopup(`<b>${esc(k.title)}</b><br><span style="opacity:.75">${esc(k.sub)}</span>`, {
          maxWidth: Math.min(300, Math.max(100, m.getSize().x - 60)),
          minWidth: Math.min(180, Math.max(100, m.getSize().x - 60)),
        })
        .on('click', () => onSelectRef.current?.(k.id))
        .addTo(group.current)
      refs.current[k.id] = mk
    })
    const ids = markers.map((k) => k.id).sort().join('|')
    if (markers.length && fitted.current !== ids) {
      fitted.current = ids
      m.fitBounds(L.latLngBounds(markers.map((k) => [k.lat, k.lng])), { padding: [40, 40], maxZoom: 15 })
    }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mk = refs.current[selectedId]
    if (mk && map.current) {
      map.current.flyTo(mk.getLatLng(), Math.max(map.current.getZoom(), 15), { duration: 0.6 })
      mk.openPopup()
    }
  }, [selectedId])

  return <div className={`isolate min-w-0 overflow-hidden rounded-xl border border-line ${className}`}><div ref={el} className="h-full w-full" /></div>
}
