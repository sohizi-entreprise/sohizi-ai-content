export const projectFormats = [
    {
        id: "storytime",
        name: "Storytime",
        description: "Narrative-driven content with a storytelling focus",
    },
    {
        id: "explainer",
        name: "Explainer",
        description: "Educational content that breaks down complex topics",
    },
    {
        id: "documentary",
        name: "Documentary",
        description: "In-depth exploration of real-world subjects",
    },
    {
        id: "presenter",
        name: "Presenter",
        description: "Host-led content with direct audience engagement",
    },
] as const

export const projectGenres = [
    {
        id: "drama",
        name: "Drama",
        description: "Emotionally driven narratives exploring human experiences",
        image: "https://storage.googleapis.com/sohizi-content/genres/drama.avif",
    },
    {
        id: "comedy",
        name: "Comedy",
        description: "Light-hearted content designed to entertain and amuse",
        image: "https://storage.googleapis.com/sohizi-content/genres/comedy.avif",
    },
    {
        id: "thriller",
        name: "Thriller",
        description: "Suspenseful stories that keep viewers on edge",
        image: "https://storage.googleapis.com/sohizi-content/genres/thriller.avif",
    },
    {
        id: "horror",
        name: "Horror",
        description: "Content designed to frighten and unsettle",
        image: "https://storage.googleapis.com/sohizi-content/genres/horror.avif",
    },
    {
        id: "romance",
        name: "Romance",
        description: "Stories centered on love and relationships",
        image: "https://storage.googleapis.com/sohizi-content/genres/romance.avif",
    },
    {
        id: "sci-fi",
        name: "Science Fiction",
        description: "Futuristic and speculative narratives",
        image: "https://storage.googleapis.com/sohizi-content/genres/sci_fi.avif",
    },
    {
        id: "fantasy",
        name: "Fantasy",
        description: "Magical worlds and mythical adventures",
        image: "https://storage.googleapis.com/sohizi-content/genres/fantasy.avif",
    },
    {
        id: "action",
        name: "Action",
        description: "High-energy content with physical conflict",
        image: "https://storage.googleapis.com/sohizi-content/genres/action.avif",
    },
    {
        id: "mystery",
        name: "Mystery",
        description: "Puzzle-driven narratives with secrets to uncover",
        image: "https://storage.googleapis.com/sohizi-content/genres/mystery.avif",
    },
    {
        id: "documentary",
        name: "Documentary",
        description: "Non-fiction explorations of real subjects",
        image: "https://storage.googleapis.com/sohizi-content/genres/documentary.avif",
    },
] as const

export const projectDuration = {
    min: 1,
    max: 15,
    presets: [
        { id: "short", name: "Short", minutes: 5, description: "Quick, snackable content" },
        { id: "medium", name: "Medium", minutes: 15, description: "Standard format" },
        { id: "long", name: "Long", minutes: 30, description: "In-depth exploration" },
        { id: "feature", name: "Feature", minutes: 60, description: "Full-length content" },
    ],
} as const

export const projectTones = [
    {
        id: "dark",
        name: "Dark",
        description: "Serious, heavy, and intense atmosphere",
    },
    {
        id: "light",
        name: "Light",
        description: "Uplifting, cheerful, and optimistic",
    },
    {
        id: "suspenseful",
        name: "Suspenseful",
        description: "Tension-building and anxiety-inducing",
    },
    {
        id: "emotional",
        name: "Emotional",
        description: "Heart-touching and sentiment-driven",
    },
    {
        id: "humorous",
        name: "Humorous",
        description: "Witty, funny, and entertaining",
    },
    {
        id: "inspiring",
        name: "Inspiring",
        description: "Motivational and uplifting",
    },
    {
        id: "melancholic",
        name: "Melancholic",
        description: "Reflective and bittersweet",
    },
    {
        id: "whimsical",
        name: "Whimsical",
        description: "Playful, quirky, and imaginative",
    },
    {
        id: "gritty",
        name: "Gritty",
        description: "Raw, realistic, and unpolished",
    },
    {
        id: "ethereal",
        name: "Ethereal",
        description: "Dreamy, otherworldly, and mystical",
    },
] as const

export const projectAudiences = [
    {
        id: "general",
        name: "General",
        description: "Suitable for all ages",
        ageRange: "All ages",
    },
    {
        id: "kids",
        name: "Kids",
        description: "Content designed for children",
        ageRange: "4-12",
    },
    {
        id: "teens",
        name: "Teens",
        description: "Content for teenage audiences",
        ageRange: "13-17",
    },
    {
        id: "young-adult",
        name: "Young Adult",
        description: "Content for young adults",
        ageRange: "18-25",
    },
    {
        id: "adult",
        name: "Adult",
        description: "Mature content for adult audiences",
        ageRange: "18+",
    },
] as const

// Type exports
export type ProjectFormat = (typeof projectFormats)[number]
export type ProjectGenre = (typeof projectGenres)[number]
export type ProjectTone = (typeof projectTones)[number]
export type ProjectAudience = (typeof projectAudiences)[number]
export type ProjectDurationPreset = (typeof projectDuration.presets)[number]
