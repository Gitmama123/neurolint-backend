import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("NeuroLint Azure Backend Running 🚀");
});
function computeStructuralScore(code) {
  let score = 1;

  const loopMatches = code.match(/\b(for|while)\b/g) || [];
  const ifMatches = code.match(/\b(if|else if|switch)\b/g) || [];
  const functionMatches = code.match(/\b(function|int|void|float|double|char)\s+\w+\s*\(/g) || [];
  const structMatches = code.match(/\b(struct|class|typedef)\b/g) || [];
  const pointerMatches = code.match(/\*/g) || [];
  const recursionMatches = code.match(/\breturn\b/g) || [];

  // Structural depth proxy
  score += Math.min(loopMatches.length, 2);
  score += Math.min(ifMatches.length, 2);

  // Multiple functions
  if (functionMatches.length > 1) score += 1;

  // Custom data structures
  if (structMatches.length > 0) score += 1;

  // Pointer / reference complexity
  if (pointerMatches.length > 2) score += 1;

  // Recursion detection (basic)
  if (recursionMatches.length > 3) score += 1;

  return Math.min(score, 10);
}




app.post("/analyze", async (req, res) => {
  try {
    const { code, mode, therapist } = req.body;

    if (!code) {
      return res.status(400).json({ error: "No code provided" });
    }

    const structuralScore = computeStructuralScore(code);

    // 🧠 Mode-based perception adjustment
const modeOffset = {
  beginner: 2,
  intermediate: 0,
  expert: -2
};

const adjustedBaseline =
  structuralScore + (modeOffset[mode] || 0);

    const systemPrompt = `
You are NeuroLint, a cognitive code analysis engine.

Structural complexity baseline: ${adjustedBaseline}

You may adjust the cognitive_load_score by AT MOST ±1 from this baseline.

You must return ONLY valid JSON matching EXACTLY this schema:

{
  "mode": "string",
  "explanation": "string",
  "cognitive_load_score": number,
  "issues": [
    {
      "type": "string",
      "description": "string",
      "why_it_matters": "string"
    }
  ],
  "refactor_suggestions": [
    {
      "suggestion": "string",
      "impact": "low | medium | high"
    }
  ],
  "mental_model": "string",
  "validity_matrix": {
    "validity_score": number,
    "unsupported_claims": ["string"],
    "confidence_level": "low | medium | high"
  }
}

Do not add extra fields.
Do not remove fields.
Return strictly valid JSON.
`;

    const userPrompt = `
Mode: ${mode}
Therapist Mode: ${therapist}

Code:
${code}
`;

    const response = await axios.post(
      "https://api.tokenfactory.nebius.com/v1/chat/completions",
      {
        model: "Qwen/Qwen2.5-Coder-7B-fast",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.NEBIUS_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: "Empty model response" });
    }

    let structured = JSON.parse(content);

    // 🔥 HARD CLAMP MODEL SCORE
    const modelScore = structured.cognitive_load_score ?? structuralScore;
    const lowerBound = adjustedBaseline - 1;
    const upperBound = adjustedBaseline + 1;
    const finalScore = Math.max(
  1,
  Math.min(
    10,
    Math.max(lowerBound, Math.min(upperBound, modelScore))
  )
);

    structured.cognitive_load_score = finalScore;

    res.json(structured);

  } catch (err) {
    console.error("AI Error:", err?.response?.data || err.message);
    res.status(500).json({ error: "AI processing failed" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`NeuroLint Azure Backend Running on port ${PORT}`);
});