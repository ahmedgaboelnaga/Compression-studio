import heapq
import json
from collections import Counter
from decimal import Decimal, ROUND_CEILING, getcontext


def _original_bits(data: str) -> int:
    return len(data.encode("utf-8")) * 8


def _ratio(compressed_bits: int | float, original_bits: int) -> float:
    return float(compressed_bits / original_bits) if original_bits > 0 else 0


# 1. RLE
def compress_rle(data: str) -> dict:
    if not data:
        return {"compressed": "", "ratio": 0, "compressed_size_bits": 0}

    pairs = []
    count = 1
    for i in range(1, len(data)):
        if data[i] == data[i - 1]:
            count += 1
        else:
            pairs.append({"symbol": data[i - 1], "count": count})
            count = 1
    pairs.append({"symbol": data[-1], "count": count})

    compressed = "".join(f"{pair['symbol']}{pair['count']}" for pair in pairs)
    original_bits = _original_bits(data)
    compressed_bits = len(compressed.encode("utf-8")) * 8

    return {
        "compressed": compressed,
        "ratio": _ratio(compressed_bits, original_bits),
        "compressed_size_bits": compressed_bits,
        "details": {"pairs": pairs},
        "translation_preview": "   ".join(f"{p['symbol']} → {p['count']}" for p in pairs[:15]) + ("..." if len(pairs) > 15 else ""),
        "metadata": [
            {"label": "Steps", "value": f"{len(pairs)} pairs"},
            {"label": "Symbols", "value": f"{len(set(p['symbol'] for p in pairs))} unique"},
            {"label": "Mode", "value": "Sequential"}
        ]
    }


# 2. Shannon-Fano
def shannon_fano_exact(symbols):
    symbols = sorted(symbols, key=lambda x: x[1], reverse=True)
    codes = {symbol[0]: "" for symbol in symbols}

    def split(symbol_list):
        if len(symbol_list) <= 1:
            return

        total = sum(symbol[1] for symbol in symbol_list)
        split_idx = 1
        min_diff = float("inf")

        for i in range(1, len(symbol_list)):
            acc = sum(symbol[1] for symbol in symbol_list[:i])
            diff = abs(acc - (total - acc))
            if diff <= min_diff:
                min_diff = diff
                split_idx = i
            else:
                break

        for symbol in symbol_list[:split_idx]:
            codes[symbol[0]] += "0"
        for symbol in symbol_list[split_idx:]:
            codes[symbol[0]] += "1"

        split(symbol_list[:split_idx])
        split(symbol_list[split_idx:])

    split(symbols)

    if len(symbols) == 1:
        codes[symbols[0][0]] = "0"

    return codes


def compress_shannon_fano(data: str) -> dict:
    if not data:
        return {"compressed": "", "ratio": 0, "compressed_size_bits": 0}

    freqs = Counter(data)
    total = sum(freqs.values())
    probabilities = [(char, count / total) for char, count in freqs.items()]

    codes = shannon_fano_exact(probabilities)
    compressed = "".join(codes[char] for char in data)
    original_bits = _original_bits(data)
    compressed_bits = len(compressed)

    return {
        "compressed": compressed,
        "ratio": _ratio(compressed_bits, original_bits),
        "compressed_size_bits": compressed_bits,
        "codes": codes,
        "details": {
            "frequencies": dict(freqs),
            "probabilities": {char: probability for char, probability in probabilities},
        },
        "translation_preview": "   ".join(f"{char} → {codes[char]}" for char in data[:12]) + ("..." if len(data) > 12 else ""),
        "metadata": [
            {"label": "Steps", "value": f"{len(compressed)} bits"},
            {"label": "Symbols", "value": f"{len(codes)} symbols"},
            {"label": "Method", "value": "Top-down Split"}
        ]
    }


# 3. Huffman
def compress_huffman(data: str) -> dict:
    if not data:
        return {"compressed": "", "ratio": 0, "compressed_size_bits": 0}

    freqs = Counter(data)
    heap = [[freq, index, char, None, None] for index, (char, freq) in enumerate(freqs.items())]
    heapq.heapify(heap)

    counter = len(freqs)
    if len(heap) == 1:
        codes = {heap[0][2]: "0"}
    else:
        while len(heap) > 1:
            low = heapq.heappop(heap)
            high = heapq.heappop(heap)
            heapq.heappush(heap, [low[0] + high[0], counter, None, low, high])
            counter += 1

        def get_codes(node, prefix=""):
            if node[2] is not None:
                return {node[2]: prefix}

            result = {}
            result.update(get_codes(node[3], prefix + "0"))
            result.update(get_codes(node[4], prefix + "1"))
            return result

        codes = get_codes(heap[0])

    compressed = "".join(codes[char] for char in data)
    original_bits = _original_bits(data)
    compressed_bits = len(compressed)

    return {
        "compressed": compressed,
        "ratio": _ratio(compressed_bits, original_bits),
        "compressed_size_bits": compressed_bits,
        "codes": codes,
        "details": {"frequencies": dict(freqs)},
        "translation_preview": "   ".join(f"{char} → {codes[char]}" for char in data[:12]) + ("..." if len(data) > 12 else ""),
        "metadata": [
            {"label": "Steps", "value": f"{len(compressed)} bits"},
            {"label": "Symbols", "value": f"{len(codes)} symbols"},
            {"label": "Method", "value": "Bottom-up Tree"}
        ]
    }


# 4. Arithmetic Coding
def compress_arithmetic(data: str) -> dict:
    if not data:
        return {"compressed": "", "ratio": 0, "compressed_size_bits": 0}

    getcontext().prec = max(60, len(data) * 6)
    freqs = Counter(data)
    total = Decimal(len(data))

    # Sort symbols alphabetically for deterministic range assignment
    sorted_symbols = sorted(freqs.keys())
    ranges = {}
    low = Decimal("0")
    for symbol in sorted_symbols:
        count = freqs[symbol]
        probability = Decimal(count) / total
        high = low + probability
        ranges[symbol] = (low, high)
        low = high

    current_low = Decimal("0")
    current_high = Decimal("1")

    # Encode: narrow the interval for each symbol and record each step
    encoding_steps = []
    for symbol in data:
        symbol_low, symbol_high = ranges[symbol]
        current_range = current_high - current_low
        new_high = current_low + current_range * symbol_high
        new_low = current_low + current_range * symbol_low
        encoding_steps.append({
            "symbol": symbol,
            "low": float(new_low),
            "high": float(new_high),
        })
        current_high = new_high
        current_low = new_low

    final_range = current_high - current_low
    encoded_value = (current_low + current_high) / Decimal("2")
    log2_range = final_range.log10() / Decimal(2).log10()
    compressed_bits = int((-log2_range).to_integral_value(rounding=ROUND_CEILING)) + 1
    original_bits = _original_bits(data)

    # Round-trip validation: decode back and verify
    decoded = _arithmetic_decode(
        encoded_value,
        ranges,
        len(data),
    )
    validated = decoded == data

    # Translation preview: first few encoding steps showing interval narrowing
    preview_steps = encoding_steps[:8]
    preview = "   ".join(
        f"{s['symbol']} → [{s['low']:.6f}, {s['high']:.6f})"
        for s in preview_steps
    )
    if len(data) > 8:
        preview += "   ..."

    return {
        "compressed": f"{encoded_value}",
        "ratio": _ratio(compressed_bits, original_bits),
        "compressed_size_bits": compressed_bits,
        "details": {
            "encoded_value": str(encoded_value),
            "interval_low": str(current_low),
            "interval_high": str(current_high),
            "ranges": {symbol: [str(start), str(end)] for symbol, (start, end) in ranges.items()},
            "frequencies": dict(freqs),
            "probabilities": {
                symbol: float(Decimal(freqs[symbol]) / total)
                for symbol in sorted_symbols
            },
            "encoding_steps": [
                {"step": i + 1, "symbol": s["symbol"], "low": s["low"], "high": s["high"]}
                for i, s in enumerate(encoding_steps)
            ],
            "original_length": len(data),
            "validated_round_trip": validated,
        },
        "translation_preview": preview,
        "metadata": [
            {"label": "Precision", "value": f"{compressed_bits} bits"},
            {"label": "Symbols", "value": f"{len(freqs)} unique"},
            {"label": "Valid", "value": "Yes" if validated else "FAIL"},
        ],
    }


def _arithmetic_decode(
    encoded_value: Decimal,
    ranges: dict[str, tuple[Decimal, Decimal]],
    length: int,
) -> str:
    """Decode an arithmetic-coded value back to the original string."""
    result = []
    value = encoded_value

    for _ in range(length):
        for symbol, (sym_low, sym_high) in ranges.items():
            if sym_low <= value < sym_high:
                result.append(symbol)
                # Reverse the narrowing: rescale value back into [0, 1)
                symbol_range = sym_high - sym_low
                value = (value - sym_low) / symbol_range
                break
    return "".join(result)


# 4b. Arithmetic Decoding (Standalone Decoder)
def compress_arithmetic_decode(input_data: str) -> dict:
    """
    Arithmetic decoding from a compressed JSON payload.
    Expected payload contains:
      - encoded value (value/encoded_value/payload)
      - ranges map
      - original length
    """
    if not input_data:
        return {"compressed": "", "ratio": 0, "compressed_size_bits": 0}

    # Try to parse input as a compressed payload (JSON)
    try:
        payload = json.loads(input_data)
        if not isinstance(payload, dict):
            raise ValueError("Arithmetic decode expects a JSON object payload.")

        details = payload.get("details") if isinstance(payload.get("details"), dict) else {}

        val_raw = (
            payload.get("value") or
            payload.get("encoded_value") or
            payload.get("payload") or
            details.get("value") or
            details.get("encoded_value")
        )

        ranges_raw = payload.get("ranges") or details.get("ranges")

        len_raw = (
            payload.get("length") or
            payload.get("original_length") or
            details.get("length") or
            details.get("original_length")
        )
        if val_raw is None or ranges_raw is None or len_raw is None:
            raise ValueError(
                "Invalid arithmetic payload. Required fields: encoded value, ranges, and original length."
            )

        length = int(len_raw)
        if length < 0:
            raise ValueError("Invalid arithmetic payload. Length must be non-negative.")

        if not isinstance(ranges_raw, dict) or len(ranges_raw) == 0:
            raise ValueError("Invalid arithmetic payload. Ranges must be a non-empty object.")

        # Set high precision for Decimal conversion
        getcontext().prec = max(100, max(1, length) * 10)
        encoded_value = Decimal(str(val_raw))
        ranges = {
            s: (Decimal(str(r[0])), Decimal(str(r[1])))
            for s, r in ranges_raw.items()
        }
    except (json.JSONDecodeError, KeyError, ValueError, TypeError, IndexError) as exc:
        raise ValueError(
            "Arithmetic decode expects a .cmp.json payload generated from Arithmetic Coding (not raw .txt)."
        ) from exc

    decode_steps = []
    val = encoded_value
    decoded_chars = []
    for step_i in range(length):
        found = False
        for symbol, (sym_low, sym_high) in ranges.items():
            if sym_low <= val < sym_high:
                decoded_chars.append(symbol)
                rescaled = (val - sym_low) / (sym_high - sym_low)
                decode_steps.append({
                    "step": step_i + 1,
                    "value": float(val),
                    "symbol": symbol,
                    "range_low": float(sym_low),
                    "range_high": float(sym_high),
                    "rescaled": float(rescaled),
                })
                val = rescaled
                found = True
                break
        if not found:
            raise ValueError(
                "Arithmetic decode failed: encoded value is outside the provided symbol ranges."
            )

    decoded = "".join(decoded_chars)

    return {
        "compressed": str(encoded_value),
        "ratio": 1.0,
        "details": {
            "encoded_value": str(encoded_value),
            "ranges": {s: [str(r[0]), str(r[1])] for s, r in ranges.items()},
            "decode_steps": decode_steps,
            "decoded_message": decoded,
            "is_real_decode": True,
        },
        "translation_preview": f"Reconstructed: \"{decoded}\"",
        "metadata": [
            {"label": "Mode", "value": "Real Decode"},
            {"label": "Output Len", "value": f"{len(decoded)} chars"},
            {"label": "Precision", "value": "High (Decimal)"},
        ],
    }



# 5. LZW
def lzw_decompress(compressed):
    if not compressed:
        return ""

    dictionary = {i: chr(i) for i in range(256)}
    next_code = 256
    previous = chr(compressed[0])
    result = previous

    for code in compressed[1:]:
        if code in dictionary:
            entry = dictionary[code]
        elif code == next_code:
            entry = previous + previous[0]
        else:
            raise ValueError(f"Bad LZW code: {code}")

        result += entry
        dictionary[next_code] = previous + entry[0]
        next_code += 1
        previous = entry

    return result


def compress_lzw(data: str) -> dict:
    if not data:
        return {"compressed": "", "ratio": 0, "compressed_size_bits": 0}

    if any(ord(char) > 255 for char in data):
        raise ValueError("LZW demo supports characters in the 0-255 range only.")

    dictionary = {chr(i): i for i in range(256)}
    next_code = 256
    current = ""
    output = []
    output_strings = []   # what each emitted code actually decodes to
    additions = []

    for char in data:
        candidate = current + char
        if candidate in dictionary:
            current = candidate
        else:
            code = dictionary[current]
            output.append(code)
            output_strings.append(current)   # current is exactly what code decodes to
            dictionary[candidate] = next_code
            additions.append({"code": next_code, "sequence": candidate})
            next_code += 1
            current = char

    if current:
        output.append(dictionary[current])
        output_strings.append(current)

    decoded = lzw_decompress(output)
    if decoded != data:
        raise ValueError("LZW validation failed.")

    compressed = " ".join(map(str, output))
    original_bits = _original_bits(data)
    compressed_bits = len(output) * 16

    # Correct translation preview: code → decoded string for first 8 steps
    preview_parts = [
        f"{output[i]} \u2192 \"{output_strings[i]}\""
        for i in range(min(len(output), 8))
    ]
    preview = "   ".join(preview_parts)
    if len(output) > 8:
        preview += "   ..."

    return {
        "compressed": compressed,
        "ratio": _ratio(compressed_bits, original_bits),
        "compressed_size_bits": compressed_bits,
        "details": {
            "codes": output,
            "output_strings": output_strings,
            "dictionary_additions": additions,
            "validated_round_trip": True,
        },
        "translation_preview": preview,
        "metadata": [
            {"label": "Steps", "value": f"{len(output)} codes"},
            {"label": "Dict Size", "value": f"{next_code} entries"},
            {"label": "New", "value": f"{len(additions)} additions"},
        ],
    }
