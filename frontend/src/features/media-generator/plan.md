Let's build a media generator feature where users can generate images, videos and audio using a LLM.
Put all the code inside `frontend/src/features/media-generator`

We have 2 main parts you need to implement:
1. The media setting. That should be a button on the left bottom side of the main chat input. When it's clicked a dialog opens with different settings depending on the type of media users want to generate.
2. A media viewer where users can view a grid list of media they've generated so far.


1. Media settings

- At the very top of the dialog we should have a tab style where we can select the type of media [image, video, audio]
- Settings for image : model type, duration, resolution, aspect ratio
- Image settings: model type, number variations (1-4), camera angle, resolution, aspect ratio
- Audio: model, voice, voice control [speed, stability]

2. Media Viewer

All the top let's have a tab style filter to show only the media base on their type. Filters: All, Images, Videos, Audio

- The content is rendered in a grid list
- Each media card should be rendered depending on its type.
- For each card, let's have its title display on the bottom (overlay dark gradient to show white text) and a drop down menu
- The drop down menu should have the following actions: delete, move to file.
- For image item card, when we click, it should open the image in big for preview and its other variations on the button [if any]. This should act like a carousel.
- For the image item card, by default we are showing the first variant, and a tag or badge that show the number of variations [only if variation > 1]
- For video, by clicking it should open the video in big [same dimension as image preview dialog] and auto play
- For Audio - No need of a preview dialog. Just render a play button which should start playing the audio.