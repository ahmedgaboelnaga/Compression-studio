import { useState, useRef, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

type Algorithm = 'huffman' | 'rle' | 'lzw' | 'shannon-fano' | 'arithmetic'
type InputTab  = 'text' | 'file'
type Screen    = 'input' | 'compressing' | 'results' | 'error' | 'explanations'
type ErrorKind = 'network' | 'server' | 'unknown'

import { AlgorithmExplanationsScreen } from './AlgorithmExplanations'

interface AppError { kind: ErrorKind; message: string; detail?: string }

interface ApiResult {
  original: string; original_size: number; algorithm: string
  compressed: string; ratio: number
  compressed_size?: number | null
  stats?: {
    original_bits?: number
    compressed_payload_bits?: number
    ratio_basis?: string
  } | null
  codes?: Record<string, string> | null
  details?: AlgorithmDetails | null
}

interface AlgorithmDetails {
  [key: string]: unknown
  pairs?: { symbol: string; count: number }[]
  frequencies?: Record<string, number>
  probabilities?: Record<string, number>
  ranges?: Record<string, [string, string]>
  encoded_value?: string
  interval_low?: string
  interval_high?: string
  codes?: number[]
  dictionary_additions?: { code: number; sequence: string }[]
  validated_round_trip?: boolean
}

const ALGORITHMS = {
  huffman:        { name: 'Huffman Coding',    type: 'Entropy',     complexity: 'O(n log n)', description: 'Variable-length prefix coding. Assigns shorter codes to more frequent symbols. Optimal for known frequency distributions.' },
  rle:            { name: 'Run-Length Enc.',   type: 'Statistical', complexity: 'O(n)',       description: 'Encodes consecutive identical characters as a count+symbol pair. Excellent for highly repetitive data.' },
  lzw:            { name: 'LZW',              type: 'Dictionary',  complexity: 'O(n)',       description: 'Builds a dynamic dictionary of repeated patterns. Foundation of GIF and TIFF compression formats.' },
  'shannon-fano': { name: 'Shannon-Fano',     type: 'Entropy',     complexity: 'O(n log n)', description: 'Recursive top-down symbol splitting. Predecessor to Huffman, slightly less optimal but historically significant.' },
  arithmetic:     { name: 'Arithmetic Coding', type: 'Entropy',    complexity: 'O(n)',       description: 'Encodes the entire message as a single fractional number. Achieves near-theoretical compression limits.' },
} satisfies Record<Algorithm, { name: string; type: string; complexity: string; description: string }>

const ALGO_KEYS = Object.keys(ALGORITHMS) as Algorithm[]

function Nav({ onNavigate }: { onNavigate?: (s: Screen) => void }) {
  return (
    <nav className="relative z-50 flex items-center justify-between px-12 h-16 bg-white border-b border-[#EAEAEA] shrink-0">
      <div className="flex items-center gap-8 cursor-pointer" onClick={() => onNavigate?.('input')}>
        <span className="font-mono text-[11px] tracking-[0.2em] font-semibold text-[#1A1A1A]">MULTIMEDIA</span>
        <div className="w-px h-5 bg-[#E0E0E0]" />
        <span className="font-mono text-[11px] tracking-[0.15em] text-[#666]">COMPRESSION STUDIO</span>
      </div>
      <div className="flex items-center gap-6">
        <span className="font-mono text-[10px] tracking-[0.15em] text-[#999] hover:text-[#1A1A1A] cursor-pointer transition-colors" onClick={() => window.open('https://github.com', '_blank')}>DOCS</span>
        <span className="font-mono text-[10px] tracking-[0.15em] text-[#999] hover:text-[#1A1A1A] cursor-pointer transition-colors" onClick={() => onNavigate?.('explanations')}>ALGORITHMS</span>
        <span className="font-mono text-[10px] tracking-[0.15em] text-[#999] hover:text-[#1A1A1A] cursor-pointer transition-colors">ABOUT</span>
      </div>
    </nav>
  )
}

function Hero({ selected, onSelect }: { selected: Algorithm; onSelect: (a: Algorithm) => void }) {
  return (
    <div className="relative overflow-hidden bg-[#FAFAFA] shrink-0" style={{ height: 220 }}>
      <span className="font-playfair font-bold absolute select-none pointer-events-none"
        style={{ fontSize: 240, lineHeight: 1, color: '#F0F0F0', top: -30, left: -40, letterSpacing: -8, whiteSpace: 'nowrap' }}>
        COMPRESS
      </span>
      <div className="relative z-10 px-12 pt-10 flex flex-col gap-3">
        <h1 className="font-playfair font-bold text-[42px] leading-tight text-[#1A1A1A]">Lossless Data Compression</h1>
        <p className="text-[16px] text-[#666]">Analyze and compare compression algorithms in real time.</p>
      </div>
      <div className="absolute bottom-4 left-12 z-10 flex gap-2 flex-wrap">
        {ALGO_KEYS.map(k => (
          <button key={k} onClick={() => onSelect(k)}
            className={`font-mono text-[10px] tracking-[0.1em] px-3 h-7 transition-all duration-200 cursor-pointer ${selected === k
              ? 'bg-[#1A1A1A] text-white'
              : 'bg-white border border-[#E0E0E0] text-[#1A1A1A] hover:border-[#999]'}`}>
            {k.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

function InputScreen({ onCompress }: { onCompress: (text: string, algo: Algorithm) => void }) {
  const [tab, setTab] = useState<InputTab>('text')
  const [text, setText] = useState("The quick brown fox jumps over the lazy dog. Repeated patterns like aaabbbccc help demonstrate how RLE achieves compression by encoding runs of identical characters efficiently.")
  const [algo, setAlgo] = useState<Algorithm>('huffman')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const meta = ALGORITHMS[algo]
  const uniqueChars = new Set(text).size
  const entropy = text.length > 0
    ? (-[...new Set(text)].reduce((s, c) => {
        const p = [...text].filter(x => x === c).length / text.length
        return s + p * Math.log2(p)
      }, 0)).toFixed(2)
    : '0.00'

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.txt')) return
    const reader = new FileReader()
    reader.onload = e => { setText(e.target?.result as string ?? ''); setTab('text') }
    reader.readAsText(file)
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left panel */}
      <div className="flex-1 flex flex-col px-12 py-8 gap-6 overflow-hidden">
        <span className="font-mono text-[11px] tracking-[0.2em] text-[#666]">DATA INPUT</span>
        {/* Tabs */}
        <div className="flex">
          {(['text', 'file'] as InputTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`font-mono text-[10px] tracking-[0.1em] px-5 h-9 transition-all cursor-pointer ${tab === t
                ? 'bg-[#1A1A1A] text-white'
                : 'bg-white border border-[#E0E0E0] text-[#666] hover:text-[#1A1A1A]'}`}>
              {t === 'text' ? 'TYPE TEXT' : 'UPLOAD FILE'}
            </button>
          ))}
        </div>

        {tab === 'text' ? (
          <div className="flex-1 flex flex-col bg-[#FAFAFA] border border-[#EAEAEA] overflow-hidden">
            <textarea value={text} onChange={e => setText(e.target.value)}
              className="flex-1 resize-none bg-transparent p-6 text-[15px] leading-[1.7] text-[#1A1A1A] outline-none placeholder-[#CCC]"
              placeholder="Type or paste your data here…" style={{ fontFamily: 'Inter, sans-serif' }} />
            <div className="flex justify-between items-center px-6 py-3 border-t border-[#EAEAEA]">
              <span className="font-mono text-[10px] text-[#999]">{text.length} characters</span>
              <span className={`font-mono text-[10px] tracking-[0.1em] ${text.length > 0 ? 'text-[#22C55E]' : 'text-[#CCC]'}`}>
                {text.length > 0 ? 'READY' : 'EMPTY'}
              </span>
            </div>
          </div>
        ) : (
          <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
            className={`flex-1 flex flex-col items-center justify-center gap-5 border-2 transition-colors ${dragging ? 'border-[#1A1A1A] bg-[#F5F5F5]' : 'border-[#E0E0E0] bg-[#FAFAFA]'}`}>
            <span className="text-5xl text-[#CCC]">↑</span>
            <p className="font-playfair text-[22px] text-[#1A1A1A]">Drag & drop your .txt file here</p>
            <p className="text-[13px] text-[#999]">or</p>
            <button onClick={() => fileRef.current?.click()}
              className="px-6 h-10 border border-[#1A1A1A] font-mono text-[11px] tracking-[0.1em] hover:bg-[#1A1A1A] hover:text-white transition-all cursor-pointer">
              BROWSE FILES
            </button>
            <p className="font-mono text-[10px] text-[#BBB]">Supported: .txt files up to 10 MB</p>
            <input ref={fileRef} type="file" accept=".txt" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        )}
      </div>

      <div className="w-px bg-[#EAEAEA] shrink-0" />

      {/* Right panel */}
      <div className="w-[400px] shrink-0 flex flex-col px-8 py-8 gap-6 overflow-y-auto">
        <span className="font-mono text-[11px] tracking-[0.2em] text-[#666]">ALGORITHM SETTINGS</span>

        <div className="bg-[#FAFAFA] border border-[#EAEAEA] p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="font-playfair text-[20px] text-[#1A1A1A]">{meta.name}</span>
            <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
          </div>
          <p className="text-[13px] text-[#666] leading-[1.6]">{meta.description}</p>
          <div className="flex gap-4 flex-wrap">
            {[['TYPE', meta.type], ['COMPLEXITY', meta.complexity], ['LOSSLESS', 'Yes']].map(([l, v]) => (
              <div key={l} className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-[0.1em] text-[#999]">{l}</span>
                <span className={`text-[13px] text-[#1A1A1A] ${l === 'LOSSLESS' ? 'text-[#22C55E]!' : ''} ${l === 'COMPLEXITY' ? 'font-mono' : ''}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {ALGO_KEYS.map(k => (
            <button key={k} onClick={() => setAlgo(k)}
              className={`flex items-center justify-between px-4 h-11 border transition-all text-left cursor-pointer ${algo === k
                ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                : 'bg-white border-[#E0E0E0] text-[#1A1A1A] hover:border-[#999]'}`}>
              <span className="text-[13px]">{ALGORITHMS[k].name}</span>
              <span className={`font-mono text-[10px] ${algo === k ? 'text-[#888]' : 'text-[#BBB]'}`}>{ALGORITHMS[k].complexity}</span>
            </button>
          ))}
        </div>

        <button onClick={() => text.trim() && onCompress(text, algo)} disabled={!text.trim()}
          className="flex items-center justify-center gap-3 h-14 bg-[#1A1A1A] text-white font-mono text-[12px] tracking-[0.15em] font-semibold hover:bg-[#333] disabled:bg-[#CCC] disabled:cursor-not-allowed transition-all cursor-pointer">
          COMPRESS DATA <span className="text-lg">→</span>
        </button>

        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] tracking-[0.15em] text-[#999]">QUICK PREVIEW</span>
          <div className="grid grid-cols-3 gap-3">
            {[['INPUT SIZE', `${text.length} B`], ['UNIQUE CHARS', String(uniqueChars)], ['ENTROPY', String(entropy)]].map(([l, v]) => (
              <div key={l} className="bg-[#FAFAFA] border border-[#EAEAEA] p-4 flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-[0.1em] text-[#999]">{l}</span>
                <span className="font-playfair text-[20px] text-[#1A1A1A]">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center mt-auto pt-2">
          <span className="text-[12px] text-[#999]">{meta.name} · Ready</span>
          <span className="font-mono text-[10px] text-[#CCC]">v1.0</span>
        </div>
      </div>
    </div>
  )
}

function CompressingScreen({ algo }: { algo: Algorithm }) {
  const steps = ['Profile symbols', 'Build model', 'Write payload']
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 anim-fade-in bg-[#FBFAF8] relative overflow-hidden px-8">
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#1A1A1A 1px, transparent 1px), linear-gradient(90deg, #1A1A1A 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative z-10 w-full max-w-[680px] h-[220px] flex items-center justify-center">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-[#D8D4CB]" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex gap-3 anim-token-train">
          {['T', 'H', 'E', ' ', 'Q', 'U', 'I', 'C', 'K'].map((token, i) => (
            <div key={`${token}-${i}`} className="w-10 h-10 bg-[#F6F4EF] border border-[#D8D4CB] flex items-center justify-center font-mono text-[11px] text-[#5F5A50] shadow-[0_1px_0_rgba(26,26,26,0.04)]">
              {token === ' ' ? 'SP' : token}
            </div>
          ))}
        </div>

        <div className="relative z-20 w-28 h-28 bg-[#1E1D1A] text-[#FBFAF8] border border-[#1E1D1A] shadow-[0_18px_50px_rgba(30,29,26,0.18)] flex flex-col items-center justify-center gap-3 anim-compressor-breathe">
          <div className="grid grid-cols-4 gap-1">
            {[0, 1, 1, 0, 1, 0, 0, 1].map((bit, i) => (
              <span key={i} className="font-mono text-[10px] leading-none opacity-80">{bit}</span>
            ))}
          </div>
          <div className="w-12 h-px bg-[#C9B36A]" />
          <span className="font-mono text-[9px] tracking-[0.14em] text-[#D8D4CB]">ENCODE</span>
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-[5px] anim-bit-train">
          {[...Array(34)].map((_, i) => (
            <div key={i} className="w-[5px] bg-[#1E1D1A]" style={{ height: `${14 + (i % 5) * 4}px`, opacity: i % 3 === 0 ? 0.45 : 0.82 }} />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2 anim-fade-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="font-playfair text-[32px] font-semibold text-[#1A1A1A]">Encoding with {ALGORITHMS[algo].name}</h2>
        <p className="text-[15px] text-[#666]">Readable input is being transformed into a compact payload.</p>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6" style={{ width: 400 }}>
        <div className="w-full h-[4px] bg-[#EAEAEA] overflow-hidden">
          <div className="h-full bg-[#1A1A1A] anim-progress" style={{ '--progress': '85%' } as React.CSSProperties} />
        </div>
        <div className="flex gap-12">
          {steps.map((step, i) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center anim-step-pop ${i < 2 ? 'bg-[#1A1A1A]' : 'border-2 border-[#EAEAEA]'}`}
                style={{ animationDelay: `${i * 0.25}s` }}>
                {i < 2 && <span className="text-white text-[10px]">✓</span>}
              </div>
              <span className={`font-mono text-[10px] tracking-[0.05em] ${i < 2 ? 'text-[#1A1A1A]' : 'text-[#999]'}`}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatSymbol(char: string) {
  if (char === ' ') return 'SPACE'
  if (char === '\n') return 'NEW LINE'
  if (char === '\t') return 'TAB'
  return char
}

function formatBytes(bits: number) {
  const bytes = Math.max(0, Math.ceil(bits / 8))
  return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`
}

function isCodeMap(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).length > 0 &&
    Object.values(value as Record<string, unknown>).every(item => typeof item === 'string' && /^[01]+$/.test(item))
  )
}

function getCodeMap(result: ApiResult) {
  if (result.codes && Object.keys(result.codes).length > 0) return result.codes
  if (isCodeMap(result.details)) return result.details
  return null
}

function parseRlePayload(payload: string) {
  const pairs: { symbol: string; count: number }[] = []
  let index = 0

  while (index < payload.length) {
    const symbol = payload[index]
    index += 1
    let digits = ''

    while (index < payload.length && /\d/.test(payload[index])) {
      digits += payload[index]
      index += 1
    }

    pairs.push({ symbol, count: Number(digits || 1) })
  }

  return pairs
}

function parseLzwPayload(payload: string) {
  return payload
    .trim()
    .split(/\s+/)
    .map(code => Number(code))
    .filter(code => Number.isFinite(code))
}

function parseArithmeticPayload(payload: string) {
  const value = payload.match(/value=([^\n]+)/)?.[1]
  const interval = payload.match(/interval=\[([^,]+),\s*([^)]+)\)/)
  return {
    encodedValue: value,
    low: interval?.[1],
    high: interval?.[2],
  }
}

function parsePrefixBitstream(bitstream: string, codeMap: Record<string, string>) {
  const reverse = new Map(Object.entries(codeMap).map(([symbol, code]) => [code, symbol]))
  const steps: { symbol: string; code: string; start: number; end: number }[] = []
  let buffer = ''
  let start = 0

  for (let index = 0; index < bitstream.length; index += 1) {
    buffer += bitstream[index]
    const symbol = reverse.get(buffer)

    if (symbol !== undefined) {
      steps.push({ symbol, code: buffer, start, end: index })
      buffer = ''
      start = index + 1
    }
  }

  return { steps, remainder: buffer }
}

function getJsonDownloadPayload(result: ApiResult) {
  return JSON.stringify({
    format: 'compression-studio.v1',
    algorithm: result.algorithm,
    payload: result.compressed,
    payload_size_bits: result.compressed_size ?? undefined,
    ratio_basis: result.stats?.ratio_basis ?? 'compressed payload only',
    codebook: getCodeMap(result) ?? undefined,
    details: isCodeMap(result.details) ? undefined : result.details ?? undefined,
  }, null, 2)
}

function downloadCompressedFile(result: ApiResult, format: 'json' | 'txt') {
  const payload = format === 'json' ? getJsonDownloadPayload(result) : result.compressed
  const blob = new Blob([payload], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `compressed-${result.algorithm}-${Date.now()}.${format === 'json' ? 'cmp.json' : 'txt'}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function ResultsScreen({ result, onReset }: { result: ApiResult; onReset: () => void }) {
  const originalBits = result.original_size
  const compressedBits = result.compressed_size ?? Math.round(originalBits * result.ratio)
  const compressedPct = Math.round(result.ratio * 100)
  const reductionPct = Math.round((1 - result.ratio) * 100)
  const savedBits = originalBits - compressedBits
  const barPct = Math.max(4, Math.min(100, compressedPct))
  const didCompress = savedBits >= 0
  const codeMap = getCodeMap(result)
  const compressionFactor = compressedBits > 0 ? (originalBits / compressedBits).toFixed(2) : '0.00'

  const tableRows = codeMap
    ? Object.entries(codeMap)
        .map(([char, code]) => ({
          char: formatSymbol(char),
          freq: [...result.original].filter(c => c === char).length,
          code: String(code),
          bits: String(code).length,
        }))
        .sort((a, b) => b.freq - a.freq)
        .slice(0, 12)
    : []

  const outputSummary = {
    arithmetic: 'The file stores one high-precision value inside the final interval, plus the symbol ranges needed to decode it.',
    rle: 'The file stores consecutive runs as symbol and count pairs, so repeated characters become compact groups.',
    lzw: 'The file stores dictionary code numbers. Codes above 255 refer to phrases discovered while scanning the input.',
    huffman: 'The file stores a prefix-code table and a compact bit stream. Frequent symbols receive shorter codes.',
    'shannon-fano': 'The file stores a Shannon-Fano code table and bit stream created by recursively splitting symbol probabilities.',
  }[result.algorithm as Algorithm] ?? 'The file stores the compressed payload and metadata required for decoding.'

  const renderReadableOutput = () => {
    if (result.algorithm === 'rle') {
      const pairs = result.details?.pairs?.length ? result.details.pairs : parseRlePayload(result.compressed)
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[56px_1fr_96px] gap-3 px-3 py-2 border border-[#EAEAEA] bg-[#FAFAFA]">
            {['RUN', 'SYMBOL', 'COUNT'].map(label => (
              <span key={label} className="font-mono text-[10px] tracking-[0.1em] text-[#888]">{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {pairs.slice(0, 20).map((pair, i) => (
              <div key={`${pair.symbol}-${i}`} className="grid grid-cols-[40px_1fr_64px] items-center gap-3 border border-[#EAEAEA] bg-white px-3 py-2">
                <span className="font-mono text-[11px] text-[#999]">{i + 1}</span>
                <span className="font-mono text-[12px] text-[#1A1A1A]">'{formatSymbol(pair.symbol)}'</span>
                <span className="font-mono text-[12px] text-[#666] text-right">x {pair.count}</span>
              </div>
            ))}
          </div>
          {pairs.length > 20 && (
            <span className="font-mono text-[11px] text-[#999]">{pairs.length - 20} more runs in the downloaded file</span>
          )}
        </div>
      )
    }

    if (codeMap) {
      const parsed = parsePrefixBitstream(result.compressed, codeMap)
      return (
        <div className="flex flex-col gap-4">
          <div className="border border-[#EAEAEA] bg-white">
            <div className="grid grid-cols-[56px_96px_1fr_96px] gap-3 px-3 py-2 border-b border-[#EAEAEA] bg-[#FAFAFA]">
              {['STEP', 'SYMBOL', 'CODE', 'BITS'].map(label => (
                <span key={label} className="font-mono text-[10px] tracking-[0.1em] text-[#888]">{label}</span>
              ))}
            </div>
            {parsed.steps.slice(0, 18).map((step, i) => (
              <div key={`${step.start}-${i}`} className="grid grid-cols-[56px_96px_1fr_96px] gap-3 px-3 py-2 border-b border-[#F0F0F0] last:border-b-0">
                <span className="font-mono text-[11px] text-[#999]">{i + 1}</span>
                <span className="font-mono text-[12px] text-[#1A1A1A]">'{formatSymbol(step.symbol)}'</span>
                <span className="font-mono text-[12px] text-[#666] break-all">{step.code}</span>
                <span className="font-mono text-[11px] text-[#999]">{step.start}-{step.end}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="border border-[#EAEAEA] bg-white px-3 py-2">
              <span className="font-mono text-[10px] tracking-[0.12em] text-[#888] block mb-1">DECODED STEPS</span>
              <span className="font-mono text-[13px] text-[#1A1A1A]">{parsed.steps.length}</span>
            </div>
            <div className="border border-[#EAEAEA] bg-white px-3 py-2">
              <span className="font-mono text-[10px] tracking-[0.12em] text-[#888] block mb-1">CODEBOOK</span>
              <span className="font-mono text-[13px] text-[#1A1A1A]">{Object.keys(codeMap).length} symbols</span>
            </div>
            <div className="border border-[#EAEAEA] bg-white px-3 py-2">
              <span className="font-mono text-[10px] tracking-[0.12em] text-[#888] block mb-1">REMAINDER</span>
              <span className={`font-mono text-[13px] ${parsed.remainder ? 'text-[#B45309]' : 'text-[#2F8F55]'}`}>{parsed.remainder || 'none'}</span>
            </div>
          </div>
          <div className="border border-[#EAEAEA] bg-white p-3">
            <span className="font-mono text-[10px] tracking-[0.12em] text-[#888] block mb-2">BIT STREAM PREVIEW</span>
            <p className="font-mono text-[12px] leading-[1.8] text-[#1A1A1A] break-all">
              {result.compressed.slice(0, 700)}{result.compressed.length > 700 ? '...' : ''}
            </p>
          </div>
        </div>
      )
    }

    if (result.algorithm === 'lzw') {
      const codes = result.details?.codes?.length ? result.details.codes : parseLzwPayload(result.compressed)
      const additions = result.details?.dictionary_additions ?? []
      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-5 gap-2">
            {codes.slice(0, 30).map((code, i) => (
              <div key={`${code}-${i}`} className="border border-[#EAEAEA] bg-white px-3 py-2">
                <span className="font-mono text-[10px] text-[#999] block mb-1">#{i + 1}</span>
                <span className="font-mono text-[13px] text-[#1A1A1A]">{code}</span>
              </div>
            ))}
          </div>
          {additions.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {additions.slice(0, 10).map(item => (
                <div key={item.code} className="flex justify-between border border-[#EAEAEA] bg-white px-3 py-2">
                  <span className="font-mono text-[12px] text-[#666]">{item.code}</span>
                  <span className="font-mono text-[12px] text-[#1A1A1A]">{item.sequence}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (result.algorithm === 'arithmetic') {
      const parsed = parseArithmeticPayload(result.compressed)
      const ranges = result.details?.ranges ?? {}
      return (
        <div className="flex flex-col gap-3">
          <div className="border border-[#EAEAEA] bg-white px-4 py-3">
            <span className="font-mono text-[10px] tracking-[0.12em] text-[#888] block mb-1">ENCODED VALUE</span>
            <p className="font-mono text-[13px] text-[#1A1A1A] break-all">{result.details?.encoded_value ?? parsed.encodedValue}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-[#EAEAEA] bg-white px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.12em] text-[#888] block mb-1">LOW</span>
              <p className="font-mono text-[12px] text-[#666] break-all">{result.details?.interval_low ?? parsed.low}</p>
            </div>
            <div className="border border-[#EAEAEA] bg-white px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.12em] text-[#888] block mb-1">HIGH</span>
              <p className="font-mono text-[12px] text-[#666] break-all">{result.details?.interval_high ?? parsed.high}</p>
            </div>
          </div>
          <div className="border border-[#EAEAEA] bg-white">
            <div className="grid grid-cols-[72px_1fr_1fr] gap-3 px-3 py-2 border-b border-[#EAEAEA] bg-[#FAFAFA]">
              {['SYM', 'LOW', 'HIGH'].map(label => (
                <span key={label} className="font-mono text-[10px] tracking-[0.1em] text-[#888]">{label}</span>
              ))}
            </div>
            {Object.entries(ranges).slice(0, 8).map(([symbol, range]) => (
              <div key={symbol} className="grid grid-cols-[72px_1fr_1fr] gap-3 px-3 py-2 border-b border-[#F0F0F0] last:border-b-0">
                <span className="font-mono text-[12px] text-[#1A1A1A]">{formatSymbol(symbol)}</span>
                <span className="font-mono text-[11px] text-[#666] truncate">{range[0]}</span>
                <span className="font-mono text-[11px] text-[#666] truncate">{range[1]}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="font-mono text-[13px] leading-[1.8] text-[#1A1A1A] break-all">
        {result.compressed.slice(0, 900)}{result.compressed.length > 900 ? '...' : ''}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Dark hero */}
      <div className="relative overflow-hidden bg-[#1A1A1A] shrink-0 anim-fade-in" style={{ height: 180 }}>
        <span className="font-playfair font-bold absolute select-none pointer-events-none opacity-20"
          style={{ fontSize: 180, lineHeight: 1, color: '#fff', bottom: -20, left: 0, letterSpacing: -6 }}>
          {didCompress ? Math.max(0, reductionPct) : Math.abs(reductionPct)}%
        </span>
        <div className="relative z-10 px-12 pt-8 flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-[0.2em] text-[#666]">COMPRESSION RATIO</span>
          <h2 className="font-playfair text-[36px] font-bold text-white anim-fade-up">
            {didCompress ? `${Math.max(0, reductionPct)}% reduction achieved` : `${Math.abs(reductionPct)}% larger than input`}
          </h2>
          <p className="text-[14px] text-[#888]">
            {ALGORITHMS[result.algorithm as Algorithm]?.name ?? result.algorithm} · {formatBytes(originalBits)} → {formatBytes(compressedBits)}
          </p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left */}
        <div className="flex-1 flex flex-col px-12 py-8 gap-6 overflow-y-auto">
          <span className="font-mono text-[11px] tracking-[0.2em] text-[#666]">COMPARISON & OUTPUT</span>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[13px]">
                <span>Original</span>
                <span className="font-mono text-[#666]">{formatBytes(originalBits)}</span>
              </div>
              <div className="h-8 bg-[#1A1A1A] w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[13px]">
                <span>Compressed</span>
                <span className={`font-mono ${didCompress ? 'text-[#2F8F55]' : 'text-[#B45309]'}`}>{formatBytes(compressedBits)}</span>
              </div>
              <div className="h-8 bg-[#F0F0F0] overflow-hidden">
                <div className={`h-full anim-bar ${didCompress ? 'bg-[#2F8F55]' : 'bg-[#B45309]'}`} style={{ '--bar-width': `${barPct}%` } as React.CSSProperties} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
             <span className="font-mono text-[11px] tracking-[0.2em] text-[#666]">COMPRESSED OUTPUT</span>
             <div className="bg-[#FAFAFA] border border-[#EAEAEA] flex flex-col">
               <div className="p-4 border-b border-[#EAEAEA] bg-[#F5F5F5]">
                 <span className="font-mono text-[10px] tracking-[0.15em] text-[#888] block mb-1">HOW IT'S STORED</span>
                 <p className="text-[13px] text-[#444] leading-[1.6]">
                   {outputSummary}
                 </p>
               </div>
               <div className="p-4 max-h-[260px] overflow-y-auto">
                 <span className="font-mono text-[10px] tracking-[0.15em] text-[#888] block mb-3">READABLE COMPRESSED VIEW</span>
                 {renderReadableOutput()}
               </div>
             </div>
          </div>

          {tableRows.length > 0 && (
            <div className="flex flex-col gap-3 mt-2">
              <span className="font-mono text-[11px] tracking-[0.2em] text-[#666]">ENCODING TABLE</span>
              <div className="border border-[#EAEAEA]">
                <div className="flex bg-[#FAFAFA] px-4 py-3 border-b border-[#EAEAEA]">
                  {['CHAR', 'FREQ', 'CODE', 'BITS'].map(h => (
                    <div key={h} className="flex-1 font-mono text-[10px] tracking-[0.1em] text-[#999]">{h}</div>
                  ))}
                </div>
                {tableRows.map((row, i) => (
                  <div key={i} className={`flex px-4 py-[10px] anim-fade-up ${i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'}`}
                    style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex-1 font-mono text-[13px]">'{row.char}'</div>
                    <div className="flex-1 text-[13px] text-[#666]">{row.freq}</div>
                    <div className="flex-1 font-mono text-[13px]">{row.code}</div>
                    <div className="flex-1 text-[13px] text-[#666]">{row.bits}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px bg-[#EAEAEA] shrink-0" />

        {/* Right */}
        <div className="w-[400px] shrink-0 flex flex-col px-8 py-8 gap-5">
          <span className="font-mono text-[11px] tracking-[0.2em] text-[#666]">DETAILED METRICS</span>
          <div className="flex flex-col gap-3">
            {([
              [didCompress ? 'Reduction' : 'Expansion', `${didCompress ? Math.max(0, reductionPct) : Math.abs(reductionPct)}%`, didCompress ? '#2F8F55' : '#B45309', true ],
              ['Compression Factor', `${compressionFactor}x`,            didCompress ? '#2F8F55' : '#B45309', true ],
              ['Compressed / Original', `${compressedPct}%`,             didCompress ? '#2F8F55' : '#B45309', true ],
              ['Space Saved',       `${didCompress ? '' : '-'}${formatBytes(Math.abs(savedBits))}`, '#1A1A1A', true ],
              ['Original Size',     formatBytes(originalBits),           '#1A1A1A', false],
              ['Payload Size',      formatBytes(compressedBits),         '#1A1A1A', false],
            ] as [string, string, string, boolean][]).map(([label, value, color, bold]) => (
              <div key={label} className="flex justify-between items-center bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-4 anim-fade-up">
                <span className="text-[13px]">{label}</span>
                <span className={`font-mono text-[14px] ${bold ? 'font-semibold' : ''}`} style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
          <button onClick={onReset}
            className="flex items-center justify-center gap-3 h-14 bg-[#1A1A1A] text-white font-mono text-[12px] tracking-[0.15em] font-semibold hover:bg-[#333] transition-all cursor-pointer mt-2">
            COMPRESS NEW DATA <span className="text-lg">→</span>
          </button>
          <button onClick={() => downloadCompressedFile(result, 'json')}
            className="flex items-center justify-center h-12 border border-[#1A1A1A] font-mono text-[11px] tracking-[0.15em] hover:bg-[#1A1A1A] hover:text-white transition-all cursor-pointer">
            DOWNLOAD .CMP.JSON
          </button>
          <button onClick={() => downloadCompressedFile(result, 'txt')}
            className="flex items-center justify-center h-12 border border-[#D8D4CB] font-mono text-[11px] tracking-[0.15em] text-[#666] hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-all cursor-pointer">
            DOWNLOAD RAW .TXT
          </button>
          <p className="text-[12px] leading-[1.6] text-[#888]">
            Stats measure compressed payload only. Use `.cmp.json` when the algorithm needs a codebook or dictionary to decode; `.txt` is just the raw compressed payload.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Error Screen ────────────────────────────────────────────────────────────
function ErrorScreen({ error, onRetry }: { error: AppError; onRetry: () => void }) {
  const isNetwork = error.kind === 'network'
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 px-12 anim-fade-in">
      {/* Icon */}
      <div className={`w-20 h-20 flex items-center justify-center border-2 ${
        isNetwork ? 'border-[#1A1A1A]' : 'border-red-300'
      }`}>
        <span className="text-3xl">{isNetwork ? '⌁' : '!'}</span>
      </div>

      {/* Label + message */}
      <div className="flex flex-col items-center gap-3 text-center" style={{ maxWidth: 480 }}>
        <span className={`font-mono text-[11px] tracking-[0.2em] ${
          isNetwork ? 'text-[#999]' : 'text-red-400'
        }`}>
          {isNetwork ? 'CONNECTION ERROR' : 'SERVER ERROR'}
        </span>
        <h2 className="font-playfair text-[32px] text-[#1A1A1A]">
          {isNetwork ? 'Backend not reachable' : 'Compression failed'}
        </h2>
        <p className="text-[14px] text-[#666] leading-[1.7]">{error.message}</p>
        {error.detail && (
          <div className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-5 py-4 text-left mt-2">
            <span className="font-mono text-[10px] tracking-[0.15em] text-[#999] block mb-2">DETAIL</span>
            <p className="font-mono text-[12px] text-[#666]">{error.detail}</p>
          </div>
        )}
      </div>

      {/* How to fix — only for network errors */}
      {isNetwork && (
        <div className="border border-[#EAEAEA] bg-[#FAFAFA] px-8 py-6 flex flex-col gap-4" style={{ maxWidth: 480, width: '100%' }}>
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#999]">HOW TO START THE BACKEND</span>
          <div className="flex flex-col gap-2">
            {[
              'cd backend',
              'uv run uvicorn main:app --reload',
            ].map((cmd, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-[#BBB] w-4">{i + 1}.</span>
                <code className="font-mono text-[13px] text-[#1A1A1A] bg-white border border-[#E0E0E0] px-3 py-1.5 flex-1">{cmd}</code>
              </div>
            ))}
          </div>
          <p className="font-mono text-[10px] text-[#BBB]">
            API must be running at <span className="text-[#666]">http://localhost:8000</span>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onRetry}
          className="flex items-center justify-center gap-3 h-12 px-8 bg-[#1A1A1A] text-white font-mono text-[11px] tracking-[0.15em] font-semibold hover:bg-[#333] transition-all cursor-pointer">
          ← TRY AGAIN
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('input')
  const [algo, setAlgo]     = useState<Algorithm>('huffman')
  const [result, setResult] = useState<ApiResult | null>(null)
  const [appError, setAppError] = useState<AppError | null>(null)

  const handleCompress = async (text: string, algorithm: Algorithm) => {
    setAppError(null); setAlgo(algorithm); setScreen('compressing')
    try {
      const res = await fetch(`${API_URL}/compress`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text, algorithm }),
      })
      if (!res.ok) {
        let detail: string | undefined
        try { detail = (await res.json()).detail } catch { /* ignore */ }
        throw Object.assign(new Error(`Server responded with ${res.status}`), { kind: 'server' as ErrorKind, detail })
      }
      const data: ApiResult = await res.json()
      await new Promise(r => setTimeout(r, 1800))
      setResult(data); setScreen('results')
    } catch (e: unknown) {
      const isNetwork = e instanceof TypeError && e.message.toLowerCase().includes('fetch')
      const isTagged  = (e as { kind?: string }).kind === 'server'
      setAppError({
        kind:    isNetwork ? 'network' : isTagged ? 'server' : 'unknown',
        message: isNetwork
          ? 'Could not connect to the compression API. Make sure the backend server is running.'
          : e instanceof Error ? e.message : 'An unexpected error occurred.',
        detail: (e as { detail?: string }).detail,
      })
      setScreen('error')
    }
  }

  const goBack = () => { setAppError(null); setScreen('input') }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      <Nav onNavigate={setScreen} />
      <div className="w-full h-px bg-[#EAEAEA] shrink-0" />

      {screen === 'input' && (
        <>
          <Hero selected={algo} onSelect={setAlgo} />
          <div className="w-full h-px bg-[#EAEAEA] shrink-0" />
          <InputScreen onCompress={handleCompress} />
        </>
      )}

      {screen === 'compressing' && (
        <CompressingScreen algo={algo} />
      )}

      {screen === 'results' && result && (
        <ResultsScreen result={result} onReset={() => { setScreen('input'); setResult(null) }} />
      )}

      {screen === 'explanations' && (
        <AlgorithmExplanationsScreen />
      )}

      {screen === 'error' && appError && (
        <ErrorScreen error={appError} onRetry={goBack} />
      )}
    </div>
  )
}
