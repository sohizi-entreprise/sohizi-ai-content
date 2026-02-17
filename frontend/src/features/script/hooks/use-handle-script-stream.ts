import { useMemo } from "react"
import { BlockChunk, ScriptEventLog } from "../type"
import { ScriptStreamCallback, useScriptStream } from "./use-script-stream"
import { useScriptStore } from "../store"


export const useHandleScriptStream = (projectId: string) =>{
    const url = `${import.meta.env.VITE_API_BASE_URL}/ai/script_v2/project/${projectId}`

    const setStreaming = useScriptStore(state => state.setStreaming);
    const addBlockChunk = useScriptStore(state => state.addBlockChunk);
    const upsertEventLog = useScriptStore(state => state.upsertEventLog);
    
    const callbacks: ScriptStreamCallback = useMemo(() => ({
        onAgentChunk: (runId:string, content:Partial<ScriptEventLog>) => {
            upsertEventLog(runId, content)
        },
        onBlockChunk: (data: BlockChunk) => {
            addBlockChunk(data)
        },
        onEnd: () => {
            setStreaming(false)
        },
        onStart: () => {
            setStreaming(true)
        },
        onError: (error: Error) => {
            console.log('onError', error)
        },
    }), [])

    const {startStream, stopStream, isStreaming} = useScriptStream(projectId, url, callbacks)

    return {
        startStream,
        stopStream,
        isStreaming,
    }
}