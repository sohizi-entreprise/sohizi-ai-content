const modelOptions = [
    {
        key: 'resolution',
        label: 'Resolution',
        options: [
            {
                value: '720p',
                label: '720p',
            },
            {
                value: '1080p',
                label: '1080p',
            },
            {
                value: '4K',
                label: '4K',
            },
        ],
        default: '720p',
        provider: 'generic',
    },
    {
        key: 'aspectRatio',
        label: 'Aspect ratio',
        options: [
            {
                value: '1:1',
                label: 'Square 1:1',
            },
            {
                value: '4:3',
                label: 'Standard 4:3',
            },
            {
                value: '16:9',
                label: 'Widescreen 16:9',
            },
            {
                value: '9:16',
                label: 'Portrait 9:16',
            },
        ],
        default: '16:9',
        provider: 'generic',
    },
    {
        key: 'variations',
        label: 'Variations',
        options: [
            {
                value: '1',
                label: '1',
            },
            {
                value: '2',
                label: '2',
            },
            {
                value: '3',
                label: '3',
            },
            {
                value: '4',
                label: '4',
            },
        ],
        default: '1',
        provider: 'generic',
    },
    {
        key: 'duration',
        label: 'Duration',
        options: [
            {
                value: '5s',
                label: '5 seconds',
            },
            {
                value: '10s',
                label: '10 seconds',
            },
            {
                value: '15s',
                label: '15 seconds',
            },
        ],
        default: '5s',
        provider: 'generic',
    },
    {
        key: 'voice',
        label: 'Voice',
        options: [
            {
                value: 'alloy',
                label: 'Alloy',
            },
            {
                value: 'echo',
                label: 'Echo',
            },
            {
                value: 'fable',
                label: 'Fable',
            },
            {
                value: 'onyx',
                label: 'Onyx',
            },
            {
                value: 'nova',
                label: 'Nova',
            }
        ],
        default: 'alloy',
        provider: 'openai',
    },
    {
        key: 'voice',
        label: 'Voice',
        options: [
            {
                value: '',
                label: '',
            }
        ],
        default: '',
        provider: 'gemini',
    },
    
]


const modelsAndOptions = [
    {
        modelId: '',
        optionId: '',
    }
]