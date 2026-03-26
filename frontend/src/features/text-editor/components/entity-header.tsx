import { cn } from "@/lib/utils"
import { NodeViewWrapper, ReactNodeViewProps } from "@tiptap/react"


const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    protagonist: { bg: 'bg-green-500/20', text: 'text-green-600' },
    antagonist: { bg: 'bg-red-500/20', text: 'text-red-400' },
    supporting: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    minor: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
}

export const CharacterHeaderComponent = (props: ReactNodeViewProps) => {

    const {name, role, age, thumbnail} = props.node.attrs

    const handleChange = (field: string, value: string) => {
        props.updateAttributes({
            [field]: value
        })
    }
    const handleChangeRole = (e: React.ChangeEvent<HTMLSelectElement>) => {
        handleChange('role', e.target.value)
    }
    const handleChangeName = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleChange('name', e.target.value)
    }
    const handleChangeAge = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleChange('age', e.target.value)
    }

    const placeHolder = '/imgPlaceholder.jpeg'

    return (
        <NodeViewWrapper className="flex gap-6 my-6 text-black">
            <div className="size-30 rounded-lg overflow-hidden">
                <img src={thumbnail || placeHolder} alt={name} className="w-full h-full object-cover" />
            </div>

            <div className="flex flex-col gap-4 flex-1 border-b border-gray-300">
                <div className="flex items-start">
                    <input type="text" 
                           value={name} 
                           onChange={handleChangeName} 
                           className="text-3xl font-bold flex-1"
                           placeholder="Character name..."
                    />
                    <span className={cn('uppercase py-1 px-2 text-sm font-semibold', ROLE_COLORS[role ].bg, ROLE_COLORS[role].text)}>
                        {role}
                    </span>
                </div>
                <div className="flex gap-8">
                    <div className="space-x-2">
                        <span className="text-sm text-green-600 font-semibold uppercase tracking-wider">AGE</span>
                        <input type="number" value={age} onChange={handleChangeAge} className="text-base w-20" />
                    </div>
                    <div className="space-x-2">
                        <span className="text-sm text-green-600 font-semibold uppercase tracking-wider">ROLE</span>
                        <select value={role} onChange={handleChangeRole} className="text-base">
                            <option value="protagonist">Protagonist</option>
                            <option value="antagonist">Antagonist</option>
                            <option value="supporting">Supporting</option>
                            <option value="minor">Minor</option>
                        </select>
                    </div>
                </div>
            </div>
        </NodeViewWrapper>
    )
}


export const EntityHeaderComponent = (props: ReactNodeViewProps) => {

    const {name, thumbnail, entityType} = props.node.attrs

    const handleChange = (field: string, value: string) => {
        props.updateAttributes({
            [field]: value
        })
    }
    const handleChangeName = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleChange('name', e.target.value)
    }

    const placeHolder = '/imgPlaceholder.jpeg'

    return (
        <NodeViewWrapper className="flex gap-6 my-6 text-black">
            <div className="size-30 rounded-lg overflow-hidden">
                <img src={thumbnail || placeHolder} alt={name} className="w-full h-full object-cover" />
            </div>

            <div className="flex flex-col gap-4 flex-1 border-b border-gray-300">
                <div className="flex items-start">
                    <input type="text" 
                           value={name} 
                           onChange={handleChangeName} 
                           className="text-3xl font-bold flex-1"
                           placeholder={`${entityType} name...`}
                    />
                    <span className='uppercase py-1 px-2 text-sm font-semibold text-purple-600 bg-purple-500/20'>
                        {entityType || 'Unknown'}
                    </span>
                </div>
            </div>
        </NodeViewWrapper>
    )
}