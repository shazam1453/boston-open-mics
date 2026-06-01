import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { availabilityAPI } from '../utils/api'

type Status = 'available' | 'unavailable'
type AvailabilityMap = Record<string, Status>

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

function buildMonths(baseDate: Date): { year: number; month: number }[] {
  const months = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() })
  }
  return months
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

// ─── Calendar cell ────────────────────────────────────────────────────────────
function DayCell({
  dateStr, status, isPast, onClick
}: {
  dateStr: string
  status: Status | undefined
  isPast: boolean
  onClick: () => void
}) {
  const bg =
    status === 'available'   ? '#166534' :   // dark green
    status === 'unavailable' ? '#7f1d1d' :   // dark red
    'transparent'

  const textColor =
    status === 'available'   ? '#bbf7d0' :
    status === 'unavailable' ? '#fecaca' :
    isPast ? '#4a4438' : '#b8ae9e'

  const border =
    status === 'available'   ? '1px solid #15803d' :
    status === 'unavailable' ? '1px solid #991b1b' :
    '1px solid #2e2a22'

  return (
    <button
      onClick={isPast ? undefined : onClick}
      disabled={isPast}
      title={dateStr}
      style={{
        backgroundColor: bg,
        color: textColor,
        border,
        borderRadius: '6px',
        width: '100%',
        aspectRatio: '1',
        fontSize: '0.8rem',
        fontWeight: status ? '600' : '400',
        cursor: isPast ? 'default' : 'pointer',
        transition: 'all 0.1s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {parseInt(dateStr.split('-')[2], 10)}
    </button>
  )
}

// ─── One month grid ───────────────────────────────────────────────────────────
function MonthGrid({
  year, month, availability, today, onToggle
}: {
  year: number
  month: number
  availability: AvailabilityMap
  today: Date
  onToggle: (dateStr: string) => void
}) {
  const firstDay = firstDayOfWeek(year, month)
  const numDays = daysInMonth(year, month)
  const cells: (string | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= numDays; d++) cells.push(toDateStr(year, month, d))

  return (
    <div style={{ backgroundColor: '#1e1a17', borderRadius: '10px', border: '1px solid #2e2a22', padding: '1rem' }}>
      <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#e8e0d4', marginBottom: '0.75rem' }}>
        {MONTH_NAMES[month]} {year}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: '#6b6358', fontWeight: 600, paddingBottom: '2px' }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} />
          const cellDate = new Date(dateStr + 'T00:00:00')
          const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())
          return (
            <DayCell
              key={dateStr}
              dateStr={dateStr}
              status={availability[dateStr]}
              isPast={isPast}
              onClick={() => onToggle(dateStr)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── PDF export modal ─────────────────────────────────────────────────────────
function ExportModal({
  months, availability, userName, userEmail, onClose
}: {
  months: { year: number; month: number }[]
  availability: AvailabilityMap
  userName: string
  userEmail: string
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(months.map(m => `${m.year}-${m.month}`))
  )
  const [exporting, setExporting] = useState(false)

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleExport = async () => {
    if (selected.size === 0) return
    setExporting(true)
    try {
      // Dynamic import so the bundle only loads jsPDF when needed
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })

      const pageW = doc.internal.pageSize.getWidth()   // 792
      const pageH = doc.internal.pageSize.getHeight()  // 612
      const margin = 36

      const selectedMonths = months.filter(m => selected.has(`${m.year}-${m.month}`))

      selectedMonths.forEach((m, pageIdx) => {
        if (pageIdx > 0) doc.addPage()

        const { year, month } = m
        const today = new Date()

        // ── Title ─────────────────────────────────────────────────────────────
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(18)
        doc.setTextColor(30, 26, 23)
        doc.text(`${MONTH_NAMES[month]} ${year} — ${userName}'s Availability`, margin, margin + 16)

        // Email subheader
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(100, 90, 80)
        doc.text(userEmail, margin, margin + 32)

        // ── Layout constants ──────────────────────────────────────────────────
        const calLeft    = margin
        const calTop     = margin + 56
        const calWidth   = pageW * 0.55
        const listLeft   = calLeft + calWidth + 24
        const listWidth  = pageW - listLeft - margin
        const cellSize   = Math.floor((calWidth - 6 * 4) / 7)
        const cellGap    = 4
        const headerH    = 20

        // ── Day-of-week headers ───────────────────────────────────────────────
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(120, 110, 100)
        DAY_LABELS.forEach((label, i) => {
          const x = calLeft + i * (cellSize + cellGap)
          doc.text(label, x + cellSize / 2, calTop + 12, { align: 'center' })
        })

        // ── Calendar cells ────────────────────────────────────────────────────
        const firstDay = firstDayOfWeek(year, month)
        const numDays  = daysInMonth(year, month)
        let col = firstDay
        let row = 0

        for (let d = 1; d <= numDays; d++) {
          const dateStr = toDateStr(year, month, d)
          const status  = availability[dateStr]
          const cellDate = new Date(dateStr + 'T00:00:00')
          const isPast   = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())

          const x = calLeft + col * (cellSize + cellGap)
          const y = calTop + headerH + row * (cellSize + cellGap)

          // Background
          if (status === 'available') {
            doc.setFillColor(220, 252, 231)       // light green
            doc.setDrawColor(134, 239, 172)
          } else if (status === 'unavailable') {
            doc.setFillColor(254, 226, 226)       // light red
            doc.setDrawColor(252, 165, 165)
          } else if (isPast) {
            doc.setFillColor(245, 240, 235)
            doc.setDrawColor(210, 200, 190)
          } else {
            doc.setFillColor(255, 255, 255)
            doc.setDrawColor(220, 210, 200)
          }
          doc.roundedRect(x, y, cellSize, cellSize, 3, 3, 'FD')

          // Day number
          doc.setFontSize(9)
          doc.setFont('helvetica', isPast ? 'normal' : 'bold')
          if (status === 'available')        doc.setTextColor(22, 101, 52)
          else if (status === 'unavailable') doc.setTextColor(153, 27, 27)
          else if (isPast)                   doc.setTextColor(180, 170, 160)
          else                               doc.setTextColor(60, 50, 40)

          doc.text(String(d), x + cellSize / 2, y + cellSize / 2 + 3, { align: 'center' })

          col++
          if (col === 7) { col = 0; row++ }
        }

        // ── Right column: available dates list ────────────────────────────────
        const availDates = []
        for (let d = 1; d <= numDays; d++) {
          const dateStr  = toDateStr(year, month, d)
          const cellDate = new Date(dateStr + 'T00:00:00')
          const isPast   = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())
          if (!isPast && availability[dateStr] === 'available') {
            const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][cellDate.getDay()]
            availDates.push(`${dayName}, ${MONTH_NAMES[month]} ${d}`)
          }
        }

        // List header
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(30, 26, 23)
        doc.text('Available Dates', listLeft, calTop + 12)

        doc.setDrawColor(200, 190, 180)
        doc.line(listLeft, calTop + 16, listLeft + listWidth, calTop + 16)

        if (availDates.length === 0) {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(9)
          doc.setTextColor(150, 140, 130)
          doc.text('None marked', listLeft, calTop + 32)
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.setTextColor(22, 101, 52)
          availDates.forEach((line, i) => {
            doc.text(`• ${line}`, listLeft, calTop + 32 + i * 14)
          })
        }

        // ── Legend ─────────────────────────────────────────────────────────────
        const legendY = pageH - margin - 10
        doc.setFillColor(220, 252, 231); doc.setDrawColor(134, 239, 172)
        doc.roundedRect(margin, legendY - 10, 12, 12, 2, 2, 'FD')
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 50, 40)
        doc.text('Available', margin + 16, legendY)

        doc.setFillColor(254, 226, 226); doc.setDrawColor(252, 165, 165)
        doc.roundedRect(margin + 80, legendY - 10, 12, 12, 2, 2, 'FD')
        doc.text('Unavailable', margin + 96, legendY)

        doc.setFillColor(255, 255, 255); doc.setDrawColor(220, 210, 200)
        doc.roundedRect(margin + 172, legendY - 10, 12, 12, 2, 2, 'FD')
        doc.text('Not set', margin + 188, legendY)
      })

      doc.save(`availability-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('PDF export failed. Make sure jspdf is installed (npm install in client folder).')
    }
    setExporting(false)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div style={{
        backgroundColor: '#1e1a17', border: '1px solid #3a352b', borderRadius: '12px',
        padding: '1.5rem', minWidth: '320px', maxWidth: '400px', width: '100%'
      }}>
        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#e8e0d4', marginBottom: '0.5rem' }}>
          Export PDF
        </h2>
        <p style={{ color: '#9c9080', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Select which months to include:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {months.map(m => {
            const key = `${m.year}-${m.month}`
            const checked = selected.has(key)
            return (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(key)}
                  style={{ accentColor: '#f59e0b', width: '16px', height: '16px' }}
                />
                <span style={{ color: checked ? '#e8e0d4' : '#6b6358', fontSize: '0.9rem' }}>
                  {MONTH_NAMES[m.month]} {m.year}
                </span>
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ minHeight: 0, height: '36px', padding: '0 1rem', fontSize: '0.875rem' }}>
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0 || exporting}
            className="btn btn-primary"
            style={{ minHeight: 0, height: '36px', padding: '0 1rem', fontSize: '0.875rem', opacity: selected.size === 0 ? 0.5 : 1 }}
          >
            {exporting ? 'Generating…' : `Export ${selected.size} month${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Availability() {
  const { user } = useAuth()
  const today = new Date()
  const months = buildMonths(today)

  const [availability, setAvailability] = useState<AvailabilityMap>({})
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [showExport, setShowExport] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load on mount
  useEffect(() => {
    availabilityAPI.get()
      .then(res => { setAvailability(res.data.availability || {}) })
      .catch(err => console.error('Failed to load availability:', err))
      .finally(() => setLoading(false))
  }, [])

  // Debounced save
  const save = useCallback(async (map: AvailabilityMap) => {
    setSaving(true)
    try {
      await availabilityAPI.save(map)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [])

  const handleToggle = (dateStr: string) => {
    setAvailability(prev => {
      const current = prev[dateStr]
      const next: AvailabilityMap = { ...prev }
      if (!current)                  next[dateStr] = 'available'
      else if (current === 'available') next[dateStr] = 'unavailable'
      else                           delete next[dateStr]
      save(next)
      return next
    })
  }

  const availableCount = Object.values(availability).filter(s => s === 'available').length

  if (!user) {
    return <p style={{ color: '#9c9080' }}>Please log in to manage your availability.</p>
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#e8e0d4', marginBottom: '0.25rem' }}>
            My Availability
          </h1>
          <p style={{ color: '#9c9080', fontSize: '0.85rem' }}>
            Click a day to mark it available or unavailable. Changes save automatically. Showing the next 6 months.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.8rem', color: saving ? '#f59e0b' : saveStatus === 'saved' ? '#4ade80' : saveStatus === 'error' ? '#f87171' : 'transparent' }}>
            {saving ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : '·'}
          </span>
          <button onClick={() => setShowExport(true)} className="btn btn-primary" style={{ minHeight: 0, height: '38px', padding: '0 1.25rem', fontSize: '0.875rem' }}>
            Export PDF
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { color: '#166534', border: '#15803d', text: '#bbf7d0', label: 'Available' },
          { color: '#7f1d1d', border: '#991b1b', text: '#fecaca', label: 'Unavailable' },
          { color: 'transparent', border: '#2e2a22', text: '#b8ae9e', label: 'Not set' },
        ].map(({ color, border, text, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: color, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: text, fontWeight: 700 }}>1</span>
            </div>
            <span style={{ color: '#9c9080', fontSize: '0.8rem' }}>{label}</span>
          </div>
        ))}
        <span style={{ color: '#6b6358', fontSize: '0.8rem', marginLeft: 'auto' }}>
          {availableCount} day{availableCount !== 1 ? 's' : ''} marked available
        </span>
      </div>

      {loading ? (
        <p style={{ color: '#6b6358' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {months.map(({ year, month }) => (
            <MonthGrid
              key={`${year}-${month}`}
              year={year}
              month={month}
              availability={availability}
              today={today}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {showExport && (
        <ExportModal
          months={months}
          availability={availability}
          userName={user.name}
          userEmail={user.email}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
