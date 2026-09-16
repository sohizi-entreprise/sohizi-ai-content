import StepMarker from "../components/step-marker"
import NewProjectInput from "../components/new-project-input"
import Container from "@/components/layout/container"

export default function StartProject() {
  return (
    <Container className="space-y-8">
      <StepMarker
        step="From an idea"
        title="Let's start a project"
        description="Every masterpiece begins with a simple thought. Describe yours in detail or just a few sentences."
      />
      <NewProjectInput />
    </Container>
  )
}
