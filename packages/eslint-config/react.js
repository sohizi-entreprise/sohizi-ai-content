import { tanstackConfig } from "@tanstack/eslint-config"
import prettierRecommended from "eslint-plugin-prettier/recommended"
import { createDefineConfig } from "./define.js"

const preset = [...tanstackConfig, prettierRecommended]

/** @type {import('eslint').Linter.Config[]} */
export default preset

export const defineConfig = createDefineConfig(preset)
