import { useNewProjectStore } from "../store/new-project-store"
import { ProjectFormatOption } from "../type"

type Props = {
    data: ProjectFormatOption[]
}

const SelectFormat = ({data}: Props) => {
    const { 
        format, 
        setFormat, 
    } = useNewProjectStore()
    return (
        <div className="flex items-center gap-6">
            {data.map((item) => (
                <FormatItem key={item.id} item={item} isSelected={format === item.id} onClick={() => setFormat(item.id)} />
            ))}
        </div>
    )
}

function FormatItem({item, isSelected, onClick}: {item: ProjectFormatOption, isSelected: boolean, onClick: () => void}) {
    return (
        <div className="flex flex-col gap-1 items-center relative group">
            <div className="size-20 rounded-full hover:scale-110 transition-all flex items-center justify-center bg-white/10" onClick={onClick}>
                <h1 className="text-white">Icon</h1>
            </div>
            <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                {item.name}
            </span>
            {isSelected && (
                <div className="absolute top-2 right-2 size-2 bg-primary rounded-full flex items-center justify-center" />
            )}
        </div>
    )
}

export default SelectFormat