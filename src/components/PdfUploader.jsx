import { useState } from "react"
import { parsePdfCart } from "../engine/pdfParser.js"

export default function PdfUploader({ onCartLoaded }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".pdf")) {
      setError("Please upload a PDF file.")
      return
    }

    setError("")
    setLoading(true)

    try {
      const cartItems = await parsePdfCart(file)
      onCartLoaded(cartItems)
    } catch (err) {
      setError(`PDF parsing error: ${err.message}`)
    } finally {
      setLoading(false)
      event.target.value = ""
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        disabled={loading}
        style={{
          padding: '4px',
          border: '1px solid #CECECE',
          borderRadius: 4,
          fontSize: 13,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      />
      {loading && <div style={{ fontSize: 12, color: '#888', marginTop: '4px' }}>Parsing PDF...</div>}
      {error && (
        <div style={{
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          color: '#721c24',
          padding: '6px 12px',
          borderRadius: 4,
          fontSize: 12,
          marginTop: '6px',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
