# 📸 AI Scanning Feature - Album Creation

## Overview

The refactored `CreateAlbumPage` now provides a clean, step-by-step flow for creating albums with two methods of initialization:

### **Method 1: Manual Configuration** ✏️
Define your stickers manually through:
- **Range**: Set start/end numbers with optional prefix (e.g., 1-500 with prefix "Sticker")
- **List**: Parse a text list in format `number|name|category`
- **Groups/Prefixes**: Define sections like `t1-20`, `e1-40`, `61-100`

### **Method 2: AI Image Scanning** 📷
Upload a photo of your album's grid template and let Gemini automatically:
- Detect sticker sections and prefixes
- Extract all sticker numbers
- Build the album structure automatically

---

## User Flow

```
┌─────────────────────────────────────────┐
│  STEP 1: BASIC INFORMATION              │
│                                         │
│  • Album Title (required)               │
│  • Description (optional)               │
│  • Cover Image URL (optional)           │
│                                         │
│  [Continue Button →]                    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  STEP 2: CHOOSE LOAD METHOD             │
│                                         │
│  ┌─────────────────┐  ┌──────────────┐  │
│  │ ✏️ MANUAL       │  │ 📷 AI SCAN   │  │
│  │ Configuration   │  │ with Photo   │  │
│  │                 │  │              │  │
│  │ Select method & │  │ Upload grid  │  │
│  │ input stickers  │  │ photo →      │  │
│  └─────────────────┘  │ Auto-detect  │  │
│                       └──────────────┘  │
│                                         │
│  [Back] [Create Album & Open] →         │
└─────────────────────────────────────────┘
```

---

## Step 1: Basic Information

The first step is simple and focused:

```
┌────────────────────────────────────────┐
│ Crear nuevo álbum                      │
│ Completa la información básica         │
│                                        │
│ Título del álbum *                     │
│ [Input: Liga Local 2026]               │
│                                        │
│ Descripción (opcional)                 │
│ [Textarea: Liga de fútbol local...]    │
│                                        │
│ Imagen de portada (URL opcional)       │
│ [Input: https://...]                   │
│                                        │
│                    [Continuar →]       │
└────────────────────────────────────────┘
```

**Validation:**
- Album title is required
- Description and cover image are optional
- Clicking "Continuar" advances to Step 2

---

## Step 2a: Manual Configuration

When the user selects **✏️ Manual Configuration**:

```
┌────────────────────────────────────────┐
│ Cargar figuritas                       │
│ Elige cómo deseas inicializar          │
│                                        │
│ [✏️ Manual Config] [📷 AI Scan]        │
│                                        │
│ ────────────────────────────────────── │
│                                        │
│ [Por Rango] [Lista Manual] [Grupos]   │
│                                        │
│ ► If "Por Rango" selected:            │
│   • Número inicial: [1]                │
│   • Número final: [50]                 │
│   • Prefijo: [Sticker]                 │
│   • Categoría: [Optional]              │
│                                        │
│ ► If "Lista Manual" selected:         │
│   • [Textarea with 1|Name|Cat format] │
│                                        │
│ ► If "Grupos" selected:               │
│   • [Textarea with t1-20, e1-40, etc.] │
│                                        │
│ 📊 Previsualizando: 50 figuritas       │
│ #1 Sticker 1                           │
│ #2 Sticker 2                           │
│ ...                                    │
│                                        │
│ [Atrás] [Create Album] →               │
└────────────────────────────────────────┘
```

**Features:**
- Real-time preview of stickers
- Shows total count + first 6 items
- Switch between 3 input modes
- Input validation with error messages

---

## Step 2b: AI Image Scanning

When the user selects **📷 AI Image Scanning**:

### Phase 1: Upload & Processing

```
┌────────────────────────────────────────┐
│ Cargar figuritas                       │
│ Elige cómo deseas inicializar          │
│                                        │
│ [✏️ Manual Config] [📷 AI Scan]        │
│                                        │
│ ────────────────────────────────────── │
│                                        │
│ Inicializar con foto de grilla         │
│ Carga una foto de la plantilla...      │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │  📷                              │   │
│ │  Selecciona una imagen           │   │
│ │  o arrastra aquí                 │   │
│ └──────────────────────────────────┘   │
│                                        │
│ [File Input for image upload]          │
│                                        │
│ [Cancel]                               │
└────────────────────────────────────────┘
```

### Phase 2: Scanning (Loading State)

Once an image is selected:

```
┌────────────────────────────────────────┐
│                                        │
│         ⏳                              │
│   Generando el catálogo del álbum,    │
│   por favor espera...                  │
│                                        │
│   (Calling Gemini API to detect       │
│    stickers, sections, and prefixes)  │
│                                        │
└────────────────────────────────────────┘
```

**Loading Message:**
- "⏳ Generando el catálogo del álbum, por favor espera..."
- Spinner animation
- User cannot interact with page during scan

### Phase 3: Results Review

If detection is successful:

```
┌────────────────────────────────────────┐
│                                        │
│ ✅ Estructura detectada                │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ T · 20 figuritas                 │   │
│ │ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10   │   │
│ ├──────────────────────────────────┤   │
│ │ E · 30 figuritas                 │   │
│ │ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10   │   │
│ ├──────────────────────────────────┤   │
│ │ (empty prefix) · 50 figuritas    │   │
│ │ 21, 22, 23, ...                  │   │
│ └──────────────────────────────────┘   │
│                                        │
│ [Cancelar] [Confirmar estructura →]    │
└────────────────────────────────────────┘
```

**Features:**
- Shows all detected sections with prefixes
- Displays count of stickers per section
- Lists first 10 numbers per section (if <= 10)
- "Cancelar" button to try another photo
- "Confirmar" button to proceed with creation

### Phase 4: Confirmation

Once confirmed, the system:
1. Converts detected sections to sticker drafts
2. Maintains prefix format in sticker names
3. Shows final form submission ready

---

## Error Handling

### Manual Mode Errors:
- ❌ "El álbum debe tener un título"
- ❌ "Debes definir al menos una figurita"

### AI Mode Errors:
- ❌ "Falta `VITE_GEMINI_API_KEY` en tus variables de entorno"
- ❌ "Falta albumId para procesar la imagen"
- ❌ "No se detectaron figuritas en la imagen. Intenta con otra foto."
- ❌ Generic error with Gemini API error message

---

## Technical Architecture

### Components

1. **`LoadMethodCard`** - Visual card for selecting manual vs AI
   - Props: `icon`, `title`, `description`, `selected`, `onClick`
   
2. **`RangeForm`** - Range-based input form
   - Props: `rangeStart`, `rangeEnd`, `rangePrefix`, `rangeCategory`, callbacks
   
3. **`AILoadForm`** - AI image scanning interface
   - Props: `albumTitle`, `isLoading`, `isScanning`, `detectedSections`, `scanError`, callbacks
   - File input with drag-and-drop hint
   - Loading spinner with message
   - Results preview before confirmation

### State Management

```typescript
// Step tracking
const [currentStep, setCurrentStep] = useState<'basic-info' | 'load-method'>('basic-info')

// Basic info
const [title, setTitle] = useState('')
const [description, setDescription] = useState('')
const [imageUrl, setImageUrl] = useState('')

// Load method selection
const [loadMethod, setLoadMethod] = useState<'manual' | 'ai'>('manual')

// Manual mode
const [inputMode, setInputMode] = useState<'range' | 'list' | 'groups'>('range')
const [rangeStart, rangeEnd, rangePrefix, rangeCategory] = ...
const [stickerListText, groupListText] = ...

// AI mode
const [isScanning, setIsScanning] = useState(false)
const [scanError, setScanError] = useState(null)
const [detectedSections, setDetectedSections] = useState([])
```

### Data Flow

```
CreateAlbumPage
├── Render Step 1 (basic-info)
│   ├── handleBasicInfoSubmit()
│   └── Advance to Step 2
│
└── Render Step 2 (load-method)
    ├── loadMethod === 'manual'
    │   ├── RangeForm
    │   ├── ListForm
    │   ├── GroupsForm
    │   └── stickerDrafts (useMemo)
    │
    └── loadMethod === 'ai'
        ├── AILoadForm
        ├── handleAIScan(file)
        │   ├── scanRepeatedStickers()
        │   │   └── supabase.functions.invoke('process-grid-image')
        │   │       └── Gemini API call
        │   └── Convert response to detectedSections
        ├── handleAIConfirm()
        ├── aiGeneratedDrafts (useMemo)
        └── handleLoadMethodSubmit()
            └── createAlbum(stickers)
```

### API Integration

**For AI Scanning:**
- Uses `supabase.functions.invoke('process-grid-image')`
- The Edge Function handles JWT authentication automatically
- Function expects: `{ image, albumTitle, validStickerNumbers, albumId }`
- Returns: `{ missing_by_prefix, rawText, model }`

**Converting Sections to Drafts:**
```typescript
const aiGeneratedDrafts = detectedSections.map((section) => ({
  sticker_number: seq++,
  name: `${section.prefix}${number}`,
  category_or_team: null
}))
```

---

## Styling (Tailwind CSS)

### Key Classes Used:
- `rounded-xl` / `rounded-lg` - Smooth borders
- `shadow-md` - Card shadows
- `border-2` - Thick borders for emphasis
- `bg-primary-50` / `bg-primary-600` - Primary colors
- `bg-green-50` / `bg-green-600` - Success states
- `bg-blue-50` - Loading states
- `bg-red-50` - Error states
- `focus:ring-2 focus:ring-primary-200` - Focus states
- `disabled:opacity-50` - Disabled states
- Grid responsive: `md:grid-cols-2`, `lg:grid-cols-[1.2fr_0.8fr]`

---

## User Experience Highlights

✨ **What Makes This Better:**
1. **Clear Step-by-Step Flow** - Users aren't overwhelmed by all options at once
2. **Visual Feedback** - Cards, colors, and loading states guide the user
3. **Live Preview** - Manual mode shows a live preview of what will be created
4. **AI Convenience** - Upload one photo and Gemini does the parsing work
5. **Confirmation Step** - Review AI results before creating the album
6. **Mobile Responsive** - Layouts adapt to small screens
7. **Accessibility** - Proper labels, alt text, and keyboard navigation

---

## Future Enhancements

- [ ] Drag-and-drop file upload for AI mode
- [ ] Preview of detected image for confirmation
- [ ] Ability to edit detected sections before confirming
- [ ] Batch upload multiple images for different sections
- [ ] OCR preview showing which numbers were detected
- [ ] Save incomplete albums as drafts
- [ ] Import from CSV or JSON format
