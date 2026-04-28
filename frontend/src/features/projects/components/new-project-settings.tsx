import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog"
import { IconProps, IconPuzzle, IconSettings, IconX, IconMoodSmile, IconUsers, IconBrandYoutube, IconListTree, IconBook, IconAspectRatio, IconUserSquare } from "@tabler/icons-react"
import { Label } from "@/components/ui/label"
import { ForwardRefExoticComponent, RefAttributes, useState } from "react"
import { AdditionalSettings, SettingOption, useNewProjectStore } from "../store/new-project-store"

type OptionProps = {
    onSelect: (value: string) => void
    selectedValue: SettingOption | null
}

type SettingConfig = {
    label: string
    storeKey: keyof AdditionalSettings
    component: React.ComponentType<OptionProps>
    icon: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>
}

const settings: SettingConfig[] = [
    {label: 'Genre', storeKey: 'genre', component: SelectGenre, icon: IconPuzzle},
    {label: 'Tone', storeKey: 'tone', component: SelectTone, icon: IconMoodSmile},
    {label: 'Target Audience', storeKey: 'targetAudience', component: SelectAudience, icon: IconUsers},
    {label: 'Primary Platform', storeKey: 'primaryPlatform', component: SelectPlatform, icon: IconBrandYoutube},
    {label: 'Outline Structure', storeKey: 'outlineStructure', component: OutlineStructure, icon: IconListTree},
    {label: 'Narrative Style', storeKey: 'narrativeStyle', component: NarrativeStyle, icon: IconBook},
    {label: 'Video Aspect Ratio', storeKey: 'videoAspectRatio', component: VideoAspectRatio, icon: IconAspectRatio},
    {label: 'Character Style', storeKey: 'characterStyle', component: CharacterStyle, icon: IconUserSquare},
]

export default function NewProjectSettings() {
    const [selectedSetting, setSelectedSetting] = useState<string>(settings[0].label)
    const { setAdditionalSetting, additionalSettings } = useNewProjectStore()
    
    const onSettingChange = (label: string)=>{
        return () => {
            setSelectedSetting(label)
        }
    }
    const content = settings.find((setting) => setting.label === selectedSetting)!
    const currentValue = additionalSettings[content.storeKey]
    
    const handleSelect = (label: string) => {
        return (value: string) => {
            setAdditionalSetting(content.storeKey, {label, value})
        }
    }

  return (
    <Dialog>
        <DialogTrigger asChild>
            <Button variant="outline" className="border dark:border-white/10">
                <IconSettings className="size-4" />
                Configure
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-6xl h-[80%] max-h-[800px] bg-gray-800 p-0 rounded-xl" showCloseButton={false}>
            <DialogDescription className="sr-only">Projects settings</DialogDescription>
            <div className="flex gap-4 h-full min-h-0">
                <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-l-xl overflow-y-auto overscroll-y-none">
                    <DialogHeader>
                        <DialogTitle>Project Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {settings.map((setting) => (
                            <div key={setting.label} className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-200/10 rounded-lg cursor-pointer"
                                    onClick={onSettingChange(setting.label)}
                            >
                                {<setting.icon className="size-4" />}
                                {setting.label}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    <div className="space-y-4">
                        <content.component onSelect={handleSelect(content.label)} selectedValue={currentValue} />
                    </div>
                </div>
                
            </div>

            <div className="absolute -top-8 -right-8">
                <DialogClose asChild>
                    <Button size="icon" className="border dark:border-gray-700 rounded-full">
                        <IconX className="size-4" />
                    </Button>
                </DialogClose>
            </div>

        </DialogContent>
    </Dialog>
  )
}

type RenderSettingsProps = OptionProps & {
    setting: string
    options: {label: string, value: string}[]
}

function RenderSettings({ onSelect, options, setting, selectedValue }: RenderSettingsProps){

    const handleClick = (option: SettingOption) => {
        onSelect(option.value)
    }

    return (
        <div className="space-y-4">
            <Label>{setting.toUpperCase()}</Label>
            <div className="grid grid-cols-4 gap-4">
                {options.map((opt) => (
                    <SettingItem key={opt.value} label={opt.label} value={opt.value} onClick={handleClick} isSelected={opt.value === selectedValue?.value} />
                ))}
            </div>
        </div>
    )
}

function SelectGenre({ onSelect, selectedValue }: OptionProps){

    const genres = [
        {label: 'Drama', value: 'drama'},
        {label: 'Comedy', value: 'comedy'},
        {label: 'Thriller', value: 'thriller'},
        {label: 'Horror', value: 'horror'},
        {label: 'Romance', value: 'romance'},
        {label: 'Sci-Fi', value: 'sci-fi'},
        {label: 'Fantasy', value: 'fantasy'},
        {label: 'Action', value: 'action'},
        {label: 'Mystery', value: 'mystery'},
    ]

    return (
        <RenderSettings onSelect={onSelect} options={genres} setting="Genre" selectedValue={selectedValue} />
    )
}

function SelectTone({ onSelect, selectedValue }: OptionProps){
    const tones = [
        {label: 'Serious', value: 'serious'},
        {label: 'Lighthearted', value: 'lighthearted'},
        {label: 'Dark', value: 'dark'},
        {label: 'Humorous', value: 'humorous'},
        {label: 'Inspirational', value: 'inspirational'},
        {label: 'Suspenseful', value: 'suspenseful'},
        {label: 'Melancholic', value: 'melancholic'},
        {label: 'Uplifting', value: 'uplifting'},
        {label: 'Satirical', value: 'satirical'},
    ]

    return (
        <RenderSettings onSelect={onSelect} options={tones} setting="Tone" selectedValue={selectedValue} />
    )
}

function SelectAudience({ onSelect, selectedValue }: OptionProps){
    const audiences = [
        {label: 'Children (5-12)', value: 'children'},
        {label: 'Teens (13-17)', value: 'teens'},
        {label: 'Young Adults (18-25)', value: 'young-adults'},
        {label: 'Adults (26-45)', value: 'adults'},
        {label: 'Mature (46+)', value: 'mature'},
        {label: 'Family', value: 'family'},
        {label: 'General', value: 'general'},
    ]

    return (
        <RenderSettings onSelect={onSelect} options={audiences} setting="Target Audience" selectedValue={selectedValue} />
    )
}


function SelectPlatform({ onSelect, selectedValue }: OptionProps){
    const platforms = [
        {label: 'YouTube', value: 'youtube'},
        {label: 'TikTok', value: 'tiktok'},
        {label: 'Instagram Reels', value: 'instagram-reels'},
        {label: 'Facebook', value: 'facebook'},
        {label: 'Twitter/X', value: 'twitter'},
        {label: 'LinkedIn', value: 'linkedin'},
        {label: 'Podcast', value: 'podcast'},
        {label: 'Streaming (Netflix, etc.)', value: 'streaming'},
        {label: 'Cinema', value: 'cinema'},
    ]

    return (
        <RenderSettings onSelect={onSelect} options={platforms} setting="Primary Platform" selectedValue={selectedValue} />
    )
}

function NarrativeStyle({ onSelect, selectedValue }: OptionProps){
    const styles = [
        {label: 'First Person', value: 'first-person'},
        {label: 'Third Person Limited', value: 'third-person-limited'},
        {label: 'Third Person Omniscient', value: 'third-person-omniscient'},
        {label: 'Documentary', value: 'documentary'},
        {label: 'Voiceover', value: 'voiceover'},
        {label: 'Interview', value: 'interview'},
        {label: 'Stream of Consciousness', value: 'stream-of-consciousness'},
        {label: 'Epistolary', value: 'epistolary'},
    ]

    return (
        <RenderSettings onSelect={onSelect} options={styles} setting="Narrative Style" selectedValue={selectedValue} />
    )
}

function OutlineStructure({ onSelect, selectedValue }: OptionProps){
    const structures = [
        {label: 'Three-Act Structure', value: 'three-act'},
        {label: 'Five-Act Structure', value: 'five-act'},
        {label: "Hero's Journey", value: 'heros-journey'},
        {label: 'Save the Cat', value: 'save-the-cat'},
        {label: 'Nonlinear', value: 'nonlinear'},
        {label: 'Episodic', value: 'episodic'},
        {label: 'Circular', value: 'circular'},
        {label: 'Parallel', value: 'parallel'},
        {label: 'Freeform', value: 'freeform'},
    ]

    return (
        <RenderSettings onSelect={onSelect} options={structures} setting="Outline Structure" selectedValue={selectedValue} />
    )
}

function VideoAspectRatio({ onSelect, selectedValue }: OptionProps){
    const ratios = [
        {label: '16:9 (Landscape)', value: '16:9'},
        {label: '9:16 (Portrait/TikTok)', value: '9:16'},
        {label: '1:1 (Square)', value: '1:1'},
        {label: '4:3 (Classic)', value: '4:3'},
        {label: '21:9 (Cinematic)', value: '21:9'},
        {label: '4:5 (Instagram Portrait)', value: '4:5'},
        {label: '2.39:1 (Anamorphic)', value: '2.39:1'},
    ]

    return (
        <RenderSettings onSelect={onSelect} options={ratios} setting="Video Aspect Ratio" selectedValue={selectedValue} />
    )
}

function CharacterStyle({ onSelect, selectedValue }: OptionProps){
    const styles = [
        {label: '3D Pixar Style', value: '3d-pixar'},
        {label: '3D Realistic', value: '3d-realistic'},
        {label: '2D Anime', value: '2d-anime'},
        {label: '2D Cartoon', value: '2d-cartoon'},
        {label: 'Claymation', value: 'claymation'},
        {label: 'Stop Motion', value: 'stop-motion'},
        {label: 'Watercolor', value: 'watercolor'},
        {label: 'Comic Book', value: 'comic-book'},
        {label: 'Minimalist', value: 'minimalist'},
        {label: 'Retro/Vintage', value: 'retro'},
        {label: 'Studio Ghibli', value: 'studio-ghibli'},
        {label: 'Disney Classic', value: 'disney-classic'},
    ]

    return (
        <RenderSettings onSelect={onSelect} options={styles} setting="Character Style" selectedValue={selectedValue} />
    )
}

type SettingItemProps = {
    label: string
    value: string
    img?: string
    onClick: (option: SettingOption) => void
    isSelected?: boolean
}

function SettingItem({ label, value, onClick, img, isSelected }: SettingItemProps){
    const source = img ?? `/imgPlaceholder.jpeg`
    return (
        <button className="cursor-pointer duration-300 space-y-2 group"
                onClick={() => onClick({ label, value })}
        >
            <div className={`flex justify-center items-center bg-gray-200 rounded-xl overflow-hidden aspect-4/3 group-hover:scale-105 transition-all duration-300 ring-2 ${isSelected ? 'ring-primary ring-offset-2 ring-offset-gray-800' : 'ring-transparent'}`}>
                <img className="w-1/2 object-contain" src={source} alt={label} />
            </div>
            <Label className={`text-base transition-all duration-300 ${isSelected ? 'text-primary font-semibold' : 'group-hover:text-primary'}`}>{label}</Label>
        </button>
    )
}

