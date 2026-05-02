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

class CompressRequest(BaseModel):
    text: str
    algorithm: str

@app.post("/compress")
def compress_data(request: CompressRequest):
    algo = request.algorithm.lower()
    text = request.text
    
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
        
    try:
        if algo == "rle":
            result = algorithms.compress_rle(text)
        elif algo == "shannon-fano":
            result = algorithms.compress_shannon_fano(text)
        elif algo == "huffman":
            result = algorithms.compress_huffman(text)
        elif algo == "arithmetic":
            result = algorithms.compress_arithmetic(text)
        elif algo == "lzw":
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
    }
