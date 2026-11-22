const slugPart = (value: string) =>
  value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")

export const categoryIdFromName = (name: string) => name

export const vendorIdFromName = (name: string) => `vendor_${name}`

export const parameterIdFromKey = (key: string) => `parameter_${key}`

export const optionIdFromKeyValue = (key: string, value: string) =>
  `option_${key}_${slugPart(value)}`

export const presetIdFromKey = (key: string) => `preset_${key}`

export const presetOptionIdFromKeyValue = (key: string, value: string) =>
  `preset_option_${key}_${slugPart(value)}`
