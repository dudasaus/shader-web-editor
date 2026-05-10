const SHADER_FILE_EXTENSION = '.frag'
const SHADER_FILE_TYPE = {
  description: 'GLSL fragment shaders',
  accept: {
    'text/plain': [SHADER_FILE_EXTENSION],
  },
}

let shaderDirectoryHandle: FileSystemDirectoryHandle | null = null

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  showOpenFilePicker?: (options?: {
    id?: string
    multiple?: boolean
    startIn?: FileSystemDirectoryHandle
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
    excludeAcceptAllOption?: boolean
  }) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: {
    id?: string
    startIn?: FileSystemDirectoryHandle
    suggestedName?: string
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
    excludeAcceptAllOption?: boolean
  }) => Promise<FileSystemFileHandle>
}

type SupportedPickerWindow = Window & {
  showDirectoryPicker: NonNullable<PickerWindow['showDirectoryPicker']>
  showOpenFilePicker: NonNullable<PickerWindow['showOpenFilePicker']>
  showSaveFilePicker: NonNullable<PickerWindow['showSaveFilePicker']>
}

function supportsFileSystemAccess() {
  if (typeof window === 'undefined') {
    return false
  }

  const pickerWindow = window as PickerWindow

  return (
    typeof pickerWindow.showDirectoryPicker === 'function' &&
    typeof pickerWindow.showOpenFilePicker === 'function' &&
    typeof pickerWindow.showSaveFilePicker === 'function'
  )
}

async function pickShaderDirectory() {
  const picker = (window as PickerWindow).showDirectoryPicker

  if (!picker) {
    throw new Error('This browser does not support the File System Access API.')
  }

  return picker({
    id: 'shader-directory',
    mode: 'readwrite',
  })
}

async function getShaderDirectory() {
  if (shaderDirectoryHandle) {
    return shaderDirectoryHandle
  }

  shaderDirectoryHandle = await pickShaderDirectory()
  return shaderDirectoryHandle
}

function getPickerWindow() {
  const pickerWindow = window as PickerWindow

  if (
    !pickerWindow.showDirectoryPicker ||
    !pickerWindow.showOpenFilePicker ||
    !pickerWindow.showSaveFilePicker
  ) {
    throw new Error('This browser does not support the File System Access API.')
  }

  return pickerWindow as SupportedPickerWindow
}

function withShaderExtension(name: string) {
  return name.endsWith(SHADER_FILE_EXTENSION) ? name : `${name}${SHADER_FILE_EXTENSION}`
}

export async function saveShader(source: string) {
  const directory = await getShaderDirectory()
  const pickerWindow = getPickerWindow()
  const fileHandle = await pickerWindow.showSaveFilePicker({
    id: 'shader-save-file',
    startIn: directory,
    suggestedName: 'shader.frag',
    types: [SHADER_FILE_TYPE],
    excludeAcceptAllOption: true,
  })
  const writable = await fileHandle.createWritable()
  await writable.write(source)
  await writable.close()

  return {
    directoryName: directory.name,
    fileName: withShaderExtension(fileHandle.name),
  }
}

export async function loadShader() {
  const directory = await getShaderDirectory()
  const pickerWindow = getPickerWindow()
  const [fileHandle] = await pickerWindow.showOpenFilePicker({
    id: 'shader-open-file',
    multiple: false,
    startIn: directory,
    types: [SHADER_FILE_TYPE],
    excludeAcceptAllOption: true,
  })
  const file = await fileHandle.getFile()

  return {
    directoryName: directory.name,
    fileName: file.name,
    source: await file.text(),
  }
}

export function getShaderDirectoryName() {
  return shaderDirectoryHandle?.name ?? ''
}

export { SHADER_FILE_EXTENSION, supportsFileSystemAccess }
