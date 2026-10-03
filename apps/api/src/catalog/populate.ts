import { db } from "@/db"
import {
  llmModels,
  llmVendorModelParameterOverrides,
  llmVendors,
  llmVendorsAndModels,
  llmVendorsAndParameterOptions,
  llmVendorsAndParameters,
  modelCategories,
  modelParameters,
  modelsAndCategories,
  modelsAndParameterOptions,
  modelsAndParameters,
  parameterOptions,
} from "@/db/schema"
import type {
  ModelBasePricing,
  ModelParameterDataType,
  ModelParameterUIComponent,
  VendorKind,
} from "@/type"
import { sql } from "drizzle-orm"
import { loadCatalog, withInheritedFileType } from "./load"
import { validateCatalog } from "./validate"

const toText = (value: unknown): string | null => {
  if (value == null) return null
  return typeof value === "string" ? value : String(value)
}

if (import.meta.main) {
  const { catalog, errors: loadErrors } = await loadCatalog()
  const errors = [...loadErrors, ...validateCatalog(catalog)]
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error)
    }
    console.error(
      `catalog:populate aborted: validation failed with ${errors.length} error(s)`,
    )
    process.exit(1)
  }

  try {
    await db.transaction(async (tx) => {
      if (catalog.categories.length > 0) {
        await tx
          .insert(modelCategories)
          .values(
            catalog.categories.map((category) => ({
              id: category.id,
              name: category.name,
              description: category.description,
            })),
          )
          .onConflictDoNothing()
      }

      if (catalog.parameters.length > 0) {
        await tx
          .insert(modelParameters)
          .values(
            catalog.parameters.map((parameter) => ({
              id: parameter.id,
              key: parameter.key,
              label: parameter.label,
              type: parameter.type as ModelParameterDataType,
              description: parameter.description ?? null,
              xUiComponent: (parameter.xUiComponent ??
                null) as ModelParameterUIComponent | null,
            })),
          )
          .onConflictDoUpdate({
            target: modelParameters.id,
            set: {
              key: sql`excluded.key`,
              label: sql`excluded.label`,
              type: sql`excluded.type`,
              description: sql`excluded.description`,
              xUiComponent: sql`excluded.x_ui_component`,
            },
          })
      }

      const optionRows = catalog.parameters.flatMap((parameter) =>
        parameter.options.map((option) => ({
          id: option.id,
          parameterId: parameter.id,
          label: option.label,
          value: option.value,
          description: option.description ?? null,
        })),
      )
      if (optionRows.length > 0) {
        await tx.insert(parameterOptions).values(optionRows).onConflictDoNothing()
      }

      if (catalog.models.length > 0) {
        await tx
          .insert(llmModels)
          .values(
            catalog.models.map((model) => ({
              id: model.id,
              provider: model.provider,
              name: model.name,
              description: model.description ?? null,
              pricing: model.pricing as ModelBasePricing | null,
              contextWindow: model.contextWindow,
            })),
          )
          .onConflictDoNothing()
      }

      const categoryRows = catalog.models.flatMap((model) =>
        model.categories.map((categoryId) => ({
          modelId: model.id,
          categoryId,
        })),
      )
      if (categoryRows.length > 0) {
        await tx
          .insert(modelsAndCategories)
          .values(categoryRows)
          .onConflictDoNothing()
      }

      const parametersById = new Map(
        catalog.parameters.map((parameter) => [parameter.id, parameter]),
      )
      const parameterBindingRows = catalog.models.flatMap((model) =>
        model.parameters.map((parameter, index) => ({
          modelId: model.id,
          parameterId: parameter.id,
          required: parameter.required ?? false,
          sortOrder: index,
          defaultValue: toText(parameter.defaultValue),
          constraints: withInheritedFileType(
            parameter.constraints,
            parametersById.get(parameter.id)?.fileType,
          ),
        })),
      )
      if (parameterBindingRows.length > 0) {
        await tx
          .insert(modelsAndParameters)
          .values(parameterBindingRows)
          .onConflictDoNothing()
      }

      const optionsByParameterValue = new Map<string, string>()
      for (const parameter of catalog.parameters) {
        for (const option of parameter.options) {
          optionsByParameterValue.set(
            `${parameter.id}:${option.value}`,
            option.id,
          )
        }
      }

      const allowedOptionRows = catalog.models.flatMap((model) =>
        model.parameters.flatMap((parameter) =>
          (parameter.allowedValues ?? []).flatMap((value) => {
            const optionId = optionsByParameterValue.get(
              `${parameter.id}:${String(value)}`,
            )
            if (!optionId) return []
            return [
              {
                modelId: model.id,
                parameterId: parameter.id,
                optionId,
              },
            ]
          }),
        ),
      )
      if (allowedOptionRows.length > 0) {
        await tx
          .insert(modelsAndParameterOptions)
          .values(allowedOptionRows)
          .onConflictDoNothing()
      }

      if (catalog.vendors.length > 0) {
        await tx
          .insert(llmVendors)
          .values(
            catalog.vendors.map((vendor) => ({
              id: vendor.id,
              name: vendor.name,
              adapter: vendor.adapter,
              url: vendor.url ?? null,
              kind: vendor.kind as VendorKind,
              rateLimit: vendor.rateLimit ?? {
                rpm: 60,
                burst: 60,
                maxConcurrency: 10,
              },
              circuitConfig: vendor.circuitConfig ?? null,
            })),
          )
          .onConflictDoNothing()
      }

      const vendorModelRows = catalog.vendors.flatMap((vendor) =>
        vendor.models.map((binding) => ({
          vendorId: vendor.id,
          modelId: binding.id,
          apiName: binding.apiName,
          priority: binding.priority ?? 100,
        })),
      )
      if (vendorModelRows.length > 0) {
        await tx
          .insert(llmVendorsAndModels)
          .values(vendorModelRows)
          .onConflictDoNothing()
      }

      const vendorParameterRows = catalog.vendors.flatMap((vendor) =>
        Object.entries(vendor.parametersMapping).map(
          ([parameterId, mapping]) => ({
            vendorId: vendor.id,
            parameterId,
            vendorParamName: mapping.vendorParamName ?? null,
            vendorDefaultValue: mapping.vendorDefaultValue ?? null,
          }),
        ),
      )
      if (vendorParameterRows.length > 0) {
        await tx
          .insert(llmVendorsAndParameters)
          .values(vendorParameterRows)
          .onConflictDoNothing()
      }

      const vendorOptionRows = catalog.vendors.flatMap((vendor) =>
        Object.values(vendor.parametersMapping).flatMap((mapping) =>
          Object.entries(mapping.optionMapping ?? {}).map(
            ([optionId, option]) => ({
              vendorId: vendor.id,
              parameterOptionId: optionId,
              vendorOptionValue: toText(option.mappedValue ?? option.value) ?? "",
            }),
          ),
        ),
      )
      if (vendorOptionRows.length > 0) {
        await tx
          .insert(llmVendorsAndParameterOptions)
          .values(vendorOptionRows)
          .onConflictDoNothing()
      }

      const overrideRows = catalog.vendors.flatMap((vendor) =>
        Object.entries(vendor.modelParameterOverrides).flatMap(
          ([modelId, overrides]) =>
            Object.entries(overrides).flatMap(([parameterId, override]) => {
              if (!override.vendorParamName) return []
              return [
                {
                  vendorId: vendor.id,
                  modelId,
                  parameterId,
                  vendorParamName: override.vendorParamName,
                },
              ]
            }),
        ),
      )
      if (overrideRows.length > 0) {
        await tx
          .insert(llmVendorModelParameterOverrides)
          .values(overrideRows)
          .onConflictDoNothing()
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`catalog:populate failed: ${message}`)
    process.exit(1)
  }

  console.log("catalog:populate completed")
  process.exit(0)
}
