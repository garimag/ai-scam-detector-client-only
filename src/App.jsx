import { useState } from "react";
import { createWorker } from "tesseract.js";
import "./App.css";

const PATTERNS = [
  {
    label: "urgent language",
    pattern: /\burgent\b|\bimmediately\b|\bact now\b|\blast chance\b|\btime is running out\b|\bfinal notice\b/i,
    weight: 15,
  },
  {
    label: "account verification request",
    pattern: /\bverify your account\b|\bconfirm your account\b|\bconfirm your identity\b/i,
    weight: 18,
  },
  {
    label: "password or login request",
    pattern: /\bpassword\b|\blogin\b|\breset\b|\bsign in\b/i,
    weight: 14,
  },
  {
    label: "money request",
    pattern: /\bwire\b|\bsend money\b|\bgift card\b|\bpayment\b|\bpay now\b/i,
    weight: 18,
  },
  {
    label: "reward bait",
    pattern: /\breward\b|\brewards\b|\bpoints\b|\bclaim\b|\bprize\b|\byou won\b|\bredeem\b/i,
    weight: 16,
  },
  {
    label: "threat or penalty",
    pattern: /\bexpire\b|\bexpires\b|\bforfeited\b|\bsuspended\b|\bterminated\b|\blocked\b|\bclosure\b/i,
    weight: 16,
  },
  {
    label: "generic greeting",
    pattern: /\bdear customer\b|\bdear user\b/i,
    weight: 10,
  },
  {
    label: "suspicious link present",
    pattern: /https?:\/\/|www\./i,
    weight: 12,
  },
];

const TRUSTED_BRANDS = {
  "t-mobile": ["t-mobile.com"],
  paypal: ["paypal.com"],
  apple: ["apple.com"],
  netflix: ["netflix.com"],
  amazon: ["amazon.com"],
  irs: ["irs.gov"],
  usps: ["usps.com", "usps.gov"],
};

function extractUrls(text) {
  return text.match(/https?:\/\/[^\s]+/gi) || [];
}

function isTrustedDomain(domain, trustedDomains) {
  return trustedDomains.some(
    (trustedDomain) =>
      domain === trustedDomain || domain.endsWith(`.${trustedDomain}`)
  );
}

function analyzeText(text) {
  const findings = [];
  let ruleScore = 0;
  let hardScam = false;
  const lowerText = text.toLowerCase();

  for (const item of PATTERNS) {
    if (item.pattern.test(lowerText)) {
      findings.push(item.label);
      ruleScore += item.weight;
    }
  }

  for (const rawUrl of extractUrls(lowerText)) {
    let domain = "";
    try {
      domain = new URL(rawUrl).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }

    for (const [brand, trustedDomains] of Object.entries(TRUSTED_BRANDS)) {
      if (lowerText.includes(brand) && !isTrustedDomain(domain, trustedDomains)) {
        findings.push(`brand impersonation via suspicious domain (${domain})`);
        ruleScore += 40;
        hardScam = true;
      }
    }
  }

  const confidence = hardScam
    ? Math.max(96, Math.min(100, ruleScore + 45))
    : Math.min(100, Math.round(ruleScore * 1.45));

  let label = "Safe";
  let riskLevel = "Low";

  if (hardScam || confidence >= 85) {
    label = "Scam";
    riskLevel = "Very High";
  } else if (confidence >= 70) {
    label = "Suspicious";
    riskLevel = "High";
  } else if (confidence >= 40) {
    label = "Suspicious";
    riskLevel = "Medium";
  }

  return {
    label,
    confidence,
    model_confidence: null,
    risk_level: riskLevel,
    findings,
    extracted_text: text,
  };
}

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setResult(null);
    setError("");
    setProgress(0);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl("");
    }
  }

  async function extractTextWithTesseract(imageFile) {
    const worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text") {
          setProgress(Math.round(message.progress * 100));
        }
      },
    });

    try {
      const { data } = await worker.recognize(imageFile);
      return data.text.trim();
    } finally {
      await worker.terminate();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setError("Please upload an image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setProgress(0);

    try {
      const extractedText = await extractTextWithTesseract(file);
      const analysis = analyzeText(extractedText);
      setResult(analysis);
    } catch (err) {
      setError(err.message || "Something went wrong while analyzing the image.");
    } finally {
      setLoading(false);
    }
  }

  const isSafe = result?.label?.toLowerCase() === "safe";

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1>AI Scam Detector</h1>
          <p>Upload a screenshot to check whether it looks like a scam.</p>
        </div>

        <form onSubmit={handleSubmit} className="uploadBar">
          <div className="fileInputWrap">
            <label className="fileButton">
              Choose Image
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                hidden
              />
            </label>
            {file && <span className="fileName">{file.name}</span>}
          </div>

          <button type="submit" disabled={loading || !file}>
            {loading ? "Analyzing..." : "Analyze Image"}
          </button>
        </form>

        {loading && (
          <div className="processingBar">
            <p>Processing... {progress}%</p>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="contentGrid">
          <div className="panel">
            <div className="panelHeader">
              <h2>Uploaded Image</h2>
            </div>

            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="preview" />
            ) : (
              <div className="emptyState">
                <p>No image selected yet.</p>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panelHeader">
              <h2>Analysis Result</h2>
            </div>

            {result ? (
              <>
                <div className="resultTop">
                  <div>
                    <h4 className="labelCaption">Result</h4>
                    <h4 className="resultLabel">{result.label}</h4>
                  </div>
                </div>

                <div className="confidenceRow">
                  <p className="confidence">
                    <strong>Probability of Scam:</strong> {result.confidence}%
                  </p>

                  <span
                    className={`risk ${result.risk_level
                      ?.toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    Scam Risk: {result.risk_level ?? "N/A"}
                  </span>
                  </div>

                <div className="section">
                  <h4>Extracted Text</h4>
                  <div className="textBox">
                    {result.extracted_text || "No text found."}
                  </div>
                </div>

                <div className="section">
                  <h4>
                    {isSafe ? "Why it was not flagged" : "Why this was flagged"}
                  </h4>

                  {result.findings?.length ? (
                    <ul className="findingsList">
                      {result.findings.map((item) => (
                        <li key={item} className="findingItem">
                          <span className="bullet">•</span>
                          <span className="findingText">
                            {item.charAt(0).toUpperCase() + item.slice(1)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      {isSafe
                        ? "No obvious red flags were found."
                        : "No obvious red flags found."}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="emptyState">
                <p>
                  Analysis results will appear here after you upload and analyze an image.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
