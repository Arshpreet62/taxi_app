'use client'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MLMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { POPULAR, SERVICE_BBOX, SYDNEY, type Place } from '@/lib/places'

// OpenFreeMap's Positron style (no key), recoloured from the page's own tokens so it matches day and night shift.
const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE || 'https://tiles.openfreemap.org/styles/positron'

type Props = {
  pickup: Place | null
  drop: Place | null
  geometry: [number, number][] | null
  approx: boolean
  // Bumps when the route should be drawn again with the taxi driving it.
  drawKey: number
  locked: boolean
  onPoint: (lat: number, lng: number) => void
  onPlace: (place: Place) => void
  onMove: (end: 'pickup' | 'drop', lat: number, lng: number) => void
}

const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches

// oklch() and color-mix() tokens -> rgba MapLibre understands, by letting the browser paint a pixel.
function tokenColors(names: string[]) {
  const probe = document.createElement('i')
  probe.style.display = 'none'
  document.body.append(probe)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const out: Record<string, string> = {}
  for (const n of names) {
    probe.style.color = `var(--${n})`
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = getComputedStyle(probe).color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    out[n] = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
  }
  probe.remove()
  return out
}

const TOKENS = ['map-land', 'map-park', 'map-water', 'map-water-label', 'map-building', 'map-road', 'map-road-major', 'map-road-case', 'map-rail', 'map-label', 'map-halo', 'ink', 'amber', 'ground']

function paint(map: MLMap) {
  const c = tokenColors(TOKENS)
  const set = (id: string, prop: string, v: unknown) => {
    try { map.setPaintProperty(id, prop as never, v as never) } catch { /* layer missing in this style */ }
  }
  for (const layer of map.getStyle().layers) {
    const id = layer.id
    if (layer.type === 'background') set(id, 'background-color', c['map-land'])
    else if (id === 'water') set(id, 'fill-color', c['map-water'])
    else if (id === 'waterway') set(id, 'line-color', c['map-water'])
    else if (id === 'park' || id === 'landcover_wood') set(id, 'fill-color', c['map-park'])
    else if (id === 'landuse_residential') set(id, 'fill-opacity', 0)
    else if (id === 'building') { set(id, 'fill-color', c['map-building']); set(id, 'fill-outline-color', c['map-building']) }
    else if (id.startsWith('aeroway') && layer.type === 'fill') set(id, 'fill-color', c['map-building'])
    else if (layer.type === 'line' && /casing/.test(id)) set(id, 'line-color', c['map-road-case'])
    else if (layer.type === 'line' && /motorway|major/.test(id)) set(id, 'line-color', c['map-road-major'])
    else if (layer.type === 'line' && /highway|road|aeroway/.test(id)) set(id, 'line-color', c['map-road'])
    else if (layer.type === 'line' && /rail/.test(id)) set(id, 'line-color', c['map-rail'])
    else if (layer.type === 'symbol') {
      const water = /water/.test(id)
      set(id, 'text-color', water ? c['map-water-label'] : c['map-label'])
      set(id, 'text-halo-color', water ? c['map-water'] : c['map-halo'])
    }
  }
  if (map.getLayer('route-case')) {
    set('route-case', 'line-color', c.ink)
    set('route-line', 'line-color', c.amber)
    set('stops', 'circle-color', c['map-land'])
    set('stops', 'circle-stroke-color', c.ink)
  }
}

const line = (coords: [number, number][]): GeoJSON.Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })

function pinEl(end: 'pickup' | 'drop') {
  const el = document.createElement('div')
  el.className = `m-pin m-pin--${end}`
  el.innerHTML = '<span></span>'
  return el
}

function carEl() {
  const el = document.createElement('div')
  el.className = 'm-car'
  el.innerHTML = '<svg viewBox="-32 -17 64 34" aria-hidden="true" focusable="false"><rect class="m-car__body" x="-30" y="-15" width="60" height="30" rx="10"/><rect class="m-car__glass" x="6" y="-11" width="12" height="22" rx="3"/><rect class="m-car__glass" x="-22" y="-10" width="9" height="20" rx="3"/><rect class="m-car__lamp" x="-8" y="-6" width="11" height="12" rx="2"/></svg>'
  return el
}

export default function TripMap({ pickup, drop, geometry, approx, drawKey, locked, onPoint, onPlace, onMove }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const pins = useRef<Partial<Record<'pickup' | 'drop', Marker>>>({})
  const car = useRef<Marker | null>(null)
  const anim = useRef(0)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  // Handlers change every render; the map listeners read the latest through a ref.
  const cb = useRef({ onPoint, onPlace, onMove, locked })
  useEffect(() => { cb.current = { onPoint, onPlace, onMove, locked } })

  useEffect(() => {
    if (!box.current) return
    let map: MLMap
    try {
      map = new maplibregl.Map({
        container: box.current,
        style: STYLE,
        center: [SYDNEY.lng, SYDNEY.lat],
        zoom: 10,
        minZoom: 8,
        maxBounds: [[SERVICE_BBOX[0] - 0.4, SERVICE_BBOX[1] - 0.3], [SERVICE_BBOX[2] + 0.4, SERVICE_BBOX[3] + 0.3]],
        dragRotate: false,
        pitchWithRotate: false,
        // One finger scrolls the page on phones and the wheel scrolls past on desktop; two fingers or ctrl+wheel move the map.
        cooperativeGestures: true,
        attributionControl: { compact: true },
      })
    } catch {
      // No WebGL: say so in place of the map (an external failure, reported once).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true)
      return
    }
    mapRef.current = map
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: line([]) })
      map.addSource('route-drawn', { type: 'geojson', data: line([]) })
      map.addSource('stops', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: POPULAR.map((p, i) => ({ type: 'Feature', id: i, properties: { i, label: p.label }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) },
      })
      const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
      map.addLayer({ id: 'route-case', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 5, 15, 10] } }, firstLabel)
      map.addLayer({ id: 'route-line', type: 'line', source: 'route-drawn', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 15, 5.5] } }, firstLabel)
      map.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.5, 14, 6], 'circle-stroke-width': 2 } })
      paint(map)
      setReady(true)
    })
    map.on('error', (e) => console.warn('Map:', e.error?.message))

    map.on('mouseenter', 'stops', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'stops', () => { map.getCanvas().style.cursor = '' })
    map.on('click', (e) => {
      if (cb.current.locked) return
      const stop = map.queryRenderedFeatures(e.point, { layers: ['stops'] })[0]
      if (stop) return cb.current.onPlace(POPULAR[stop.properties.i as number])
      cb.current.onPoint(e.lngLat.lat, e.lngLat.lng)
    })

    // Day/night: recolour in place when the switch or the system theme changes.
    const repaint = () => map.isStyleLoaded() && paint(map)
    const mo = new MutationObserver(repaint)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', repaint)
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(box.current)

    return () => {
      mo.disconnect()
      mq.removeEventListener('change', repaint)
      ro.disconnect()
      cancelAnimationFrame(anim.current)
      map.remove()
      mapRef.current = null
      pins.current = {}
      car.current = null
    }
  }, [])

  // Pins: draggable until the ride is booked.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const end of ['pickup', 'drop'] as const) {
      const place = end === 'pickup' ? pickup : drop
      if (!place) { pins.current[end]?.remove(); continue }
      let m = pins.current[end]
      if (!m) {
        const made = new maplibregl.Marker({ element: pinEl(end), draggable: true, anchor: 'bottom' })
        made.on('dragend', () => { const { lat, lng } = made.getLngLat(); cb.current.onMove(end, lat, lng) })
        m = pins.current[end] = made
      }
      m.setLngLat([place.lng, place.lat]).addTo(map)
      m.setDraggable(!locked)
      m.getElement().setAttribute('aria-label', `${end === 'pickup' ? 'Pickup' : 'Drop-off'}: ${place.label}`)
    }
  }, [pickup, drop, locked, ready])

  // Route: fit it in view, then draw it and drive the taxi along it.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    cancelAnimationFrame(anim.current)
    const full = map.getSource('route') as GeoJSONSource, drawn = map.getSource('route-drawn') as GeoJSONSource
    map.setPaintProperty('route-case', 'line-dasharray', approx ? [1.5, 1.5] : [1, 0])

    // Keep the route clear of the meter where it overlaps the map (wide screens).
    const rig = document.querySelector('.rig')?.getBoundingClientRect(), mb = map.getContainer().getBoundingClientRect()
    const top = Math.max(40, rig ? Math.min(mb.height * 0.6, rig.bottom - mb.top + 30) : 40)
    const padding = { top, bottom: 50, left: 40, right: 40 }

    if (!geometry || geometry.length < 2) {
      full.setData(line([]))
      drawn.setData(line([]))
      car.current?.remove()
      const ends = [pickup, drop].filter(Boolean) as Place[]
      if (ends.length === 1) map.easeTo({ center: [ends[0].lng, ends[0].lat], zoom: Math.max(map.getZoom(), 12), padding, duration: 600 })
      if (ends.length === 2) map.fitBounds([[Math.min(ends[0].lng, ends[1].lng), Math.min(ends[0].lat, ends[1].lat)], [Math.max(ends[0].lng, ends[1].lng), Math.max(ends[0].lat, ends[1].lat)]], { padding, maxZoom: 14, duration: 600 })
      return
    }

    const bounds = geometry.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(geometry[0], geometry[0]))
    map.fitBounds(bounds, { padding, maxZoom: 15, duration: motionOK() ? 700 : 0 })
    full.setData(line(geometry))

    // Lay the route out flat (lng scaled by cos lat) to measure lengths and headings.
    const kx = Math.cos((geometry[0][1] * Math.PI) / 180)
    const xy = geometry.map(([lng, lat]) => [lng * kx, -lat])
    const cum = [0]
    for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]))
    const total = cum[cum.length - 1]

    const taxi = (car.current ??= new maplibregl.Marker({ element: carEl(), rotationAlignment: 'map' })).setLngLat(geometry[0]).addTo(map)
    let i = 0
    const at = (d: number) => {
      if (d < cum[i]) i = 0
      while (i < cum.length - 2 && cum[i + 1] < d) i++
      const j = Math.min(i + 1, geometry.length - 1), span = cum[j] - cum[i] || 1, k = Math.min(1, Math.max(0, (d - cum[i]) / span))
      const p: [number, number] = [geometry[i][0] + (geometry[j][0] - geometry[i][0]) * k, geometry[i][1] + (geometry[j][1] - geometry[i][1]) * k]
      drawn.setData(line([...geometry.slice(0, i + 1), p]))
      taxi.setLngLat(p).setRotation((Math.atan2(xy[j][1] - xy[i][1], xy[j][0] - xy[i][0]) * 180) / Math.PI)
    }
    if (!motionOK()) return at(total)
    const t0 = performance.now() + 500, dur = 1600
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / dur))
      at((k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) * total)
      if (k < 1) anim.current = requestAnimationFrame(step)
    }
    at(0)
    anim.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(anim.current)
    // pickup/drop are read for framing only; the route itself is what triggers a redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, approx, drawKey, ready])

  return (
    <div className="map__canvas" ref={box} role="region" aria-label="Trip map. Tap the map or a stop to set the pickup or drop-off; drag a pin to move it.">
      {!ready && <p className="map__loading">{failed ? 'The map can’t load on this device. Search still works.' : 'Loading map…'}</p>}
    </div>
  )
}
