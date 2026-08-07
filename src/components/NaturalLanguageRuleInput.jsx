import { useState } from "react";
import { parseNaturalLanguageRule } from "../engine/llmParser";
import "./NaturalLanguageRuleInput.css";

export default function NaturalLanguageRuleInput({ onRuleAdded }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedRule, setParsedRule] = useState(null);
  const [error, setError] = useState("");

  const handleParse = async () => {
    if (!input.trim()) {
      setError("Please enter a discount rule description.");
      return;
    }

    setError("");
    setLoading(true);

    const result = await parseNaturalLanguageRule(input);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setParsedRule(null);
    } else {
      setParsedRule(result);
    }
  };

  const handleConfirm = () => {
    if (parsedRule) {
      onRuleAdded(parsedRule);
      setInput("");
      setParsedRule(null);
      setError("");
    }
  };

  const handleDiscard = () => {
    setParsedRule(null);
    setError("");
  };

  return (
    <div className="natural-language-input-container">
      <h2>Add Rule by Description</h2>
      
      <div className="input-section">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Example: 20% off for Natura Casa brand, stackable with other offers"
          rows={3}
          disabled={loading || parsedRule !== null}
        />
        <button
          onClick={handleParse}
          disabled={loading || parsedRule !== null}
          className="parse-button"
        >
          {loading ? "Parsing..." : "Parse Rule"}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {parsedRule && (
        <div className="confirmation-modal">
          <h3>Detected Rule</h3>
          
          <div className="rule-details">
            {parsedRule.scope === "cart" ? (
              <>
                <div className="detail-row">
                  <span className="label">Scope:</span>
                  <span className="value">Cart-level</span>
                </div>
              </>
            ) : (
              <>
                <div className="detail-row">
                  <span className="label">Scope:</span>
                  <span className="value">{parsedRule.scope}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Applies To:</span>
                  <span className="value">{parsedRule.appliesTo}</span>
                </div>
              </>
            )}

            <div className="detail-row">
              <span className="label">Discount Type:</span>
              <span className="value">{parsedRule.type}</span>
            </div>

            <div className="detail-row">
              <span className="label">Discount Value:</span>
              <span className="value">
                {parsedRule.type === "percentage"
                  ? `${parsedRule.value}%`
                  : `Rs.${parsedRule.value}`}
              </span>
            </div>

            {parsedRule.stackable !== undefined && (
              <div className="detail-row">
                <span className="label">Stackable:</span>
                <span className="value">{parsedRule.stackable ? "Yes" : "No"}</span>
              </div>
            )}

            {parsedRule.minCartValue && (
              <div className="detail-row">
                <span className="label">Min Cart Value:</span>
                <span className="value">Rs.{parsedRule.minCartValue}</span>
              </div>
            )}
          </div>

          <div className="confirmation-buttons">
            <button onClick={handleConfirm} className="confirm-button">
              Confirm
            </button>
            <button onClick={handleDiscard} className="discard-button">
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
