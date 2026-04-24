Act as an expert frontend developer and UX/UI designer. I want to build a React application for an AI-powered mini-video production editor. The app takes users from ideation to a production-ready video. The UI should strictly follow a minimalist, modern aesthetic similar to VS Code, utilizing Tailwind CSS for styling and Lucide React or Tabler icons for icons.

Please generate the React code for this application, breaking it down into modular components. 
Put all the components in the current folder (editor).

### 1. Overall Layout & Architecture
The application must feature a full-width, full-height layout divided into distinct resizable areas. Please use `react-resizable-panels` to handle the drag-to-resize functionality between these main sections:
*   **Top:** Global Navigation Bar.
*   **Left:** Activity Bar (icons) + File Explorer panel.
*   **Center:** Main Editor Workspace (Tabs + Content).
*   **Right:** AI Assistant Panel.

### 2. Component Details

**A. Top Navigation Bar**
*   Left: App Logo (Sohizi AI) and Project Title dropdown.
*   Right: User avatar and an "dark/light" mode toggle.

**B. Left Sidebar (Activity Bar & File Explorer)**
*   **Activity Bar:** A narrow vertical strip on the far left with icons (Files, Search, Settings, etc.). With floating glasmorphism effect.
*   **File Explorer Panel:** Resizable panel containing the project file tree.
*   **Requirement:** Use the `react-arborist` package to render a sortable, collapsible file tree. Include generic file icons based on extensions (e.g., `.txt`, `.vid`, `.md`).

**C. Main Editor Workspace (Center)**
*   **Tabs Management:** Use the `rc-tabs` package. Tabs must be draggable and sortable. 
*   **Tab Features:** Each tab needs a close ('x') button and a small dropdown menu icon (to move the tab to a different pane).
*   **Split Panes:** Implement the ability to split the center screen into two panels (Left and Right) to view files side-by-side. 
*   **Dynamic Content Routing:** The content area below the tabs should render different components based on the active file's extension:
    *   *If a text/document file is open:* Render the **Text Editor View**.
    *   *If a video/project file is open:* Render the **Video Storyboard View**.

**D. Text Editor View (Using Tiptap)**
*   **Requirement:** Integrate the `@tiptap/react` package.
*   **UI:** A clean, minimalist document-editing interface (resembling modern writing apps). 
*   **Toolbar:** A floating or fixed toolbar at the top of the editor pane with standard rich text settings (Heading 1/2/3, Bold, Italic, Underline, Link, Bullet List, Undo/Redo).

**E. Video Storyboard View**
*   A complex internal layout representing video editing.
*   **Top Left (Captions/Script):** A vertical list of editable text blocks/captions with timestamps.
*   **Top Right (Preview):** A video player placeholder with a prominent play button and controls.
*   **Bottom (Timeline):** A horizontal timeline spanning the width of the pane, showing multi-track layers (Video, Text, Audio) with segmented clips.

**F. Right AI Assistant Panel**
*   A resizable sidebar on the right.
*   **Header:** Title ("AI Assistance") and icon buttons for "Chat History" and "New Chat".
*   **Body:** A chat interface layout. Display a mock "Reasoning" or "Design System" output block to show how the AI structures its responses.
*   **Footer:** A sticky input field to "Ask a follow-up..." with submit/action icons.

### 3. Tech Stack & Implementation Rules
*   Use **React (Functional components & Hooks)**.
*   Use **Tailwind CSS** for all styling. Ensure a cohesive dark-mode theme by default, matching a sleek IDE vibe.
*   Use **Lucide React** (`lucide-react` or Tabler icon) for all UI icons.
*   Use `react-resizable-panels` for the layout shell.
*   Use `react-arborist` for the file tree.
*   Use `rc-tabs` for the center tabs.
*   Use `tiptap` for the text editor.

### 4. Output Generation Strategy
Since this is a complex application, please output the code in logical steps:
1.  **Step 1:** The main `AppLayout` component and the `react-resizable-panels` shell.
2.  **Step 2:** The `Sidebar` and `FileTree` components.
3.  **Step 3:** The `EditorWorkspace` including the `rc-tabs` setup and split-pane logic.
4.  **Step 4:** The `TiptapEditor` and `VideoStoryboard` content components.
5.  **Step 5:** The `AIAssistant` panel.

Provide all necessary boilerplate state (mock files, mock tabs, mock chat history) so the UI renders fully functional right away. Use placeholder divs with distinct background colors or borders if necessary for complex sub-components like the timeline, but make the styling look as close to a production-ready modern IDE as possible.
