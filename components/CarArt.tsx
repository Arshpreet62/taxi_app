import type { CarId } from '@/lib/tariff'

// Side views in the Harbour Ride livery, 320 × 132 with the ground at y 120.
const CARS: Record<CarId, {
  body: string; glass: string[]; glint: string; lines: string; handles: number[]; head: string; tail: string; mirror: string
  stripe: [number, number, number]; sign: [number, number]; wheels: number[]
}> = {
  sedan: {
    body: 'M20 100C14 100 12 96 12 90V80C12 72 18 69 28 68L92 60C100 59 106 55 112 50L138 32C146 27 152 26 162 26H212C224 26 230 29 238 36L260 56 294 60C304 61 308 66 308 74V92C308 97 305 100 300 100Z',
    glass: ['M118 57 142 38C148 34 152 33 160 33H180V57Z', 'M186 33H210C220 33 224 36 230 41L246 57H186Z'],
    glint: 'M146 54 162 36M156 54 170 40M200 54 212 38',
    lines: 'M112 58V96M183 34V96M252 58V90M28 68 294 60',
    handles: [160, 228], head: 'M13 74 30 71V78L13 81Z', tail: 'M299 62 308 66V76L299 75Z', mirror: 'M114 51 105 49 103 56 112 57Z',
    stripe: [16, 80, 290], sign: [178, 14], wheels: [78, 250],
  },
  wagon: {
    body: 'M20 100C14 100 12 96 12 90V80C12 72 18 69 28 68L90 60C98 59 104 55 110 50L136 30C143 25 149 24 158 24H268C276 24 280 28 283 34L296 60C304 62 308 66 308 74V92C308 97 305 100 300 100Z',
    glass: ['M116 57 140 36C145 32 149 31 156 31H176V57Z', 'M182 31H228V57H182Z', 'M234 31H266C271 31 274 33 276 37L286 57H234Z'],
    glint: 'M144 54 160 34M196 54 212 34M246 54 262 34',
    lines: 'M110 58V96M179 32V96M231 32V96M28 68 296 61M150 19H266M156 19V24M260 19V24',
    handles: [154, 206], head: 'M13 74 30 71V78L13 81Z', tail: 'M298 58 308 64V76L298 75Z', mirror: 'M112 51 103 49 101 56 110 57Z',
    stripe: [16, 80, 290], sign: [192, 11], wheels: [78, 254],
  },
  maxi: {
    body: 'M18 100C13 100 10 96 10 90V80C10 70 16 66 26 64L60 58C68 56 72 52 76 46L98 16C103 9 108 8 118 8H294C303 8 308 13 308 22V92C308 97 305 100 300 100Z',
    glass: ['M82 52 102 22C105 17 108 16 114 16H130V52Z', 'M138 16H192V52H138Z', 'M200 16H250V52H200Z', 'M258 16H298C300 16 301 17 301 19V52H258Z'],
    glint: 'M106 48 122 20M160 48 176 20M222 48 238 20M276 48 290 22',
    lines: 'M134 12V96M196 56V96M254 12V96M138 60H250M26 64H306',
    handles: [178, 262], head: 'M11 72 26 68V76L11 79Z', tail: 'M301 58H308V78H301Z', mirror: 'M80 46 72 44 70 51 78 52Z',
    stripe: [14, 76, 294], sign: [168, -3], wheels: [72, 256],
  },
}

function Wheel({ x }: { x: number }) {
  return (
    <g className="cv-wheel">
      <circle className="cv-arch" cx={x} cy="98" r="27" />
      <circle className="cv-tyre" cx={x} cy="98" r="22" />
      <g className="cv-rimg" style={{ transformOrigin: `${x}px 98px` }}>
        <circle className="cv-rim" cx={x} cy="98" r="14" />
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i * 72 * Math.PI) / 180
          return <path key={i} className="cv-spoke" d={`M${(x + Math.cos(a) * 4.5).toFixed(1)} ${(98 + Math.sin(a) * 4.5).toFixed(1)}L${(x + Math.cos(a) * 12.5).toFixed(1)} ${(98 + Math.sin(a) * 12.5).toFixed(1)}`} />
        })}
        <circle className="cv-hub" cx={x} cy="98" r="4" />
      </g>
    </g>
  )
}

export function CarArt({ id, className = 'car__art' }: { id: CarId; className?: string }) {
  const c = CARS[id]
  return (
    <svg className={`${className} cv cv--${id}`} viewBox="0 0 320 132" aria-hidden="true" focusable="false">
      <ellipse className="cv-shadow" cx="160" cy="121" rx="150" ry="5" />
      <g className="cv-sign">
        <rect x={c.sign[0]} y={c.sign[1]} width="38" height="13" rx="3" />
        <text x={c.sign[0] + 19} y={c.sign[1] + 10} textAnchor="middle">TAXI</text>
      </g>
      <path className="cv-body" d={c.body} />
      <rect className="cv-stripe" x={c.stripe[0]} y={c.stripe[1]} width={c.stripe[2]} height="7" rx="2" />
      <path className="cv-sill" d="M14 90H306V96C306 98 304 100 300 100H20C16 100 14 98 14 96Z" />
      {c.glass.map((g) => <path key={g} className="cv-glass" d={g} />)}
      <path className="cv-glint" d={c.glint} />
      <path className="cv-line" d={c.lines} />
      {c.handles.map((h) => <rect key={h} className="cv-handle" x={h} y="64" width="13" height="3.5" rx="1.5" />)}
      <path className="cv-head" d={c.head} />
      <path className="cv-tail" d={c.tail} />
      <path className="cv-mirror" d={c.mirror} />
      {c.wheels.map((x) => <Wheel key={x} x={x} />)}
    </svg>
  )
}
