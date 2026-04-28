import StepMarker from '../components/step-marker'
import Container from '@/components/layout/container'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getProjectOptionsQueryOptions } from '../query-mutation'
import SelectFormat from '../components/select-format'
import NewProjectInput from '../components/new-project-input'

export default function StartProject() {
    const { data } = useSuspenseQuery(getProjectOptionsQueryOptions)
  return (
    <Container className='pt-8 space-y-8'>
        <StepMarker step="01" title="Let's start" description="Every masterpiece begins with a simple thought. Describe yours in detail or just a few sentences." />
        <SelectFormat data={data.formats}/>
        <NewProjectInput />
    </Container>
  )
}
