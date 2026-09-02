/**
 * @typedef {import('eslint').Linter.Config} FlatConfig
 */

/**
 * Bind a shared preset so an app can append local ignores, rules, or files.
 *
 * @param {FlatConfig[]} preset
 */
export function createDefineConfig(preset) {
  /**
   * @param {FlatConfig | FlatConfig[]} [overrides]
   * @returns {FlatConfig[]}
   */
  return function defineConfig(overrides) {
    if (overrides == null) return [...preset]
    return [...preset, ...(Array.isArray(overrides) ? overrides : [overrides])]
  }
}
