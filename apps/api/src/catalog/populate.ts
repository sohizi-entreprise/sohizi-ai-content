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
import { notInArray, sql, type SQL, type SQLWrapper } from "drizzle-orm"
import { loadCatalog, withInheritedFileType, type Catalog } from "./load"
import { validateCatalog, validateTrackedModels } from "./validate"

const toText = (value: unknown): string | null => {
  if (value == null) return null
  return typeof value === "string" ? value : String(value)
}

export type CatalogWriteMode = "populate" | "overwrite"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const touched = (mode: CatalogWriteMode, set: Record<string, unknown>) =>
  mode === "overwrite" ? { ...set, updatedAt: new Date() } : set

const excluded = (column: string) => sql.raw(`excluded.${column}`)

const notInTuples = (columns: SQLWrapper[], tuples: SQL[]) =>
  sql`(${sql.join(columns, sql`, `)}) not in (${sql.join(tuples, sql`, `)})`

const pair = (a: unknown, b: unknown) => sql`(${a}, ${b})`

const triple = (a: unknown, b: unknown, c: unknown) => sql`(${a}, ${b}, ${c})`

async function deleteMissingIds(
  tx: Tx,
  table: Parameters<Tx["delete"]>[0],
  column: Parameters<typeof notInArray>[0],
  ids: string[],
) {
  const query =
    ids.length === 0
      ? tx.delete(table)
      : tx.delete(table).where(notInArray(column, ids))
  const removed = await query.returning()
  return removed.length
}

async function deleteMissing(
  tx: Tx,
  catalog: Catalog,
  rows: {
    categoryRows: Array<{ modelId: string; categoryId: string }>
    parameterBindingRows: Array<{ modelId: string; parameterId: string }>
    allowedOptionRows: Array<{
      modelId: string
      parameterId: string
      optionId: string
    }>
    vendorModelRows: Array<{ vendorId: string; modelId: string }>
    vendorParameterRows: Array<{ vendorId: string; parameterId: string }>
    vendorOptionRows: Array<{ vendorId: string; parameterOptionId: string }>
    overrideRows: Array<{
      vendorId: string
      modelId: string
      parameterId: string
    }>
  },
) {
  let removed = 0
  const drop = async (removedRows: unknown[]) => {
    removed += removedRows.length
  }

  await drop(
    rows.allowedOptionRows.length === 0
      ? await tx.delete(modelsAndParameterOptions).returning()
      : await tx
          .delete(modelsAndParameterOptions)
          .where(
            notInTuples(
              [
                modelsAndParameterOptions.modelId,
                modelsAndParameterOptions.parameterId,
                modelsAndParameterOptions.optionId,
              ],
              rows.allowedOptionRows.map((row) =>
                triple(row.modelId, row.parameterId, row.optionId),
              ),
            ),
          )
          .returning(),
  )
  await drop(
    rows.parameterBindingRows.length === 0
      ? await tx.delete(modelsAndParameters).returning()
      : await tx
          .delete(modelsAndParameters)
          .where(
            notInTuples(
              [modelsAndParameters.modelId, modelsAndParameters.parameterId],
              rows.parameterBindingRows.map((row) =>
                pair(row.modelId, row.parameterId),
              ),
            ),
          )
          .returning(),
  )
  await drop(
    rows.categoryRows.length === 0
      ? await tx.delete(modelsAndCategories).returning()
      : await tx
          .delete(modelsAndCategories)
          .where(
            notInTuples(
              [modelsAndCategories.modelId, modelsAndCategories.categoryId],
              rows.categoryRows.map((row) => pair(row.modelId, row.categoryId)),
            ),
          )
          .returning(),
  )
  await drop(
    rows.overrideRows.length === 0
      ? await tx.delete(llmVendorModelParameterOverrides).returning()
      : await tx
          .delete(llmVendorModelParameterOverrides)
          .where(
            notInTuples(
              [
                llmVendorModelParameterOverrides.vendorId,
                llmVendorModelParameterOverrides.modelId,
                llmVendorModelParameterOverrides.parameterId,
              ],
              rows.overrideRows.map((row) =>
                triple(row.vendorId, row.modelId, row.parameterId),
              ),
            ),
          )
          .returning(),
  )
  await drop(
    rows.vendorOptionRows.length === 0
      ? await tx.delete(llmVendorsAndParameterOptions).returning()
      : await tx
          .delete(llmVendorsAndParameterOptions)
          .where(
            notInTuples(
              [
                llmVendorsAndParameterOptions.vendorId,
                llmVendorsAndParameterOptions.parameterOptionId,
              ],
              rows.vendorOptionRows.map((row) =>
                pair(row.vendorId, row.parameterOptionId),
              ),
            ),
          )
          .returning(),
  )
  await drop(
    rows.vendorParameterRows.length === 0
      ? await tx.delete(llmVendorsAndParameters).returning()
      : await tx
          .delete(llmVendorsAndParameters)
          .where(
            notInTuples(
              [
                llmVendorsAndParameters.vendorId,
                llmVendorsAndParameters.parameterId,
              ],
              rows.vendorParameterRows.map((row) =>
                pair(row.vendorId, row.parameterId),
              ),
            ),
          )
          .returning(),
  )
  await drop(
    rows.vendorModelRows.length === 0
      ? await tx.delete(llmVendorsAndModels).returning()
      : await tx
          .delete(llmVendorsAndModels)
          .where(
            notInTuples(
              [llmVendorsAndModels.vendorId, llmVendorsAndModels.modelId],
              rows.vendorModelRows.map((row) =>
                pair(row.vendorId, row.modelId),
              ),
            ),
          )
          .returning(),
  )

  const optionIds = catalog.parameters.flatMap((parameter) =>
    parameter.options.map((option) => option.id),
  )
  removed += await deleteMissingIds(
    tx,
    parameterOptions,
    parameterOptions.id,
    optionIds,
  )
  removed += await deleteMissingIds(
    tx,
    modelParameters,
    modelParameters.id,
    catalog.parameters.map((parameter) => parameter.id),
  )
  removed += await deleteMissingIds(
    tx,
    modelCategories,
    modelCategories.id,
    catalog.categories.map((category) => category.id),
  )
  removed += await deleteMissingIds(
    tx,
    llmModels,
    llmModels.id,
    catalog.models.map((model) => model.id),
  )
  removed += await deleteMissingIds(
    tx,
    llmVendors,
    llmVendors.id,
    catalog.vendors.map((vendor) => vendor.id),
  )
  return removed
}

export async function writeCatalog(mode: CatalogWriteMode) {
  const script = mode === "overwrite" ? "catalog:overwrite" : "catalog:populate"
  const { catalog, errors: loadErrors } = await loadCatalog()
  const errors = [
    ...loadErrors,
    ...validateCatalog(catalog),
    ...validateTrackedModels(catalog),
  ]
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error)
    }
    console.error(
      `${script} aborted: validation failed with ${errors.length} error(s)`,
    )
    process.exit(1)
  }

  if (
    mode === "overwrite" &&
    (catalog.categories.length === 0 ||
      catalog.parameters.length === 0 ||
      catalog.models.length === 0 ||
      catalog.vendors.length === 0)
  ) {
    console.error(
      `${script} aborted: refusing to wipe the catalog tables from an empty file set`,
    )
    process.exit(1)
  }

  try {
    const removed = await db.transaction(async (tx) => {
      if (catalog.categories.length > 0) {
        const query = tx.insert(modelCategories).values(
          catalog.categories.map((category) => ({
            id: category.id,
            name: category.name,
            description: category.description,
          })),
        )
        if (mode === "overwrite") {
          await query.onConflictDoUpdate({
            target: modelCategories.id,
            set: touched(mode, {
              name: excluded("name"),
              description: excluded("description"),
            }),
          })
        } else {
          await query.onConflictDoNothing()
        }
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
            set: touched(mode, {
              key: excluded("key"),
              label: excluded("label"),
              type: excluded("type"),
              description: excluded("description"),
              xUiComponent: excluded("x_ui_component"),
            }),
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
        const query = tx.insert(parameterOptions).values(optionRows)
        if (mode === "overwrite") {
          await query.onConflictDoUpdate({
            target: parameterOptions.id,
            set: touched(mode, {
              parameterId: excluded("parameter_id"),
              label: excluded("label"),
              value: excluded("value"),
              description: excluded("description"),
            }),
          })
        } else {
          await query.onConflictDoNothing()
        }
      }

      if (catalog.models.length > 0) {
        const query = tx.insert(llmModels).values(
          catalog.models.map((model) => ({
            id: model.id,
            provider: model.provider,
            name: model.name,
            description: model.description ?? null,
            promptingTechnics: model.promptingTechnics ?? null,
            selectionGuidance: model.selectionGuidance ?? null,
            pricing: model.pricing as ModelBasePricing | null,
            contextWindow: model.contextWindow,
          })),
        )
        if (mode === "overwrite") {
          await query.onConflictDoUpdate({
            target: llmModels.id,
            set: touched(mode, {
              provider: excluded("provider"),
              name: excluded("name"),
              description: excluded("description"),
              promptingTechnics: excluded("prompting_technics"),
              selectionGuidance: excluded("selection_guidance"),
              pricing: excluded("pricing"),
              contextWindow: excluded("context_window"),
            }),
          })
        } else {
          await query.onConflictDoNothing()
        }
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
        const query = tx
          .insert(modelsAndParameters)
          .values(parameterBindingRows)
        if (mode === "overwrite") {
          await query.onConflictDoUpdate({
            target: [
              modelsAndParameters.modelId,
              modelsAndParameters.parameterId,
            ],
            set: touched(mode, {
              required: excluded("required"),
              sortOrder: excluded("sort_order"),
              defaultValue: excluded("default_value"),
              constraints: excluded("constraints"),
            }),
          })
        } else {
          await query.onConflictDoNothing()
        }
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
        const query = tx.insert(llmVendors).values(
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
        if (mode === "overwrite") {
          await query.onConflictDoUpdate({
            target: llmVendors.id,
            set: touched(mode, {
              name: excluded("name"),
              adapter: excluded("adapter"),
              url: excluded("url"),
              kind: excluded("kind"),
              rateLimit: excluded("rate_limit"),
              circuitConfig: excluded("circuit_config"),
            }),
          })
        } else {
          await query.onConflictDoNothing()
        }
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
        const query = tx.insert(llmVendorsAndModels).values(vendorModelRows)
        if (mode === "overwrite") {
          await query.onConflictDoUpdate({
            target: [llmVendorsAndModels.vendorId, llmVendorsAndModels.modelId],
            set: touched(mode, {
              apiName: excluded("api_name"),
              priority: excluded("priority"),
            }),
          })
        } else {
          await query.onConflictDoNothing()
        }
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
        const query = tx
          .insert(llmVendorsAndParameters)
          .values(vendorParameterRows)
        if (mode === "overwrite") {
          await query.onConflictDoUpdate({
            target: [
              llmVendorsAndParameters.vendorId,
              llmVendorsAndParameters.parameterId,
            ],
            set: touched(mode, {
              vendorParamName: excluded("vendor_param_name"),
              vendorDefaultValue: excluded("vendor_default_value"),
            }),
          })
        } else {
          await query.onConflictDoNothing()
        }
      }

      const vendorOptionRows = catalog.vendors.flatMap((vendor) =>
        Object.values(vendor.parametersMapping).flatMap((mapping) =>
          Object.entries(mapping.optionMapping ?? {}).map(
            ([optionId, option]) => ({
              vendorId: vendor.id,
              parameterOptionId: optionId,
              vendorOptionValue:
                toText(option.mappedValue ?? option.value) ?? "",
            }),
          ),
        ),
      )
      if (vendorOptionRows.length > 0) {
        const query = tx
          .insert(llmVendorsAndParameterOptions)
          .values(vendorOptionRows)
        if (mode === "overwrite") {
          await query.onConflictDoUpdate({
            target: [
              llmVendorsAndParameterOptions.vendorId,
              llmVendorsAndParameterOptions.parameterOptionId,
            ],
            set: touched(mode, {
              vendorOptionValue: excluded("vendor_option_value"),
            }),
          })
        } else {
          await query.onConflictDoNothing()
        }
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
        const query = tx
          .insert(llmVendorModelParameterOverrides)
          .values(overrideRows)
        if (mode === "overwrite") {
          await query.onConflictDoUpdate({
            target: [
              llmVendorModelParameterOverrides.vendorId,
              llmVendorModelParameterOverrides.modelId,
              llmVendorModelParameterOverrides.parameterId,
            ],
            set: touched(mode, {
              vendorParamName: excluded("vendor_param_name"),
            }),
          })
        } else {
          await query.onConflictDoNothing()
        }
      }

      if (mode !== "overwrite") return 0
      return deleteMissing(tx, catalog, {
        categoryRows,
        parameterBindingRows,
        allowedOptionRows,
        vendorModelRows,
        vendorParameterRows,
        vendorOptionRows,
        overrideRows,
      })
    })

    if (mode === "overwrite") {
      console.log(`${script} completed (removed ${removed} stale row(s))`)
    } else {
      console.log(`${script} completed`)
    }
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${script} failed: ${message}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  await writeCatalog("populate")
}
