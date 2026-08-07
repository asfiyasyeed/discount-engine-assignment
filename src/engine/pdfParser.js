import * as pdfjsLib from "pdfjs-dist";

// Native Vite worker import
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function parsePdfCart(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Group text items by Y coordinate to preserve actual line structure
      const linesMap = {};
      for (const item of textContent.items) {
        if (!item.str || !item.str.trim()) continue;
        // Transform matrix [a, b, c, d, tx, ty] -> transform[5] is y-position
        const y = Math.round(item.transform ? item.transform[5] : 0);
        if (!linesMap[y]) linesMap[y] = [];
        linesMap[y].push(item);
      }

      // Sort lines top-to-bottom (higher Y coordinate is top of page in PDF)
      const sortedYs = Object.keys(linesMap).map(Number).sort((a, b) => b - a);

      for (const y of sortedYs) {
        // Sort items left-to-right within line (x-position is transform[4])
        const lineItems = linesMap[y].sort((a, b) => (a.transform?.[4] || 0) - (b.transform?.[4] || 0));
        const lineStr = lineItems.map((item) => item.str.trim()).join("   ");
        fullText += lineStr + "\n";
      }
    }

    const { items, skippedRows } = parseCartTable(fullText);

    if (items.length === 0) {
      throw new Error(
        skippedRows.length > 0
          ? `No valid rows could be parsed. ${skippedRows.length} row(s) were malformed.`
          : "No item rows were found in this PDF."
      );
    }

    return { items, skippedRows };
  } catch (error) {
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
}

function parseCartTable(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const cartItems = [];
  const skippedRows = [];
  let itemId = 1;

  const knownPlatforms = ["Amazon India", "Flipkart", "Noon", "Amazon", "Myntra"];
  const knownBrands = ["Natura Casa", "LivSpace Pro", "Nordic Basics"];

  for (const line of lines) {
    // Skip headers
    if (
      line.toLowerCase().includes("product") &&
      line.toLowerCase().includes("brand")
    ) {
      continue;
    }

    // Extract price at the end of the line. Explicitly capture an optional
    // leading minus sign so negative prices are caught, not silently
    // stripped to a positive number.
    const priceMatch = line.match(/(?:rs\.?|₹|\$)?\s*(-?[\d,]+)\s*$/i);

    if (!priceMatch) {
      skippedRows.push({ line, reason: "No valid price found" });
      continue;
    }

    const basePrice = parseInt(priceMatch[1].replace(/,/g, ""), 10);

    if (isNaN(basePrice) || basePrice <= 0) {
      skippedRows.push({ line, reason: `Invalid price: "${priceMatch[1]}"` });
      continue;
    }

    const textBeforePrice = line.substring(0, priceMatch.index).trim();

    if (!textBeforePrice) {
      skippedRows.push({ line, reason: "No product/brand/platform text found" });
      continue;
    }

    // Split by 2+ spaces, tabs, or pipes (matches table-formatted PDFs)
    let parts = textBeforePrice.split(/\s{2,}|\t|\|/).map((p) => p.trim()).filter(Boolean);

    // Fallback for single-space separation: only accept if platform AND
    // brand are both confidently identified from known lists, and what's
    // left over is a non-empty product name. We never guess a field by
    // just grabbing "the last word" — that silently produces wrong data
    // instead of failing loudly, which is worse in a pricing engine.
    if (parts.length < 3) {
      let remaining = textBeforePrice;
      let foundPlatform = "";
      let foundBrand = "";

      for (const plat of knownPlatforms) {
        if (remaining.toLowerCase().endsWith(plat.toLowerCase())) {
          foundPlatform = plat;
          remaining = remaining.slice(0, remaining.length - plat.length).trim();
          break;
        }
      }

      for (const b of knownBrands) {
        if (remaining.toLowerCase().endsWith(b.toLowerCase())) {
          foundBrand = b;
          remaining = remaining.slice(0, remaining.length - b.length).trim();
          break;
        }
      }

      if (foundPlatform && foundBrand && remaining) {
        parts = [remaining, foundBrand, foundPlatform];
      } else {
        skippedRows.push({
          line,
          reason: "Could not confidently identify product, brand, and platform",
        });
        continue;
      }
    }

    const [product, brand, platform] = parts;

    if (!product || !brand || !platform) {
      skippedRows.push({ line, reason: "One or more fields (product/brand/platform) missing" });
      continue;
    }

    cartItems.push({
      itemId: `PDF-ITEM-${itemId}`,
      product,
      brand,
      platform,
      basePrice,
    });
    itemId++;
  }

  return { items: cartItems, skippedRows };
}