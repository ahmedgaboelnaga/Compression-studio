import { useState, useRef, useCallback } from 'react'

const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://127.0.0.1:8001' : '/api')

type Algorithm = 'huffman' | 'rle' | 'lzw' | 'shannon-fano' | 'arithmetic' | 'arithmetic-decode'
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
  codes?: Record<string, string> | null;
  details?: AlgorithmDetails | null;
  translation_preview?: string;
  metadata?: { label: string; value: string }[];
}

interface AlgorithmDetails {
  [key: string]: unknown
  pairs?: { symbol: string; count: number }[]
  frequencies?: Record<string, number>
  probabilities?: Record<string, number>
  ranges?: Record<string, [string, string]>
  encoding_steps?: { step: number; symbol: string; low: number; high: number }[]
  decode_steps?: { step: number; value: number; symbol: string; range_low: number; range_high: number; rescaled: number }[]
  encoded_value?: string
  interval_low?: string
  interval_high?: string
  codes?: number[]
  output_strings?: string[]
  dictionary_additions?: { code: number; sequence: string }[]
  validated_round_trip?: boolean
}

const ALGORITHMS = {
  huffman:             { name: 'Huffman Coding',       type: 'Entropy',     complexity: 'O(n log n)', description: 'Variable-length prefix coding. Assigns shorter codes to more frequent symbols. Optimal for known frequency distributions.' },
  rle:                 { name: 'Run-Length Enc.',      type: 'Statistical', complexity: 'O(n)',       description: 'Encodes consecutive identical characters as a count+symbol pair. Excellent for highly repetitive data.' },
  lzw:                 { name: 'LZW',                 type: 'Dictionary',  complexity: 'O(n)',       description: 'Builds a dynamic dictionary of repeated patterns. Foundation of GIF and TIFF compression formats.' },
  'shannon-fano':      { name: 'Shannon-Fano',        type: 'Entropy',     complexity: 'O(n log n)', description: 'Recursive top-down symbol splitting. Predecessor to Huffman, slightly less optimal but historically significant.' },
  arithmetic:          { name: 'Arithmetic Coding',   type: 'Entropy',     complexity: 'O(n)',       description: 'Encodes the entire message as a single fractional number in (0,1). Achieves near-theoretical compression limits.' },
  'arithmetic-decode': { name: 'Arithmetic Decoding', type: 'Entropy',     complexity: 'O(n·m)',    description: 'Step-by-step arithmetic decode: given an encoded value and the symbol probability table, recovers the original message symbol-by-symbol.' },
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

function InputScreen({ onCompress, value, onChange, algo, onAlgoChange }: { 
  onCompress: (text: string, algo: Algorithm) => void;
  value: string;
  onChange: (val: string) => void;
  algo: Algorithm;
  onAlgoChange: (algo: Algorithm) => void;
}) {
  const [tab, setTab] = useState<InputTab>('text')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const meta = ALGORITHMS[algo]
  const isDecodeMode = algo === 'arithmetic-decode'
  const uniqueChars = new Set(value).size
  const entropy = value.length > 0 && !isDecodeMode
    ? (-[...new Set(value)].reduce((s, c) => {
        const p = [...value].filter(x => x === c).length / value.length
        return s + p * Math.log2(p)
        }, 0)).toFixed(2)
    : 'N/A'

  const handleFile = useCallback((file: File) => {
    const isJson = file.name.endsWith('.json') || file.name.endsWith('.cmp.json')
    const isTxt = file.name.endsWith('.txt')
    if (!isTxt && !isJson) return
    const reader = new FileReader()
    reader.onload = e => { onChange(e.target?.result as string ?? ''); setTab('text') }
    reader.readAsText(file)
  }, [onChange])

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
            <textarea value={value} onChange={e => onChange(e.target.value)}
              className="flex-1 resize-none bg-transparent p-6 text-[15px] leading-[1.7] text-[#1A1A1A] outline-none placeholder-[#CCC] font-mono"
              placeholder={isDecodeMode ? "Paste compressed JSON payload here..." : "Type or paste your data here..."} />
            <div className="flex justify-between items-center px-6 py-3 border-t border-[#EAEAEA]">
              <div className="flex gap-4 items-center">
                <span className="font-mono text-[10px] text-[#999]">{value.length} characters</span>
                {isDecodeMode && (
                  <button 
                    onClick={() => onChange(JSON.stringify({
                      value: "0.556640625",
                      ranges: { "H": ["0.0", "0.2"], "E": ["0.2", "0.4"], "L": ["0.4", "0.8"], "O": ["0.8", "1.0"] },
                      length: 5
                    }, null, 2))}
                    className="font-mono text-[9px] text-[#1A1A1A] hover:underline cursor-pointer"
                  >
                    LOAD SAMPLE JSON
                  </button>
                )}
              </div>
              <span className={`font-mono text-[10px] tracking-[0.1em] ${value.length > 0 ? 'text-[#22C55E]' : 'text-[#CCC]'}`}>
                {value.length > 0 ? 'READY' : 'EMPTY'}
              </span>
            </div>
          </div>
        ) : (
          <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
            className={`flex-1 flex flex-col items-center justify-center gap-5 border-2 transition-colors ${dragging ? 'border-[#1A1A1A] bg-[#F5F5F5]' : 'border-[#E0E0E0] bg-[#FAFAFA]'}`}>
            <span className="text-5xl text-[#CCC]">↑</span>
            <p className="font-playfair text-[22px] text-[#1A1A1A]">Drag & drop your .txt or .cmp.json file here</p>
            <p className="text-[13px] text-[#999]">or</p>
            <button onClick={() => fileRef.current?.click()}
              className="px-6 h-10 border border-[#1A1A1A] font-mono text-[11px] tracking-[0.1em] hover:bg-[#1A1A1A] hover:text-white transition-all cursor-pointer">
              BROWSE FILES
            </button>
            <p className="font-mono text-[10px] text-[#BBB]">Supported: .txt, .json, .cmp.json files up to 10 MB</p>
            <input ref={fileRef} type="file" accept=".txt,.json,.cmp.json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        )}
      </div>

      <div className="w-px bg-[#EAEAEA] shrink-0" />

      {/* Right panel */}
      <div className="w-[400px] shrink-0 flex flex-col px-8 py-8 gap-5 overflow-hidden">
        <span className="font-mono text-[11px] tracking-[0.2em] text-[#666]">ALGORITHM SETTINGS</span>

        {/* Algorithm list with inline expansion for selected */}
        <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
          {ALGO_KEYS.map(k => (
            <div key={k}>
              <button onClick={() => onAlgoChange(k)}
                className={`w-full flex items-center justify-between px-4 h-11 border transition-all text-left cursor-pointer ${algo === k
                  ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                  : 'bg-white border-[#E0E0E0] text-[#1A1A1A] hover:border-[#999]'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-[13px]">{ALGORITHMS[k].name}</span>
                  <span className={`font-mono text-[9px] px-1.5 py-0.5 ${algo === k ? 'bg-[#333] text-[#999]' : 'bg-[#F5F5F5] text-[#CCC]'}`}>
                    {ALGORITHMS[k].type}
                  </span>
                </div>
                <span className={`font-mono text-[10px] ${algo === k ? 'text-[#666]' : 'text-[#CCC]'}`}>{ALGORITHMS[k].complexity}</span>
              </button>
              {algo === k && (
                <div className="border border-t-0 border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 flex flex-col gap-2 anim-fade-up">
                  <p className="text-[12px] text-[#555] leading-[1.6]">{ALGORITHMS[k].description}</p>
                  <span className="font-mono text-[9px] text-[#22C55E] tracking-wider">LOSSLESS</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={() => value.trim() && onCompress(value, algo)} disabled={!value.trim()}
          className="flex items-center justify-center gap-3 bg-[#1A1A1A] text-white font-mono text-[11px] tracking-[0.15em] font-semibold hover:bg-[#2A2A2A] disabled:bg-[#CCC] disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 py-4">
          {isDecodeMode ? 'DECOMPRESS DATA' : 'COMPRESS DATA'} <span className="text-base">&#8594;</span>
        </button>

        <div className="flex flex-col gap-2 shrink-0">
          <span className="font-mono text-[10px] tracking-[0.15em] text-[#999]">QUICK PREVIEW</span>
          <div className="grid grid-cols-3 gap-2">
            {[['INPUT SIZE', `${value.length} B`], ['UNIQUE CHARS', String(uniqueChars)], ['ENTROPY', String(entropy)]].map(([l, v]) => (
              <div key={l} className="bg-[#FAFAFA] border border-[#EAEAEA] px-3 py-3 flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-[0.1em] text-[#999]">{l}</span>
                <span className="font-mono text-[16px] font-semibold text-[#1A1A1A]">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center shrink-0">
          <span className="text-[11px] text-[#AAA]">{meta.name} &#183; Ready</span>
          <span className="font-mono text-[10px] text-[#DDD]">v1.0</span>
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
}function parseRlePayload(payload: string) {
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





function getJsonDownloadPayload(result: ApiResult) {
  if (result.algorithm === 'arithmetic') {
    const details = (result.details ?? {}) as AlgorithmDetails
    return JSON.stringify({
      format: 'compression-studio.arithmetic.v1',
      algorithm: result.algorithm,
      value: result.compressed,
      ranges: details.ranges ?? undefined,
      length: (details.original_length as number | undefined) ?? result.original.length,
    }, null, 2)
  }

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

function ResultsScreen({ result, onReset, onTestDecode }: { result: ApiResult; onReset: () => void; onTestDecode?: (payload: string) => void }) {
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
      // Translation preview already shows the step-by-step decoding.
      // Nothing extra needed here — codebook is shown in Zone B below.
      return null
    }

    if (result.algorithm === 'lzw') {
      const codes = result.details?.codes?.length ? result.details.codes : parseLzwPayload(result.compressed)
      const outputStrings: string[] = (result.details?.output_strings as string[] | undefined) ?? []
      const additions = result.details?.dictionary_additions ?? []
      return (
        <div className="flex flex-col">
          {/* Step table: STEP / CODE / TYPE / DECODES TO */}
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#EAEAEA]">
                {['#', 'CODE', 'TYPE', 'DECODES TO'].map(h => (
                  <th key={h} className="font-mono text-[10px] tracking-[0.12em] text-[#999] text-left px-6 py-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.slice(0, 40).map((code, i) => {
                const decoded = outputStrings[i] ?? (code < 256 ? String.fromCharCode(code) : `[${code}]`)
                const isLearned = code >= 256
                return (
                  <tr key={i} className={`border-b border-[#F4F4F4] ${i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'}`}>
                    <td className="font-mono text-[10px] text-[#CCC] px-6 py-3">{i + 1}</td>
                    <td className="font-mono text-[12px] text-[#1A1A1A] px-6 py-3">{code}</td>
                    <td className="px-6 py-3">
                      <span className={`font-mono text-[9px] px-1.5 py-0.5 ${isLearned ? 'bg-[#1A1A1A] text-white' : 'bg-[#F0F0F0] text-[#888]'}`}>
                        {isLearned ? 'DICT' : 'ASCII'}
                      </span>
                    </td>
                    <td className="font-mono text-[12px] text-[#444] px-6 py-3">
                      "{formatSymbol(decoded)}"
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Dictionary additions */}
          {additions.length > 0 && (
            <>
              <div className="flex items-center gap-4 px-6 py-3 border-t border-b border-[#EAEAEA] bg-[#FAFAFA] mt-2">
                <span className="font-mono text-[10px] tracking-[0.2em] text-[#999]">DICTIONARY ADDITIONS</span>
                <span className="text-[#DDD]">·</span>
                <span className="text-[12px] text-[#666]">{additions.length} new phrases learned during encoding</span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#EAEAEA]">
                    {['CODE', 'PHRASE'].map(h => (
                      <th key={h} className="font-mono text-[10px] tracking-[0.12em] text-[#999] text-left px-6 py-3 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {additions.slice(0, 30).map((item, i) => (
                    <tr key={item.code} className={`border-b border-[#F4F4F4] ${i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'}`}>
                      <td className="font-mono text-[12px] text-[#1A1A1A] px-6 py-3">{item.code}</td>
                      <td className="font-mono text-[12px] text-[#555] px-6 py-3">"{formatSymbol(item.sequence)}"</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )
    }

    if (result.algorithm === 'arithmetic' || result.algorithm === 'arithmetic-decode') {
      const ranges = result.details?.ranges ?? {}
      const probabilities = result.details?.probabilities ?? {}
      const encodingSteps = result.details?.encoding_steps ?? []
      const decodeSteps = result.details?.decode_steps ?? []
      const isDecodeMode = result.algorithm === 'arithmetic-decode'

      return (
        <div className="flex flex-col">
          {/* Step 1: Initial Probability Ranges */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-[#EAEAEA] bg-[#FAFAFA]">
            <span className="font-mono text-[10px] tracking-[0.2em] text-[#999]">1. INITIAL PROBABILITY RANGES</span>
            <span className="text-[#DDD]">·</span>
            <span className="text-[12px] text-[#666]">Mapping symbols to [0, 1) intervals</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#EAEAEA]">
                {['SYM', 'PROB', 'RANGE LOW', 'RANGE HIGH'].map(h => (
                  <th key={h} className="font-mono text-[10px] tracking-[0.12em] text-[#999] text-left px-6 py-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(ranges).map(([symbol, range], i) => (
                <tr key={symbol} className={`border-b border-[#F4F4F4] ${i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'}`}>
                  <td className="font-mono text-[12px] text-[#1A1A1A] px-6 py-3">{formatSymbol(symbol)}</td>
                  <td className="font-mono text-[12px] text-[#666] px-6 py-3">{(probabilities[symbol] as number).toFixed(4)}</td>
                  <td className="font-mono text-[11px] text-[#888] px-6 py-3 truncate max-w-[120px]">{range[0]}</td>
                  <td className="font-mono text-[11px] text-[#888] px-6 py-3 truncate max-w-[120px]">{range[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Step 2: Step-by-Step Process (Encoding or Decoding) */}
          <div className="flex items-center gap-4 px-6 py-3 border-t border-b border-[#EAEAEA] bg-[#FAFAFA] mt-4">
            <span className="font-mono text-[10px] tracking-[0.2em] text-[#999]">
              {isDecodeMode ? '2. DECODING PROCESS' : '2. ENCODING PROCESS'}
            </span>
            <span className="text-[#DDD]">·</span>
            <span className="text-[12px] text-[#666]">
              {isDecodeMode ? 'Reconstructing message from value' : 'Iteratively narrowing the interval'}
            </span>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#EAEAEA]">
                {isDecodeMode 
                  ? ['#', 'VALUE', 'SYMBOL', 'NEW VALUE'].map(h => <th key={h} className="font-mono text-[10px] tracking-[0.12em] text-[#999] text-left px-6 py-3 font-normal">{h}</th>)
                  : ['#', 'SYM', 'NEW LOW', 'NEW HIGH'].map(h => <th key={h} className="font-mono text-[10px] tracking-[0.12em] text-[#999] text-left px-6 py-3 font-normal">{h}</th>)
                }
              </tr>
            </thead>
            <tbody>
              {isDecodeMode 
                ? decodeSteps.slice(0, 20).map((step, i) => (
                    <tr key={i} className={`border-b border-[#F4F4F4] ${i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'}`}>
                      <td className="font-mono text-[10px] text-[#CCC] px-6 py-3">{step.step}</td>
                      <td className="font-mono text-[11px] text-[#444] px-6 py-3 truncate max-w-[150px]">{step.value.toFixed(10)}...</td>
                      <td className="font-mono text-[12px] text-[#1A1A1A] font-bold px-6 py-3">"{formatSymbol(step.symbol)}"</td>
                      <td className="font-mono text-[11px] text-[#888] px-6 py-3 truncate max-w-[150px]">{step.rescaled.toFixed(10)}...</td>
                    </tr>
                  ))
                : encodingSteps.slice(0, 20).map((step, i) => (
                    <tr key={i} className={`border-b border-[#F4F4F4] ${i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'}`}>
                      <td className="font-mono text-[10px] text-[#CCC] px-6 py-3">{step.step}</td>
                      <td className="font-mono text-[12px] text-[#1A1A1A] font-bold px-6 py-3">"{formatSymbol(step.symbol)}"</td>
                      <td className="font-mono text-[11px] text-[#444] px-6 py-3 truncate max-w-[150px]">{step.low.toFixed(10)}...</td>
                      <td className="font-mono text-[11px] text-[#444] px-6 py-3 truncate max-w-[150px]">{step.high.toFixed(10)}...</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>

          {/* Final Value */}
          <div className="p-6 bg-white border-t border-[#EAEAEA] mt-auto">
            <span className="font-mono text-[10px] tracking-[0.12em] text-[#888] block mb-2">
              {isDecodeMode ? 'DECODED MESSAGE' : 'FINAL ENCODED VALUE'}
            </span>
            <div className="p-4 bg-[#FAFAFA] border border-[#EAEAEA] font-mono text-[14px] text-[#1A1A1A] break-all leading-relaxed">
              {isDecodeMode
                ? String(result.details?.decoded_message ?? '')
                : String(result.details?.encoded_value ?? '')}
            </div>
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
      {/* Results header — compact dark strip */}
      <div className="relative overflow-hidden bg-[#1A1A1A] shrink-0 anim-fade-in" style={{ height: 80 }}>
        <span className="font-playfair font-bold absolute select-none pointer-events-none opacity-[0.12]"
          style={{ fontSize: 140, lineHeight: 1, color: '#fff', bottom: -16, left: -4, letterSpacing: -4 }}>
          {didCompress ? Math.max(0, reductionPct) : Math.abs(reductionPct)}%
        </span>
        <div className="relative z-10 h-full flex items-center px-10 gap-8">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] tracking-[0.2em] text-[#555]">COMPRESSION RATIO</span>
            <span className="font-playfair text-[22px] font-bold text-white leading-tight anim-fade-up">
              {didCompress ? `${Math.max(0, reductionPct)}% reduction` : `${Math.abs(reductionPct)}% larger`}
            </span>
          </div>
          <div className="w-px h-8 bg-[#333] shrink-0" />
          <span className="text-[13px] text-[#666]">
            {ALGORITHMS[result.algorithm as Algorithm]?.name ?? result.algorithm}
          </span>
          <div className="w-px h-8 bg-[#333] shrink-0" />
          <span className="font-mono text-[12px] text-[#555]">{formatBytes(originalBits)}</span>
          <span className="text-[#444] text-[11px]">→</span>
          <span className={`font-mono text-[12px] font-semibold ${didCompress ? 'text-[#4CAF76]' : 'text-[#C97B2A]'}`}>{formatBytes(compressedBits)}</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left — compact 2-zone layout */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Zone A: top row — bars + translation side by side */}
          <div className="flex gap-0 shrink-0 border-b border-[#EAEAEA]" style={{ height: 190 }}>

            {/* A1: Size comparison bars */}
            <div className="flex flex-col justify-center px-10 py-6 gap-4 border-r border-[#EAEAEA]" style={{ width: 280 }}>
              <span className="font-mono text-[10px] tracking-[0.2em] text-[#999]">SIZE COMPARISON</span>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-[#999] tracking-wider">ORIGINAL</span>
                    <span className="font-mono text-[11px] text-[#444]">{formatBytes(originalBits)}</span>
                  </div>
                  <div className="h-5 bg-[#1A1A1A] w-full" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-[#999] tracking-wider">COMPRESSED</span>
                    <span className={`font-mono text-[11px] font-semibold ${didCompress ? 'text-[#2F8F55]' : 'text-[#B45309]'}`}>{formatBytes(compressedBits)}</span>
                  </div>
                  <div className="h-5 bg-[#F0F0F0] overflow-hidden">
                    <div className={`h-full anim-bar ${didCompress ? 'bg-[#2F8F55]' : 'bg-[#B45309]'}`} style={{ '--bar-width': `${barPct}%` } as React.CSSProperties} />
                  </div>
                </div>
              </div>
            </div>

            {/* A2: Translation preview — inline, clipped */}
            <div className="flex-1 flex flex-col px-8 py-6 gap-2 overflow-hidden bg-[#FAFAFA]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.2em] text-[#999]">TRANSLATION PREVIEW</span>
                {result.metadata && result.metadata.length > 0 && (
                  <div className="flex gap-1.5">
                    {result.metadata.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-[#E8E8E8]">
                        <span className="font-mono text-[8px] text-[#AAA] tracking-wider">{m.label.toUpperCase()}</span>
                        <span className="font-mono text-[9px] text-[#444] font-semibold">{m.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-hidden relative">
                <div className="font-mono text-[11px] leading-[1.75] text-[#444] whitespace-pre-wrap break-all h-full overflow-hidden">
                  {result.translation_preview || "Generating translation mechanics..."}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#FAFAFA] to-transparent pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Zone B: Encoding table (left) or algorithm-specific output */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between px-10 py-3 border-b border-[#EAEAEA] bg-[#FAFAFA] shrink-0">
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] tracking-[0.2em] text-[#999]">
                  {tableRows.length > 0 ? 'ENCODING TABLE' : 'COMPRESSED OUTPUT'}
                </span>
                {tableRows.length > 0 && (
                  <>
                    <span className="text-[#DDD]">·</span>
                    <span className="text-[12px] text-[#666]">{tableRows.length} symbols · sorted by frequency</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {tableRows.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#FAFAFA] border-b border-[#EAEAEA]">
                      {['#', 'SYMBOL', 'FREQUENCY', 'CODE', 'BITS'].map(h => (
                        <th key={h} className="font-mono text-[10px] tracking-[0.12em] text-[#999] text-left px-6 py-3 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, i) => (
                      <tr key={i} className={`border-b border-[#F4F4F4] anim-fade-up ${i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'}`}
                        style={{ animationDelay: `${i * 0.04}s` }}>
                        <td className="font-mono text-[10px] text-[#CCC] px-6 py-3">{i + 1}</td>
                        <td className="font-mono text-[12px] text-[#1A1A1A] px-6 py-3">{row.char}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[12px] text-[#444]">{row.freq}</span>
                            <div className="h-[3px] bg-[#EAEAEA] flex-1 max-w-[80px] overflow-hidden">
                              <div className="h-full bg-[#1A1A1A] anim-bar"
                                style={{ '--bar-width': `${Math.round((row.freq / (tableRows[0]?.freq || 1)) * 100)}%` } as React.CSSProperties} />
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-[11px] text-[#555] px-6 py-3 tracking-wide">{row.code}</td>
                        <td className="font-mono text-[11px] text-[#999] px-6 py-3">{row.bits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-10 py-5">
                  {renderReadableOutput()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-px bg-[#EAEAEA] shrink-0" />

        {/* Right sidebar — preserved exactly */}
        <div className="w-[380px] shrink-0 flex flex-col px-8 py-8 gap-5 overflow-y-auto">
          <span className="font-mono text-[11px] tracking-[0.2em] text-[#666]">DETAILED METRICS</span>
          <div className="flex flex-col gap-2">
            {([
              [didCompress ? 'Reduction' : 'Expansion', `${didCompress ? Math.max(0, reductionPct) : Math.abs(reductionPct)}%`, didCompress ? '#2F8F55' : '#B45309', true ],
              ['Compression Factor', `${compressionFactor}x`,            didCompress ? '#2F8F55' : '#B45309', true ],
              ['Compressed / Original', `${compressedPct}%`,             didCompress ? '#2F8F55' : '#B45309', true ],
              ['Space Saved',       `${didCompress ? '' : '-'}${formatBytes(Math.abs(savedBits))}`, '#1A1A1A', true ],
              ['Original Size',     formatBytes(originalBits),           '#1A1A1A', false],
              ['Payload Size',      formatBytes(compressedBits),         '#1A1A1A', false],
            ] as [string, string, string, boolean][]).map(([label, value, color, bold]) => (
              <div key={label} className="flex justify-between items-center bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 anim-fade-up">
                <span className="text-[12px] text-[#444]">{label}</span>
                <span className={`font-mono text-[13px] ${bold ? 'font-semibold' : ''}`} style={{ color }}>{value}</span>
              </div>
            ))}
          </div>



          <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-[#EAEAEA]">
            {result.algorithm === 'arithmetic' && onTestDecode && (
              <button 
                onClick={() => {
                  const details = result.details as any
                  const payload = JSON.stringify({
                    value: result.compressed,
                    ranges: details.ranges,
                    length: details.original_length || result.original.length
                  }, null, 2)
                  onTestDecode(payload)
                }}
                className="flex items-center justify-center gap-3 h-13 bg-[#2F8F55] text-white font-mono text-[11px] tracking-[0.15em] font-semibold hover:bg-[#267344] transition-all cursor-pointer py-3.5 mb-2 shadow-lg shadow-emerald-900/10"
              >
                TEST DECODING <span className="text-base">⌁</span>
              </button>
            )}
            <button onClick={onReset}
              className="flex items-center justify-center gap-3 h-13 bg-[#1A1A1A] text-white font-mono text-[11px] tracking-[0.15em] font-semibold hover:bg-[#2A2A2A] transition-all cursor-pointer py-3.5">
              COMPRESS NEW DATA <span className="text-base">→</span>
            </button>
            <div className="flex gap-2">
              <button onClick={() => downloadCompressedFile(result, 'json')}
                className="flex-1 flex items-center justify-center h-10 border border-[#1A1A1A] font-mono text-[10px] tracking-[0.1em] hover:bg-[#1A1A1A] hover:text-white transition-all cursor-pointer">
                .CMP.JSON
              </button>
              <button onClick={() => downloadCompressedFile(result, 'txt')}
                className="flex-1 flex items-center justify-center h-10 border border-[#D8D4CB] font-mono text-[10px] tracking-[0.1em] text-[#666] hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-all cursor-pointer">
                RAW .TXT
              </button>
            </div>
            <p className="text-[11px] leading-[1.55] text-[#AAA]">
              Use .cmp.json when the algorithm needs a codebook to decode. .txt is the raw payload only.
            </p>
          </div>
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
              'uv run uvicorn main:app --reload --port 8001',
            ].map((cmd, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-[#BBB] w-4">{i + 1}.</span>
                <code className="font-mono text-[13px] text-[#1A1A1A] bg-white border border-[#E0E0E0] px-3 py-1.5 flex-1">{cmd}</code>
              </div>
            ))}
          </div>
          <p className="font-mono text-[10px] text-[#BBB]">
            API must be running at <span className="text-[#666]">http://127.0.0.1:8001</span>
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
  const [input, setInput]   = useState("The quick brown fox jumps over the lazy dog. Repeated patterns like aaabbbccc help demonstrate how RLE achieves compression by encoding runs of identical characters efficiently.")
  const [result, setResult] = useState<ApiResult | null>(null)
  const [appError, setAppError] = useState<AppError | null>(null)

  const handleCompress = async (text: string, algorithm: Algorithm) => {
    const isDecode = algorithm === 'arithmetic-decode'
    const endpoint = isDecode
      ? `${API_URL}/decompress/${algorithm}`
      : `${API_URL}/compress/${algorithm}`
    console.log(`[STUDIO] Connecting to ${endpoint}`)
    setAppError(null); setAlgo(algorithm); setScreen('compressing')
    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
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
          <InputScreen 
            value={input}
            onChange={setInput}
            algo={algo}
            onAlgoChange={setAlgo}
            onCompress={handleCompress} 
          />
        </>
      )}

      {screen === 'compressing' && (
        <CompressingScreen algo={algo} />
      )}

      {screen === 'results' && result && (
        <ResultsScreen 
          result={result} 
          onReset={() => { setScreen('input'); setResult(null) }} 
          onTestDecode={(payload) => {
            setAlgo('arithmetic-decode')
            setInput(payload)
            setScreen('input')
            setResult(null)
          }}
        />
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
