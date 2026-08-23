import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listCatalogModelParametersQueryOptions } from '../query-mutations'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import { ModelParameterBinding } from '@/features/admin/types'
import { parseParameterAssetUrls } from '../lib/parameter-assets'

export function useModelParameters() {
  const selectedModelId = useMediaGeneratorStore((state) => state.selectedModelId)
  const parameterValues = useMediaGeneratorStore((state) => state.parameterValues)
  const setParameterValues = useMediaGeneratorStore((state) => state.setParameterValues)
  const initializedFor = useRef<string | null>(null)

  const parametersQuery = useQuery(listCatalogModelParametersQueryOptions(selectedModelId))

  useEffect(() => {
    if (!selectedModelId) {
      initializedFor.current = null
      return
    }

    if (parametersQuery.isFetching || !parametersQuery.data) return
    if (initializedFor.current === selectedModelId) return

    initializedFor.current = selectedModelId
    if (Object.keys(parameterValues).length > 0) return

    setParameterValues(
      Object.fromEntries(
        parametersQuery.data.map((parameter) => [
          parameter.key,
          parameter.defaultValue || parameter.options[0]?.value || '',
        ]),
      ),
    )
  }, [parameterValues, parametersQuery.data, parametersQuery.isFetching, selectedModelId, setParameterValues])

  return {
    parameters: parametersQuery.data ?? [],
    isLoadingParameters: Boolean(selectedModelId) && parametersQuery.isLoading,
  }
}


export function useValidateParameterValues() {

  const [errors, setErrors] = useState<Record<string, string>>({})

  const parameterValues = useMediaGeneratorStore((state) => state.parameterValues)

  const assignError = (key: string, message: string) => {
    setErrors((prev) => ({ ...prev, [key]: message }))
  }

  const resetErrors = useCallback(() => {
    setErrors({})
  }, [])
  
  const validate = useCallback((parameters: ModelParameterBinding[]) => {
    let errorMsg: string | null = null
    parameters.forEach((parameter) => {
      const value = parameterValues[parameter.key]
      const constraint = parameter.constraints ?? {}
  
      const parameterType = parameter.type
  
      if (parameter.required) {
        const missing = parameter.xUiComponent === 'uploader'
          ? parseParameterAssetUrls(typeof value === 'string' ? value : '').length === 0
          : !value
        if (missing) {
          errorMsg = 'This field is required'
          assignError(parameter.key, errorMsg)
        }
      }
  
      if (parameterType === 'number'){
        const numberValue = Number(value)
        if (isNaN(numberValue)) {
          errorMsg = 'This field must be a number'
          assignError(parameter.key, errorMsg)
        }
        if (constraint.min && numberValue < constraint.min) {
          errorMsg = `This field must be greater than ${constraint.min}`
          assignError(parameter.key, errorMsg)
        }
        if (constraint.max && numberValue > constraint.max) {
          errorMsg = `This field must be less than ${constraint.max}`
          assignError(parameter.key, errorMsg)
        }
      }
  
      if(parameterType === 'boolean'){
        if(typeof value !== 'boolean'){
          errorMsg = 'This field must be a boolean'
          assignError(parameter.key, errorMsg)
        }
      }
  
      if(parameterType === 'array<string>' || parameterType === 'array<number>'){
        const parsed = parseArrayValue(value)
        if(parsed){
          if(constraint.min && parsed.length < constraint.min) {
            errorMsg = `This field must be greater than ${constraint.min}`
            assignError(parameter.key, errorMsg)
          }
          if(constraint.max && parsed.length > constraint.max) {
            errorMsg = `This field must be less than ${constraint.max}`
            assignError(parameter.key, errorMsg)
          }
        }
        else {
          errorMsg = 'This field must be an array'
          assignError(parameter.key, errorMsg)
        }
      }
    })

    if (errorMsg) {
      return false
    }

    return true

  }, [parameterValues])


  return { errors, validate, resetErrors }
}

function parseArrayValue(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (value == null || value === '') return []
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}
