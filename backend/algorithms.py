import heapq
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
    }


# 4. Arithmetic Coding
def compress_arithmetic(data: str) -> dict:
    if not data:
        return {"compressed": "", "ratio": 0, "compressed_size_bits": 0}

    getcontext().prec = max(60, len(data) * 6)
    freqs = Counter(data)
    total = Decimal(len(data))

    ranges = {}
    low = Decimal("0")
    for symbol, count in freqs.items():
        probability = Decimal(count) / total
        high = low + probability
        ranges[symbol] = (low, high)
        low = high

    current_low = Decimal("0")
    current_high = Decimal("1")

    for symbol in data:
        symbol_low, symbol_high = ranges[symbol]
        current_range = current_high - current_low
        current_high = current_low + current_range * symbol_high
        current_low = current_low + current_range * symbol_low

    final_range = current_high - current_low
    encoded_value = (current_low + current_high) / Decimal("2")
    log2_range = final_range.log10() / Decimal(2).log10()
    compressed_bits = int((-log2_range).to_integral_value(rounding=ROUND_CEILING)) + 1
    original_bits = _original_bits(data)

    return {
        "compressed": f"value={encoded_value}\ninterval=[{current_low}, {current_high})",
        "ratio": _ratio(compressed_bits, original_bits),
        "compressed_size_bits": compressed_bits,
        "details": {
            "encoded_value": str(encoded_value),
            "interval_low": str(current_low),
            "interval_high": str(current_high),
            "ranges": {symbol: [str(start), str(end)] for symbol, (start, end) in ranges.items()},
            "frequencies": dict(freqs),
        },
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
    additions = []

    for char in data:
        candidate = current + char
        if candidate in dictionary:
            current = candidate
        else:
            output.append(dictionary[current])
            dictionary[candidate] = next_code
            additions.append({"code": next_code, "sequence": candidate})
            next_code += 1
            current = char

    if current:
        output.append(dictionary[current])

    decoded = lzw_decompress(output)
    if decoded != data:
        raise ValueError("LZW validation failed.")

    compressed = " ".join(map(str, output))
    original_bits = _original_bits(data)
    compressed_bits = len(output) * 16

    return {
        "compressed": compressed,
        "ratio": _ratio(compressed_bits, original_bits),
        "compressed_size_bits": compressed_bits,
        "details": {
            "codes": output,
            "dictionary_additions": additions,
            "validated_round_trip": True,
        },
    }
