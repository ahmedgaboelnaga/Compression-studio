from enum import Enum
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import algorithms

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AlgorithmName(str, Enum):
    rle = "rle"
    shannon_fano = "shannon-fano"
    huffman = "huffman"
    arithmetic = "arithmetic"
    arithmetic_decode = "arithmetic-decode"
    lzw = "lzw"

class CompressRequest(BaseModel):
    text: str
    algorithm: AlgorithmName

class TextRequest(BaseModel):
    text: str


def _run_algorithm(algo: AlgorithmName, text: str) -> dict:
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        if algo == AlgorithmName.rle:
            result = algorithms.compress_rle(text)
        elif algo == AlgorithmName.shannon_fano:
            result = algorithms.compress_shannon_fano(text)
        elif algo == AlgorithmName.huffman:
            result = algorithms.compress_huffman(text)
        elif algo == AlgorithmName.arithmetic:
            result = algorithms.compress_arithmetic(text)
        elif algo == AlgorithmName.arithmetic_decode:
            result = algorithms.compress_arithmetic_decode(text)
        elif algo == AlgorithmName.lzw:
            result = algorithms.compress_lzw(text)
        else:
            raise HTTPException(status_code=400, detail="Unknown algorithm")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "original": text,
        "original_size": len(text.encode("utf-8")) * 8,
        "algorithm": algo,
        "compressed": result["compressed"],
        "ratio": result["ratio"],
        "compressed_size": result.get("compressed_size_bits"),
        "stats": {
            "original_bits": len(text.encode("utf-8")) * 8,
            "compressed_payload_bits": result.get("compressed_size_bits"),
            "ratio_basis": "compressed payload only; codebooks and JSON download metadata are not counted",
        },
        "codes": result.get("codes"),
        "details": result.get("details"),
        "translation_preview": result.get("translation_preview"),
        "metadata": result.get("metadata"),
    }


@app.post("/compress/{algorithm}")
def compress_by_algorithm(algorithm: AlgorithmName, request: TextRequest):
    if algorithm == AlgorithmName.arithmetic_decode:
        raise HTTPException(
            status_code=400,
            detail="Use /decompress/arithmetic-decode for arithmetic decode payloads.",
        )
    return _run_algorithm(algorithm, request.text)


@app.post("/decompress/{algorithm}")
def decompress_by_algorithm(algorithm: AlgorithmName, request: TextRequest):
    if algorithm != AlgorithmName.arithmetic_decode:
        raise HTTPException(
            status_code=400,
            detail=f"Decompress endpoint is currently supported only for '{AlgorithmName.arithmetic_decode.value}'.",
        )
    return _run_algorithm(algorithm, request.text)


@app.post("/compress")
def compress_data(request: CompressRequest):
    """
    Backward-compatible route for existing clients.
    Prefer /compress/{algorithm} and /decompress/{algorithm} for new integrations.
    """
    return _run_algorithm(request.algorithm, request.text)
