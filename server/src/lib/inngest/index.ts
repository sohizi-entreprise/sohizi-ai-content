import { handleConceptGeneration, 
         handleStoryBibleGeneration, 
         handleEntityGeneration, 
         handleSceneGeneration, 
         handleSynopsisGeneration 
        } from './functions'

export {inngest} from './client'

export {  eventNameMap } from './functions'

export const functions = [
    handleConceptGeneration,
    handleSynopsisGeneration,
    handleStoryBibleGeneration,
    handleEntityGeneration,
    handleSceneGeneration,
]

