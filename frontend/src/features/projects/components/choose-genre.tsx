import { IconBolt, IconMasksTheater, IconMoodSmile, IconRocket, IconSkull } from '@tabler/icons-react'
import { ReactNode } from 'react'

type GenreItemType = {
    img: string
    label: string
    icon: ReactNode
    onClick: () => void
}

type GenreProps = {
    onSelect?: (value: string) => void
}


export default function ChooseGenre(props: GenreProps) {
    const { onSelect } = props
    const genres = getGenres()
  return (
    <div className="flex gap-4">
        {
            genres.map((genre) => (
                <GenreItem key={genre.value} {...genre} onClick={() => onSelect?.(genre.value)} />
            ))
        }
    </div>
  )
}

function GenreItem(props: GenreItemType){

    const {label, icon, onClick, img} = props

    return (
        <button onClick={onClick} className="group relative w-40 aspect-3/4 rounded-2xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark bg-surface-dark">
            <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent z-10"></div>
            <img alt={label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100" src={img}/>
            <div className="absolute bottom-4 left-4 z-20 text-left">
                {icon}
                <h3 className="font-semibold text-white">{label}</h3>
            </div>
            <div className="absolute top-3 right-3 z-20 opacity-0 group-focus:opacity-100 transition-opacity">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <span className="material-icons-outlined text-black text-sm font-bold">check</span>
                </div>
            </div>
        </button>
    )
}


function getGenres(){

    const iconClassName = 'text-primary size-5'

    return [
        {
            value: 'sci-fi',
            label: 'Sci-Fi',
            icon: <IconRocket className={iconClassName}/>,
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDVRTNmr-8JPCShdhoNaZg5rsaxN3SwIHBICa08_hCjWh20yxWYhlVR-40_Fi9X2f84kF2bAHOORgMA5FYiyPmeKBcCQ6-7pQLSC-XrKq9m6hVyG2lmigMVaHj_9o5WV51OVXn0fejI9tn5a6ke3h4W4cK-jeVefjHVpkou8oKJqNNOcMSsIbQh8-kGJU5ExTkVDEpG7P373It7ErrGuOk75E0F_-91zTPi6MU7-197PIbU4iqTExXsufpSEWZ0rUkCe8tfRD-ekQ',
        },
        {
            value: 'horror',
            label: 'Horror',
            icon: <IconSkull className={iconClassName}/>,
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB8Wc_oK4rdrooeZ0WHsNIcqRD0C6dQp2-OzC1gBjDTJLEgVEiwrdwuynLKhXyhGHn0QPkBfLfvDhDiQf-K6nqSeTYYlKowEodqoa3foBjAPJATFIalGY67pEKuHZwhilhIRjqb1veYzj3fK_0dZuTOPWAjnBNjzrAq709lT05G0uXnkz6dC7ctDLg04pI_EvqjrD5Ub1ewNkcUvDiWLG2ULiPJSpsKmRjj8u1XDFsXHzQOOLm9Bm7LW8PXP8qaKkaoUGfjpgWYeQ',
        },
        {
            value: 'action',
            label: 'Action',
            icon: <IconBolt className={iconClassName}/>,
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAl2u2xnht2wvnuYUwO40YYFrbauOL8fdAY1UU_COZWA40OcrxVamG43TdgZI732aPTTUfLA_YdilMGRRcrxJhrTX5fmOB_-7DamJzfcK_P8Adgl3uJnoNmDuFyEgtWcsESWDAKPQrE6P87hYHkJu0C1PCX5mugBwYlzpfSSFZ3VijfI8sMX82_-qA7pTiXt_OcwVqUvcLXhEADqSOdvd27RHd9jcSltmexO5ANC5Uw_jT9YvHH5vLOA0cdGOHlfX2DCbVK_Xz65g',
        },
        {
            value: 'drama',
            label: 'Drama',
            icon: <IconMasksTheater className={iconClassName}/>,
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDp3TcFYN98B1TTelWjUBnbJ1j_2QcQJtAjeyU7K9duYerugnRzCNe9fH_0Njbbjz7egJi4PP-bPmEf4N9y6qmx3zm-9YhGhPg1scW216RfKeR_re0cBx7Gaw-DIc3xn6WVShRJKFVW_4-8sN9O6R7SnG8w7aNBXA9Jrfs5U3LTErLH0VT3CVc2R0SP1ssPsSnnPNbofi1amC_3Yk_aT1ep4LZmjSnOI1SMTS9FZonGwnLcLUZpB8pzjmD6SkxkQbzVYCnUNTKHDA',
        },
        {
            value: 'comedy',
            label: 'Comedy',
            icon: <IconMoodSmile className={iconClassName}/>,
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAl2u2xnht2wvnuYUwO40YYFrbauOL8fdAY1UU_COZWA40OcrxVamG43TdgZI732aPTTUfLA_YdilMGRRcrxJhrTX5fmOB_-7DamJzfcK_P8Adgl3uJnoNmDuFyEgtWcsESWDAKPQrE6P87hYHkJu0C1PCX5mugBwYlzpfSSFZ3VijfI8sMX82_-qA7pTiXt_OcwVqUvcLXhEADqSOdvd27RHd9jcSltmexO5ANC5Uw_jT9YvHH5vLOA0cdGOHlfX2DCbVK_Xz65g',
        },
    ]
}