import Papa from 'papaparse'
/**
 * Parses the raw text of rules.csv into an array of DiscountRule objects.
 * Returns { data, errors } where errors is an array of row-level issues.
 * 
 * For cart-level rules (scope: "cart"), min_cart_value is required.
 * For brand/platform rules, min_cart_value is ignored.
 */
export function parseRulesCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return { data: [], errors: parseErrors.map((e) => e.message) }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2 // account for header row
    const missing = []

    if (!row.rule_id) missing.push('rule_id')
    if (!row.scope) missing.push('scope')
    if (!row.type) missing.push('type')
    if (row.value === undefined || row.value === '') missing.push('value')
    if (row.stackable === undefined || row.stackable === '') missing.push('stackable')

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields — ${missing.join(', ')}`)
      return
    }

    const scope = row.scope.trim().toLowerCase()
    // Scope can be "brand", "platform", or "cart"
    if (scope !== 'brand' && scope !== 'platform' && scope !== 'cart') {
      errors.push(`Row ${rowNum}: scope must be "brand", "platform", or "cart", got "${row.scope}"`)
      return
    }

    // For brand/platform rules, applies_to is required. For cart rules, it's not.
if ((scope === 'brand' || scope === 'platform') && !row.applies_to) {
  errors.push(`Row ${rowNum}: applies_to is required for ${scope} scope`)
  return
}

// For cart rules, min_cart_value is required
if (scope === 'cart' && (row.min_cart_value === undefined || row.min_cart_value === '')) {
  errors.push(`Row ${rowNum}: min_cart_value is required for cart-scope rules`)
  return
}


    const type = row.type.trim().toLowerCase()
    if (type !== 'percentage' && type !== 'flat') {
      errors.push(`Row ${rowNum}: type must be "percentage" or "flat", got "${row.type}"`)
      return
    }

    const value = parseFloat(row.value)
    if (isNaN(value) || value <= 0) {
      errors.push(`Row ${rowNum}: value must be a positive number, got "${row.value}"`)
      return
    }

    const stackableStr = row.stackable.trim().toLowerCase()
    const stackable = stackableStr === 'true' || stackableStr === '1' || stackableStr === 'yes'

    // For cart-level rules, min_cart_value is required
    let minCartValue = null
    if (scope === 'cart') {
      if (row.min_cart_value === undefined || row.min_cart_value === '') {
        errors.push(`Row ${rowNum}: min_cart_value is required for cart-scope rules`)
        return
      }
      minCartValue = parseFloat(row.min_cart_value)
      if (isNaN(minCartValue) || minCartValue < 0) {
        errors.push(`Row ${rowNum}: min_cart_value must be a non-negative number, got "${row.min_cart_value}"`)
        return
      }
    }

    const rule = {
      ruleId: row.rule_id.trim(),
      scope,
      type,
      value,
      stackable,
    }

    // Only add appliesTo for non-cart rules
    if (scope !== 'cart') {
      rule.appliesTo = row.applies_to.trim()
    }

    // Only add minCartValue if it's a cart rule
    if (scope === 'cart') {
      rule.minCartValue = minCartValue
    }

    data.push(rule)
  })

  return { data, errors }
}


/**
 * Parses the raw text of cart.csv into an array of CartItem objects.
 * Returns { data, errors } where errors is an array of row-level issues.
 */
export function parseCartCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return { data: [], errors: parseErrors.map((e) => e.message) }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const missing = []

    // Cart CSV required fields
    if (!row.item_id) missing.push('item_id')
    if (!row.product) missing.push('product')
    if (!row.brand) missing.push('brand')
    if (!row.platform) missing.push('platform')
    if (row.base_price === undefined || row.base_price === '') {
      missing.push('base_price')
    }

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields — ${missing.join(', ')}`)
      return
    }

    const basePrice = parseFloat(row.base_price)

    if (isNaN(basePrice) || basePrice < 0) {
      errors.push(
        `Row ${rowNum}: base_price must be a valid positive number, got "${row.base_price}"`
      )
      return
    }

    data.push({
      itemId: row.item_id.trim(),
      product: row.product.trim(),
      brand: row.brand.trim(),
      platform: row.platform.trim(),
      basePrice: Math.round(basePrice),
    })
  })

  return { data, errors }
}