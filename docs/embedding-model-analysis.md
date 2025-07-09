# Embedding Model Analysis for LoreHub

## Decision Matrix

### Option 1: @xenova/transformers with all-MiniLM-L6-v2 ✅ (Recommended)

**Pros:**
- 384-dimensional embeddings (perfect for sqlite-vec)
- Only 22MB model size
- Fast inference (~2-3s on standard hardware)
- No external API dependencies
- Full TypeScript support (with workarounds)
- Proven in production (used by LangChain.js)
- ONNX optimized for JavaScript

**Cons:**
- First run downloads model (~22MB)
- TypeScript ESM import issues (solvable)
- 84-85% accuracy vs 87-88% for larger models

**Implementation:**
```typescript
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const embeddings = await embedder(text, { pooling: 'mean', normalize: true });
```

### Option 2: node-llama-cpp with local models

**Pros:**
- More model choices
- Can use quantized models
- Better for edge devices

**Cons:**
- Requires native compilation
- Platform-specific binaries
- More complex setup
- Larger memory footprint

### Option 3: OpenAI-compatible APIs (local)

**Pros:**
- Standard API interface
- Easy to swap providers

**Cons:**
- Requires running separate service
- Not truly embedded
- Additional complexity

## Recommendation

Use **@xenova/transformers** with **all-MiniLM-L6-v2** because:

1. **Perfect for LoreHub's use case**: Technical documentation embeddings
2. **Optimal vector size**: 384 dimensions balances quality and performance
3. **Local-first**: No external dependencies aligns with LoreHub's philosophy
4. **Easy integration**: Works with existing TypeScript/Node.js stack
5. **Production-proven**: Used by major projects like LangChain.js

## TypeScript Configuration

To handle ESM imports in TypeScript:

```typescript
// Option 1: Dynamic import
const TransformersApi = Function('return import("@xenova/transformers")')();
const { pipeline } = await TransformersApi;

// Option 2: Update tsconfig.json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "node"
  }
}
```

## Performance Expectations

- **Model download**: ~22MB on first run
- **Embedding generation**: 50-200ms per fact
- **Memory usage**: ~100-200MB when loaded
- **Accuracy**: Sufficient for technical documentation search