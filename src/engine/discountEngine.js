/**
 * discountEngine.js
 *
 * Pure discount calculation logic. No UI, no side effects.
 * All functions take plain objects and return plain objects.
 *
 * Data shapes:
 *
 * DiscountRule {
 *   ruleId:    string       — e.g. "RULE-01"
 *   scope:     "brand" | "platform"
 *   appliesTo: string       — e.g. "Natura Casa", "Amazon India"
 *   type:      "percentage" | "flat"
 *   value:     number       — percentage as integer (15 = 15%), flat in rupees
 *   stackable: boolean
 * }
 *
 * CartItem {
 *   itemId:    string       — e.g. "ITEM-01"
 *   product:   string
 *   brand:     string
 *   platform:  string
 *   basePrice: number       — in rupees
 * }
 *
 * DiscountResult {
 *   itemId:        string
 *   product:       string
 *   brand:         string
 *   platform:      string
 *   basePrice:     number
 *   finalPrice:    number
 *   totalDiscount: number
 *   appliedRules:  string[]
 *   skippedRules:  string[]
 *   reasoning:     string   — customer-readable explanation
 * }
 */

/**
 * Returns true if the rule applies to this cart item.
 */
export function ruleMatchesItem(item, rule) {
  const normalise = (s) => s.trim().toLowerCase()
  if (rule.scope === 'brand') {
    return normalise(item.brand) === normalise(rule.appliesTo)
  }
  if (rule.scope === 'platform') {
    return normalise(item.platform) === normalise(rule.appliesTo)
  }
  return false
}

/**
 * Calculates the rupee discount a rule gives on a given price.
 * Uses the provided price, not the original base price — important for stacking.
 */
export function calculateDiscountAmount(price, rule) {
  if (rule.type === 'percentage') {
    return Math.round(price * rule.value / 100)
  }
  if (rule.type === 'flat') {
    return rule.value
  }
  return 0
}

/**
 * Builds the customer-facing reasoning string for an applied rule.
 */
function ruleToReasoning(rule) {
  const scopeLabel = rule.scope === 'brand' ? 'Brand' : 'Platform'
  if (rule.type === 'percentage') {
    return `${scopeLabel} offer: ${rule.value}% off`
  }
  if (rule.type === 'flat') {
    return `${scopeLabel} offer: Rs.${rule.value} off`
  }
  return `${scopeLabel} offer applied`
}

/**
 * Applies the active discount rules to a single cart item.
 * Returns a DiscountResult.
 *
 * Logic:
 *   1. Find all rules that match this item.
 *   2. Among non-stackable rules, pick the one giving the largest discount.
 *   3. Apply any stackable rules on top of that price.
 *   4. Build the reasoning string from what was applied.
 */
export function applyDiscounts(item, rules) {
  const matchingRules = rules.filter((r) => ruleMatchesItem(item, r))

  // No rules match — return base price with explanation
  if (matchingRules.length === 0) {
    return {
      itemId: item.itemId,
      product: item.product,
      brand: item.brand,
      platform: item.platform,
      basePrice: item.basePrice,
      finalPrice: item.basePrice,
      totalDiscount: 0,
      appliedRules: [],
      skippedRules: [],
      reasoning: 'No offers available',
    }
  }

  const nonStackable = matchingRules.filter((r) => !r.stackable)
  const stackable = matchingRules.filter((r) => r.stackable)

  // Pick the non-stackable rule that gives the largest saving
  let winner = null
  let skipped = []

  if (nonStackable.length > 0) {
    const sorted = [...nonStackable].sort(
      (a, b) =>
        calculateDiscountAmount(item.basePrice, b) -
        calculateDiscountAmount(item.basePrice, a)
    )
    winner = sorted[0]
    skipped = sorted.slice(1)
  }

  // Apply winner first, then stack on top
  let price = item.basePrice
  const appliedRules = []
  const reasoningParts = []

  if (winner) {
    price -= calculateDiscountAmount(price, winner)
    appliedRules.push(winner.ruleId)
    reasoningParts.push(ruleToReasoning(winner))
  }

  for (const rule of stackable) {
    price -= calculateDiscountAmount(price, rule)
    appliedRules.push(rule.ruleId)
    reasoningParts.push(ruleToReasoning(rule))
  }

  const finalPrice = Math.round(price)

  return {
    itemId: item.itemId,
    product: item.product,
    brand: item.brand,
    platform: item.platform,
    basePrice: item.basePrice,
    finalPrice,
    totalDiscount: item.basePrice - finalPrice,
    appliedRules,
    skippedRules: skipped.map((r) => r.ruleId),
    reasoning: reasoningParts.join(' + '),
  }
}

/**
 * Runs applyDiscounts across every item in the cart.
 * Returns an array of DiscountResult objects.
 */
export function processCart(cartItems, rules) {
  return cartItems.map((item) => applyDiscounts(item, rules))
}

/**
 * Sums the final prices across all results.
 */
export function cartTotal(results) {
  return results.reduce((sum, r) => sum + r.finalPrice, 0)
}


/**
 * Filters rules that have scope === 'cart'.
 * Cart rules apply to the entire cart total, not individual items.
 */
export function getCartRules(rules) {
  return rules.filter((r) => r.scope === 'cart')
}


/**
 * Returns true if the cart rule's condition is satisfied.
 * Currently only supports min cart value conditions.
 *
 * Example: if rule.minCartValue = 4000 and cartTotalPrice = 5932,
 * this returns true.
 */
export function cartRuleConditionMet(cartTotalPrice, rule) {
  // If the rule has a minCartValue condition, check it
  if (rule.minCartValue !== undefined && rule.minCartValue !== null) {
    return cartTotalPrice >= rule.minCartValue
  }
  // If no condition is specified, the rule always applies
  return true
}


/**
 * Calculates the rupee discount a cart rule gives on the cart total.
 * Similar to calculateDiscountAmount but operates on the full cart price.
 */
export function calculateCartDiscount(cartTotalPrice, rule) {
  if (rule.type === 'percentage') {
    return Math.round(cartTotalPrice * rule.value / 100)
  }
  if (rule.type === 'flat') {
    return rule.value
  }
  return 0
}


/**
 * Evaluates all cart-level rules against the current cart total.
 * Returns an object describing which cart offer was applied (if any).
 *
 * Returns:
 * {
 *   applied: true/false,
 *   ruleId: string or null,
 *   discountAmount: number (rupees saved),
 *   reasoning: string,
 *   finalTotal: number (cart total after cart discount)
 * }
 */
export function applyCartOffer(cartTotalPrice, cartRules) {
  // Filter to cart rules that satisfy their conditions
  const eligibleRules = cartRules.filter((r) =>
    cartRuleConditionMet(cartTotalPrice, r)
  )

  // No cart rules apply
  if (eligibleRules.length === 0) {
    return {
      applied: false,
      ruleId: null,
      discountAmount: 0,
      reasoning: '',
      finalTotal: cartTotalPrice,
    }
  }

  // If multiple cart rules could apply, pick the one with the largest discount
  // (same logic as non-stackable item rules)
  const sorted = [...eligibleRules].sort(
    (a, b) =>
      calculateCartDiscount(cartTotalPrice, b) -
      calculateCartDiscount(cartTotalPrice, a)
  )
  const winner = sorted[0]
  const discountAmount = calculateCartDiscount(cartTotalPrice, winner)

  return {
    applied: true,
    ruleId: winner.ruleId,
    discountAmount,
    reasoning:
      winner.type === 'percentage'
        ? `Cart offer: ${winner.value}% off`
        : `Cart offer: Rs.${winner.value} off`,
    finalTotal: Math.round(cartTotalPrice - discountAmount),
  }
}
