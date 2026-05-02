

export function AlgorithmExplanationsScreen() {
  return (
    <div className="explanations-screen flex-1 flex overflow-hidden bg-white">
      {/* Left Sidebar */}
      <div className="explanations-sidebar w-[320px] flex flex-col px-12 py-12 gap-8 bg-[#FAFAFA] border-r border-[#EAEAEA] shrink-0 overflow-y-auto">
        <span className="font-mono text-[14px] font-bold tracking-[0.2em] text-[#1A1A1A]">COMPRESSION</span>
        <div className="flex flex-col gap-4 mt-4">
          <a href="#intro" className="text-[13px] font-medium text-[#1A1A1A] hover:text-black">Introduction</a>
          <a href="#rle" className="text-[13px] text-[#666] hover:text-[#1A1A1A]">1. Run-Length Encoding</a>
          <a href="#shannon" className="text-[13px] text-[#666] hover:text-[#1A1A1A]">2. Shannon-Fano</a>
          <a href="#huffman" className="text-[13px] text-[#666] hover:text-[#1A1A1A]">3. Huffman Coding</a>
          <a href="#arithmetic" className="text-[13px] text-[#666] hover:text-[#1A1A1A]">4. Arithmetic Coding</a>
          <a href="#lzw" className="text-[13px] text-[#666] hover:text-[#1A1A1A]">5. LZW Compression</a>
        </div>
      </div>

      {/* Main Content */}
      <div className="explanations-content flex-1 flex flex-col items-center px-16 py-20 overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
        <div className="explanations-inner flex flex-col gap-24 w-full" style={{ maxWidth: 680 }}>
          
          {/* Intro */}
          <section id="intro" className="flex flex-col gap-6">
            <h1 className="font-playfair text-[36px] font-bold text-[#1A1A1A] leading-tight">Introduction to Lossless Compression</h1>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              Lossless compression algorithms reduce file size without losing any information. This project demonstrates five fundamental techniques, each with distinct mathematical approaches to identifying and reducing redundancy.
            </p>
          </section>

          {/* RLE */}
          <section id="rle" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[12px] font-bold tracking-[0.1em] text-[#999]">01</span>
              <h2 className="font-playfair text-[28px] font-semibold text-[#1A1A1A]">Run-Length Encoding (RLE)</h2>
            </div>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              RLE is a highly intuitive algorithm that replaces sequences of identical characters with a single character followed by its count. It is incredibly efficient for data with long repeating sequences (like solid color graphics).
            </p>
            <div className="flex flex-col gap-6 p-8 bg-[#F5F5F5] rounded-lg">
              <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#666]">VISUALIZATION: SEQUENCE COLLAPSE</span>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => <div key={i} className="w-6 h-6 bg-[#6366F1] rounded-sm" />)}
                <span className="mx-2"></span>
                {[1,2,3].map(i => <div key={i} className="w-6 h-6 bg-[#A5B4FC] rounded-sm" />)}
                <span className="mx-2"></span>
                <div className="w-6 h-6 bg-[#1A1A1A] rounded-sm" />
              </div>
              <span className="text-[11px] italic text-[#888]">↓ is compressed to ↓</span>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#6366F1] rounded-sm" />
                  <span className="font-mono text-[14px] font-semibold text-[#1A1A1A]">× 5</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#A5B4FC] rounded-sm" />
                  <span className="font-mono text-[14px] font-semibold text-[#1A1A1A]">× 3</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#1A1A1A] rounded-sm" />
                  <span className="font-mono text-[14px] font-semibold text-[#1A1A1A]">× 1</span>
                </div>
              </div>
            </div>
            <div className="flex gap-8 p-6 bg-[#FAFAFA] border border-[#EAEAEA]">
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">TIME COMPLEXITY</span>
                <span className="font-mono text-[16px] text-[#1A1A1A]">O(n)</span>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">BEST CASE SIZE</span>
                <span className="font-mono text-[16px] text-[#1A1A1A]">O(1) pairs</span>
              </div>
            </div>
          </section>

          {/* Shannon-Fano */}
          <section id="shannon" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[12px] font-bold tracking-[0.1em] text-[#999]">02</span>
              <h2 className="font-playfair text-[28px] font-semibold text-[#1A1A1A]">Shannon-Fano Coding</h2>
            </div>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              Shannon-Fano works top-down by dividing symbols into two sets with roughly equal total probabilities, assigning 0 to the first set and 1 to the second, then repeating recursively.
            </p>
            <div className="flex flex-col gap-6 p-8 bg-[#F5F5F5] rounded-lg">
              <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#666]">VISUALIZATION: TOP-DOWN SPLITTING</span>
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 max-w-[180px] h-8 bg-[#A5B4FC] rounded flex items-center justify-center text-[12px] font-semibold text-white">A (39%)</div>
                <span className="text-[#888] font-light">|</span>
                <div className="flex-1 max-w-[120px] h-8 bg-[#E0E7FF] rounded flex items-center justify-center text-[12px] font-semibold text-[#6366F1]">B (21%)</div>
                <div className="flex-1 max-w-[100px] h-8 bg-[#E0E7FF] rounded flex items-center justify-center text-[12px] font-semibold text-[#6366F1]">C (15%)</div>
                <div className="flex-1 max-w-[80px] h-8 bg-[#E0E7FF] rounded flex items-center justify-center text-[12px] font-semibold text-[#6366F1]">D (9%)</div>
              </div>
              <span className="text-[12px] italic text-[#888]">↑ Split point: 39% vs 45%. Set 1 gets '0', Set 2 gets '1'.</span>
            </div>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              While highly efficient, it is often slightly suboptimal compared to Huffman's bottom-up approach because the top-down divisions cannot always be perfectly balanced.
            </p>
            <div className="flex gap-8 p-6 bg-[#FAFAFA] border border-[#EAEAEA]">
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">TIME COMPLEXITY</span>
                <span className="font-mono text-[16px] text-[#1A1A1A]">O(n log n)</span>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">EFFICIENCY</span>
                <span className="text-[16px] text-[#1A1A1A]">Sub-optimal prefix code</span>
              </div>
            </div>
          </section>

          {/* Huffman */}
          <section id="huffman" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[12px] font-bold tracking-[0.1em] text-[#999]">03</span>
              <h2 className="font-playfair text-[28px] font-semibold text-[#1A1A1A]">Huffman Coding</h2>
            </div>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              Huffman constructs an optimal prefix tree by starting from the bottom up. Characters that appear frequently are assigned shorter binary codes, while rare characters receive longer ones.
            </p>
            <div className="flex flex-col gap-6 p-8 bg-[#F5F5F5] rounded-lg">
              <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#666]">VISUALIZATION: THE PREFIX TREE</span>
              <div className="relative w-full h-[140px] flex justify-center mt-4">
                 <div className="absolute top-0 w-10 h-10 rounded-full border-2 border-[#6366F1] bg-white flex items-center justify-center text-[12px] font-bold text-[#6366F1] z-10">10</div>
                 {/* Left branch */}
                 <div className="absolute top-[20px] left-[calc(50%-45px)] w-[50px] h-[45px] border-l-2 border-b-2 border-[#A5B4FC] rounded-bl-lg" />
                 <div className="absolute top-[50px] left-[calc(50%-65px)] w-10 h-10 rounded-full bg-[#6366F1] flex items-center justify-center text-[12px] font-bold text-white z-10">A:6</div>
                 <span className="absolute top-[25px] left-[calc(50%-55px)] text-[12px] font-bold text-[#888]">0</span>
                 
                 {/* Right branch */}
                 <div className="absolute top-[20px] right-[calc(50%-45px)] w-[50px] h-[45px] border-r-2 border-b-2 border-[#A5B4FC] rounded-br-lg" />
                 <div className="absolute top-[50px] right-[calc(50%-65px)] w-10 h-10 rounded-full border-2 border-[#6366F1] bg-white flex items-center justify-center text-[12px] font-bold text-[#6366F1] z-10">4</div>
                 <span className="absolute top-[25px] right-[calc(50%-55px)] text-[12px] font-bold text-[#888]">1</span>
              </div>
            </div>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              By traversing the tree from the root to the leaf node, we generate the binary code for each character. Since no leaf is an ancestor of another, it guarantees that no code is a prefix of another, allowing unambiguous decoding.
            </p>
            <div className="flex gap-8 p-6 bg-[#FAFAFA] border border-[#EAEAEA]">
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">TIME COMPLEXITY</span>
                <span className="font-mono text-[16px] text-[#1A1A1A]">O(n log n)</span>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">EFFICIENCY</span>
                <span className="text-[16px] text-[#1A1A1A]">Optimal prefix code</span>
              </div>
            </div>
          </section>

          {/* Arithmetic */}
          <section id="arithmetic" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[12px] font-bold tracking-[0.1em] text-[#999]">04</span>
              <h2 className="font-playfair text-[28px] font-semibold text-[#1A1A1A]">Arithmetic Coding</h2>
            </div>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              Instead of replacing letters with fixed codes, Arithmetic Coding represents the entire message as a single, highly precise fractional number between 0 and 1. It operates by repeatedly zooming into a number line.
            </p>
            <div className="flex flex-col gap-6 p-8 bg-[#F5F5F5] rounded-lg">
              <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#666]">VISUALIZATION: THE RECURSIVE ZOOM</span>
              <div className="flex flex-col w-full gap-2">
                <div className="flex w-full h-6 rounded overflow-hidden">
                  <div className="flex-1 bg-[#E0E7FF]" />
                  <div className="w-[120px] bg-[#A5B4FC]" />
                  <div className="w-[60px] bg-[#6366F1]" />
                </div>
                <div className="flex justify-between w-full">
                  <span className="text-[12px] text-[#666]">0.0</span>
                  <span className="text-[12px] text-[#666]">1.0</span>
                </div>
              </div>
              <div className="flex justify-center w-full">
                <span className="text-[11px] italic text-[#888]">↓ Zooming into segment C [0.8, 1.0] ↓</span>
              </div>
              <div className="flex flex-col w-full gap-2">
                <div className="flex w-full h-6 rounded overflow-hidden">
                  <div className="flex-1 bg-[#E0E7FF]" />
                  <div className="w-[100px] bg-[#A5B4FC]" />
                </div>
                <div className="flex justify-between w-full">
                  <span className="text-[12px] text-[#666]">0.8</span>
                  <span className="text-[12px] text-[#666]">1.0</span>
                </div>
              </div>
            </div>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              By zooming in proportionally to the symbol probabilities, rare symbols shrink the interval drastically (requiring more bits to represent), while common symbols leave the interval large. The final compressed message is simply a fraction falling within the final microscopic interval.
            </p>
            <div className="flex gap-8 p-6 bg-[#FAFAFA] border border-[#EAEAEA]">
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">TIME COMPLEXITY</span>
                <span className="font-mono text-[16px] text-[#1A1A1A]">O(n)</span>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">THEORETICAL LIMIT</span>
                <span className="text-[16px] text-[#1A1A1A]">Approaches entropy</span>
              </div>
            </div>
          </section>

          {/* LZW */}
          <section id="lzw" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[12px] font-bold tracking-[0.1em] text-[#999]">05</span>
              <h2 className="font-playfair text-[28px] font-semibold text-[#1A1A1A]">LZW Compression</h2>
            </div>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              Lempel-Ziv-Welch (LZW) is a dictionary-based algorithm. Instead of analyzing character frequencies up front, it dynamically builds a dictionary of repeating sequences as it scans the file.
            </p>
            <div className="flex flex-col gap-6 p-8 bg-[#F5F5F5] rounded-lg">
              <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#666]">VISUALIZATION: DYNAMIC DICTIONARY</span>
              <div className="flex items-center gap-4">
                <span className="text-[14px] font-semibold text-[#666]">Input:</span>
                <span className="font-mono text-[18px] tracking-[0.2em] text-[#1A1A1A]">A B A B C</span>
              </div>
              <div className="flex flex-col border border-[#EAEAEA] rounded overflow-hidden">
                <div className="flex bg-[#FAFAFA] px-4 py-2 border-b border-[#EAEAEA]">
                  <span className="w-[80px] font-mono text-[11px] font-semibold text-[#888]">CODE</span>
                  <span className="flex-1 font-mono text-[11px] font-semibold text-[#888]">SEQUENCE</span>
                </div>
                <div className="flex bg-white px-4 py-3 border-b border-[#EAEAEA]">
                  <span className="w-[80px] font-mono text-[13px] text-[#6366F1]">256</span>
                  <span className="flex-1 font-mono text-[13px] text-[#1A1A1A]">AB</span>
                </div>
                <div className="flex bg-white px-4 py-3 border-b border-[#EAEAEA]">
                  <span className="w-[80px] font-mono text-[13px] text-[#6366F1]">257</span>
                  <span className="flex-1 font-mono text-[13px] text-[#1A1A1A]">BA</span>
                </div>
                <div className="flex bg-white px-4 py-3">
                  <span className="w-[80px] font-mono text-[13px] text-[#6366F1]">258</span>
                  <span className="flex-1 font-mono text-[13px] text-[#1A1A1A]">ABC</span>
                </div>
              </div>
            </div>
            <p className="text-[16px] leading-[1.7] text-[#444]">
              As the algorithm encounters 'A' followed by 'B', it outputs the code for 'A' and adds the sequence 'AB' to its dictionary. When it encounters 'AB' again later, it outputs the single integer 256 instead of two separate characters.
            </p>
            <div className="flex gap-8 p-6 bg-[#FAFAFA] border border-[#EAEAEA]">
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">TIME COMPLEXITY</span>
                <span className="font-mono text-[16px] text-[#1A1A1A]">O(n)</span>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[#888]">STRENGTH</span>
                <span className="text-[16px] text-[#1A1A1A]">High redundancy</span>
              </div>
            </div>
          </section>

          {/* Spacer */}
          <div className="h-20" />
        </div>
      </div>
    </div>
  )
}
